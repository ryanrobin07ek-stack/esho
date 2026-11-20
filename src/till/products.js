// Product and category records in local SQLite: list, save, delete.
import { normalizePricedAttributes } from '../attribute-pricing.js';
import {
  DEFAULT_SERVICE_MINUTES, isService, normalizeServiceDuration, serviceDuration
} from '../service-model.js';
import { rows, run } from './db.js';
import { assertDate, createSku, fromCents, nowIso, toCents } from './format.js';
import { normalizePosVariants } from './pricing.js';
import { recordSharedStockUpdate } from './stock.js';

async function listProducts() {
  return rows(`SELECT p.id, p.name, p.sku, p.barcode, p.expiry_date AS expiryDate, p.category_id AS categoryId, c.name AS categoryName,
    p.taxonomy_category_id AS taxonomyCategoryId, p.taxonomy_custom_category AS taxonomyCustomCategory,
    p.taxonomy_attributes_json AS taxonomyAttributesJson, p.variants_json AS variantsJson,
    p.priced_attributes_json AS pricedAttributesJson,
    p.price_cents, p.buying_price_cents, p.stock_count AS stock, p.image_uri AS imageUri,
    hex(p.image_embedding) AS imageEmbeddingHex,
    p.low_stock_threshold AS lowStockThreshold, p.active,
    p.duration_minutes AS durationMinutes, p.supplier_id AS supplierId
    FROM pos_products p LEFT JOIN pos_categories c ON c.id = p.category_id ORDER BY p.name COLLATE NOCASE`)
    .then((items) => items.map((item) => ({
      id: item.id, name: item.name, sku: item.sku || '', barcode: item.barcode || '',
      expiryDate: item.expiryDate || '',
      categoryId: item.categoryId, categoryName: item.categoryName || '',
      taxonomyCategoryId: item.taxonomyCategoryId || '',
      taxonomyCustomCategory: item.taxonomyCustomCategory || '',
      taxonomyAttributes: JSON.parse(item.taxonomyAttributesJson || '[]'),
      variants: JSON.parse(item.variantsJson || '[]'),
      pricedAttributes: JSON.parse(item.pricedAttributesJson || '[]'),
      price: fromCents(item.price_cents), buyingPrice: item.buying_price_cents == null ? null : fromCents(item.buying_price_cents),
      stock: item.stock, imageUri: item.imageUri, imageEmbedding: embeddingHexToInt8(item.imageEmbeddingHex || ''),
      lowStockThreshold: Number(item.lowStockThreshold) || 0,
      active: item.active !== 0,
      // The rule for what a service is lives in service-model.js; this only carries the stored duration.
      durationMinutes: serviceDuration({ duration_minutes: item.durationMinutes }),
      isService: isService({ duration_minutes: item.durationMinutes }),
      supplierId: item.supplierId || ''
    })));
}

async function listCategories() {
  return rows('SELECT id, name FROM pos_categories ORDER BY name COLLATE NOCASE');
}

