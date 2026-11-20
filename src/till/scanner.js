// The barcode / QR / label / photo scanner: open it, handle what it reads, add the product to the sale.
import { rows } from './db.js';
import { escapeHtml, fromCents } from './format.js';
import { classifyQrCode } from './product-matching.js';

export function createTillScanner({
  toast, state, updateCartPanel, scanLabelFrames, scanPhotoMatchFrames
}) {
  let barcodeScanner = null;

  async function findProductByCode(code) {
    const normalized = String(code || '').trim();
    if (!normalized || normalized.length > 120) return null;
    const matches = await rows(`SELECT id,name,sku,barcode,price_cents,active FROM pos_products
      WHERE barcode=? COLLATE NOCASE OR sku=? COLLATE NOCASE LIMIT 2`, [normalized, normalized]);
    if (matches.length > 1) throw new Error('This code matches more than one product. Fix duplicate barcodes or SKUs in the catalogue.');
    return matches[0] || null;
  }

  async function addScannedBarcode(code) {
    const value = String(code || '').trim();
    if (!value || value.length > 120) throw new Error('This barcode is too long to save as a product code.');
    const product = await findProductByCode(value);
    if (!product) {
      toast(`No product found for ${value}.`, true);
      if (confirm(`No product matches ${value}. Add a new product with this barcode?`)) {
        window.location.hash = `#/pos/catalogue/products?new=1&barcode=${encodeURIComponent(value)}`;
        return { captured: true };
      }
      return false;
    }
    if (!product.active) throw new Error('This product is disabled and cannot be added to a sale.');
    return addProductToSale(product);
  }

  async function addProductToSale(product, closeScanner = false) {
    if (!product?.active) throw new Error('This product is disabled and cannot be added to a sale.');
    const productId = Number(product.id);
    const unitPrice = product.price_cents == null ? Number(product.price) : fromCents(product.price_cents);
    if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('This product has an invalid saved price. Edit it in Catalogue before adding it to a sale.');
    }
    const cartItem = state.cart.find((item) => item.productId === productId);
    if (cartItem) cartItem.quantity = Math.min(99999, cartItem.quantity + 1);
    else state.cart.push({
      productId, name: product.name, quantity: 1, unitPrice
    });
    if (closeScanner) await barcodeScanner?.close();
    updateCartPanel();
    toast(`${product.name} added to this sale.`);
    return { added: true, name: product.name, closeScanner };
  }

  function showQrDetails(rawValue) {
    const qr = classifyQrCode(rawValue);
    const overlay = document.createElement('div');
    overlay.className = 'pos-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#0009;display:grid;place-items:center;padding:16px';
    const link = qr.type === 'link' ? `<p><a href="${escapeHtml(qr.content)}" target="_blank" rel="noopener noreferrer">Open link</a></p>` : '';
    overlay.innerHTML = `<section class="pos-card" role="dialog" aria-modal="true" aria-label="QR code result"
      style="width:min(100%,520px);max-height:90vh;overflow:auto;background:#fff;color:#18181b;padding:20px;border-radius:16px">
      <h2>${escapeHtml(qr.label)}</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(qr.content)}</pre>
      ${link}<button type="button" class="btn-secondary" data-qr-close>Close</button></section>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-qr-close]').addEventListener('click', close, { once: true });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
  }

  async function openBarcodeScanner(onBarcode, { allowProductLabel = false, productForm = null, initialMode = 'barcode' } = {}) {
    if (barcodeScanner) await barcodeScanner.close();
    const overlay = document.createElement('div');
    overlay.className = 'pos-scanner-overlay';
    overlay.innerHTML = `<section class="pos-scanner-shell" role="dialog" aria-modal="true" aria-label="Scan barcode or product label">
      <video class="pos-scanner-video" autoplay muted playsinline></video>
      <div class="pos-scanner-header"><h2 data-scanner-title>Scan barcode or QR code</h2>
        <p data-scanner-instructions>Center the code in the frame. Barcodes add products; QR codes show their contents.</p></div>
      <div class="pos-scanner-frame" aria-hidden="true"></div>
      <div class="pos-scanner-footer"><p class="pos-scanner-status" data-scanner-status role="status" aria-live="polite">Starting camera…</p>
        ${allowProductLabel ? `<div class="pos-scanner-modes" role="group" aria-label="Camera scan mode">
          <button type="button" class="pos-scanner-mode is-active" data-scanner-mode="barcode" aria-pressed="true">Barcode / QR</button>
          <button type="button" class="pos-scanner-mode" data-scanner-mode="label" aria-pressed="false">Product label</button>
          ${!productForm ? '<button type="button" class="pos-scanner-mode" data-scanner-mode="match" aria-pressed="false">Photo match</button>' : ''}
        </div>` : ''}
        <div class="pos-scanner-label-result" data-scanner-label-result hidden></div>
        <button type="button" class="pos-scanner-close" data-scanner-close>Cancel scan</button></div>
    </section>`;
    document.body.appendChild(overlay);
    const video = overlay.querySelector('video');
    const status = overlay.querySelector('[data-scanner-status]');
    const session = {
      closed: false, controls: null, stream: null, mode: initialMode, ocrBusy: false, imageMatchBusy: false,
      processingCode: false, labelFramesScanned: 0, failedImageProfiles: new Set(),
      lastOcrText: '', stableOcrFrames: 0, candidate: null, close: null
    };
    session.close = async () => {
      if (session.closed) return;
      session.closed = true;
      try {
        session.controls?.stop();
        (session.stream || video.srcObject)?.getTracks().forEach((track) => track.stop());
      } finally {
        overlay.remove();
        if (barcodeScanner === session) barcodeScanner = null;
      }
    };
    barcodeScanner = session;
    overlay.querySelector('[data-scanner-close]').addEventListener('click', () => {
      void session.close().catch((error) => toast(error instanceof Error ? error.message : 'Could not stop the scanner.', true));
    }, { once: true });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        void session.close().catch((error) => toast(error instanceof Error ? error.message : 'Could not stop the scanner.', true));
      }
    });
    if (allowProductLabel) {
      overlay.querySelectorAll('[data-scanner-mode]').forEach((button) => {
        const selected = button.dataset.scannerMode === session.mode;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
        button.addEventListener('click', () => {
          session.mode = button.dataset.scannerMode;
          overlay.querySelectorAll('[data-scanner-mode]').forEach((modeButton) => {
            const selected = modeButton === button;
            modeButton.classList.toggle('is-active', selected);
            modeButton.setAttribute('aria-pressed', String(selected));
          });
          overlay.querySelector('[data-scanner-title]').textContent =
            session.mode === 'label' ? 'Scan product label'
              : session.mode === 'match' ? 'Find a product by photo' : 'Scan barcode or QR code';
          overlay.querySelector('[data-scanner-instructions]').textContent = session.mode === 'label'
            ? 'Hold the label steady in the frame. Text is read on this device.'
            : session.mode === 'match'
            ? 'Point at one product. Matching starts automatically; tap a result to add it.'
            : 'Center the code in the frame. Barcodes add products; QR codes show their contents.';
          overlay.querySelector('[data-scanner-label-result]').hidden = true;
          session.candidate = null;
          session.lastOcrText = '';
          session.stableOcrFrames = 0;
          session.labelFramesScanned = 0;
          status.textContent = session.mode === 'label'
            ? 'Looking for clear label text…' : session.mode === 'match'
            ? 'Camera ready · automatically scanning product photos…' : 'Camera ready · hold a code inside the frame.';
        });
      });
      overlay.querySelector('[data-scanner-title]').textContent =
        session.mode === 'label' ? 'Scan product label'
          : session.mode === 'match' ? 'Find a product by photo' : 'Scan barcode or QR code';
      overlay.querySelector('[data-scanner-instructions]').textContent = session.mode === 'label'
        ? 'Hold the label steady in the frame. Text is read on this device.'
        : session.mode === 'match'
        ? 'Point at one product. Matching starts automatically; tap a result to add it.'
        : 'Center the code in the frame. Barcodes add products; QR codes show their contents.';
    }
    const handleDetected = async (barcode) => {
      if (session.closed) return;
      const value = String(barcode?.rawValue || barcode?.displayValue || '').trim();
      if (!value) return;
      const now = Date.now();
      const lastSeen = barcodeScannerLastSeen.get(value) || 0;
      barcodeScannerLastSeen.set(value, now);
      if (now - lastSeen < 1400) return;
      if (session.processingCode) return;
      if (barcodeScannerLastSeen.size > 200) {
        for (const [seenCode, seenAt] of barcodeScannerLastSeen) {
          if (now - seenAt > 60_000) barcodeScannerLastSeen.delete(seenCode);
        }
      }
      if (barcode.format === 'QR_CODE') {
        if (!productForm) {
          await session.close();
          showQrDetails(value);
          return;
        }
        session.processingCode = true;
        try {
          const result = await onBarcode(value);
          if (result?.captured || result?.closeScanner) await session.close();
        } catch (error) {
          if (!session.closed) {
            status.textContent = error instanceof Error ? error.message : 'Could not process this QR code.';
            status.dataset.state = 'error';
          }
        } finally {
          session.processingCode = false;
        }
        return;
      }
      if (barcode.format && !['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128'].includes(barcode.format)) return;
      session.processingCode = true;
      try {
        const result = await onBarcode(value);
        if (session.closed) return;
        status.textContent = result?.captured
          ? 'Barcode captured successfully.'
          : result?.added
          ? `Added ${result.name}. Scan the next item.`
          : 'Barcode not found. You can add it as a new product.';
        status.dataset.state = result?.captured || result?.added ? 'success' : 'notice';
        if (result?.captured || result?.closeScanner) await session.close();
      } catch (error) {
        if (!session.closed) {
          status.textContent = error instanceof Error ? error.message : 'Could not process this barcode.';
          status.dataset.state = 'error';
        }
      } finally {
        session.processingCode = false;
      }
    };
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This device does not provide an in-app camera preview.');
      session.stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = session.stream;
      await video.play();
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const { BarcodeFormat: ZXingBarcodeFormat } = await import('@zxing/library');
      const formatMap = new Map([
        [ZXingBarcodeFormat.QR_CODE, 'QR_CODE'],
        [ZXingBarcodeFormat.EAN_13, 'EAN_13'],
        [ZXingBarcodeFormat.EAN_8, 'EAN_8'],
        [ZXingBarcodeFormat.UPC_A, 'UPC_A'],
        [ZXingBarcodeFormat.UPC_E, 'UPC_E'],
        [ZXingBarcodeFormat.CODE_128, 'CODE_128']
      ]);
      const reader = new BrowserMultiFormatReader();
      session.controls = await reader.decodeFromVideoElement(video, (result, error) => {
        if (session.mode !== 'barcode') return;
        if (result) {
          void handleDetected({
            rawValue: result.getText(),
            displayValue: result.getText(),
            format: formatMap.get(result.getBarcodeFormat())
          });
        } else if (error && error.name !== 'NotFoundException') {
          status.textContent = 'Keep the code inside the camera view.';
        }
      });
      status.textContent = session.mode === 'label'
        ? 'Looking for clear label text…'
        : session.mode === 'match'
        ? 'Camera ready · automatically scanning product photos…'
        : 'Camera ready · center a code inside the frame.';
      if (allowProductLabel) void scanLabelFrames(session, video, overlay, status, productForm);
      if (allowProductLabel && !productForm) void scanPhotoMatchFrames(session, video, overlay, status);
    } catch (error) {
      await session.close();
      const message = error instanceof Error ? error.message : 'Camera scanning could not start.';
      throw new Error(`Could not start barcode scanning: ${message}`);
    }
  }

  const barcodeScannerLastSeen = new Map();

  async function handleScannerKeydown(event) {
    const input = event.target.closest('[data-pos-barcode-input]');
    if (!input || event.key !== 'Enter') return;
    event.preventDefault();
    const code = input.value.trim();
    input.value = '';
    if (!code) return;
    try {
      await addScannedBarcode(code);
      document.querySelector?.('[data-pos-barcode-input]')?.focus();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not add the scanned product.', true);
    }
  }

  return {
    findProductByCode, addScannedBarcode, addProductToSale, openBarcodeScanner,
    handleScannerKeydown, get barcodeScanner() { return barcodeScanner; }
  };
}
