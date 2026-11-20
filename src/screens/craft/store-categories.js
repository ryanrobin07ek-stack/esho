// Craft store categories screen (/store/categories).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StudioRenderers } from '../../app/main.js';

// Body of the `if (path === "/store/categories")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderStoreCategories({ currency, snapshot, webProducts }) {
      const websiteCategories = SQLiteEngine.getCategories();
      const storeOnlyCategories = snapshot.posCategories.filter(posCategory => !websiteCategories.some(webCategory => webCategory.name.trim().toLocaleLowerCase() === posCategory.name.trim().toLocaleLowerCase()));
      return `
        <form class="store-workspace-form" data-studio-form="web-category">
          <input name="name" aria-label="Category name" placeholder="Category name" required maxlength="120"><button type="submit" class="btn-primary">Add category</button><p role="status"></p>
        </form>
        <section class="studio-panel"><div class="studio-panel-heading"><h2>Categories available in Store inventory</h2></div>
          ${storeOnlyCategories.map(category => `<article class="store-category-import-row"><strong>${AppUtils.escapeHTML(category.name)}</strong><button type="button" class="btn-secondary" data-store-website-category="${AppUtils.escapeHTML(category.name)}">Add from Store</button></article>`).join("") || `<p class="store-workspace-empty">No additional Store categories to import.</p>`}
        </section>
        ${websiteCategories.length ? `<div class="store-bulk-actions" data-bulk-removal="categories"><label class="store-bulk-select-all"><input type="checkbox" data-bulk-select-all><span>Select all categories</span></label><span class="store-bulk-selection-count" data-bulk-selection-count>0 selected</span><button type="button" class="btn-secondary" data-bulk-remove disabled>Remove selected categories</button></div>` : ""}
        <div class="store-workspace-list">${websiteCategories.map(category => {
          const categoryProducts = webProducts.filter(product => Number(product.category_id) === Number(category.id));
          return `
          <div class="store-bulk-row">
          <label class="store-bulk-item" aria-label="Select ${AppUtils.escapeHTML(category.name)}"><input type="checkbox" data-bulk-item="${category.id}"></label>
          <details class="store-category-wrap">
            <summary class="store-workspace-row">
              <div><strong class="store-product-name">${AppUtils.escapeHTML(category.name)}</strong><span>${categoryProducts.length} products</span></div>
              <div class="store-product-sources"><span class="store-product-source">Web only</span></div>
            </summary>
            <div class="store-category-details">
              <div class="store-category-products">
                ${categoryProducts.map(product => `<details class="store-category-product"><summary><strong>${AppUtils.escapeHTML(product.name)}</strong><span>${this.formatMainShopMoney(product.price, currency)} · ${product.stock == null ? "Stock not set" : `${product.stock} in stock`}</span></summary><p>SKU: ${AppUtils.escapeHTML(product.sku || "Not assigned")} · Website catalog</p>${product.description ? `<p>${AppUtils.escapeHTML(product.description)}</p>` : ""}</details>`).join("") || `<span class="store-workspace-empty">No products in this category yet.</span>`}
              </div>
              <button type="button" class="btn-secondary" data-remove-website-category="${category.id}" style="margin:12px 0;">Remove category from this website</button>
              <a class="btn-secondary" href="/store/products" data-route="/store/products">Add web product to this category</a>
            </div>
          </details></div>`;
        }).join("") || `<p class="store-workspace-empty">No website categories yet.</p>`}</div>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderStoreCategories() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/store/categories", snapshot, true);
}

export function unmount() {}