async function saveProduct(data) {
  const id = Number(data.id || 0);
  const name = String(data.name || '').trim();
  let sku = String(data.sku || '').trim();
  let barcode = data.barcode === undefined ? '' : String(data.barcode || '').trim();
  let expiryDate = data.expiryDate === undefined ? '' : String(data.expiryDate || '').trim();
  if (id > 0 && (!sku || data.barcode === undefined)) {
    const existing = (await rows('SELECT sku,barcode,expiry_date FROM pos_products WHERE id = ?', [id]))[0];
    if (!sku) sku = existing?.sku || '';
    if (data.barcode === undefined) barcode = existing?.barcode || '';
    if (data.expiryDate === undefined) expiryDate = existing?.expiry_date || '';
  }
  while (!sku) {
    const candidate = createSku();
    const existing = (await rows('SELECT id FROM pos_products WHERE sku = ? LIMIT 1', [candidate]))[0];
    if (!existing) sku = candidate;
  }
  const categoryId = Number(data.categoryId);
  const priceCents = toCents(data.price);
  const buyingCents = String(data.buyingPrice ?? '').trim() === '' ? null : toCents(data.buyingPrice);
  let stock = String(data.stock ?? '').trim() === '' ? null : Number(data.stock);
  // A service is a product with a duration. It has nothing to count, so its stock is always untracked.
  let durationMinutes = null;
  let supplierId = data.supplierId === undefined ? undefined : String(data.supplierId || '').trim().slice(0, 120);
  const mentionsService = Object.hasOwn(data, 'isService') || Object.hasOwn(data, 'durationMinutes');
  if (mentionsService) {
    const flag = Object.hasOwn(data, 'isService')
      ? !(data.isService === false || data.isService === 0 || data.isService === '0' || data.isService === '' || data.isService == null)
      : true;
    if (flag) durationMinutes = normalizeServiceDuration(data.durationMinutes) || DEFAULT_SERVICE_MINUTES;
  }
  if ((!mentionsService || supplierId === undefined) && id > 0) {
    const kept = (await rows('SELECT duration_minutes,supplier_id FROM pos_products WHERE id=?', [id]))[0];
    if (!mentionsService) durationMinutes = kept?.duration_minutes || null;
    if (supplierId === undefined) supplierId = kept?.supplier_id || '';
  }
  if (durationMinutes) stock = null;
  const lowStockThreshold = Number(data.lowStockThreshold ?? 3);
  const active = data.active === false || data.active === '0' ? 0 : 1;
  const hasTaxonomyCategory = Object.hasOwn(data, 'taxonomyCategoryId');
  const hasTaxonomyCustomCategory = Object.hasOwn(data, 'taxonomyCustomCategory');
  const hasTaxonomyAttributes = Object.hasOwn(data, 'taxonomyAttributes');
  if (expiryDate) assertDate(expiryDate, 'Expiry date');
  if (!name || sku.length > 120 || barcode.length > 120 || !Number.isSafeInteger(categoryId) || categoryId <= 0 || !Number.isSafeInteger(priceCents) || priceCents < 0
    || (buyingCents !== null && (!Number.isSafeInteger(buyingCents) || buyingCents < 0))
    || (stock !== null && (!Number.isSafeInteger(stock) || stock < 0))
    || !Number.isSafeInteger(lowStockThreshold) || lowStockThreshold < 0) {
    throw new Error('Enter a name, category, valid prices, stock and reorder threshold.');
  }
  const category = (await rows('SELECT id FROM pos_categories WHERE id = ?', [categoryId]))[0];
  if (!category) throw new Error('Choose a category that still exists.');
  if (sku && (await rows('SELECT id FROM pos_products WHERE sku=? AND id<>? LIMIT 1', [sku, id]))[0]) {
    throw new Error('That barcode/SKU is already assigned to another product.');
  }
  if (barcode && (await rows('SELECT id FROM pos_products WHERE (barcode=? COLLATE NOCASE OR sku=? COLLATE NOCASE) AND id<>? LIMIT 1',
    [barcode, barcode, id]))[0]) {
    throw new Error('That barcode is already assigned to another product.');
  }
  let existingTaxonomy = {};
  if (id > 0 && (!hasTaxonomyCategory || !hasTaxonomyCustomCategory || !hasTaxonomyAttributes)) {
    existingTaxonomy = (await rows('SELECT taxonomy_category_id,taxonomy_custom_category,taxonomy_attributes_json FROM pos_products WHERE id=?', [id]))[0] || {};
  }
  const taxonomyCategoryId = hasTaxonomyCategory
    ? String(data.taxonomyCategoryId || '').trim() || null
    : existingTaxonomy.taxonomy_category_id || null;
  const taxonomyCustomCategory = hasTaxonomyCustomCategory
    ? String(data.taxonomyCustomCategory || '').trim().slice(0, 160) || null
    : existingTaxonomy.taxonomy_custom_category || null;
  const taxonomyAttributesJson = hasTaxonomyAttributes
    ? JSON.stringify(Array.isArray(data.taxonomyAttributes) ? data.taxonomyAttributes : [])
    : existingTaxonomy.taxonomy_attributes_json || '[]';
  const mentionsVariants = Object.hasOwn(data, 'variants');
  let variants = mentionsVariants ? normalizePosVariants(data.variants) : [];
  if (!mentionsVariants && id > 0) {
    variants = JSON.parse((await rows('SELECT variants_json FROM pos_products WHERE id=?', [id]))[0]?.variants_json || '[]');
  }
  // Time is not sold in sizes, and a sized product counts its stock per size.
  if (durationMinutes) variants = [];
  if (variants.length) stock = variants.reduce((total, variant) => total + variant.stock, 0);
  if (variants.length && (!Number.isSafeInteger(stock) || stock < 0)) throw new Error('Total option stock is too large.');
  const variantsJson = JSON.stringify(variants);
  const mentionsPricedAttributes = Object.hasOwn(data, 'pricedAttributes');
  let pricedAttributes = mentionsPricedAttributes ? normalizePricedAttributes(data.pricedAttributes) : [];
  if (!mentionsPricedAttributes && id > 0) {
    pricedAttributes = JSON.parse((await rows('SELECT priced_attributes_json FROM pos_products WHERE id=?', [id]))[0]?.priced_attributes_json || '[]');
  }
  const pricedAttributesJson = JSON.stringify(pricedAttributes);
  const values = [name, categoryId, priceCents, buyingCents, stock, sku || null, barcode || null, expiryDate || null,
    String(data.imageUri || '').trim() || null,
    lowStockThreshold, active, taxonomyCategoryId, taxonomyCustomCategory, taxonomyAttributesJson, variantsJson, pricedAttributesJson,
    durationMinutes, supplierId || null];
  const hasEmbedding = Object.hasOwn(data, 'imageEmbeddingHex');
  const embeddingHex = hasEmbedding ? String(data.imageEmbeddingHex || '') : '';
  if (hasEmbedding && embeddingHex && (!/^(?:[\da-f]{2}){128,4096}$/i.test(embeddingHex))) {
    throw new Error('The product image match profile is invalid. Choose the photo again and retry.');
  }
  if (id > 0) {
    const embeddingUpdate = hasEmbedding ? `,image_embedding=${embeddingHex ? `X'${embeddingHex}'` : 'NULL'}` : '';
    const result = await run(`UPDATE pos_products SET name=?,category_id=?,price_cents=?,buying_price_cents=?,stock_count=?,sku=?,barcode=?,expiry_date=?,image_uri=?,low_stock_threshold=?,active=?,taxonomy_category_id=?,taxonomy_custom_category=?,taxonomy_attributes_json=?,variants_json=?,priced_attributes_json=?,duration_minutes=?,supplier_id=?${embeddingUpdate} WHERE id=?`, [...values, id]);
    if (!result.changes?.changes) throw new Error('This product could not be found. Refresh and try again.');
    await recordSharedStockUpdate(sku, stock);
    return id;
  }
  const embeddingColumn = hasEmbedding ? ',image_embedding' : '';
  const embeddingValue = hasEmbedding ? `,${embeddingHex ? `X'${embeddingHex}'` : 'NULL'}` : '';
  const result = await run(`INSERT INTO pos_products (name,category_id,price_cents,buying_price_cents,stock_count,sku,barcode,expiry_date,image_uri,low_stock_threshold,active,taxonomy_category_id,taxonomy_custom_category,taxonomy_attributes_json,variants_json,priced_attributes_json,duration_minutes,supplier_id,created_at${embeddingColumn}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?${embeddingValue})`, [...values, nowIso()]);
  await recordSharedStockUpdate(sku, stock);
  return result.changes?.lastId;
}

async function addCategory(name) {
  const value = String(name || '').trim();
  if (!value) throw new Error('Enter a category name.');
  await run('INSERT INTO pos_categories (name) VALUES (?)', [value]);
}

async function deleteProduct(id) {
  await run('DELETE FROM pos_products WHERE id = ?', [Number(id)]);
}

  function embeddingHexToInt8(hex) {
    const value = String(hex || '');
    if (!value || value.length % 2 || !/^[\da-f]+$/i.test(value)) return new Int8Array(0);
    const embedding = new Int8Array(value.length / 2);
    for (let index = 0; index < embedding.length; index += 1) {
      const unsigned = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
      embedding[index] = unsigned > 127 ? unsigned - 256 : unsigned;
    }
    return embedding;
  }

export { listProducts, listCategories, saveProduct, addCategory, deleteProduct };
