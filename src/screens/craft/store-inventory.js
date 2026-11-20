// Craft store inventory screen (/store/inventory).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, StudioRenderers } from '../../app/main.js';

// Body of the `if (path === "/store/inventory")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderStoreInventory({ webProducts }) {
      return `
        <p class="studio-panel-note">Website stock is managed independently. Updating it does not change POS inventory.</p>
        <div class="store-workspace-list">${webProducts.map(product => `
          <form class="store-workspace-row store-stock-form" data-pos-id="" data-web-id="${product.id}">
            <div><strong class="store-product-name">${AppUtils.escapeHTML(product.name)}</strong><span>${AppUtils.escapeHTML(product.sku || "No SKU")} · Website stock</span></div>
            <label>Quantity<input name="stock" type="number" min="0" step="1" value="${product.stock ?? ""}" required></label>
            <button type="submit" class="btn-secondary">Save web stock</button>
          </form>
        `).join("") || `<p class="store-workspace-empty">No website products to manage.</p>`}</div>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderStoreInventory() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/store/inventory", snapshot, true);
}

export function unmount() {}
