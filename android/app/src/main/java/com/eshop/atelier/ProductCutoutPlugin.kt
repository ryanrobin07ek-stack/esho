package com.eshop.atelier

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.moduleinstall.InstallStatusListener
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusCodes
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withContext

@CapacitorPlugin(name = "ProductCutout")
class ProductCutoutPlugin : Plugin() {
    private val workerScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val processingMutex = Mutex()
    private var segmenter: SubjectSegmenter? = null

    @PluginMethod
    fun processVideo(call: PluginCall) {
        val path = call.getString("path")
        val count = call.getInt("count")
        val width = call.getInt("width")
        if (path.isNullOrBlank()) {
            call.reject("A video file path is required.")
            return
        }
        if (count == null || count !in 1..MAX_ITEMS) {
            call.reject("Frame count must be between 1 and $MAX_ITEMS.")
            return
        }
        if (width == null || width !in MIN_WIDTH..MAX_WIDTH) {
            call.reject("Output width must be between $MIN_WIDTH and $MAX_WIDTH pixels.")
            return
        }

        workerScope.launch {
            try {
                val result = processingMutex.withLock {
                    ensureModelReady(call)
                    extractAndCutoutVideo(path, count, width, call)
                }
                call.resolve(result)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                call.reject(readableError(error), error)
            }
        }
    }

    @PluginMethod
    fun cutoutImages(call: PluginCall) {
        val input = call.getArray("paths")
        val width = call.getInt("width")
        if (input == null || input.length() == 0) {
            call.reject("At least one image file path is required.")
            return
        }
        if (input.length() > MAX_ITEMS) {
            call.reject("A maximum of $MAX_ITEMS images can be processed at once.")
            return
        }
        if (width == null || width !in MIN_WIDTH..MAX_WIDTH) {
            call.reject("Output width must be between $MIN_WIDTH and $MAX_WIDTH pixels.")
            return
        }

        val paths = try {
            (0 until input.length()).map { index ->
                input.getString(index)?.takeIf(String::isNotBlank)
                    ?: throw IllegalArgumentException("Image path at position ${index + 1} is empty.")
            }
        } catch (error: Exception) {
            call.reject("The image path list is invalid.", error)
            return
        }

        workerScope.launch {
            try {
                val result = processingMutex.withLock {
                    ensureModelReady(call)
                    cutoutImagePaths(paths, width, call)
                }
                call.resolve(result)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                call.reject(readableError(error), error)
            }
        }
    }

