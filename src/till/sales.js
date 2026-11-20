// Sale records in local SQLite: save a sale (stock, payment status, discount), reverse it, list sales.
import { chosenAttributeLabel } from '../attribute-pricing.js';
import { isReversedSale } from '../revenue-definition.js';
import { deductsStock } from '../service-model.js';
import { rows, stmt, transaction } from './db.js';
import {
  PAYMENT_METHODS, assertDate, assertTotals, fromCents, nowIso, numberTag, toCents
} from './format.js';
import { getSettings } from './settings-store.js';

async function saveSale(items, { paymentMethod, paid, customerName, customerPhone, dueDate, allowOutOfStock, discount, mpesaRef } = {}) {
  const settings = await getSettings();
  const { subtotalCents } = assertTotals(items, settings.taxRate);
  const discountCents = toCents(discount || 0);
  if (!Number.isSafeInteger(discountCents) || discountCents < 0 || discountCents > subtotalCents) {
    throw new Error('Discount must be between zero and the sale subtotal.');
  }
  const taxCents = Math.round((subtotalCents - discountCents) * settings.taxRate / 100);
  const totalCents = subtotalCents - discountCents + taxCents;
  const customer = String(customerName || '').trim();
  const phone = String(customerPhone || '').trim();
  const method = paymentMethod || null;
  if ((customer && !phone) || (!customer && phone)) throw new Error('Enter both customer name and phone, or leave both blank.');
  if (phone && !/^[+\d][\d\s()+-]{5,20}$/.test(phone)) throw new Error('Enter a valid customer phone number.');
  const date = String(dueDate || '').trim();
  if (date) assertDate(date, 'Credit due date');
  if (paid && date) throw new Error('A due date is only for an unpaid credit sale.');
  if (method && !PAYMENT_METHODS.includes(method)) throw new Error('Choose a valid payment method.');
  // The optional M-Pesa confirmation code is kept on the payment, so a mobile-money sale can be matched to the statement.
  const reference = method === 'Mobile money' ? String(mpesaRef || '').trim().toUpperCase() : '';
  if (reference) {
    if (!/^[A-Z0-9]{6,20}$/.test(reference)) throw new Error('The M-Pesa reference should be 6 to 20 letters and numbers, like QGH7XXXXXX.');
    if (paid && (await rows('SELECT id FROM pos_sale_payments WHERE mpesa_ref=? LIMIT 1', [reference]))[0]) {
      throw new Error('That M-Pesa reference is already recorded on another payment.');
    }
  }
  const quantityMap = new Map();
  // A line with no product (a custom quotation/invoice line) is sold but has no stock to look up or move.
  items.forEach((item) => {
    const productId = Number(item.productId);
    if (productId > 0) quantityMap.set(productId, (quantityMap.get(productId) || 0) + Number(item.quantity));
  });
  // A sized product is counted twice: once for the product total, once for the option sold, so
  // selling the last medium cannot be covered by stock that only exists in small.
  const variantQuantities = new Map();
  items.forEach((item) => {
    const productId = Number(item.productId);
    const variantId = String(item.variantId || '').trim();
    if (productId <= 0 || !variantId) return;
    const key = `${productId}|${variantId}`;
    const current = variantQuantities.get(key) || { productId, variantId, quantity: 0 };
    current.quantity += Number(item.quantity);
    variantQuantities.set(key, current);
  });
  const productData = new Map();
  const stockDeducted = (product) => deductsStock({ stock_count: product.stock_count, duration_minutes: product.duration_minutes });
  for (const [productId, requested] of quantityMap) {
    const product = (await rows('SELECT id,name,sku,stock_count,duration_minutes,buying_price_cents,active,variants_json FROM pos_products WHERE id=?', [productId]))[0];
    if (!product) throw new Error('A product in this sale is no longer available.');
    if (product.active !== 1) throw new Error(`${product.name} is disabled and cannot be sold.`);
    if (!allowOutOfStock && stockDeducted(product) && requested > product.stock_count) {
      throw new Error(`${product.name} has ${product.stock_count} in stock, ${requested} requested.`);
    }
    productData.set(productId, product);
  }
  const variantStock = new Map();
  for (const { productId, variantId, quantity } of variantQuantities.values()) {
    const product = productData.get(productId);
    const variants = variantStock.get(productId) || JSON.parse(product.variants_json || '[]');
    variantStock.set(productId, variants);
    const variant = variants.find((row) => String(row.id) === variantId);
    if (!variant) throw new Error(`An option sold for ${product.name} is no longer available.`);
    if (!allowOutOfStock && Number(variant.stock) < quantity) {
      throw new Error(`${product.name} ${variant.label} has ${variant.stock} in stock, ${quantity} requested.`);
    }
    variant.stock = Math.max(0, Number(variant.stock) - quantity);
  }
  const variantStatements = [...variantStock].map(([productId, variants]) =>
    stmt('UPDATE pos_products SET variants_json=? WHERE id=?', [JSON.stringify(variants), productId]));
  const awaitingMobilePayment = method === 'Mobile money' && !paid;
  const isPaid = Boolean(paid) && !awaitingMobilePayment;
  const createdAt = nowIso();
  const receipt = numberTag('SALE');
  const statements = [
    stmt(`INSERT INTO pos_sales (receipt_number,subtotal_cents,tax_cents,discount_cents,total_cents,currency,payment_method,paid,
      customer_name,customer_phone,due_date,payment_status,amount_paid_cents,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [receipt, subtotalCents, taxCents, discountCents, totalCents, settings.currency, method, isPaid ? 1 : 0, customer || null, phone || null,
      date || null, isPaid ? 'confirmed' : 'pending', isPaid ? totalCents : 0, createdAt])
  ];
  const itemStatements = items.map((item) => {
    const product = productData.get(Number(item.productId));
    const picked = Array.isArray(item.attributes) ? item.attributes : [];
    return stmt(`INSERT INTO pos_sale_items
      (sale_id,product_id,name,quantity,unit_price_cents,unit_cost_cents,unit_cost_captured,variant_id,variant_label,attributes_json,attributes_label)
      SELECT id,?,?,?,?,?,1,?,?,?,? FROM pos_sales WHERE receipt_number=?`,
    [Number(item.productId) > 0 ? Number(item.productId) : null, item.name, item.quantity, toCents(item.unitPrice),
      product?.buying_price_cents == null ? null : Number(product.buying_price_cents),
      String(item.variantId || '').trim() || null, String(item.variantLabel || '').trim() || null,
      picked.length ? JSON.stringify(picked) : null,
      String(item.attributesLabel || '').trim() || chosenAttributeLabel(picked) || null, receipt]);
  });
  const paymentStatement = isPaid && totalCents > 0
    ? [stmt(`INSERT INTO pos_sale_payments
      (sale_id,method,amount_cents,mpesa_ref,sender_name,sender_phone,created_at)
      SELECT id,?,?,?,?,?,? FROM pos_sales WHERE receipt_number=?`,
    [method, totalCents, reference || null, null, null, createdAt, receipt])]
    : [];
  const stockStatements = [...quantityMap].filter(([productId]) => stockDeducted(productData.get(productId))).map(([productId, quantity]) =>
    stmt('UPDATE pos_products SET stock_count=MAX(0,stock_count-?) WHERE id=? AND stock_count IS NOT NULL', [quantity, productId]));
  const connection = (await rows("SELECT value FROM pos_settings WHERE key='shared_tenant_id'"))[0]?.value;
  const sharedItems = new Map();
  if (connection) {
    for (const [productId, quantity] of quantityMap) {
      if (!stockDeducted(productData.get(productId))) continue;
      const sku = String(productData.get(productId)?.sku || '').trim();
      if (sku) sharedItems.set(sku, (sharedItems.get(sku) || 0) + quantity);
    }
  }
  const queueStatement = connection && sharedItems.size
    ? [
      stmt('INSERT INTO shared_inventory_events (tenant_id,event_id,created_at) VALUES (?,?,?)',
        [connection, receipt, createdAt]),
      ...[...sharedItems].map(([sku, quantity]) =>
        stmt('INSERT INTO shared_inventory_event_items (tenant_id,event_id,sku,quantity) VALUES (?,?,?,?)',
          [connection, receipt, sku, quantity])),
      stmt(`INSERT INTO pos_inventory_queue (event_id,tenant_id,items_json,operation,status,updated_at)
        VALUES (?,?,?,'sale','pending',?)`,
      [receipt, connection, JSON.stringify([...sharedItems].map(([sku, quantity]) => ({ sku, quantity }))), createdAt])
    ]
    : [];
  await transaction([...statements, ...itemStatements, ...paymentStatement, ...stockStatements, ...variantStatements, ...queueStatement]);
  if (connection && sharedItems.size) {
    const updated = await Promise.all([...sharedItems.keys()].map(async (sku) => ({
      sku,
      stock: Number((await rows('SELECT stock FROM shared_inventory WHERE tenant_id=? AND sku=?', [connection, sku]))[0]?.stock)
    })));
    await window.EshopInventoryBridge?.updateLocalStock?.(connection, updated);
  }
  const saved = (await rows('SELECT id FROM pos_sales WHERE receipt_number=?', [receipt]))[0];
  if (!saved) throw new Error('The sale transaction completed but its receipt could not be read.');
  return { id: saved.id, receiptNumber: receipt, total: fromCents(totalCents), currency: settings.currency };
}

const REVERSAL_LABELS = {
  refunded: 'Refunded', voided: 'Voided', cancelled: 'Cancelled', canceled: 'Cancelled', failed: 'Failed'
};

/** The word shown on a reversed sale, so the list never calls a refunded sale "Unpaid". */
function reversalLabel(sale) {
  return REVERSAL_LABELS[String(sale?.payment_status || '').toLowerCase()] || 'Reversed';
}

/**
 * Takes back a recorded sale. 'refunded' is money returned to the customer; 'voided' is a sale that
 * should never have been rung up. Both restore stock for tracked products (a service or any product
 * with no stock number is left alone) and drop the sale out of every report, because
 * isReversedSale() in revenue-definition.js reads payment_status.
 *
 * Shared stock is deliberately not adjusted here: the shop-wide mirror is corrected by its own sync,
 * and a silent reverse-queue entry would be harder to explain than a visible difference.
 */
async function reverseSale(saleId, mode = 'refunded') {
  const id = Number(saleId);
  const status = mode === 'voided' ? 'voided' : 'refunded';
  const sale = (await rows('SELECT id,payment_status FROM pos_sales WHERE id=?', [id]))[0];
  if (!sale) throw new Error('That sale no longer exists.');
  if (isReversedSale(sale)) throw new Error('That sale has already been reversed.');
  const items = await rows('SELECT product_id,quantity,variant_id FROM pos_sale_items WHERE sale_id=?', [id]);
  const restock = new Map();
  const variantRestock = new Map();
  for (const item of items) {
    if (item.product_id === null || item.product_id === undefined) continue;
    const productId = Number(item.product_id);
    restock.set(productId, (restock.get(productId) || 0) + Number(item.quantity));
    const variantId = String(item.variant_id || '').trim();
    if (!variantId) continue;
    // The refunded shirt goes back in the size it left in, not onto the pile.
    const key = `${productId}|${variantId}`;
    const current = variantRestock.get(key) || { productId, variantId, quantity: 0 };
    current.quantity += Number(item.quantity);
    variantRestock.set(key, current);
  }
  const restoredVariants = new Map();
  for (const { productId, variantId, quantity } of variantRestock.values()) {
    const variants = restoredVariants.get(productId)
      || JSON.parse((await rows('SELECT variants_json FROM pos_products WHERE id=?', [productId]))[0]?.variants_json || '[]');
    restoredVariants.set(productId, variants);
    const variant = variants.find((row) => String(row.id) === variantId);
    if (variant) variant.stock = Number(variant.stock) + quantity;
  }
  await transaction([
    stmt('UPDATE pos_sales SET payment_status=?,paid=0,amount_paid_cents=0 WHERE id=?', [status, id]),
    ...[...restock].map(([productId, quantity]) =>
      stmt('UPDATE pos_products SET stock_count=stock_count+? WHERE id=? AND stock_count IS NOT NULL',
        [quantity, productId])),
    ...[...restoredVariants].map(([productId, variants]) =>
      stmt('UPDATE pos_products SET variants_json=? WHERE id=?', [JSON.stringify(variants), productId]))
  ]);
  return { status, restocked: restock.size };
}

async function listSales() {
  const sales = await rows('SELECT * FROM pos_sales ORDER BY created_at DESC, id DESC');
  const items = await rows(`SELECT sale_id,product_id AS productId,name,quantity,unit_price_cents,unit_cost_cents,
    variant_id AS variantId, variant_label AS variantLabel, attributes_label AS attributesLabel
    FROM pos_sale_items WHERE sale_id IN (SELECT id FROM pos_sales) ORDER BY sale_id,id`);
  const itemsBySale = new Map();
  for (const item of items) {
    const saleId = String(item.sale_id);
    const saleItems = itemsBySale.get(saleId) || [];
    saleItems.push({
      productId: item.productId || 0,
      name: item.name,
      variantId: item.variantId || '',
      variantLabel: item.variantLabel || '',
      attributesLabel: item.attributesLabel || '',
      quantity: item.quantity,
      unitPrice: fromCents(item.unit_price_cents),
      historicalUnitCost: item.unit_cost_cents == null ? null : fromCents(item.unit_cost_cents)
    });
    itemsBySale.set(saleId, saleItems);
  }
  for (const sale of sales) {
    sale.subtotal = fromCents(sale.subtotal_cents);
    sale.tax = fromCents(sale.tax_cents);
    sale.discount = fromCents(sale.discount_cents);
    // Net sales: what was sold after discounts, before tax. The receipt still shows the gross subtotal.
    sale.netSales = Math.max(0, sale.subtotal - sale.discount);
    sale.total = fromCents(sale.total_cents);
    sale.amountPaid = fromCents(sale.amount_paid_cents);
    sale.items = itemsBySale.get(String(sale.id)) || [];
  }
  return sales;
}

export { saveSale, reversalLabel, reverseSale, listSales };
