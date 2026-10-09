package com.eshop.atelier;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Rect;
import android.graphics.RectF;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.label.ImageLabel;
import com.google.mlkit.vision.label.ImageLabeler;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.tensorflow.lite.DataType;
import org.tensorflow.lite.Interpreter;
import org.tensorflow.lite.Tensor;

@CapacitorPlugin(name = "ProductVision")
public class ProductVisionPlugin extends Plugin {
    private static final int EMBEDDING_IMAGE_SIZE = 224;
    private static final String MODEL_NAME = "mobilenet_v3_small_100_224_feature_vector.tflite";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private Interpreter interpreter;
    private ImageLabeler imageLabeler;

    @Override
    protected void handleOnDestroy() {
        worker.shutdown();
        if (interpreter != null) interpreter.close();
        if (imageLabeler != null) imageLabeler.close();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void labelImage(PluginCall call) {
        String encodedImage = call.getString("imageBase64");
        if (encodedImage == null || encodedImage.isEmpty()) {
            call.reject("An image is required for category suggestions.");
            return;
        }
        worker.execute(() -> {
            try {
                Bitmap bitmap = decodeImage(encodedImage);
                ImageLabeler labeler = getImageLabeler();
                labeler.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener(labels -> {
                        bitmap.recycle();
                        call.resolve(toLabelResult(labels));
                    })
                    .addOnFailureListener(error -> {
                        bitmap.recycle();
                        call.reject("On-device image labeling failed.", error);
                    });
            } catch (Exception error) {
                call.reject("Could not prepare the image for labeling.", error);
            }
        });
    }

    @PluginMethod
    public void embedImage(PluginCall call) {
        String encodedImage = call.getString("imageBase64");
        if (encodedImage == null || encodedImage.isEmpty()) {
            call.reject("An image is required to create a product match profile.");
            return;
        }
        worker.execute(() -> {
            Bitmap source = null;
            try {
                source = decodeImage(encodedImage);
                float[] embedding = createEmbedding(source);
                byte[] quantized = quantize(embedding);
                JSObject result = new JSObject();
                result.put("dimensions", quantized.length);
                result.put("embedding", Base64.encodeToString(quantized, Base64.NO_WRAP));
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not create the product image match profile.", error);
            } finally {
                if (source != null && !source.isRecycled()) source.recycle();
            }
        });
    }

    private Bitmap decodeImage(String encodedImage) {
        if (encodedImage.length() > 3_000_000) {
            throw new IllegalArgumentException("The image is too large to analyze.");
        }
        byte[] bytes = Base64.decode(encodedImage, Base64.DEFAULT);
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            throw new IllegalArgumentException("The selected file is not a readable image.");
        }
        BitmapFactory.Options options = new BitmapFactory.Options();
        int longestSide = Math.max(bounds.outWidth, bounds.outHeight);
        options.inSampleSize = 1;
        while (longestSide / options.inSampleSize > 768) options.inSampleSize *= 2;
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        if (bitmap == null) throw new IllegalArgumentException("The selected image could not be decoded.");
        return bitmap;
    }

    private synchronized ImageLabeler getImageLabeler() {
        if (imageLabeler == null) {
            imageLabeler = ImageLabeling.getClient(
                new ImageLabelerOptions.Builder()
                    .setConfidenceThreshold(0.35f)
                    .build()
            );
        }
        return imageLabeler;
    }

    private JSObject toLabelResult(List<ImageLabel> labels) {
        JSArray results = new JSArray();
        for (ImageLabel label : labels) {
            JSObject item = new JSObject();
            item.put("text", label.getText());
            item.put("confidence", label.getConfidence());
            item.put("index", label.getIndex());
            results.put(item);
        }
        JSObject result = new JSObject();
        result.put("labels", results);
        return result;
    }

    private float[] createEmbedding(Bitmap source) throws Exception {
        Bitmap inputImage = centerCrop(source, EMBEDDING_IMAGE_SIZE);
        try {
            Interpreter model = getInterpreter();
            Tensor inputTensor = model.getInputTensor(0);
            int[] inputShape = inputTensor.shape();
            if (inputShape.length != 4 || inputShape[1] != EMBEDDING_IMAGE_SIZE
                || inputShape[2] != EMBEDDING_IMAGE_SIZE || inputShape[3] != 3) {
                throw new IllegalStateException("The bundled image model has an unsupported input shape.");
            }

            ByteBuffer input = createInputBuffer(inputTensor, inputImage);
            Tensor outputTensor = model.getOutputTensor(0);
            int outputSize = 1;
            for (int dimension : outputTensor.shape()) outputSize *= dimension;
            ByteBuffer output = ByteBuffer.allocateDirect(outputSize * bytesPerElement(outputTensor.dataType()))
                .order(ByteOrder.nativeOrder());
            model.run(input, output);
            output.rewind();
            float[] vector = new float[outputSize];
            readOutput(outputTensor, output, vector);
            float norm = 0;
            for (float value : vector) norm += value * value;
            norm = (float) Math.sqrt(norm);
            if (!Float.isFinite(norm) || norm == 0) {
                throw new IllegalStateException("The image model returned an invalid match profile.");
            }
            for (int index = 0; index < vector.length; index++) vector[index] /= norm;
            return vector;
        } finally {
            inputImage.recycle();
        }
    }

