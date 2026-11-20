// Cloud sync records: stable record IDs, queueing products, categories, expenses and settings,
// seeding the catalogue, and applying a change that came from the cloud. Moved verbatim from pos.js:
// change sync behavior only with the owner's OK.
import { normalizeServiceDuration } from '../service-model.js';
import { saveBusinessRecord } from './business-records.js';
import { rows, run, stmt, transaction } from './db.js';
import { listExpenses } from './expenses.js';
import { createSku, nowIso, toCents } from './format.js';
import { addCategory, listCategories, listProducts } from './products.js';
import { listSales } from './sales.js';
import { getSettings, saveSettings } from './settings-store.js';

export function createSyncRecords({ queueCloudRecord, state }) {
  // Keep sync IDs identical when Web Crypto is unavailable in local mobile WebViews.
  function sha256Fallback(bytes) {
    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    const bitLength = bytes.length * 8;
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
    view.setUint32(paddedLength - 4, bitLength >>> 0);
    const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const rotateRight = (value, bits) => (value >>> bits) | (value << (32 - bits));
    for (let offset = 0; offset < paddedLength; offset += 64) {
      const words = new Uint32Array(64);
      for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
      for (let index = 16; index < 64; index += 1) {
        const left = words[index - 15];
        const right = words[index - 2];
        const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
        const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
        words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = hash;
      for (let index = 0; index < 64; index += 1) {
        const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choice = (e & f) ^ (~e & g);
        const first = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
        const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const second = (sum0 + majority) >>> 0;
        [a, b, c, d, e, f, g, h] = [
          (first + second) >>> 0, a, b, c, (d + first) >>> 0, e, f, g
        ];
      }
      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }
    return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
  }

  async function stableRecordId(prefix, value) {
    const bytes = new TextEncoder().encode(String(value));
    const subtle = globalThis.crypto?.subtle;
    if (!subtle?.digest) return `${prefix}-${sha256Fallback(bytes)}`;
    const digest = await subtle.digest('SHA-256', bytes);
    return `${prefix}-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  async function queueProduct(product, deleted = false) {
    if (!product || !Number.isSafeInteger(Number(product.id)) || Number(product.id) <= 0) {
      throw new Error('This product needs a saved product ID before it can sync.');
    }
    if (!product.sku) {
      let sku = '';
      while (!sku) {
        const candidate = createSku();
        const existing = (await rows('SELECT id FROM pos_products WHERE sku=? LIMIT 1', [candidate]))[0];
        if (!existing) sku = candidate;
      }
      await run('UPDATE pos_products SET sku=? WHERE id=? AND (sku IS NULL OR sku=?)', [sku, Number(product.id), '']);
      const updated = (await rows('SELECT sku FROM pos_products WHERE id=?', [Number(product.id)]))[0]?.sku;
      if (!updated) throw new Error(`Could not assign a sync SKU to ${product.name || 'a product'}.`);
      product.sku = updated;
    }
    const recordId = await stableRecordId('PRODUCT', product.sku);
    const imageUri = /^https?:\/\//i.test(product.imageUri || '') ? product.imageUri : '';
    const { imageEmbedding, imageEmbeddingHex, ...syncProduct } = product;
    await queueCloudRecord('product', recordId, { ...syncProduct, imageUri }, deleted);
  }

  async function queueCategory(category, deleted = false) {
    if (!category?.name) return;
    const recordId = await stableRecordId('CATEGORY', category.name.trim().toLocaleLowerCase());
    await queueCloudRecord('category', recordId, { name: category.name.trim() }, deleted);
  }

  async function queueExpense(expense, deleted = false) {
    if (!expense?.sync_key) throw new Error('This expense is missing its sync identity; edit and save it again.');
    await queueCloudRecord('expense', expense.sync_key, {
      expenseDate: expense.expense_date,
      category: expense.category,
      label: expense.label,
      amountCents: Number(expense.amount_cents),
      currency: expense.currency,
      paymentMethod: expense.payment_method,
      note: expense.note || '',
      createdAt: expense.created_at
    }, deleted);
  }

  async function queueSettings() {
    const settings = await getSettings();
    await queueCloudRecord('setting', 'settings', {
      taxRate: settings.taxRate,
      currency: settings.currency,
      monthlyRevenueGoal: settings.monthlyRevenueGoal,
      monthlyRevenueGoalCurrency: settings.monthlyRevenueGoalCurrency
    });
  }

  async function seedCatalogueSync() {
    for (const category of await listCategories()) await queueCategory(category);
    for (const product of await listProducts()) await queueProduct(product);
    for (const expense of await listExpenses()) await queueExpense(expense);
    await queueSettings();
  }

  async function seedCloudCatalogueForTenant(tenantId) {
    const seedKey = `cloud_catalogue_seeded:${tenantId}`;
    const seeded = (await rows('SELECT value FROM pos_settings WHERE key=?', [seedKey]))[0]?.value;
    if (seeded === '1') return;
    await seedCatalogueSync();
    for (const sale of await listSales()) {
      await saveBusinessRecord('sale', sale.receipt_number, sale, false, 0, tenantId);
    }
    await run('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', [seedKey, '1']);
  }

  async function applyRemoteChange(change) {
    const payload = change.payload;
    if (change.entity === 'category') {
      const category = (await listCategories()).find((item) => item.name.toLocaleLowerCase() === String(payload.name || '').toLocaleLowerCase());
      if (change.deleted) {
        if (category && category.name.toLocaleLowerCase() !== 'other') {
          const products = await listProducts();
          const fallback = (await listCategories()).find((item) => item.name.toLocaleLowerCase() === 'other');
          const statements = products.filter((item) => item.categoryId === category.id && fallback)
            .map((item) => stmt('UPDATE pos_products SET category_id=? WHERE id=?', [fallback.id, item.id]));
          statements.push(stmt('DELETE FROM pos_categories WHERE id=?', [category.id]));
          await transaction(statements);
        }
      } else if (!category) {
        await addCategory(payload.name);
      }
      return;
    }
    if (change.entity === 'product') {
      const product = (await listProducts()).find((item) => item.sku === payload.sku);
      if (change.deleted) {
        if (product) await run('DELETE FROM pos_products WHERE id=?', [product.id]);
        return;
      }
      let category = (await listCategories()).find((item) => item.name.toLocaleLowerCase() === String(payload.categoryName || '').toLocaleLowerCase());
      if (!category) {
        await addCategory(payload.categoryName || 'Other');
        category = (await listCategories()).find((item) => item.name.toLocaleLowerCase() === String(payload.categoryName || 'Other').toLocaleLowerCase());
      }
      if (!category) throw new Error('Could not restore a synced product category.');
      const values = [payload.name, category.id, toCents(payload.price), payload.buyingPrice == null ? null : toCents(payload.buyingPrice),
        payload.stock == null ? null : Number(payload.stock), payload.sku, payload.barcode || product?.barcode || null,
        payload.expiryDate || product?.expiryDate || null,
        String(payload.imageUri || '').slice(0, 200_000),
        Number(payload.lowStockThreshold) || 0, payload.active === false ? 0 : 1];
      // Older payloads carry no service or supplier fields; they must not wipe what this device already knows.
      const remoteDuration = payload.durationMinutes === undefined
        ? product?.durationMinutes || null : normalizeServiceDuration(payload.durationMinutes) || null;
      if (remoteDuration) values[4] = null;
      const remoteSupplier = payload.supplierId === undefined ? product?.supplierId || null : String(payload.supplierId || '') || null;
      values.push(remoteDuration, remoteSupplier);
      if (product) {
        await run(`UPDATE pos_products SET name=?,category_id=?,price_cents=?,buying_price_cents=?,stock_count=?,sku=?,barcode=?,expiry_date=?,image_uri=?,
          low_stock_threshold=?,active=?,duration_minutes=?,supplier_id=? WHERE id=?`, [...values, product.id]);
      } else {
        await run(`INSERT INTO pos_products (name,category_id,price_cents,buying_price_cents,stock_count,sku,barcode,expiry_date,image_uri,
          low_stock_threshold,active,duration_minutes,supplier_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [...values, nowIso()]);
      }
      return;
    }
    if (change.entity === 'expense') {
      const current = (await rows('SELECT id FROM pos_expenses WHERE sync_key=?', [change.record_id]))[0];
      if (change.deleted) {
        if (current) await run('DELETE FROM pos_expenses WHERE id=?', [current.id]);
        return;
      }
      const values = [payload.expenseDate, payload.category, payload.label, Number(payload.amountCents),
        payload.currency, payload.paymentMethod, payload.note || ''];
      if (current) {
        await run(`UPDATE pos_expenses SET expense_date=?,category=?,label=?,amount_cents=?,currency=?,payment_method=?,note=? WHERE id=?`,
          [...values, current.id]);
      } else {
        await run(`INSERT INTO pos_expenses (sync_key,expense_date,category,label,amount_cents,currency,payment_method,note,created_at)
          VALUES (?,?,?,?,?,?,?,?,?)`, [change.record_id, ...values, payload.createdAt || nowIso()]);
      }
      return;
    }
    if (change.entity === 'setting') {
      await saveSettings(payload.taxRate, payload.currency);
      if (payload.monthlyRevenueGoal && payload.monthlyRevenueGoalCurrency) {
        await transaction([
          stmt('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)',
            ['monthly_revenue_goal_cents', String(payload.monthlyRevenueGoal)]),
          stmt('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)',
            ['monthly_revenue_goal_currency', payload.monthlyRevenueGoalCurrency])
        ]);
      } else {
        await transaction([
          stmt("DELETE FROM pos_settings WHERE key='monthly_revenue_goal_cents'", []),
          stmt("DELETE FROM pos_settings WHERE key='monthly_revenue_goal_currency'", [])
        ]);
      }
      return;
    }
    if (!['supplier', 'purchase', 'ticket', 'sale'].includes(change.entity)) {
      throw new Error('Cloud sync returned an unsupported business record.');
    }
    const payloadJson = JSON.stringify(payload);
    await run(`INSERT INTO pos_business_records
      (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,entity,record_id) DO UPDATE SET
      payload_json=excluded.payload_json,deleted=excluded.deleted,
      server_revision=excluded.server_revision,updated_at=excluded.updated_at
      WHERE excluded.server_revision > pos_business_records.server_revision
        OR excluded.updated_at > pos_business_records.updated_at`,
    [state.cloudScopeId, change.entity, change.record_id, payloadJson, change.deleted ? 1 : 0,
      Number(change.revision) || 0, change.changed_at || nowIso()]);
  }

  return {
    queueProduct, queueCategory, queueExpense, queueSettings, seedCatalogueSync,
    seedCloudCatalogueForTenant, applyRemoteChange
  };
}
