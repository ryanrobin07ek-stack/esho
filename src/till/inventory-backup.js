// Inventory backup, restore and CSV import/export.
import { csvRows, nowIso, today } from './format.js';
import { addCategory, listCategories, listProducts, saveProduct } from './products.js';
import { createSafetyCopy, dropSafetyCopy, restoreSafetyCopy } from './safety-copy.js';

export function createInventoryBackup({ queueProduct, queueCategory, toast, refresh }) {
  // Restoring an inventory backup overwrites the price, stock and visibility of every product it
  // matches, so it is split into read (validate only), plan (what would change) and apply (atomic).
  async function readInventoryBackup(file) {
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      throw new Error('The selected file is not valid JSON.');
    }
    if (!backup || backup.format !== 'audit-pos-inventory' || backup.version !== 1
      || !Array.isArray(backup.categories) || !Array.isArray(backup.products)) {
      throw new Error('Choose a supported POS inventory backup.');
    }
    const validCategories = backup.categories.every((category) => typeof category === 'string' && category.trim());
    const validProducts = backup.products.every((product) => product && typeof product.name === 'string' && product.name.trim()
      && typeof product.categoryName === 'string' && product.categoryName.trim()
      && (product.sku === undefined || (typeof product.sku === 'string' && product.sku.length <= 120))
      && (product.barcode === undefined || (typeof product.barcode === 'string' && product.barcode.length <= 120))
      && (product.expiryDate === undefined || (typeof product.expiryDate === 'string' && (!product.expiryDate || /^\d{4}-\d{2}-\d{2}$/.test(product.expiryDate))))
      && Number.isFinite(product.price) && product.price >= 0
      && (product.buyingPrice == null || (Number.isFinite(product.buyingPrice) && product.buyingPrice >= 0))
      && (product.stock == null || (Number.isSafeInteger(product.stock) && product.stock >= 0))
      && (product.image == null || (typeof product.image.mimeType === 'string' && /^image\/[A-Za-z0-9.+-]+$/.test(product.image.mimeType)
        && typeof product.image.base64 === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(product.image.base64))));
    if (!validCategories || !validProducts) throw new Error('The backup contains invalid inventory details.');
    return backup;
  }

  const normalizeBackupName = (name) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

  // What a restore writes for the details a backup may not carry. A backup never blanks something the
  // shop has now: photos are exported only when they are embedded (data:) images, so a linked
  // https image, a cost price, a barcode or an expiry date that is missing from the backup stays as it is.
  function restoredDetails(existing, item) {
    return {
      imageUri: item.image ? `data:${item.image.mimeType};base64,${item.image.base64}` : (existing?.imageUri || null),
      buyingPrice: item.buyingPrice ?? existing?.buyingPrice ?? null,
      barcode: item.barcode || existing?.barcode || '',
      expiryDate: item.expiryDate || existing?.expiryDate || '',
      lowStockThreshold: item.lowStockThreshold ?? existing?.lowStockThreshold ?? 3
    };
  }

  // Human-readable list of everything a restore would change on an existing product.
  function restoreChanges(existing, item) {
    const next = restoredDetails(existing, item);
    const changes = [];
    if ((existing.stock ?? null) !== (item.stock ?? null)) changes.push('stock');
    if (Number(existing.price) !== Number(item.price)) changes.push('price');
    if (Boolean(existing.active) !== (item.active !== false)) changes.push('visibility');
    if ((existing.imageUri || null) !== next.imageUri) changes.push('photo');
    if ((existing.buyingPrice ?? null) !== next.buyingPrice) changes.push('buying price');
    if ((existing.barcode || '') !== next.barcode) changes.push('barcode');
    if ((existing.expiryDate || '') !== next.expiryDate) changes.push('expiry date');
    if (Number(existing.lowStockThreshold ?? 3) !== Number(next.lowStockThreshold)) changes.push('reorder level');
    return changes;
  }

  async function planInventoryRestore(backup) {
    const categoryIds = new Map((await listCategories()).map((category) => [normalizeBackupName(category.name), category.id]));
    const products = await listProducts();
    const created = [];
    const overwritten = [];
    for (const item of backup.products) {
      const categoryId = categoryIds.get(normalizeBackupName(item.categoryName));
      const existing = products.find((product) => item.sku
        ? product.sku === item.sku
        : categoryId !== undefined && product.categoryId === categoryId && normalizeBackupName(product.name) === normalizeBackupName(item.name));
      if (!existing) {
        created.push(item);
        continue;
      }
      const changes = restoreChanges(existing, item);
      if (changes.length) overwritten.push({ item, existing, changes, stockChanged: changes.includes('stock') });
    }
    const overwrittenFields = [...new Set(overwritten.flatMap((entry) => entry.changes))];
    const date = backup.createdAt ? String(backup.createdAt).slice(0, 10) : 'an unknown date';
    const stockChanges = overwritten.filter((entry) => entry.stockChanged);
    const lines = stockChanges.slice(0, 5)
      .map((entry) => `• ${entry.existing.name}: stock ${entry.existing.stock ?? 'not tracked'} → ${entry.item.stock ?? 'not tracked'}`);
    const message = `Restore ${backup.products.length} product${backup.products.length === 1 ? '' : 's'} from the backup made on ${date}?\n\n`
      + `${created.length} new product${created.length === 1 ? '' : 's'} will be added. `
      + `${overwritten.length} existing product${overwritten.length === 1 ? '' : 's'} will be overwritten with the backup’s ${overwrittenFields.length ? overwrittenFields.join(', ') : 'price, stock and visibility'}`
      + `${overwritten.length ? ', which may be older than what you have now' : ''}.`
      + `${lines.length ? `\n\n${lines.join('\n')}${stockChanges.length > lines.length ? '\n• …' : ''}` : ''}`
      + '\n\nProducts that are not in the backup are kept. The restore is all-or-nothing: if anything fails, nothing is changed.';
    return { created, overwritten, message };
  }

  async function applyInventoryRestore(backup) {
    const tables = ['pos_categories', 'pos_products'];
    await createSafetyCopy(tables);
    let restoredIds;
    try {
      const categoryIds = new Map((await listCategories()).map((category) => [normalizeBackupName(category.name), category.id]));
      for (const name of [...backup.categories, ...backup.products.map((item) => item.categoryName)]) {
        if (categoryIds.has(normalizeBackupName(name))) continue;
        await addCategory(name.trim());
        (await listCategories()).forEach((category) => categoryIds.set(normalizeBackupName(category.name), category.id));
      }
      let products = await listProducts();
      restoredIds = [];
      for (const item of backup.products) {
        const categoryId = categoryIds.get(normalizeBackupName(item.categoryName));
        if (!categoryId) throw new Error(`Could not restore category "${item.categoryName}".`);
        const existing = products.find((product) => item.sku
          ? product.sku === item.sku
          : product.categoryId === categoryId && normalizeBackupName(product.name) === normalizeBackupName(item.name));
        const details = restoredDetails(existing, item);
        restoredIds.push(await saveProduct({
          id: existing?.id || 0, name: item.name.trim(), categoryId, price: item.price,
          buyingPrice: details.buyingPrice, stock: item.stock, sku: item.sku || existing?.sku || '',
          barcode: details.barcode, expiryDate: details.expiryDate, imageUri: details.imageUri,
          lowStockThreshold: details.lowStockThreshold, active: item.active !== false
        }));
        products = await listProducts();
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The restore failed.';
      try {
        await restoreSafetyCopy(tables);
      } catch {
        throw new Error(`${reason} Your previous catalogue is kept in a safety copy and will be restored when the POS next starts.`);
      }
      throw new Error(`${reason} Nothing was changed.`);
    }
    await dropSafetyCopy(tables);
    const restored = new Set(restoredIds);
    for (const product of (await listProducts()).filter((entry) => restored.has(entry.id))) {
      await queueProduct(product);
    }
    return backup.products.length;
  }

  async function exportInventory() {
    const [categories, products] = await Promise.all([listCategories(), listProducts()]);
    const backup = {
      format: 'audit-pos-inventory', version: 1, createdAt: nowIso(),
      categories: categories.map((item) => item.name),
      products: products.map((product) => {
        const image = /^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(product.imageUri || '');
        return { name: product.name, sku: product.sku, barcode: product.barcode,
          expiryDate: product.expiryDate, categoryName: product.categoryName, price: product.price,
          buyingPrice: product.buyingPrice, stock: product.stock, lowStockThreshold: product.lowStockThreshold,
          active: product.active, image: image ? { mimeType: image[1], base64: image[2] } : null };
      })
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `eshop-pos-inventory-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importInventoryCsv(file) {
    const records = csvRows(await file.text());
    if (records.length < 2) throw new Error('The CSV must include a header and at least one product.');
    const headers = records.shift().map((header) => header.trim().toLocaleLowerCase().replace(/[\s_-]+/g, ''));
    const column = (name) => headers.indexOf(name);
    if (column('name') < 0 || column('price') < 0 || new Set(headers).size !== headers.length) {
      throw new Error('CSV needs unique headers including name and price.');
    }
    const values = (record, name) => column(name) < 0 ? '' : String(record[column(name)] ?? '').trim();
    const existingProducts = await listProducts();
    const existingCategories = await listCategories();
    const normalize = (value) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const categoryMap = new Map(existingCategories.map((item) => [normalize(item.name), item]));
    const parsed = records.map((record, index) => {
      if (record.length > headers.length) throw new Error(`CSV row ${index + 2} has more cells than headers.`);
      const name = values(record, 'name');
      const sku = values(record, 'sku');
      const barcode = values(record, 'barcode');
      const expiryDate = values(record, 'expirydate');
      const price = Number(values(record, 'price'));
      const costText = values(record, 'buyingprice') || values(record, 'cost');
      const buyingPrice = costText ? Number(costText) : null;
      const stockText = values(record, 'stock');
      const stock = stockText ? Number(stockText) : null;
      const thresholdText = values(record, 'lowstockthreshold') || values(record, 'reorderat');
      const threshold = thresholdText ? Number(thresholdText) : null;
      const activeText = values(record, 'active').toLocaleLowerCase();
      const categoryName = values(record, 'category');
      if (!name || !Number.isFinite(price) || price < 0
        || (buyingPrice !== null && (!Number.isFinite(buyingPrice) || buyingPrice < 0))
        || (stock !== null && (!Number.isSafeInteger(stock) || stock < 0))
        || (threshold !== null && (!Number.isSafeInteger(threshold) || threshold < 0))
        || (sku && sku.length > 120) || (barcode && barcode.length > 120)
        || (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate))
        || (activeText && !['1', '0', 'true', 'false', 'yes', 'no', 'active', 'disabled'].includes(activeText))) {
        throw new Error(`CSV row ${index + 2} has invalid product details.`);
      }
      const existing = (sku && existingProducts.find((item) => item.sku === sku))
        || (barcode && existingProducts.find((item) => item.barcode === barcode))
        || existingProducts.find((item) => normalize(item.name) === normalize(name));
      const category = categoryName
        ? categoryMap.get(normalize(categoryName)) || { name: categoryName, id: 0 }
        : existingCategories.find((item) => item.id === existing?.categoryId)
          || existingCategories.find((item) => normalize(item.name) === 'other');
      if (!category) throw new Error(`CSV row ${index + 2} needs a category or a default "Other" category.`);
      return { index, name, sku: sku || existing?.sku || '', barcode: barcode || existing?.barcode || '',
        expiryDate: expiryDate || existing?.expiryDate || '', price,
        buyingPrice: buyingPrice ?? existing?.buyingPrice ?? null,
        stock: stockText ? stock : existing?.stock ?? 0,
        lowStockThreshold: threshold ?? existing?.lowStockThreshold ?? 3,
        active: activeText ? !['0', 'false', 'no', 'disabled'].includes(activeText) : existing?.active ?? true,
        imageUri: existing?.imageUri || '', existing, categoryName: category.name };
    });
    const knownSkus = new Set(existingProducts.map((item) => item.sku).filter(Boolean));
    const knownBarcodes = new Set(existingProducts.map((item) => item.barcode).filter(Boolean));
    const incomingSkus = new Set();
    const incomingBarcodes = new Set();
    for (const item of parsed) {
      if (item.sku && (incomingSkus.has(item.sku) || (knownSkus.has(item.sku) && !item.existing))) {
        throw new Error(`CSV contains a duplicate or conflicting SKU "${item.sku}".`);
      }
      if (item.sku) incomingSkus.add(item.sku);
      if (item.barcode && (incomingBarcodes.has(item.barcode) || (knownBarcodes.has(item.barcode) && !item.existing))) {
        throw new Error(`CSV contains a duplicate or conflicting barcode "${item.barcode}".`);
      }
      if (item.barcode) incomingBarcodes.add(item.barcode);
    }
    if (!confirm(`Import ${parsed.length} products? Matching SKU or name will be updated; other products will remain.`)) return 0;
    for (const item of parsed) {
      let category = categoryMap.get(normalize(item.categoryName));
      if (!category) {
        await addCategory(item.categoryName);
        category = (await listCategories()).find((entry) => normalize(entry.name) === normalize(item.categoryName));
        if (!category) throw new Error(`Could not create category "${item.categoryName}".`);
        categoryMap.set(normalize(item.categoryName), category);
        await queueCategory(category);
      }
      const productId = await saveProduct({ ...item, id: item.existing?.id || 0, categoryId: category.id });
      await queueProduct((await listProducts()).find((product) => product.id === productId));
    }
    return parsed.length;
  }

  async function handleFileChange(event) {
    const input = event.target.closest('[data-pos-import], [data-pos-csv-import]');
    if (!input || !input.files?.[0]) return;
    try {
      let count;
      if (input.matches('[data-pos-csv-import]')) {
        count = await importInventoryCsv(input.files[0]);
      } else {
        const backup = await readInventoryBackup(input.files[0]);
        const plan = await planInventoryRestore(backup);
        if (!confirm(plan.message)) {
          toast('Restore cancelled. Nothing was changed.');
          return;
        }
        count = await applyInventoryRestore(backup);
      }
      if (count) {
        toast(`${count} product${count === 1 ? '' : 's'} imported.`);
        await refresh();
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not import this inventory file.', true);
    } finally {
      input.value = '';
    }
  }

  return { exportInventory, handleFileChange };
}