    private Interpreter getInterpreter() throws Exception {
        if (interpreter != null) return interpreter;
        File modelFile = new File(getContext().getFilesDir(), MODEL_NAME);
        if (!modelFile.isFile()) {
            try (InputStream input = getContext().getAssets().open("models/" + MODEL_NAME);
                 FileOutputStream output = new FileOutputStream(modelFile)) {
                byte[] buffer = new byte[16 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            }
        }
        Interpreter.Options options = new Interpreter.Options()
            .setNumThreads(Math.max(1, Math.min(4, Runtime.getRuntime().availableProcessors())));
        interpreter = new Interpreter(modelFile, options);
        return interpreter;
    }

    private ByteBuffer createInputBuffer(Tensor tensor, Bitmap image) {
        DataType type = tensor.dataType();
        int elementSize = bytesPerElement(type);
        ByteBuffer input = ByteBuffer.allocateDirect(EMBEDDING_IMAGE_SIZE * EMBEDDING_IMAGE_SIZE * 3 * elementSize)
            .order(ByteOrder.nativeOrder());
        int[] pixels = new int[EMBEDDING_IMAGE_SIZE * EMBEDDING_IMAGE_SIZE];
        image.getPixels(pixels, 0, EMBEDDING_IMAGE_SIZE, 0, 0, EMBEDDING_IMAGE_SIZE, EMBEDDING_IMAGE_SIZE);
        float scale = tensor.quantizationParams().getScale();
        int zeroPoint = tensor.quantizationParams().getZeroPoint();
        for (int pixel : pixels) {
            int[] channels = { (pixel >> 16) & 0xff, (pixel >> 8) & 0xff, pixel & 0xff };
            for (int channel : channels) {
                if (type == DataType.FLOAT32) {
                    input.putFloat(channel / 255f);
                } else if (type == DataType.UINT8) {
                    float realValue = scale > 0 && scale < 0.1f ? channel / 255f : channel;
                    int quantized = scale > 0 ? Math.round(realValue / scale) + zeroPoint : channel;
                    input.put((byte) Math.max(0, Math.min(255, quantized)));
                } else if (type == DataType.INT8) {
                    float realValue = channel / 255f;
                    int quantized = scale > 0 ? Math.round(realValue / scale) + zeroPoint : channel - 128;
                    input.put((byte) Math.max(-128, Math.min(127, quantized)));
                } else {
                    throw new IllegalStateException("The bundled image model has an unsupported input type.");
                }
            }
        }
        input.rewind();
        return input;
    }

    private void readOutput(Tensor tensor, ByteBuffer output, float[] vector) {
        DataType type = tensor.dataType();
        float scale = tensor.quantizationParams().getScale();
        int zeroPoint = tensor.quantizationParams().getZeroPoint();
        for (int index = 0; index < vector.length; index++) {
            if (type == DataType.FLOAT32) vector[index] = output.getFloat();
            else if (type == DataType.UINT8) vector[index] = ((output.get() & 0xff) - zeroPoint) * scale;
            else if (type == DataType.INT8) vector[index] = (output.get() - zeroPoint) * scale;
            else throw new IllegalStateException("The bundled image model has an unsupported output type.");
        }
    }

    private byte[] quantize(float[] vector) {
        byte[] result = new byte[vector.length];
        for (int index = 0; index < vector.length; index++) {
            result[index] = (byte) Math.max(-127, Math.min(127, Math.round(vector[index] * 127)));
        }
        return result;
    }

    private int bytesPerElement(DataType type) {
        if (type == DataType.FLOAT32) return 4;
        if (type == DataType.UINT8 || type == DataType.INT8) return 1;
        throw new IllegalStateException("The bundled image model has an unsupported tensor type.");
    }

    private Bitmap centerCrop(Bitmap source, int size) {
        int side = Math.min(source.getWidth(), source.getHeight());
        int left = (source.getWidth() - side) / 2;
        int top = (source.getHeight() - side) / 2;
        Bitmap result = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(result);
        canvas.drawBitmap(source, new Rect(left, top, left + side, top + side),
            new RectF(0, 0, size, size), null);
        return result;
    }
}