    @PluginMethod
    fun persistVideo(call: PluginCall) {
        val path = call.getString("path")
        val extension = call.getString("extension")?.lowercase()
        if (path.isNullOrBlank()) {
            call.reject("A video file path is required.")
            return
        }
        if (extension !in setOf("mp4", "webm", "mov")) {
            call.reject("Video format must be MP4, WebM, or QuickTime.")
            return
        }

        workerScope.launch {
            val directory = File(context.filesDir, "product-media")
            val target = File(directory, "video-${UUID.randomUUID()}.$extension")
            try {
                if (!directory.exists() && !directory.mkdirs()) {
                    throw IOException("Could not create persistent media storage.")
                }
                openInput(parseUri(path)).use { input ->
                    FileOutputStream(target).use { output ->
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                        var totalBytes = 0L
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            totalBytes += count
                            if (totalBytes > MAX_VIDEO_BYTES) {
                                throw IllegalArgumentException("Videos must be smaller than 50 MB.")
                            }
                            output.write(buffer, 0, count)
                        }
                        if (totalBytes == 0L) {
                            throw IllegalArgumentException("The selected video is empty.")
                        }
                    }
                }
                call.resolve(JSObject().putValue("path", target.absolutePath))
            } catch (cancelled: CancellationException) {
                target.delete()
                throw cancelled
            } catch (error: Exception) {
                target.delete()
                call.reject(readableError(error), error)
            }
        }
    }

    override fun handleOnDestroy() {
        workerScope.cancel()
        segmenter?.close()
        segmenter = null
        super.handleOnDestroy()
    }

    private suspend fun ensureModelReady(call: PluginCall) {
        val playServicesStatus = GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(context)
        if (playServicesStatus != com.google.android.gms.common.ConnectionResult.SUCCESS) {
            throw IllegalStateException(
                "Google Play services is missing or out of date. Install or update it, then try again."
            )
        }

        val activeSegmenter = getSegmenter()
        val modules = ModuleInstall.getClient(context)
        if (!modules.areModulesAvailable(activeSegmenter).await().areModulesAvailable()) {
            val terminalUpdate = CompletableDeferred<ModuleInstallStatusUpdate>()
            val listener = InstallStatusListener { update ->
                sendModelProgress(call, update)
                if (update.installState == ModuleInstallStatusUpdate.InstallState.STATE_COMPLETED ||
                    update.installState == ModuleInstallStatusUpdate.InstallState.STATE_FAILED ||
                    update.installState == ModuleInstallStatusUpdate.InstallState.STATE_CANCELED) {
                    terminalUpdate.complete(update)
                }
            }
            val installRequest = ModuleInstallRequest.newBuilder()
                .addApi(activeSegmenter)
                .setListener(listener)
                .build()
            val installResponse = try {
                modules.installModules(installRequest).await()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                throw IllegalStateException(
                    "Google Play services could not start the background-removal model download: ${error.message ?: error.javaClass.simpleName}",
                    error
                )
            }
            if (!installResponse.areModulesAlreadyInstalled()) {
                val update = try {
                    withTimeout(MODEL_INSTALL_TIMEOUT_MS) { terminalUpdate.await() }
                } catch (timeout: TimeoutCancellationException) {
                    throw IllegalStateException(
                        "Google Play services has not finished downloading the background-removal model yet. Keep Craft open while the download completes, then retry.",
                        timeout
                    )
                } finally {
                    modules.unregisterListener(listener).await()
                }
                when (update.installState) {
                    ModuleInstallStatusUpdate.InstallState.STATE_FAILED ->
                        throw IllegalStateException(
                            "Google Play services failed to download the background-removal model (status ${ModuleInstallStatusCodes.getStatusCodeString(update.errorCode)})."
                        )
                    ModuleInstallStatusUpdate.InstallState.STATE_CANCELED ->
                        throw IllegalStateException("Google Play services canceled the background-removal model download.")
                    ModuleInstallStatusUpdate.InstallState.STATE_COMPLETED -> Unit
                }
            }
        }
        if (!modules.areModulesAvailable(activeSegmenter).await().areModulesAvailable()) {
            throw IllegalStateException(
                "Google Play services reported that the background-removal model finished downloading, but it is still unavailable. Reopen Craft and retry."
            )
        }
        try {
            activeSegmenter.initTask.await()
        } catch (error: Exception) {
            if (error is CancellationException) throw error
            activeSegmenter.close()
            segmenter = null
            val retrySegmenter = getSegmenter()
            try {
                retrySegmenter.initTask.await()
            } catch (retryError: Exception) {
                if (retryError is CancellationException) throw retryError
                retrySegmenter.close()
                segmenter = null
                throw IllegalStateException(
                    "The background-removal model is installed, but ML Kit could not initialize it: ${retryError.message ?: retryError.javaClass.simpleName}",
                    retryError
                )
            }
        }
    }

    private fun sendModelProgress(call: PluginCall, update: ModuleInstallStatusUpdate) {
        val progress = update.progressInfo
        val state = when (update.installState) {
            ModuleInstallStatusUpdate.InstallState.STATE_PENDING -> "pending"
            ModuleInstallStatusUpdate.InstallState.STATE_DOWNLOADING -> "downloading"
            ModuleInstallStatusUpdate.InstallState.STATE_DOWNLOAD_PAUSED -> "paused"
            ModuleInstallStatusUpdate.InstallState.STATE_INSTALLING -> "installing"
            ModuleInstallStatusUpdate.InstallState.STATE_COMPLETED -> "completed"
            ModuleInstallStatusUpdate.InstallState.STATE_FAILED -> "failed"
            ModuleInstallStatusUpdate.InstallState.STATE_CANCELED -> "canceled"
            else -> "preparing"
        }
        val event = JSObject()
            .putValue("phase", "model")
            .putValue("state", state)
        if (progress != null && progress.totalBytesToDownload > 0) {
            event.putValue(
                "done",
                (progress.bytesDownloaded * 100 / progress.totalBytesToDownload).toInt().coerceIn(0, 100)
            )
            event.putValue("total", 100)
        }
        notifyListeners("progress", event)
    }

    private fun getSegmenter(): SubjectSegmenter {
        segmenter?.let { return it }
        return SubjectSegmentation.getClient(
            SubjectSegmenterOptions.Builder()
                .enableForegroundBitmap()
                .build()
        ).also { segmenter = it }
    }

    private suspend fun extractAndCutoutVideo(
        path: String,
        count: Int,
        width: Int,
        call: PluginCall
    ): JSObject {
        val retriever = MediaMetadataRetriever()
        val outputPaths = JSArray()
        val outputDirectory = createOutputDirectory()
        var source: Bitmap? = null
        try {
            setVideoSource(retriever, path)
            val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull()
                ?: throw IllegalArgumentException("The selected video has no readable duration.")
            if (durationMs <= 0L) {
                throw IllegalArgumentException("The selected video is empty or unreadable.")
            }
            val durationUs = durationMs * 1000L

            for (index in 0 until count) {
                val timeUs = durationUs * index / count
                source = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
                    ?: throw IllegalArgumentException("Could not extract video frame ${index + 1}.")
                val output = cutout(source!!, width, outputDirectory, "frame-${index + 1}")
                outputPaths.put(output.absolutePath)
                source?.recycle()
                source = null
                sendProgress(call, index + 1, count)
            }
            return JSObject().putValue("frames", outputPaths)
        } catch (error: Exception) {
            deleteOutputDirectory(outputDirectory)
            throw error
        } finally {
            source?.recycle()
            retriever.release()
        }
    }

    private suspend fun cutoutImagePaths(
        paths: List<String>,
        width: Int,
        call: PluginCall
    ): JSObject {
        val outputPaths = JSArray()
        val outputDirectory = createOutputDirectory()
        var source: Bitmap? = null
        try {
            paths.forEachIndexed { index, path ->
                source = decodeImage(path, width)
                val output = cutout(source!!, width, outputDirectory, "image-${index + 1}")
                outputPaths.put(output.absolutePath)
                source?.recycle()
                source = null
                sendProgress(call, index + 1, paths.size)
            }
            return JSObject().putValue("images", outputPaths)
        } catch (error: Exception) {
            deleteOutputDirectory(outputDirectory)
            throw error
        } finally {
            source?.recycle()
        }
    }

    private suspend fun cutout(
        source: Bitmap,
        width: Int,
        outputDirectory: File,
        name: String
    ): File {
        val targetHeight = (source.height.toLong() * width / source.width)
            .coerceAtLeast(1L)
        if (targetHeight * width > MAX_OUTPUT_PIXELS) {
            throw IllegalArgumentException(
                "The requested output is too large to process safely. Use a smaller width."
            )
        }
        val resized = if (source.width == width) source else Bitmap.createScaledBitmap(
            source,
            width,
            targetHeight.toInt(),
            true
        )
        try {
            val result = getSegmenter().process(InputImage.fromBitmap(resized, 0)).await()
            val foreground = result.foregroundBitmap
                ?: throw IllegalStateException("ML Kit did not return a foreground image.")
            try {
                return saveTransparentBitmap(foreground, outputDirectory, name)
            } finally {
                if (!foreground.isRecycled) foreground.recycle()
            }
        } finally {
            if (resized !== source && !resized.isRecycled) resized.recycle()
        }
    }

    private fun decodeImage(path: String, width: Int): Bitmap {
        val uri = parseUri(path)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        openInput(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            throw IllegalArgumentException("The image path is unreadable: $path")
        }
        val targetHeight = bounds.outHeight.toLong() * width / bounds.outWidth
        if (targetHeight * width > MAX_OUTPUT_PIXELS) {
            throw IllegalArgumentException(
                "The requested output is too large to process safely. Use a smaller width."
            )
        }

        val options = BitmapFactory.Options().apply {
            inSampleSize = sampleSizeForWidth(bounds.outWidth, width)
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val bitmap = openInput(uri).use { BitmapFactory.decodeStream(it, null, options) }
            ?: throw IllegalArgumentException("Could not decode the image at: $path")
        return bitmap
    }

    private fun sampleSizeForWidth(sourceWidth: Int, targetWidth: Int): Int {
        var sampleSize = 1
        while (sourceWidth / (sampleSize * 2) >= targetWidth) sampleSize *= 2
        return sampleSize
    }

    private fun saveTransparentBitmap(bitmap: Bitmap, directory: File, name: String): File {
        val webp = File(directory, "$name.webp")
        try {
            FileOutputStream(webp).use { output ->
                val format = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    Bitmap.CompressFormat.WEBP_LOSSLESS
                } else {
                    @Suppress("DEPRECATION")
                    Bitmap.CompressFormat.WEBP
                }
                if (bitmap.compress(format, 100, output)) return webp
            }
        } catch (_: RuntimeException) {
            // Retry as PNG below.
        } catch (_: IOException) {
        }
        webp.delete()

        val png = File(directory, "$name.png")
        FileOutputStream(png).use { output ->
            if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                throw IOException("Could not encode the transparent image.")
            }
        }
        return png
    }

    private suspend fun sendProgress(call: PluginCall, done: Int, total: Int) {
        withContext(Dispatchers.Main.immediate) {
            notifyListeners(
                "progress",
                JSObject().putValue("phase", "frames").putValue("done", done).putValue("total", total)
            )
        }
    }

    private fun setVideoSource(retriever: MediaMetadataRetriever, path: String) {
        val uri = parseUri(path)
        try {
            if (uri.scheme == "content") {
                retriever.setDataSource(context, uri)
            } else {
                val filePath = if (uri.scheme == "file") uri.path else path
                if (filePath.isNullOrBlank() || !File(filePath).isFile) {
                    throw IllegalArgumentException("The video path does not point to a readable file.")
                }
                retriever.setDataSource(filePath)
            }
        } catch (error: IllegalArgumentException) {
            throw error
        } catch (error: RuntimeException) {
            throw IllegalArgumentException("Could not open the video. Check that the path is readable.", error)
        }
    }

    private fun parseUri(path: String): Uri {
        val uri = Uri.parse(path)
        return if (uri.scheme.isNullOrEmpty()) Uri.fromFile(File(path)) else uri
    }

    private fun openInput(uri: Uri) =
        if (uri.scheme == "content") {
            context.contentResolver.openInputStream(uri)
                ?: throw IOException("Could not open the selected file.")
        } else {
            val path = if (uri.scheme == "file") uri.path else uri.toString()
            val file = File(path ?: throw IOException("The selected file path is invalid."))
            if (!file.isFile || !file.canRead()) {
                throw IllegalArgumentException("The image path does not point to a readable file.")
            }
            file.inputStream()
        }

    private fun createOutputDirectory(): File {
        val directory = File(context.filesDir, "product-cutout/${UUID.randomUUID()}")
        if (!directory.mkdirs()) {
            throw IOException("Could not create the temporary output folder.")
        }
        return directory
    }

    private fun deleteOutputDirectory(directory: File) {
        directory.listFiles()?.forEach(File::delete)
        directory.delete()
    }

    private fun readableError(error: Exception): String = when (error) {
        is IllegalArgumentException, is IllegalStateException -> error.message ?: "Image processing failed."
        else -> "Product background removal failed: ${error.localizedMessage ?: error.javaClass.simpleName}"
    }

    private fun JSObject.putValue(key: String, value: Any): JSObject {
        put(key, value)
        return this
    }

    companion object {
        private const val MIN_WIDTH = 64
        private const val MAX_WIDTH = 4096
        private const val MAX_ITEMS = 120
        private const val MAX_OUTPUT_PIXELS = 12_000_000L
        private const val MAX_VIDEO_BYTES = 50_000_000L
        private const val MODEL_INSTALL_TIMEOUT_MS = 600_000L
    }
}
