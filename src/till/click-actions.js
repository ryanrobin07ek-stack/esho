// Every till button and link action (data-pos-action) is handled here.
import { listBusinessRecords, saveBusinessRecord } from './business-records.js';
import { run, stmt, transaction } from './db.js';
import { listExpenses } from './expenses.js';
import { PAYMENT_METHODS, escapeHtml, nowIso } from './format.js';
import { updateInstance } from './instances.js';
import { markInvoicePaid } from './payments.js';
import { suggestImageCategories } from './product-matching.js';
import { listCategories, listProducts } from './products.js';
import { convertQuotationToInvoice, deleteQuotation } from './quotations.js';
import { listSales, reverseSale } from './sales.js';
import { getSettings, saveInsightPreferences } from './settings-store.js';

export function createClickActions({
  openBarcodeScanner, toast, refresh, captureProductPhoto, readImageFile, prepareImageForVision,
  getProductVision, state, addScannedBarcode, updateCartPanel, queueCloudRecord, queueProduct,
  receivePurchaseOrder, seedCloudCatalogueForTenant, syncCloudBusinessRecords,
  startBluetoothNearbySync, stopNearbySync, startNearbySync, addProductToCart, cartLineKey,
  renderCurrent, queueCategory, renderKeepingForm, syncInventorySales, printDocument,
  quotationHtml, queueExpense, receiptHtml, invoiceHtml, exportInventory, syncSharedStock
}) {
  async function handleClick(event) {
    const target = event.target.closest('[data-pos-action]');
    if (!target) return;
    const action = target.dataset.posAction;
    const id = Number(target.dataset.id || 0);
    try {
      if (action === 'scan-barcode') {
        const form = target.closest('form[data-pos-form="product"]');
        if (!form) return;
        await openBarcodeScanner(async (code) => {
          if (code.length > 120) throw new Error('Barcode is too long to save as a product code.');
          form.elements.barcode.value = code;
          const result = form.querySelector('[data-product-barcode-status]');
          if (result) result.textContent = `Barcode ${code} captured successfully. Complete the product details and save.`;
          toast(`Barcode ${code} captured.`);
          return { captured: true };
        }, { allowProductLabel: true, productForm: form });
        return;
      } else if (action === 'refund-sale' || action === 'void-sale') {
        const voiding = action === 'void-sale';
        if (!window.confirm(voiding
          ? 'Void this sale? It leaves your reports and any tracked stock goes back.'
          : 'Refund this sale? It leaves your reports and any tracked stock goes back.')) return;
        const result = await reverseSale(id, voiding ? 'voided' : 'refunded');
        await refresh();
        toast(result.restocked
          ? `Sale ${voiding ? 'voided' : 'refunded'} · stock returned for ${result.restocked} product${result.restocked === 1 ? '' : 's'}.`
          : `Sale ${voiding ? 'voided' : 'refunded'}.`);
        return;
      } else if (action === 'refresh-overview') {
        await refresh();
        toast('Overview refreshed from saved POS records.');
        return;
      } else if (action === 'take-product-photo') {
        const form = target.closest('form[data-pos-form="product"]');
        if (!form) return;
        const status = form.querySelector('[data-product-image-capture-status]');
        const preview = form.querySelector('[data-product-image-preview]');
        if (status) status.textContent = 'Opening camera…';
        try {
          const imageUri = await captureProductPhoto();
          if (!imageUri) {
            if (status) status.textContent = 'Photo capture cancelled. Your product details were not changed.';
            return;
          }
          form.elements.capturedProductImage.value = imageUri;
          if (preview) {
            preview.src = imageUri;
            preview.hidden = false;
          }
          if (status) status.textContent = 'Photo captured. Save the product to keep it and create its image match profile.';
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not take a product photo.';
          if (status) status.textContent = message;
          toast(message, true);
        }
        return;
      } else if (action === 'suggest-image-category') {
        const form = target.closest('form[data-pos-form="product"]');
        if (!form) return;
        const status = form.querySelector('[data-product-image-status]');
        const suggestions = form.querySelector('[data-image-category-suggestions]');
        const selectedImage = form.elements?.imageFile?.files?.[0];
        const dataUrl = await readImageFile(selectedImage) || form.elements.imageUri.value.trim();
        if (!dataUrl.startsWith('data:image/')) {
          if (status) status.textContent = 'Upload a product photo first to get an offline category suggestion.';
          toast('Upload a product photo first to get an offline category suggestion.', true);
          return;
        }
        if (status) status.textContent = 'Reading image labels on this device…';
        let ranked;
        let labels;
        try {
          const imageBase64 = await prepareImageForVision(dataUrl);
          const { plugin: vision } = await getProductVision();
          const result = await vision.labelImage({ imageBase64 });
          labels = result.labels || [];
          ranked = suggestImageCategories(labels, state.categories);
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : 'Could not read the product photo.';
          toast(error instanceof Error ? error.message : 'Could not read the product photo.', true);
          return;
        }
        if (!ranked.length) {
          if (suggestions) {
            suggestions.hidden = true;
            suggestions.replaceChildren();
          }
          if (status) status.textContent = 'No existing category matched the image labels. Choose a category manually.';
          return;
        }
        if (suggestions) {
          suggestions.innerHTML = ranked.map((item) =>
            `<button type="button" class="btn-secondary" data-image-category="${escapeHtml(item.categoryId)}">${escapeHtml(item.categoryName)}
              <small>${escapeHtml(item.label)} · ${Math.round(item.score * 100)}%</small></button>`).join('');
          suggestions.hidden = false;
          suggestions.querySelectorAll('[data-image-category]').forEach((button) => {
            button.addEventListener('click', () => {
              form.elements.categoryId.value = button.dataset.imageCategory;
              if (status) status.textContent = `${button.textContent.trim()} selected as a suggestion. Review it before saving.`;
              suggestions.hidden = true;
            });
          });
        }
        if (status) status.textContent = `Image labels: ${labels.slice(0, 3).map((label) => label.text).join(', ')}. Tap a suggested existing category to select it.`;
        return;
      } else if (action === 'scan-product-label') {
        const form = target.closest('form[data-pos-form="product"]');
        if (!form) return;
        await openBarcodeScanner(async () => null, {
          allowProductLabel: true, productForm: form, initialMode: 'label'
        });
        return;
      } else if (action === 'scan-sale-barcode') {
        await openBarcodeScanner(addScannedBarcode, { allowProductLabel: true });
        return;
      } else if (action === 'set-discount') {
        state.discountDialogOpen = true;
        updateCartPanel();
      } else if (action === 'close-discount') {
        state.discountDialogOpen = false;
        updateCartPanel();
      } else if (action === 'checkout-method') {
        const method = target.dataset.method;
        if (!PAYMENT_METHODS.includes(method)) throw new Error('Choose a valid payment method.');
        state.paymentMethod = method;
        updateCartPanel();
      } else if (action === 'park-ticket') {
        if (!state.cart.length) throw new Error('Add products before parking this order.');
        const existing = state.tickets.find((item) => item.id === state.activeTicketId);
        const name = prompt('Order name (optional)', existing?.name || '');
        if (name === null) return;
        const id = state.activeTicketId || `TICKET-${crypto.randomUUID().replace(/-/g, '')}`;
        const ticket = {
          id, name: String(name).trim().slice(0, 100), items: state.cart.map((item) => ({ ...item })),
          discount: Number(state.discount) || 0, customerName: existing?.customerName || '',
          customerPhone: existing?.customerPhone || '', createdAt: existing?.createdAt || nowIso(),
          updatedAt: nowIso()
        };
        await queueCloudRecord('ticket', id, ticket);
        state.cart = [];
        state.discount = 0;
        state.discountDialogOpen = false;
        state.paymentMethod = '';
        state.activeTicketId = '';
        toast('Order parked.');
        await refresh();
      } else if (action === 'resume-ticket') {
        const ticket = state.tickets.find((item) => item.id === target.dataset.recordId);
        if (!ticket) throw new Error('This parked order is no longer available.');
        if (state.cart.length && !confirm('Replace the current sale with this parked order?')) return;
        state.cart = ticket.items.map((item) => ({ ...item }));
        state.discount = Number(ticket.discount) || 0;
        state.activeTicketId = ticket.id;
        state.paymentMethod = '';
        window.location.hash = '#/pos';
        await refresh();
      } else if (action === 'delete-ticket') {
        const recordId = target.dataset.recordId || '';
        if (!recordId || !confirm('Delete this parked order?')) return;
        await queueCloudRecord('ticket', recordId, { id: recordId }, true);
        toast('Parked order deleted.');
        await refresh();
      } else if (action === 'delete-supplier') {
        const recordId = target.dataset.recordId || '';
        if (!recordId || !confirm('Delete this supplier? Existing purchase orders will keep their supplier details.')) return;
        await queueCloudRecord('supplier', recordId, { id: recordId }, true);
        if (state.products.some((item) => item.supplierId === recordId)) {
          await run('UPDATE pos_products SET supplier_id=NULL WHERE supplier_id=?', [recordId]);
          for (const product of (await listProducts()).filter((item) => state.products.some((old) => old.id === item.id && old.supplierId === recordId))) {
            await queueProduct(product);
          }
        }
        toast('Supplier deleted.');
        await refresh();
      } else if (action === 'receive-purchase') {
        const recordId = target.dataset.recordId || '';
        if (!confirm('Receive this purchase order and add the quantities to stock?')) return;
        await receivePurchaseOrder(recordId);
        toast('Purchase order received; stock updated.');
        await refresh();
      } else if (action === 'toggle-cloud-sync') {
        if (state.settings.cloudSyncEnabled) {
          await transaction([
            stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_enabled','0')", []),
            stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", [])
          ]);
          toast('Cloud sync disabled. Local data remains on this device.');
        } else {
          if (!confirm('Enable cloud backup and sync for this shop? This saves this device’s POS products, stock, categories, expenses, suppliers, purchase orders, parked orders, settings, and receipts to your shop’s cloud account and shares them with your other registers. Product and expense details, plus customer names and phone numbers on receipts, will be sent. Local data stays on this device too.')) return;
          const tenantId = window.EshopInventoryBridge?.activeWebsiteId?.();
          if (!tenantId || typeof window.EshopInventoryBridge?.syncPosRecords !== 'function') {
            throw new Error('Select an active Cloudflare website in Studio first.');
          }
          await window.EshopInventoryBridge.syncPosRecords(tenantId, 'GET', { after: 0, limit: 1 });
          const previousScope = state.cloudScopeId;
          await transaction([
            stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_tenant_id',?)", [tenantId]),
            stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_enabled','1')", []),
            stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", [])
          ]);
          state.settings = await getSettings();
          state.cloudScopeId = tenantId;
          if (previousScope !== tenantId) {
            for (const entity of ['supplier', 'purchase', 'ticket']) {
              for (const record of await listBusinessRecords(entity, previousScope)) {
                await saveBusinessRecord(entity, record.id, record, false, 0, tenantId);
              }
            }
          }
          await seedCloudCatalogueForTenant(tenantId);
          await syncCloudBusinessRecords();
          toast('Cloud backup and sync enabled.');
        }
        await refresh();
      } else if (action === 'nearby-bt-host') {
        try {
          await startBluetoothNearbySync('host');
        } catch (error) {
          await stopNearbySync(error instanceof Error ? `Bluetooth sync failed: ${error.message}` : 'Bluetooth sync failed.');
          throw error;
        }
      } else if (action === 'nearby-bt-find') {
        try {
          await startBluetoothNearbySync('find');
        } catch (error) {
          await stopNearbySync(error instanceof Error ? `Bluetooth sync failed: ${error.message}` : 'Bluetooth sync failed.');
          throw error;
        }
      } else if (action === 'nearby-sync-create') {
        target.disabled = true;
        target.textContent = 'Preparing QR…';
        try {
          await startNearbySync('create');
        } catch (error) {
          await stopNearbySync(error instanceof Error ? `Nearby sync failed: ${error.message}` : 'Nearby sync failed. Check the shop selection, camera access, and Wi-Fi connection.');
          throw error;
        } finally {
          const button = document.querySelector('[data-pos-action="nearby-sync-create"]');
          if (button) {
            button.disabled = false;
            button.textContent = 'Create pairing QR';
          }
        }
      } else if (action === 'nearby-sync-join') {
        target.disabled = true;
        target.textContent = 'Opening camera…';
        try {
          await startNearbySync('join');
        } catch (error) {
          await stopNearbySync(error instanceof Error ? `Nearby sync failed: ${error.message}` : 'Nearby sync failed. Check the shop selection, camera access, and Wi-Fi connection.');
          throw error;
        } finally {
          const button = document.querySelector('[data-pos-action="nearby-sync-join"]');
          if (button) {
            button.disabled = false;
            button.textContent = 'Scan pairing QR';
          }
        }
      } else if (action === 'nearby-sync-stop') {
        await stopNearbySync();
        await refresh();
      } else if (action === 'sync-cloud-now') {
        try {
          await syncCloudBusinessRecords();
        } catch (error) {
          if (error?.code !== 'MASS_DELETE') throw error;
          if (!confirm(`${error.message}\n\nApply those deletions on this device?`)) return;
          await syncCloudBusinessRecords({ allowMassDelete: true });
        }
        if (state.cloudSyncError) toast(`Cloud save and sync failed: ${state.cloudSyncError}`, true);
        else toast('Cloud save and sync complete.');
        await refresh();
      } else if (action === 'cancel-sale') {
        if (!state.cart.length) return;
        if (!confirm('Cancel this sale and clear all items?')) return;
        state.cart = [];
        state.paymentMethod = '';
        state.discount = 0;
        state.discountDialogOpen = false;
        updateCartPanel();
        toast('Sale cancelled.');
      } else if (action === 'add-cart') {
        const product = state.products.find((item) => item.id === id);
        if (!product || !product.active) throw new Error('This product is no longer available.');
        if (product.variants?.length || product.pricedAttributes?.length) {
          state.variantPickerProductId = id;
          updateCartPanel();
          return;
        }
        addProductToCart(product, null);
      } else if (action === 'pick-variant') {
        const product = state.products.find((item) => item.id === id);
        if (!product || !product.active) throw new Error('This product is no longer available.');
        const dialog = target.closest('.pos-discount-dialog');
        const chosenAttributes = [...(dialog?.querySelectorAll('[data-pos-priced-attribute]') || [])]
          .filter((select) => select.value)
          .map((select) => ({ attributeName: select.dataset.posPricedAttribute, value: select.value }));
        const needsVariant = Boolean(product.variants?.length);
        const variant = needsVariant
          ? (product.variants || []).find((row) => String(row.id) === String(target.dataset.variant))
          : null;
        if (needsVariant && !variant) throw new Error('That option is no longer available.');
        addProductToCart(product, variant, chosenAttributes);
        state.variantPickerProductId = 0;
        updateCartPanel();
      } else if (action === 'close-variant') {
        state.variantPickerProductId = 0;
        updateCartPanel();
      } else if (action === 'cart-plus' || action === 'cart-minus') {
        const line = target.dataset.line;
        state.cart = state.cart.flatMap((item) => {
          if (cartLineKey(item) !== line) return [item];
          const quantity = item.quantity + (action === 'cart-plus' ? 1 : -1);
          return quantity > 0 ? [{ ...item, quantity }] : [];
        });
        updateCartPanel();
      } else if (action === 'toggle-sale') {
        state.expandedSale = state.expandedSale === id ? 0 : id;
        renderCurrent();
      } else if (action === 'delete-product') {
        if (confirm('Delete this POS product? Saved receipts will keep their original line details.')) {
          const product = state.products.find((item) => item.id === id);
          if (!product) throw new Error('This product is no longer available.');
          await run('DELETE FROM pos_products WHERE id=?', [id]);
          await queueProduct(product, true);
          toast('Product deleted.');
          await refresh();
        }
      } else if (action === 'rename-category') {
        const category = state.categories.find((item) => item.id === id);
        const name = prompt('Category name', category?.name || '');
        if (name === null) return;
        if (!name.trim() || category?.name.toLowerCase() === 'other') throw new Error('Enter a valid category name.');
        await queueCategory(category, true);
        await run('UPDATE pos_categories SET name=? WHERE id=?', [name.trim(), id]);
        const renamed = (await listCategories()).find((item) => item.id === id);
        await queueCategory(renamed);
        for (const product of (await listProducts()).filter((item) => item.categoryId === id)) await queueProduct(product);
        toast('Category renamed.');
        await refresh();
      } else if (action === 'delete-category') {
        const category = state.categories.find((item) => item.id === id);
        if (!category || category.name.toLowerCase() === 'other') throw new Error('The default category cannot be deleted.');
        const count = state.products.filter((item) => item.categoryId === id).length;
        if (!confirm(`Delete ${category.name}? ${count ? 'Its products will move to Other.' : ''}`)) return;
        const fallback = state.categories.find((item) => item.name.toLowerCase() === 'other');
        await transaction([
          ...(fallback ? [stmt('UPDATE pos_products SET category_id=? WHERE category_id=?', [fallback.id, id])] : []),
          stmt('DELETE FROM pos_categories WHERE id=?', [id])
        ]);
        await queueCategory(category, true);
        if (fallback) {
          for (const product of (await listProducts()).filter((item) => item.categoryId === fallback.id)) {
            await queueProduct(product);
          }
        }
        toast('Category deleted.');
        await refresh();
      } else if (action === 'invoice-add') {
        const product = state.products.find((item) => item.id === id);
        if (!product) throw new Error('This product could not be found.');
        const found = state.invoiceItems.find((item) => item.productId === id);
        if (found) found.quantity = Math.min(99999, found.quantity + 1);
        else state.invoiceItems.push({ productId: id, name: product.name, quantity: 1, unitPrice: product.price });
        renderKeepingForm('invoice');
      } else if (action === 'invoice-remove') {
        state.invoiceItems.splice(Number(target.dataset.index), 1);
        renderKeepingForm('invoice');
      } else if (action === 'mark-invoice-paid') {
        const method = target.closest('article')?.querySelector('[data-invoice-pay-method]')?.value || 'Cash';
        let mpesaRef = '';
        if (method === 'Mobile money') {
          const entered = prompt('M-Pesa reference (optional)', '');
          if (entered === null) return;
          mpesaRef = entered;
        }
        const result = await markInvoicePaid(id, method, { mpesaRef });
        try {
          const savedSale = (await listSales()).find((item) => item.id === result.id);
          if (savedSale) await queueCloudRecord('sale', savedSale.receipt_number, savedSale);
          const productsAfter = await listProducts();
          for (const productId of result.productIds) {
            const product = productsAfter.find((item) => item.id === productId);
            if (product) await queueProduct(product);
          }
          await syncInventorySales();
        } catch (error) {
          await refresh();
          toast(`Invoice ${result.invoiceNumber} paid as receipt ${result.receiptNumber}, but sync failed: ${error instanceof Error ? error.message : 'unknown error'}`, true);
          return;
        }
        toast(`Invoice ${result.invoiceNumber} marked paid · receipt ${result.receiptNumber}.`);
        await refresh();
      } else if (action === 'convert-quotation') {
        const invoiceId = await convertQuotationToInvoice(id);
        toast('Invoice created from the quotation.');
        window.location.hash = `#/pos/orders/invoices?edit=${invoiceId}`;
        await refresh();
      } else if (action === 'delete-quotation') {
        if (!confirm('Delete this quotation?')) return;
        await deleteQuotation(id);
        toast('Quotation deleted.');
        await refresh();
      } else if (action === 'print-quotation') {
        const quotation = state.quotations.find((item) => item.id === id);
        if (quotation) printDocument('Quotation', quotationHtml(quotation));
      } else if (action.startsWith('instance-')) {
        const operation = action.replace('instance-', '');
        if (operation === 'stop' && !confirm('Stop and save this business instance?')) return;
        await updateInstance(target.dataset.id, operation);
        toast('Instance updated.');
        await refresh();
      } else if (action === 'delete-expense') {
        if (!confirm('Delete this expense?')) return;
        const expense = (await listExpenses()).find((item) => item.id === id);
        if (!expense) throw new Error('This expense is no longer available.');
        await run('DELETE FROM pos_expenses WHERE id=?', [id]);
        await queueExpense(expense, true);
        toast('Expense deleted.');
        await refresh();
      } else if (action === 'edit-expense') {
        window.location.hash = `#/pos/settings?expense=${id}`;
      } else if (action === 'print-sale') {
        const sale = state.sales.find((item) => item.id === id);
        if (sale) printDocument('Receipt', receiptHtml(sale));
      } else if (action === 'print-invoice') {
        const invoice = state.invoices.find((item) => item.id === id);
        if (invoice) printDocument('Invoice', invoiceHtml(invoice));
      } else if (action === 'backup-export') {
        await exportInventory();
        toast('Inventory backup downloaded.');
      } else if (action === 'sync-product-details') {
        const product = state.products.find((item) => item.id === id);
        if (!product || !product.sku) throw new Error('This product needs a SKU before its details can be synced.');
        const websiteId = window.EshopInventoryBridge?.activeWebsiteId?.();
        if (!websiteId || typeof window.EshopInventoryBridge?.syncProductDetails !== 'function')
          throw new Error('The active local website draft is unavailable.');
        const { imageEmbedding, ...webProduct } = product;
        await window.EshopInventoryBridge.syncProductDetails(websiteId, webProduct);
        toast('Product details saved to the active website draft.');
        await refresh();
      } else if (action === 'sync-shared-stock') {
        const result = await syncSharedStock(target.dataset.source);
        toast(result.localOnly
          ? `${result.count} website product${result.count === 1 ? '' : 's'} loaded into this device's POS. Cloud stock sharing is separate.`
          : `${result.count} matching products connected${result.pending ? ` · ${result.pending} sale${result.pending === 1 ? '' : 's'} waiting to sync` : ''}.`);
      } else if (action === 'snooze-alert' || action === 'dismiss-alert') {
        const key = String(target.dataset.key || '');
        if (!key) throw new Error('This insight alert could not be identified.');
        const preferences = state.settings.insightPreferences;
        const next = action === 'dismiss-alert'
          ? { dismissed: [...new Set([...preferences.dismissed, key])], snoozed: { ...preferences.snoozed } }
          : { dismissed: preferences.dismissed.filter((item) => item !== key),
            snoozed: { ...preferences.snoozed, [key]: Date.now() + 24 * 60 * 60 * 1000 } };
        await saveInsightPreferences(next);
        toast(action === 'dismiss-alert' ? 'Alert dismissed.' : 'Alert snoozed for 24 hours.');
        await refresh();
      } else if (action === 'restore-alerts') {
        await saveInsightPreferences({ dismissed: [], snoozed: {} });
        toast('Dismissed alerts restored.');
        await refresh();
      } else if (action === 'clear-revenue-goal') {
        await transaction([
          stmt('DELETE FROM pos_settings WHERE key=?', ['monthly_revenue_goal_cents']),
          stmt('DELETE FROM pos_settings WHERE key=?', ['monthly_revenue_goal_currency'])
        ]);
        toast('Monthly revenue goal removed.');
        await refresh();
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'POS action failed.', true);
    }
  }

  return { handleClick };
}
