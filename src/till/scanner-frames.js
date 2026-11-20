// Scanner frame loops: match a product by photo, read a product label, show label suggestions.
import { escapeHtml, money } from './format.js';
import { matchProductLabel, parseProductLabel, rankImageMatches } from './product-matching.js';
import { listProducts, saveProduct } from './products.js';

export function createScannerFrames({
  captureVideoFrameForVision, getProductVision, embeddingBase64ToHex, state,
  createProductImageEmbedding, addProductToSale, queueProduct, refresh, toast
}) {
  async function scanPhotoMatchFrames(session, video, overlay, status) {
    let lastProcessedAt = 0;
    while (!session.closed) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      const resultPanel = overlay.querySelector('[data-scanner-label-result]');
      if (session.closed || session.mode !== 'match' || session.imageMatchBusy || session.processingCode
        || video.readyState < 2 || (resultPanel && !resultPanel.hidden)
        || Date.now() - lastProcessedAt < 550) continue;
      lastProcessedAt = Date.now();
      session.imageMatchBusy = true;
      try {
        status.textContent = 'Recognizing product…';
        const imageBase64 = captureVideoFrameForVision(video, 256);
        const { plugin: vision } = await getProductVision();
        const result = await vision.embedImage({ imageBase64 });
        const profileHex = embeddingBase64ToHex(result.embedding, Number(result.dimensions));
        const embedding = Int8Array.from(profileHex.match(/.{2}/g), (byte) => {
          const value = Number.parseInt(byte, 16);
          return value > 127 ? value - 256 : value;
        });
        const products = state.products.filter((product) => product.active);
        const matches = rankImageMatches(products, embedding);
        if (!matches.length) {
          const missingProfile = products.find((product) => !product.imageEmbedding?.length
            && !session.failedImageProfiles.has(product.id) && /^data:image\//i.test(product.imageUri || ''));
          if (missingProfile) {
            status.textContent = `Preparing saved photos · ${missingProfile.name}…`;
            if (!await createProductImageEmbedding(missingProfile.id, missingProfile.imageUri)) {
              session.failedImageProfiles.add(missingProfile.id);
            }
            continue;
          }
          const savedProfiles = products.filter((product) => product.imageEmbedding?.length).length;
          status.textContent = savedProfiles
            ? 'No close match yet · keep the product centered while scanning continues.'
            : products.some((product) => product.imageUri)
              ? 'Saved photos could not be prepared. Retake the photos or use barcode scanning.'
              : 'No saved product photos yet · take and save photos in Catalogue first.';
          status.dataset.state = savedProfiles || products.some((product) => product.imageUri) ? 'notice' : 'error';
          continue;
        }
        resultPanel.innerHTML = `<strong>Choose a product</strong>${matches.map(({ product, similarity }) => `
          <button type="button" class="pos-image-match" data-image-match="${escapeHtml(product.id)}">
            ${product.imageUri ? `<img src="${escapeHtml(product.imageUri)}" alt="">` : ''}
            <span><b>${escapeHtml(product.name)}</b><small>${Math.round(similarity * 100)}% photo similarity · ${escapeHtml(product.categoryName)}</small></span>
            <b>${money(product.price, state.settings.currency)}</b>
          </button>`).join('')}
          <button type="button" class="pos-scanner-close pos-scanner-rescan" data-match-none>None of these · keep scanning</button>`;
        resultPanel.hidden = false;
        status.textContent = 'Possible matches found. Tap the correct product to add it.';
        status.dataset.state = 'success';
        resultPanel.querySelectorAll('[data-image-match]').forEach((button) => {
          button.addEventListener('click', async () => {
            const product = state.products.find((item) => String(item.id) === button.dataset.imageMatch && item.active);
            if (!product) {
              status.textContent = 'That product is no longer available. Keep scanning.';
              status.dataset.state = 'error';
              resultPanel.hidden = true;
              return;
            }
            try {
              await addProductToSale(product, true);
            } catch (error) {
              status.textContent = error instanceof Error ? error.message : 'Could not add this product.';
              status.dataset.state = 'error';
            }
          }, { once: true });
        });
        resultPanel.querySelector('[data-match-none]').addEventListener('click', () => {
          resultPanel.hidden = true;
          status.textContent = 'Keep the next product centered · scanning automatically.';
          delete status.dataset.state;
        }, { once: true });
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Could not scan the product photo.';
        status.dataset.state = 'error';
      } finally {
        session.imageMatchBusy = false;
      }
    }
  }

  async function scanLabelFrames(session, video, overlay, status, productForm) {
    let savedProducts = [];
    let Filesystem, Directory, TextRecognition, Script;
    try {
      if (!productForm) savedProducts = (await listProducts()).filter((product) => product.active);
      [{ Filesystem, Directory }, { TextRecognition, Script }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor-mlkit/text-recognition')
      ]);
    } catch (error) {
      status.textContent = error instanceof Error ? `Label scan failed: ${error.message}` : 'Label scan failed.';
      status.dataset.state = 'error';
      return;
    }
    let lastProcessedAt = 0;
    while (!session.closed) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (session.closed || session.mode !== 'label' || session.ocrBusy || video.readyState < 2
        || Date.now() - lastProcessedAt < 700) continue;
      const resultPanel = overlay.querySelector('[data-scanner-label-result]');
      if (resultPanel && !resultPanel.hidden) continue;
      lastProcessedAt = Date.now();
      session.ocrBusy = true;
      let framePath = '';
      try {
        const maxWidth = 960;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Could not prepare a camera frame for label reading.');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameData = canvas.toDataURL('image/jpeg', 0.78).split(',')[1];
        const frame = await Filesystem.writeFile({
          path: `label-scan-${Date.now()}.jpg`, data: frameData, directory: Directory.Cache
        });
        framePath = frame.uri;
        const result = await TextRecognition.processImage({ path: framePath, script: Script.Latin });
        const text = String(result.text || '').trim();
        if (!text) {
          status.textContent = 'Keep the label steady and in focus…';
          continue;
        }
        session.labelFramesScanned += 1;
        if (text === session.lastOcrText) session.stableOcrFrames += 1;
        else {
          session.lastOcrText = text;
          session.stableOcrFrames = 1;
        }
        const suggestions = parseProductLabel(text);
        if (!productForm) {
          const product = matchProductLabel(text, savedProducts);
          if (product) {
            await addProductToSale(product, true);
            continue;
          }
          if (session.labelFramesScanned >= 4) {
            const resultPanel = overlay.querySelector('[data-scanner-label-result]');
            resultPanel.innerHTML = `<strong>No saved product matched this label</strong>
              <p>Save this product in Catalogue first, then scan its label here.</p>
              <button type="button" class="pos-scanner-close pos-scanner-rescan" data-label-rescan>Scan again</button>`;
            resultPanel.hidden = false;
            status.textContent = 'No saved product matched. Nothing was added to the sale.';
            status.dataset.state = 'notice';
            resultPanel.querySelector('[data-label-rescan]').addEventListener('click', () => {
              session.candidate = null;
              session.lastOcrText = '';
              session.stableOcrFrames = 0;
              session.labelFramesScanned = 0;
              resultPanel.hidden = true;
              status.textContent = 'Looking for a saved product…';
              delete status.dataset.state;
            }, { once: true });
          } else {
            status.textContent = 'Reading label…';
          }
        } else if (session.stableOcrFrames >= 2 && suggestions.name) {
          session.candidate = { text, suggestions };
          showLabelSuggestions(session, overlay, status, productForm);
        } else {
          status.textContent = 'Reading label… hold it steady for a moment.';
        }
      } catch (error) {
        status.textContent = error instanceof Error ? `Label scan failed: ${error.message}` : 'Label scan failed.';
        status.dataset.state = 'error';
      } finally {
        if (framePath) {
          await Filesystem.deleteFile({ path: framePath }).catch((error) => {
            console.warn('Could not remove temporary label-scan frame.', error);
          });
        }
        session.ocrBusy = false;
      }
    }
  }

  function showLabelSuggestions(session, overlay, status, productForm) {
    const result = overlay.querySelector('[data-scanner-label-result]');
    const { text, suggestions } = session.candidate;
    result.innerHTML = productForm
      ? `<strong>Product name found</strong><p>${escapeHtml(suggestions.name || '')}</p>
        <button type="button" class="pos-scanner-close pos-scanner-rescan" data-label-rescan>Scan again</button>
        <button type="button" class="pos-scanner-close pos-scanner-confirm" data-label-confirm>Use details</button>`
      : `<strong>Label read · check these details</strong>
        <label>Name<input data-label-name value="${escapeHtml(suggestions.name || '')}" maxlength="200"></label>
        <label>Price<input data-label-price type="number" min="0" step="0.01" value="${suggestions.price ?? ''}"></label>
        <label>Expiry date<input data-label-expiry type="date" value="${escapeHtml(suggestions.expiryDate || '')}"></label>
        <details><summary>Recognized text</summary><pre>${escapeHtml(text.slice(0, 1600))}</pre></details>
        <button type="button" class="pos-scanner-close pos-scanner-rescan" data-label-rescan>Scan another label</button>
        <button type="button" class="pos-scanner-close pos-scanner-confirm" data-label-confirm>Add product to sale</button>`;
    result.hidden = false;
    status.textContent = 'Label scanned successfully.';
    status.dataset.state = 'success';
    result.querySelector('[data-label-rescan]').addEventListener('click', () => {
      session.candidate = null;
      session.lastOcrText = '';
      session.stableOcrFrames = 0;
      result.hidden = true;
      status.textContent = 'Looking for clear label text…';
      delete status.dataset.state;
    }, { once: true });
    result.querySelector('[data-label-confirm]').addEventListener('click', async () => {
      if (productForm) {
        const name = String(session.candidate?.suggestions.name || '').trim();
        if (!name) {
          status.textContent = 'No product name was recognized. Scan again or enter it manually.';
          status.dataset.state = 'error';
          return;
        }
        productForm.elements.name.value = name;
        const nameStatus = productForm.querySelector('[data-product-ocr-status]');
        if (nameStatus) nameStatus.textContent = 'Product name filled from the label. Enter the remaining details below.';
        await session.close();
        return;
      }
      const data = {
        name: result.querySelector('[data-label-name]').value.trim(),
        price: result.querySelector('[data-label-price]').value,
        expiryDate: result.querySelector('[data-label-expiry]').value
      };
      try {
        if (!data.name || data.price === '' || !Number.isFinite(Number(data.price)) || Number(data.price) < 0) {
          throw new Error('Check that the product name and price are valid before adding it.');
        }
        const categoryId = state.categories.find((category) => category.name.toLowerCase() === 'general')?.id
          || state.categories[0]?.id;
        if (!categoryId) throw new Error('Create a product category before adding a scanned label.');
        const productId = await saveProduct({
          name: data.name, price: data.price, expiryDate: data.expiryDate, categoryId,
          stock: '', buyingPrice: '', lowStockThreshold: 3, active: true
        });
        const product = (await listProducts()).find((item) => item.id === productId);
        if (!product) throw new Error('The product was saved but could not be loaded into this sale.');
        await queueProduct(product);
        state.cart.push({ productId, name: product.name, quantity: 1, unitPrice: product.price });
        await session.close();
        await refresh();
        toast(`${product.name} added to this sale.`);
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Could not add the scanned product.';
        status.dataset.state = 'error';
      }
    }, { once: true });
  }

  return { scanPhotoMatchFrames, scanLabelFrames };
}
