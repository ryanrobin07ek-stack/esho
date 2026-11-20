// Product photos: read, capture and prepare images, and build the image embedding used for photo matching.
import { listProducts, saveProduct } from './products.js';

export function createProductPhotos({ queueProduct, loadState, toast }) {
  async function readImageFile(file) {
    if (!file) return '';
    if (!window.AppUtils?.compressImageFile) {
      throw new Error('Image compression is not available in this app session.');
    }
    return window.AppUtils.compressImageFile(file, { maxDimension: 1800, maxBytes: 900_000 });
  }

  async function getProductVision() {
    const { ProductVision } = await import('../product-vision.js');
    return { plugin: ProductVision };
  }

  async function createProductImageEmbedding(productId, imageUri) {
    try {
      const imageBase64 = await prepareImageForVision(imageUri);
      const { plugin: vision } = await getProductVision();
      const profile = await vision.embedImage({ imageBase64 });
      const imageEmbeddingHex = embeddingBase64ToHex(profile.embedding, Number(profile.dimensions));
      const product = (await listProducts()).find((item) => item.id === productId);
      if (!product || product.imageUri !== imageUri) return;
      await saveProduct({ ...product, imageEmbeddingHex });
      const updated = (await listProducts()).find((item) => item.id === productId);
      if (updated) await queueProduct(updated);
      await loadState();
      return true;
    } catch (error) {
      toast(`Product saved. Photo matching is unavailable: ${error instanceof Error ? error.message : 'image profile failed'}`, true);
      return false;
    }
  }

  async function prepareImageForVision(dataUrl, size = 512) {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error('Choose a readable product photo.');
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not prepare the product photo for recognition.');
    context.drawImage(image,
      (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side,
      0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
  }

  async function captureProductPhoto() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This device does not provide an in-app camera preview. Upload a product photo instead.');
    }
    const overlay = document.createElement('div');
    overlay.className = 'pos-scanner-overlay';
    overlay.innerHTML = `<section class="pos-scanner-shell" role="dialog" aria-modal="true" aria-label="Take product photo">
      <video class="pos-scanner-video" autoplay muted playsinline></video>
      <div class="pos-scanner-header"><h2>Take product photo</h2>
        <p>Center one product in the frame, then capture. The photo stays on this device.</p></div>
      <div class="pos-scanner-frame" aria-hidden="true"></div>
      <div class="pos-scanner-footer">
        <p class="pos-scanner-status" data-product-photo-status role="status" aria-live="polite">Starting camera…</p>
        <button type="button" class="pos-scanner-mode" data-product-photo-capture disabled>Capture photo</button>
        <button type="button" class="pos-scanner-close" data-product-photo-cancel>Cancel</button>
      </div>
    </section>`;
    document.body.appendChild(overlay);
    const video = overlay.querySelector('video');
    const status = overlay.querySelector('[data-product-photo-status]');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = stream;
      await video.play();
      const image = await new Promise((resolve, reject) => {
        const finish = (value) => {
          overlay.remove();
          resolve(value);
        };
        overlay.querySelector('[data-product-photo-cancel]').addEventListener('click', () => finish(''), { once: true });
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) finish('');
        }, { once: true });
        const capture = overlay.querySelector('[data-product-photo-capture]');
        capture.disabled = false;
        capture.addEventListener('click', () => {
          try {
            const side = Math.min(video.videoWidth, video.videoHeight);
            if (!side) throw new Error('The camera is not ready yet. Try again in a moment.');
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const context = canvas.getContext('2d', { alpha: false });
            if (!context) throw new Error('Could not prepare this product photo.');
            context.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2,
              side, side, 0, 0, canvas.width, canvas.height);
            finish(canvas.toDataURL('image/jpeg', 0.82));
          } catch (error) {
            status.textContent = error instanceof Error ? error.message : 'Could not capture this photo.';
          }
        });
        status.textContent = 'Camera ready · frame the product, then capture.';
      });
      return image;
    } catch (error) {
      throw new Error(`Could not start product camera: ${error instanceof Error ? error.message : 'camera unavailable'}`);
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      overlay.remove();
    }
  }

  function captureVideoFrameForVision(video, size = 512) {
    if (!video.videoWidth || !video.videoHeight) throw new Error('The camera is not ready yet. Try again in a moment.');
    const side = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not prepare a camera frame for image matching.');
    context.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
  }

  function embeddingBase64ToHex(encoded, dimensions) {
    if (typeof encoded !== 'string' || !Number.isSafeInteger(dimensions) || dimensions < 64 || dimensions > 2048) {
      throw new Error('The on-device image model returned an invalid match profile.');
    }
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    if (bytes.length !== dimensions) throw new Error('The on-device image model returned an incomplete match profile.');
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return {
    readImageFile, getProductVision, createProductImageEmbedding, prepareImageForVision,
    captureProductPhoto, captureVideoFrameForVision, embeddingBase64ToHex
  };
}
