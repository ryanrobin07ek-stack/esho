// Catalogue screens: inventory, products and categories. One renderer serves all three
// (they share the product form and the product/category cards); suppliers has its own module.
import { createAttributePricingFields } from '../../attribute-pricing-fields.js';
import { createProductTaxonomyFields } from '../../product-taxonomy.js';
import { createProductVariantFields } from '../../product-variants.js';
import { DEFAULT_SERVICE_MINUTES } from '../../service-model.js';
import { durationLabel, escapeHtml, money, serviceChoices } from '../../till/format.js';

export function createCatalogueInventoryScreen({
  state, renderSuppliers, tabsTitle, card, button, field, select, iconButton, editIcon, deleteIcon,
  iconLink, statusTag
}) {
  function renderInventory(params, screen = '/inventory') {
    const edit = Number(params.get('edit') || 0);
    const product = state.products.find((item) => item.id === edit);
    const categories = state.categories;
    const websites = typeof window.EshopInventoryBridge?.websites === 'function'
      ? window.EshopInventoryBridge.websites() : [];
    const inventoryCloudLinked = state.sharedTenantId &&
      window.EshopInventoryBridge?.hasTenantOwnerKey?.(state.sharedTenantId) !== false;
    const websiteChoices = websites.map((website) => [website.tenant_id, website.name || website.tenant_id]);
    const selectedWebsite = state.sharedTenantId || websiteChoices[0]?.[0] || '';
    const requestedBarcode = params.get('barcode') || '';
    const productForm = (item = null) => `<form class="pos-form pos-editor-form" data-pos-form="product" novalidate>
      <input type="hidden" name="id" value="${item?.id || 0}">
      ${field('Product name', 'name', item?.name || '', { required: true, placeholder: 'Name' })}
      <input type="hidden" name="sku" value="${escapeHtml(item?.sku || '')}">
      <div class="pos-form-actions">
        <button type="button" class="btn-secondary" data-pos-action="scan-barcode">Scan barcode (optional)</button>
        <button type="button" class="btn-secondary" data-pos-action="scan-product-label">Scan product label</button>
      </div>
      <p class="pos-help">Scan a barcode or enter it below. A separate SKU is assigned automatically when needed.</p>
      ${field('Barcode · optional', 'barcode', item?.barcode || requestedBarcode, { placeholder: 'EAN, UPC or Code 128' })}
      <p class="pos-help" data-product-barcode-status role="status" aria-live="polite">${requestedBarcode
        ? `Barcode ${escapeHtml(requestedBarcode)} captured successfully. Complete the product details and save.`
        : item?.barcode ? `Saved barcode: ${escapeHtml(item.barcode)}`
          : 'No barcode captured yet.'}</p>
      <p class="pos-help" data-product-ocr-status role="status" aria-live="polite">OCR suggestions are optional; check them before saving.</p>
      ${select('Category', 'categoryId', categories.map((cat) => [cat.id, cat.name]), item?.categoryId || categories[0]?.id)}
      ${createProductTaxonomyFields({
        categoryId: item?.taxonomyCategoryId,
        customCategory: item?.taxonomyCustomCategory,
        attributes: item?.taxonomyAttributes,
        // The POS form owns the "categoryId" field above; the picker must not submit a second one.
        storeCategoryFieldName: ''
      })}
      ${select('Item type · a service is sold by time and has no stock', 'isService', [[0, 'Product'], [1, 'Service']], item?.isService ? 1 : 0)}
      <div data-service-duration ${item?.isService ? '' : 'hidden'}>${select('Duration', 'durationMinutes', serviceChoices(), item?.durationMinutes || DEFAULT_SERVICE_MINUTES)}</div>
      ${field('Selling price', 'price', item?.price ?? '', { type: 'number', min: '0', step: '0.01', required: true })}
      ${field('Expiry date · optional', 'expiryDate', item?.expiryDate || '', { type: 'date' })}
      ${field('Unit cost · optional', 'buyingPrice', item?.buyingPrice ?? '', { type: 'number', min: '0', step: '0.01' })}
      <div data-product-stock-field ${item?.isService ? 'hidden' : ''}>${field('Stock · blank means untracked', 'stock', item?.stock ?? '', { type: 'number', min: '0', step: '1' })}</div>
      <div data-product-attribute-pricing>${createAttributePricingFields({
        pricedAttributes: item?.pricedAttributes || []
      })}</div>
      <div data-product-variants-field ${item?.isService ? 'hidden' : ''}>${createProductVariantFields({
        variants: item?.variants || [],
        option1Name: item?.variants?.[0]?.option1_name || '',
        option2Name: item?.variants?.[0]?.option2_name || ''
      })}</div>
      ${state.suppliers.length ? select('Supplier · optional', 'supplierId', [['', 'No supplier'], ...state.suppliers.map((supplier) => [supplier.id, supplier.name])], item?.supplierId || '') : ''}
      ${field('Image URL · optional', 'imageUri', /^https?:\/\//i.test(item?.imageUri || '') ? item.imageUri : '', { placeholder: 'https://…' })}
      <input type="hidden" name="capturedProductImage" value="${/^data:image\//i.test(item?.imageUri || '') ? escapeHtml(item.imageUri) : ''}">
      <div class="pos-form-actions"><button type="button" class="btn-secondary" data-pos-action="take-product-photo">Take product photo</button></div>
      <label class="pos-field"><span>Upload image · max 1 MB</span><input name="imageFile" type="file" accept="image/*"></label>
      <img class="pos-product-image-preview" data-product-image-preview src="${escapeHtml(item?.imageUri || '')}" alt="Product photo preview" ${item?.imageUri ? '' : 'hidden'}>
      <p class="pos-help" data-product-image-capture-status role="status" aria-live="polite">Take a product photo or upload one to enable image suggestions and matching.</p>
      <div class="pos-form-actions"><button type="button" class="btn-secondary" data-pos-action="suggest-image-category">Suggest category from photo</button></div>
      <p class="pos-help" data-product-image-status role="status" aria-live="polite">Category suggestions use on-device image labels and never save automatically.</p>
      <div class="pos-image-category-suggestions" data-image-category-suggestions hidden></div>
      ${field('Reorder alert at', 'lowStockThreshold', item?.lowStockThreshold ?? 3, { type: 'number', min: '0', step: '1' })}
      ${select('POS status', 'active', [[1, 'Active'], [0, 'Disabled']], item?.active === false ? 0 : 1)}
      <div class="pos-form-actions"><button class="btn-primary" type="submit">${item ? 'Save product' : 'Add product'}</button>
        ${item ? `<a href="/pos/inventory" data-route="/pos/inventory" class="btn-secondary">Cancel</a>` : ''}</div>
      <p class="pos-help" data-product-submit-status role="status" aria-live="polite">Selling price is required. Photo matching is prepared after the product is saved.</p>
    </form>`;
    const categoryDetailsCards = () => `<div class="pos-mobile-catalogue" aria-label="Categories">
      ${categories.map((category) => {
        const productsInCategory = state.products.filter((item) => item.categoryId === category.id);
        const productNames = productsInCategory.slice(0, 5).map((item) => escapeHtml(item.name)).join(', ');
        const remainingCount = productsInCategory.length - 5;
        const isDefault = category.name.toLowerCase() === 'other';
        return `<details class="pos-catalogue-item">
          <summary><strong>${escapeHtml(category.name)}</strong><span class="pos-catalogue-chevron" aria-hidden="true"></span></summary>
          <div class="pos-catalogue-item-details">
            <p class="pos-help">${productNames ? `Products: ${productNames}${remainingCount > 0 ? ` and ${remainingCount} more` : ''}` : 'No products in this category.'}</p>
            ${isDefault ? '<p class="pos-help">Default category · cannot be deleted.</p>' : `<div class="pos-row-actions">
              ${iconButton('rename-category', category.id, `Edit ${category.name}`, editIcon)}
              ${iconButton('delete-category', category.id, `Delete ${category.name}`, deleteIcon)}
            </div>`}
          </div>
        </details>`;
      }).join('')}
    </div>`;
    const supplierLabel = (supplierId) => state.suppliers.find((supplier) => supplier.id === supplierId)?.name || '';
    const stockText = (item, untracked, tracked = (count) => String(count)) => item.isService
      ? `Service · ${durationLabel(item.durationMinutes)}` : item.stock === null ? untracked : tracked(item.stock);
    const supplierFilter = params.get('supplier') || '';
    const visibleProducts = state.products.filter((item) => !supplierFilter
      || (supplierFilter === 'none' ? !item.supplierId : item.supplierId === supplierFilter));
    const productDetailsCards = (editPath, summaryMode = 'product', includeSync = false) => `<div class="pos-mobile-catalogue" aria-label="Products">
      ${visibleProducts.map((item) => `<details class="pos-catalogue-item">
        <summary>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${summaryMode === 'inventory'
            ? stockText(item, 'Not tracked', (count) => `${count} in stock`)
            : money(item.price, state.settings.currency)}</small>
          <span class="pos-catalogue-chevron" aria-hidden="true"></span>
        </summary>
        <div class="pos-catalogue-item-details">
          <div class="pos-catalogue-detail-values">
            <div><small>SKU</small><strong>${escapeHtml(item.sku || '—')}</strong></div>
            <div><small>Stock</small><strong>${stockText(item, 'Not tracked', (count) => `${count} on hand`)}</strong></div>
            <div><small>Supplier</small><strong>${escapeHtml(supplierLabel(item.supplierId) || 'Not set')}</strong></div>
            <div><small>Unit cost</small><strong>${item.buyingPrice == null ? 'Not recorded' : money(item.buyingPrice, state.settings.currency)}</strong></div>
            <div><small>Reorder at</small><strong>${item.lowStockThreshold}</strong></div>
            <div><small>Status</small><strong>${item.active ? 'Active' : 'Disabled'}</strong></div>
            <div><small>Expiry date</small><strong>${escapeHtml(item.expiryDate || 'Not set')}</strong></div>
          </div>
          <div class="pos-row-actions">
            ${iconLink(`${editPath}?edit=${item.id}`, `Edit ${item.name}`)}
            ${iconButton('delete-product', item.id, `Delete ${item.name}`, deleteIcon)}
            ${includeSync && item.sku ? button('Sync details to active website draft', 'sync-product-details', `data-id="${item.id}"`, true) : ''}
          </div>
        </div>
      </details>`).join('') || '<p class="pos-help">No products yet.</p>'}
    </div>`;
    if (screen === '/catalogue/products') {
      return `<section class="pos-content">
        ${tabsTitle('Products', `${state.products.length} products`, `<a href="/pos/catalogue/products?new=1" data-route="/pos/catalogue/products?new=1" class="btn-primary">Add product</a>`)}
        ${params.get('edit') || params.get('new') === '1' ? card(`<h3>${product ? 'Edit product' : 'Add product'}</h3>${productForm(product)}`) : ''}
        ${state.suppliers.length ? card(`<label class="pos-field"><span>Filter by supplier</span><select data-pos-supplier-filter aria-label="Filter products by supplier">${[['', 'All suppliers'], ['none', 'No supplier'], ...state.suppliers.map((supplier) => [supplier.id, supplier.name])].map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === supplierFilter ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>`) : ''}
        ${card(`<div class="pos-catalogue-desktop-list"><div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Supplier</th><th></th></tr></thead><tbody>
          ${visibleProducts.map((item) => `<tr><td>${escapeHtml(item.name)}${item.isService ? ` ${statusTag('Service')}` : ''}</td><td>${escapeHtml(item.categoryName)}</td><td>${money(item.price, state.settings.currency)}</td><td>${stockText(item, '—')}</td><td>${escapeHtml(supplierLabel(item.supplierId) || '—')}</td><td class="pos-row-actions">
            ${iconLink(`/pos/catalogue/products?edit=${item.id}`, `Edit ${item.name}`)}
            ${iconButton('delete-product', item.id, `Delete ${item.name}`, deleteIcon)}
          </td></tr>`).join('') || `<tr><td colspan="6">${state.products.length ? 'No products for this supplier.' : 'No products yet.'}</td></tr>`}
        </tbody></table></div></div>${productDetailsCards('/pos/catalogue/products')}`)}</section>`;
    }
    if (screen === '/catalogue/categories') {
      return `<section class="pos-content">
        ${tabsTitle('Categories', 'Organize your catalogue.')}
        ${card(`<form class="pos-inline-form" data-pos-form="category"><input name="name" required placeholder="New category name"><button class="btn-primary">Add category</button></form>
          <div class="pos-catalogue-desktop-list"><div class="pos-category-list">${categories.map((cat) => `<div class="pos-category-row"><strong>${escapeHtml(cat.name)}</strong><span>${state.products.filter((p) => p.categoryId === cat.id).length} products</span>
            ${cat.name.toLowerCase() === 'other' ? '<small>Default category</small>' : `<div class="pos-row-actions">${iconButton('rename-category', cat.id, `Edit ${cat.name}`, editIcon)}${iconButton('delete-category', cat.id, `Delete ${cat.name}`, deleteIcon)}</div>`}
          </div>`).join('') || '<p class="pos-help">No categories yet.</p>'}</div></div>${categoryDetailsCards()}`)}</section>`;
    }
    if (screen === '/catalogue/suppliers') return renderSuppliers(params);
    if (screen === '/catalogue/inventory') {
      return `<section class="pos-content">
        ${tabsTitle('Inventory', `${state.products.length} products · stock on hand`)}
        ${card(`<h3>POS ↔ website stock</h3>
          ${websites.length ? `<label class="pos-field"><span>Website</span><select id="pos-shared-website">${websiteChoices.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selectedWebsite ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
            <p class="pos-help">${inventoryCloudLinked ? `Connected · ${escapeHtml(websites.find((item) => item.tenant_id === state.sharedTenantId)?.name || state.sharedTenantId)}. ${state.pendingInventoryEvents} POS sales waiting to sync.` : state.sharedTenantId ? 'Local products and stock remain available. Cloud stock sync is paused until this shop is linked once.' : 'Load website stock to import products into this device’s POS. POS-to-website live stock sync is a separate shop connection.'}</p>
            <div class="pos-form-actions">${button('Use POS stock for website', 'sync-shared-stock', 'data-source="pos"', true)}${button('Load website stock into POS', 'sync-shared-stock', 'data-source="website"', true)}</div>`
            : '<p class="pos-help">Create or select a website in Studio to connect inventory.</p>'}`)}
        ${card(`<div class="pos-catalogue-desktop-list"><div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>On hand</th><th>Reorder at</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          ${state.products.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.sku || '—')}</td><td>${escapeHtml(item.categoryName)}</td><td>${stockText(item, 'Not tracked')}</td><td>${item.lowStockThreshold}</td><td>${item.active ? 'Active' : 'Disabled'}</td><td class="pos-row-actions">
            ${iconLink(`/pos/inventory?edit=${item.id}`, `Edit ${item.name}`)}
            ${iconButton('delete-product', item.id, `Delete ${item.name}`, deleteIcon)}
          </td></tr>`).join('') || '<tr><td colspan="7">No products yet.</td></tr>'}
        </tbody></table></div></div>${productDetailsCards('/pos/inventory', 'inventory')}`)}</section>`;
    }
    return `<section class="pos-content">
      ${tabsTitle('Inventory', 'Manage POS products, categories and stock.',
        `<div class="pos-form-actions"><button type="button" class="btn-secondary" data-pos-action="backup-export">Export inventory</button>
          <label class="btn-secondary pos-file-button">Import CSV<input type="file" accept="text/csv,.csv" data-pos-csv-import></label>
          <label class="btn-secondary pos-file-button">Restore backup<input type="file" accept="application/json,.json" data-pos-import></label></div>`)}
      ${card(`<h3>POS ↔ website stock</h3>
        ${websites.length ? `<label class="pos-field"><span>Website</span><select id="pos-shared-website">
          ${websiteChoices.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selectedWebsite ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
        </select></label>
        <p class="pos-help">${inventoryCloudLinked
          ? `Connected · ${escapeHtml(websites.find((item) => item.tenant_id === state.sharedTenantId)?.name || state.sharedTenantId)}. ${state.pendingInventoryEvents} POS sale${state.pendingInventoryEvents === 1 ? '' : 's'} waiting to sync.`
          : state.sharedTenantId
            ? 'Local products and stock remain available. Cloud stock sync is paused until this shop is linked once.'
            : 'Load website stock to import products into this device’s POS. POS-to-website live stock sync is separate and links matching SKUs.'}</p>
        ${state.sharedTenantId && state.pendingInventoryEvents && navigator.onLine === false
          ? '<p class="pos-help" role="status">Offline: shared stock changes are saved locally and queued for D1 sync.</p>'
          : state.inventorySyncError ? `<p class="pos-help" role="status">Latest sync issue: ${escapeHtml(state.inventorySyncError)}</p>` : ''}
        <div class="pos-form-actions">
          ${button('Use POS stock for website', 'sync-shared-stock', 'data-source="pos"', true)}
          ${button('Load website stock into POS', 'sync-shared-stock', 'data-source="website"', true)}
        </div>`
        : '<p class="pos-help">Create or select a website in Studio, then return here to connect its inventory.</p>'}`)}
      ${product ? card(`<h3>Edit product</h3>${productForm(product)}`) : ''}
      ${card(`<h3>Add product</h3>${productForm()}`)}
      ${card(`<h3>Categories</h3>
        <form class="pos-inline-form" data-pos-form="category"><input name="name" required placeholder="New category name"><button class="btn-secondary">Add category</button></form>
        <div class="pos-catalogue-desktop-list"><div class="pos-category-list">${categories.map((cat) => `<div class="pos-category-row">
          <strong>${escapeHtml(cat.name)}</strong><span>${state.products.filter((p) => p.categoryId === cat.id).length} products</span>
          ${cat.name.toLowerCase() === 'other' ? '<small>Default category</small>' : `<div class="pos-row-actions">${iconButton('rename-category', cat.id, `Edit ${cat.name}`, editIcon)}${iconButton('delete-category', cat.id, `Delete ${cat.name}`, deleteIcon)}</div>`}
        </div>`).join('')}</div></div>${categoryDetailsCards()}`)}
      ${card(`${tabsTitle('Products', `${state.products.length} products`)}
        <div class="pos-catalogue-desktop-list"><div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Reorder at</th><th>Status</th><th></th></tr></thead><tbody>
              ${state.products.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.sku || '—')}</td>
            <td>${escapeHtml(item.categoryName)}</td>
            <td>${money(item.price, state.settings.currency)}</td><td>${item.buyingPrice == null ? '—' : money(item.buyingPrice, state.settings.currency)}</td>
            <td>${stockText(item, '—')}</td><td>${item.lowStockThreshold}</td><td>${item.active ? 'Active' : 'Disabled'}</td><td class="pos-row-actions">
              ${iconLink(`/pos/catalogue/products?edit=${item.id}`, `Edit ${item.name}`)}
              ${iconButton('delete-product', item.id, `Delete ${item.name}`, deleteIcon)}
              ${item.sku ? button('Sync details to active website draft', 'sync-product-details', `data-id="${item.id}"`, true) : ''}
            </td></tr>`).join('') || '<tr><td colspan="9">No products yet.</td></tr>'}
        </tbody></table></div></div>${productDetailsCards('/pos/catalogue/products', 'product', true)}`)}
    </section>`;
  }

  return { renderInventory };
}
