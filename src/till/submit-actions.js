// Every till form submit (data-pos-form) is handled here.
import { readAttributePricingFields } from '../attribute-pricing-fields.js';
import { readProductTaxonomyFields } from '../product-taxonomy.js';
import { readProductVariantFields } from '../product-variants.js';
import { rows, run } from './db.js';
import { saveExpense } from './expenses.js';
import { assertDate, fromCents, nowIso, toCents } from './format.js';
import { startInstance } from './instances.js';
import { saveInvoice } from './invoices.js';
import { recordPayment } from './payments.js';
import { addCategory, listCategories, listProducts, saveProduct } from './products.js';
import { saveQuotation } from './quotations.js';
import { listSales } from './sales.js';
import { saveMonthlyRevenueGoal, saveSettings } from './settings-store.js';

export function createSubmitActions({
  refresh, state, renderCurrent, queueCategory, toast, queueSettings, queueExpense, readImageFile,
  queueProduct, createProductImageEmbedding, queueCloudRecord, saveCheckout, updateCartPanel
}) {
  async function handleSubmit(event) {
    const form = event.target.closest('form[data-pos-form]');
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const submitButton = form.querySelector?.('button[type="submit"]');
    const originalSubmitText = submitButton?.textContent || '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Saving…';
    }
    try {
      switch (form.dataset.posForm) {
        case 'store-filter':
          state.search = String(data.search || '').trim();
          state.category = String(data.category || '');
          renderCurrent();
          return;
        case 'product': {
          Object.assign(data, readProductTaxonomyFields(form));
          // Normalise the item type to an explicit flag.
          data.isService = String(form.elements?.isService?.value) === '1' ? '1' : '0';
          if (data.isService !== '1') delete data.durationMinutes;
          // Options are read from the same editor the website form uses. A service has none.
          const variantFields = form.querySelector('[data-product-variant-fields]');
          data.pricedAttributes = readAttributePricingFields(form.querySelector('[data-attribute-pricing]'));
          data.variants = data.isService === '1' || !variantFields
            ? []
            : readProductVariantFields(variantFields).variants;
          const requiredField = !String(data.name || '').trim()
            ? form.elements?.name
            : String(data.price ?? '').trim() === '' ? form.elements?.price : null;
          if (requiredField) {
            const message = requiredField.name === 'price'
              ? 'Enter a selling price before adding this product.'
              : 'Enter a product name before adding this product.';
            const status = form.querySelector('[data-product-submit-status]');
            if (status) status.textContent = message;
            requiredField.focus();
            requiredField.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
            toast(message, true);
            return;
          }
          const selectedImage = form.elements?.imageFile?.files?.[0];
          const uploadedImage = await readImageFile(selectedImage);
          const capturedImage = String(form.elements?.capturedProductImage?.value || '');
          const imageUri = uploadedImage || capturedImage || data.imageUri;
          data.imageUri = imageUri;
          const oldProduct = state.products.find((product) => product.id === Number(data.id));
          const imageChanged = Boolean(selectedImage) || imageUri !== (oldProduct?.imageUri || '')
            || (/^data:image\//i.test(imageUri || '') && !oldProduct?.imageEmbedding?.length);
          if (imageChanged) {
            data.imageEmbeddingHex = '';
          }
          const productId = await saveProduct(data);
          const product = (await listProducts()).find((item) => item.id === productId);
          if (!product) throw new Error('The product could not be loaded after saving. Refresh the catalogue and check before adding it again.');
          await queueProduct(product);
          toast('Product saved.');
          await refresh();
          if (imageChanged && /^data:image\//i.test(imageUri || '')) {
            void createProductImageEmbedding(productId, imageUri);
          }
          return;
        }
        case 'supplier': {
          const name = String(data.name || '').trim();
          const phone = String(data.phone || '').trim();
          const email = String(data.email || '').trim();
          if (!name || name.length > 160
            || (phone && !/^[+\d][\d\s()+-]{4,24}$/.test(phone))
            || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            throw new Error('Enter a supplier name and valid contact details.');
          }
          const id = String(data.id || `SUP-${crypto.randomUUID().replace(/-/g, '')}`);
          const supplier = { id, name, phone, email, supplies: String(data.supplies || '').trim().slice(0, 500), updatedAt: nowIso() };
          await queueCloudRecord('supplier', id, supplier);
          toast('Supplier saved.');
          break;
        }
        case 'purchase': {
          const supplier = state.suppliers.find((item) => item.id === data.supplierId);
          if (!supplier) throw new Error('Choose a supplier.');
          const items = [];
          for (const index of [1, 2, 3]) {
            const sku = String(data[`product${index}`] || '').trim();
            const quantityText = String(data[`quantity${index}`] || '').trim();
            const costText = String(data[`cost${index}`] || '').trim();
            if (!sku && !quantityText && !costText) continue;
            const quantity = Number(quantityText);
            const unitCost = Number(costText);
            const product = state.products.find((item) => item.sku === sku);
            if (!product || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99999
              || !Number.isFinite(unitCost) || unitCost < 0) {
              throw new Error(`Complete product, whole-number quantity and valid unit cost on line ${index}.`);
            }
            items.push({ sku, productId: product.id, name: product.name, quantity, unitCost });
          }
          if (!items.length) throw new Error('Add at least one product to the purchase order.');
          const id = `PO-${crypto.randomUUID().replace(/-/g, '')}`;
          const purchase = {
            id, supplierId: supplier.id, supplierName: supplier.name,
            reference: String(data.reference || '').trim().slice(0, 80),
            items, status: 'ordered', createdAt: nowIso()
          };
          await queueCloudRecord('purchase', id, purchase);
          toast('Purchase order created.');
          break;
        }
        case 'category':
          await addCategory(data.name);
          await queueCategory((await listCategories()).find((item) => item.name.toLocaleLowerCase() === String(data.name).trim().toLocaleLowerCase()));
          toast('Category added.');
          break;
        case 'checkout': {
          const method = data.paymentMethod || null;
          await saveCheckout(data, method, Boolean(method));
          return;
        }
        case 'discount': {
          const subtotalCents = state.cart.reduce((sum, item) => sum + toCents(item.unitPrice) * item.quantity, 0);
          const entered = String(data.discountAmount ?? '').trim();
          const amount = entered === '' ? 0 : Number(entered);
          const discountCents = toCents(amount);
          if (!Number.isFinite(amount) || !Number.isSafeInteger(discountCents)
            || discountCents < 0 || discountCents > subtotalCents) {
            throw new Error('Enter a valid discount amount no greater than the sale subtotal.');
          }
          state.discount = fromCents(discountCents);
          state.discountDialogOpen = false;
          updateCartPanel();
          return;
        }
        case 'payment': {
          const result = await recordPayment(data.saleId, data.amount, data.method, data);
          const paidSale = (await listSales()).find((item) => item.id === Number(data.saleId));
          if (paidSale) await queueCloudRecord('sale', paidSale.receipt_number, paidSale);
          toast(result.paid ? 'Sale fully paid.' : 'Payment recorded.');
          state.expandedSale = Number(data.saleId);
          break;
        }
        case 'invoice': {
          const items = state.invoiceItems;
          if (!items.length) throw new Error('Add at least one invoice item.');
          await saveInvoice({ ...data, items });
          state.invoiceItems = [];
          state.invoiceDraftId = null;
          window.location.hash = '#/pos/invoices';
          toast('Invoice saved.');
          break;
        }
        case 'quotation': {
          const productIds = new Set(new FormData(form).getAll('products').map(Number));
          const items = [];
          for (const product of state.products.filter((entry) => productIds.has(entry.id))) {
            const quantity = Number(data[`quantity_${product.id}`] ?? 1);
            if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99999) {
              throw new Error(`Enter a whole-number quantity for ${product.name}.`);
            }
            items.push({ productId: product.id, name: product.name, quantity, unitPrice: product.price });
          }
          for (const key of Object.keys(data).filter((entry) => /^customName\d+$/.test(entry))) {
            const slot = key.slice('customName'.length);
            const customName = String(data[key] || '').trim();
            const customPrice = String(data[`customPrice${slot}`] || '').trim();
            const customQty = String(data[`customQty${slot}`] || '').trim();
            if (!customName && !customPrice && !customQty) continue;
            const amount = Number(customPrice);
            const quantity = customQty === '' ? 1 : Number(customQty);
            if (!customName || customPrice === '' || !Number.isFinite(amount) || amount < 0
              || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99999) {
              throw new Error('Enter a name, a valid price and a whole-number quantity for each custom item.');
            }
            items.push({ productId: 0, name: customName, quantity, unitPrice: amount });
          }
          if (!items.length) throw new Error('Choose a catalogue product or enter a custom item.');
          await saveQuotation({ ...data, items });
          window.location.hash = '#/pos/orders/quotations';
          toast('Quotation saved.');
          break;
        }
        case 'instance':
          await startInstance(data);
          toast('Business instance started.');
          break;
        case 'settings':
          await saveSettings(data.taxRate, data.currency);
          await queueSettings();
          toast('POS settings saved.');
          break;
        case 'revenue-goal':
          await saveMonthlyRevenueGoal(data.amount, state.settings.currency);
          await queueSettings();
          toast('Monthly revenue goal saved.');
          break;
        case 'expense':
          await queueExpense(await saveExpense({ ...data, currency: state.settings.currency }));
          toast(Number(data.id) ? 'Expense updated.' : 'Expense saved.');
          break;
        case 'movement': {
          const amount = toCents(data.amount);
          if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a positive cash movement amount.');
          await run('INSERT INTO pos_cash_movements (movement_type,amount_cents,currency,note,created_at) VALUES (?,?,?,?,?)',
            [data.type, amount, state.settings.currency, String(data.note || '').trim(), nowIso()]);
          toast('Cash movement recorded.');
          break;
        }
        case 'till': {
          assertDate(data.date, 'Till date');
          const counted = toCents(data.countedCash);
          if (!Number.isSafeInteger(counted) || counted < 0) throw new Error('Enter a valid counted cash total.');
          const dayStart = new Date(`${data.date}T00:00:00`);
          const from = dayStart.toISOString();
          dayStart.setDate(dayStart.getDate() + 1);
          const to = new Date(dayStart.getTime() - 1).toISOString();
          const [cashPayments, cashExpenses, movements] = await Promise.all([
            rows(`SELECT p.amount_cents FROM pos_sale_payments p JOIN pos_sales s ON s.id=p.sale_id
              WHERE p.method='Cash' AND p.status='confirmed' AND s.currency=? AND p.created_at BETWEEN ? AND ?`,
            [state.settings.currency, from, to]),
            rows("SELECT amount_cents FROM pos_expenses WHERE payment_method='Cash' AND currency=? AND expense_date=?",
              [state.settings.currency, data.date]),
            rows('SELECT movement_type,amount_cents FROM pos_cash_movements WHERE currency=? AND created_at BETWEEN ? AND ?',
              [state.settings.currency, from, to])
          ]);
          const cashSales = cashPayments.reduce((sum, row) => sum + Number(row.amount_cents), 0);
          const expenseCents = cashExpenses.reduce((sum, row) => sum + Number(row.amount_cents), 0);
          const moved = movements.reduce((sum, row) => sum + (row.movement_type === 'float_in' ? 1 : -1) * Number(row.amount_cents), 0);
          const expected = cashSales - expenseCents + moved;
          await run('INSERT INTO pos_till_closes (close_date,expected_cash_cents,counted_cash_cents,difference_cents,currency) VALUES (?,?,?,?,?)',
            [data.date, expected, counted, counted - expected, state.settings.currency]);
          toast('Till close saved.');
          break;
        }
      }
      await refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save this POS change.', true);
    } finally {
      if (submitButton?.isConnected) {
        submitButton.disabled = false;
        submitButton.textContent = originalSubmitText;
      }
    }
  }

  return { handleSubmit };
}
