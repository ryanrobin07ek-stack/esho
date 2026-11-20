// Craft store products screen (/store/products).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StudioRenderers, webServiceDurationOptions } from '../../app/main.js';

// Body of the `if (path === "/store/products")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderStoreProducts({ activeTenant, currency, snapshot, webProducts }) {
      const websiteCategories = SQLiteEngine.getCategories();
      const posOnly = snapshot.posProducts.filter(pos => !webProducts.some(web => {
        const posSku = String(pos.sku || "").trim().toUpperCase();
        const webSku = String(web.sku || "").trim().toUpperCase();
        return posSku && webSku ? posSku === webSku
          : !posSku && !webSku && String(web.name || "").trim().toLowerCase() === String(pos.name || "").trim().toLowerCase();
      }));
      return `
        <div class="studio-inline-actions web-product-actions">
          <button type="button" class="btn-secondary web-product-action-card" id="store-add-product-trigger">Add from Store</button>
          <button type="button" class="btn-primary web-product-action-card" id="store-create-web-product">Add web product</button>
          <a class="btn-secondary web-product-action-card" href="/account/products" data-route="/account/products">Advanced web catalog</a>
          <button type="button" class="btn-secondary web-product-action-card" id="btn-publish-cloudflare">Publish to ${AppUtils.escapeHTML(activeTenant.hostname)}</button>
        </div>
        <p class="studio-panel-note">Website products are managed separately. Publish to update ${AppUtils.escapeHTML(activeTenant.hostname)}.</p>
        <div id="product-modal-container"></div>
        ${webProducts.length ? `<div class="store-bulk-actions" data-bulk-removal="products"><label class="store-bulk-select-all"><input type="checkbox" data-bulk-select-all><span>Select all products</span></label><span class="store-bulk-selection-count" data-bulk-selection-count>0 selected</span><button type="button" class="btn-secondary" data-bulk-product-holds="enable" disabled>Enable holds</button><button type="button" class="btn-secondary" data-bulk-product-holds="disable" disabled>Disable holds</button><button type="button" class="btn-secondary" data-bulk-remove disabled>Remove selected products</button></div>` : ""}
        <form class="store-workspace-form store-existing-product-form" data-store-web-import hidden>
          <h2>Add from main Store</h2>
          <p class="studio-panel-note">Select one or more products. Existing Store images are copied when available.</p>
          <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" data-store-import-select-all> Select all available products</label>
          <p class="studio-panel-note" data-store-import-count>0 selected</p>
          <div style="max-height:360px;overflow:auto;">
            ${posOnly.map(pos => {
              const index = snapshot.products.findIndex(item => item.posProductId === Number(pos.id));
              if (index < 0) return "";
              const image = pos.imageUri || pos.images?.[0] || "";
              return `<label class="studio-list-row" style="display:flex;align-items:center;gap:10px;">
                <input type="checkbox" data-store-import-product="${index}">
                ${image ? `<img src="${AppUtils.escapeHTML(image)}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:7px;">` : ""}
                <span style="flex:1;min-width:0;"><strong>${AppUtils.escapeHTML(pos.name)}</strong><span>${AppUtils.escapeHTML(pos.categoryName || "Uncategorized")}</span></span>
                <strong>${this.formatMainShopMoney(pos.price, currency)}</strong>
              </label>`;
            }).join("") || `<p class="store-workspace-empty">No additional Store products to add.</p>`}
          </div>
          <button type="submit" class="btn-primary" disabled>Add selected from Store</button>
          <p role="status"></p>
        </form>
        <form class="store-workspace-form" data-studio-form="web-product" hidden>
          <h2>Create web-only product</h2>
          <input type="hidden" name="productId" value="">
          <label>Product name<input name="name" maxlength="160" required></label>
          <div class="web-product-taxonomy" data-web-product-taxonomy></div>
          <div class="studio-form-grid">
            <label>Selling price<input name="price" type="number" min="0" step="0.01" required></label>
            <label>Buying price · optional<input name="costPrice" type="number" min="0" step="0.01"></label>
          </div>
          <div class="web-product-media">
            <label class="web-product-file">Add photos (up to 8)<input name="image" type="file" accept="image/*" data-web-product-image multiple></label>
            <div class="web-product-media-modes" role="group" aria-label="Product media type">${[["keep", "Photos"], ["3d", "360° spin"], ["video", "Video"], ["cutout", "Cutout"]].map(([value, label], index) => `<button type="button" class="btn-secondary" data-web-product-media-mode="${value}" aria-pressed="${index === 0}">${label}</button>`).join("")}</div>
            <div class="web-product-video-options" data-web-product-video-options hidden>
              <button type="button" class="btn-secondary" data-web-product-video-record>Record video</button>
              <button type="button" class="btn-secondary" data-web-product-video-pick>Pick video</button>
              <input type="file" accept="video/*" capture="environment" data-web-product-record-file hidden>
              <input type="file" accept="video/*" data-web-product-video-file hidden>
            </div>
            <div class="web-product-media-preview" data-web-product-media-preview hidden></div>
            <p class="studio-panel-note" data-web-product-media-status role="status" aria-live="polite">Add product photos or choose another media type.</p>
          </div>
          <div class="studio-form-grid">
            <label>Item type<select name="itemType" data-web-product-item-type><option value="product">Product</option><option value="service">Service</option></select></label>
            <label data-web-product-duration hidden>How long it takes<select name="durationMinutes">${webServiceDurationOptions()}</select></label>
          </div>
          <label data-web-product-stock>Starting website stock<input name="stock" type="number" min="0" step="1" value="0" required></label>
          <div class="web-product-variants" data-web-product-variants></div>
          <div class="web-product-attribute-pricing" data-web-product-attribute-pricing></div>
          <label class="web-product-hold"><input type="checkbox" name="booking_enabled"><span>Allow customer holds</span></label>
          <button type="button" class="btn-secondary" data-web-product-cancel hidden>Cancel edit</button>
          <button type="submit" class="btn-primary">Save web product</button>
          <p role="status"></p>
        </form>
        <div class="store-workspace-list">
          ${webProducts.map(product => {
            const categoryName = SQLiteEngine.getCategories().find(category => Number(category.id) === Number(product.category_id))?.name || "Uncategorized";
            const existsInPos = snapshot.posProducts.some(pos => {
              const posSku = String(pos.sku || "").trim().toUpperCase();
              const webSku = String(product.sku || "").trim().toUpperCase();
              return posSku && webSku ? posSku === webSku
                : !posSku && !webSku && String(pos.name || "").trim().toLowerCase() === String(product.name || "").trim().toLowerCase();
            });
            return `
            <div class="store-bulk-row">
            <label class="store-bulk-item" aria-label="Select ${AppUtils.escapeHTML(product.name)}"><input type="checkbox" data-bulk-item="${product.id}"></label>
            <details class="store-product-detail-wrap" data-store-search="${AppUtils.escapeHTML(`${product.name} ${product.sku || ""} ${categoryName}`.toLocaleLowerCase())}">
              <summary class="store-workspace-row">
                <div><strong class="store-product-name">${AppUtils.escapeHTML(product.name)}</strong><span>${AppUtils.escapeHTML(categoryName)} · ${this.formatMainShopMoney(product.price, currency)}</span></div>
                <div class="store-product-sources"><span class="store-product-source">Web</span></div>
              </summary>
              <div class="store-product-detail">
                <div class="store-product-detail-grid">
                  <div><strong>Price</strong> <span>${this.formatMainShopMoney(product.price, currency)}</span></div>
                  <div><strong>Stock</strong> <span>${product.stock == null ? "Not set" : `${product.stock} units`}</span></div>
                  <div><strong>SKU</strong> <span>${AppUtils.escapeHTML(product.sku || "Not assigned")}</span></div>
                  <div><strong>Brand</strong> <span>${AppUtils.escapeHTML(product.brand || "—")}</span></div>
                  <div><strong>Discount</strong> <span>${Number(product.discount || 0)}%</span></div>
                </div>
                <label class="studio-panel-note"><input type="checkbox" data-web-product-booking="${product.id}" ${product.booking_enabled ? "checked" : ""}> Allow customers to place temporary holds on this product</label>
                <p>${AppUtils.escapeHTML(product.description || "No description.")}</p>
                ${product.images?.[0] ? `<img class="store-product-detail-image" src="${AppUtils.escapeHTML(product.images[0])}" alt="${AppUtils.escapeHTML(product.name)}">` : ""}
                <button type="button" class="btn-secondary" data-edit-web-product="${product.id}" style="margin-top:12px;">Edit product</button>
                ${existsInPos ? "" : `<button type="button" class="btn-secondary" data-store-pos-product="${product.id}" style="margin-top:12px;">Add to Store/POS</button>`}
                <button type="button" class="btn-secondary" data-remove-website-product="${product.id}" style="margin-top:12px;">Remove from this website</button>
              </div>
            </details>
            </div>
          `}).join("") || `<p class="store-workspace-empty">No website products yet. Add a web-only product or select one from Store inventory.</p>`}
        </div>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderStoreProducts() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/store/products", snapshot, true);
}

export function unmount() {}
