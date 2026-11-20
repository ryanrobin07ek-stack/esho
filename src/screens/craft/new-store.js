// New-website wizard ("webmaker", /account/web/studio/websites/webmaker): its products step, the
// device-saved draft, and the event wiring (split by step into the new-store-*.js modules).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppController, AppUtils, SQLiteEngine, StudioRenderers, WEBSITE_BUILDER_DRAFT_SYNC_KEY, WEBSITE_BUILDER_DRAFT_TENANT_ID } from '../../app/main.js';
import { bindWizardCatalogRefresh, bindWizardCategories, bindWizardClearProducts, bindWizardIdentity } from './new-store-steps.js';
import { bindWizardProducts } from './new-store-products.js';
import { bindWizardStorePicker } from './new-store-store-picker.js';

export const newStoreScreen = {
  renderNewWebsiteProducts() {
    const draft = this.websiteBuilderDraft();
    const litrusBuilderRoute = "/account/web/site?new=1&edit=1&theme=litrus-mixer";
    // Step 1 is the shop's identity; the catalogue only opens once the shop has a name and address.
    if (draft.wizard_step !== "catalogue" || !draft.shop_name || !draft.shop_address) {
      return `<section class="studio-workspace-section">
      <header class="website-management-heading">
        <div><span class="studio-workspace-kicker">NEW WEBSITE · STEP 1 OF 2</span><h2>Your shop</h2><p>Start with the basics. You will add products and categories next.</p></div>
      </header>
      <form id="website-wizard-identity-form" class="store-workspace-form">
        <label>Shop / website name<input name="name" maxlength="120" required placeholder="My Shop" value="${AppUtils.escapeHTML(draft.shop_name || "")}"></label>
        <label>What do you sell?<input name="kind" maxlength="120" placeholder="For example clothes, groceries or haircuts" value="${AppUtils.escapeHTML(draft.shop_kind || "")}"></label>
        <label>Website address<span style="display:flex;align-items:center;gap:5px;"><input name="address" maxlength="40" required placeholder="my-shop" value="${AppUtils.escapeHTML(draft.shop_address || "")}"><span style="white-space:nowrap;font-size:.8rem;">.rrobin.co.ke</span></span></label>
        <p id="website-wizard-identity-error" role="alert" hidden style="margin:0;color:#b42318;"></p>
        <button type="submit" class="btn-primary" id="website-wizard-identity-continue">Continue to products</button>
      </form>
    </section>`;
    }
    return `<section class="studio-workspace-section">
      <header class="website-management-heading">
        <div><span class="studio-workspace-kicker">NEW WEBSITE · STEP 2 OF 2</span><h2>Website products</h2><p>${AppUtils.escapeHTML(draft.shop_name)} · ${AppUtils.escapeHTML(draft.shop_address)}.rrobin.co.ke. Choose Store products to add or create products just for this website.</p></div>
      </header>
      <div class="studio-inline-actions"><button type="button" class="btn-secondary website-wizard-compact-action" id="website-wizard-edit-identity">Edit shop details</button></div>
      <div class="studio-inline-actions web-product-actions">
        <button type="button" class="btn-secondary web-product-action-card" id="website-wizard-load-store">Add from Store</button>
        <button type="button" class="btn-primary web-product-action-card" id="website-wizard-create-product">Add web product</button>
      </div>
      <section class="studio-panel">
        <div class="studio-panel-heading"><h3>Website categories</h3></div>
        <form id="website-wizard-category-form" class="store-workspace-form">
          <input type="hidden" name="id" value="">
          <label>Category name<input name="name" maxlength="120" required></label>
          <button type="submit" class="btn-secondary">Add category</button>
        </form>
        <div class="website-wizard-category-list" id="website-wizard-category-list">${draft.categories.map(category =>
          `<div class="website-wizard-category-row"><span>${AppUtils.escapeHTML(category.name)}</span><button type="button" class="btn-secondary website-wizard-compact-action" data-edit-wizard-category="${AppUtils.escapeHTML(String(category.id))}">Edit</button><button type="button" class="btn-secondary website-wizard-compact-action" data-remove-wizard-category="${AppUtils.escapeHTML(String(category.id))}" aria-label="Remove ${AppUtils.escapeHTML(category.name)} from this website">Remove</button></div>`
        ).join("") || `<p class="studio-panel-note">No categories yet. Add from Store or create a category to add web products.</p>`}</div>
      </section>
      <section class="studio-panel">
        <div class="studio-panel-heading"><h3>Products</h3></div>
        <input class="form-input" id="website-wizard-product-search" type="search" placeholder="Search website products" aria-label="Search website products">
        <p class="website-wizard-list-status" id="website-wizard-product-count" role="status"></p>
        <div class="website-wizard-product-list" id="website-wizard-product-list"></div>
      </section>
      <form id="website-wizard-product-form" class="store-workspace-form website-wizard-product-form" hidden>
        <h3>Add web product</h3>
        <input type="hidden" name="id" value="">
        <label>Product name<input name="name" maxlength="160" required></label>
        <label>Category<select name="category_id" required><option value="">Choose a category</option>${draft.categories.map(category =>
          `<option value="${AppUtils.escapeHTML(String(category.id))}">${AppUtils.escapeHTML(category.name)}</option>`
        ).join("")}</select></label>
        <div class="studio-form-grid">
          <label>Selling price<input name="price" type="number" min="0" step="0.01" required></label>
          <label>Cost price<input name="cost_price" type="number" min="0" step="0.01"></label>
          <label>Starting website stock<input name="stock" type="number" min="0" step="1" value="0" required></label>
          <label>SKU<input name="sku" maxlength="120"></label>
        </div>
        <label>Description<textarea name="description" rows="3"></textarea></label>
        <div data-wizard-product-taxonomy></div>
        <div data-wizard-product-variants></div>
        <div class="web-product-attribute-pricing" data-wizard-product-attribute-pricing></div>
        <div class="web-product-media">
          <label data-wizard-photo-label>Add photos (up to 8)<input type="file" accept="image/*" data-wizard-product-images multiple></label>
          <div class="web-product-media-modes" role="group" aria-label="Product media type">
            <button type="button" class="btn-secondary" data-wizard-media-mode="image">Photos</button>
            <button type="button" class="btn-secondary" data-wizard-media-mode="spin">360° spin</button>
            <button type="button" class="btn-secondary" data-wizard-media-mode="video">Video</button>
            <button type="button" class="btn-secondary" data-wizard-media-mode="cutout">Cutout</button>
          </div>
          <div data-wizard-video-options hidden>
            <button type="button" class="btn-secondary" data-wizard-video-record>Record video</button>
            <button type="button" class="btn-secondary" data-wizard-video-pick>Pick video</button>
            <input type="file" accept="video/*" data-wizard-video-file hidden>
          </div>
          <div data-wizard-media-preview hidden></div>
          <p data-wizard-media-status role="status" aria-live="polite"></p>
        </div>
        <div class="studio-inline-actions">
          <button type="button" class="btn-secondary" id="website-wizard-cancel-product-edit" hidden>Cancel edit</button>
          <button type="submit" class="btn-primary">Add product</button>
        </div>
      </form>
      <div class="website-wizard-sticky-footer has-bottom-nav"><div>
        <a id="website-wizard-go-builder" class="btn-primary website-wizard-go-builder" href="${AppUtils.escapeHTML(litrusBuilderRoute)}" data-route="${AppUtils.escapeHTML(litrusBuilderRoute)}">Go to web builder</a>
      </div></div>
      <div style="height:190px" aria-hidden="true"></div>
      <section id="website-wizard-store-picker" class="studio-panel" hidden>
        <div class="studio-panel-heading"><h3>Choose products from Store</h3><button type="button" class="btn-secondary" id="website-wizard-store-close">Close</button></div>
        <input class="form-input" id="website-wizard-store-search" type="search" placeholder="Search Store products" aria-label="Search Store products">
        <select class="form-input" id="website-wizard-store-category" aria-label="Filter by Store category"><option value="all">All categories</option></select>
        <label><input type="checkbox" id="website-wizard-store-select-all"> Select all shown</label>
        <p class="studio-panel-note" id="website-wizard-store-count" role="status"></p>
        <div id="website-wizard-store-list"></div>
        <button type="button" class="btn-primary" id="website-wizard-import-store" disabled>Add selected from Store</button>
      </section>
    </section>`;
  },
};

export const newStoreDraft = {
  websiteBuilderDraft() {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ESHOP_NEW_WEBSITE_DRAFT_V1") || "{}");
      const draftId = typeof saved.draft_id === "string" && /^[a-z0-9-]{8,100}$/i.test(saved.draft_id)
        ? saved.draft_id
        : `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      if (saved.draft_id !== draftId) {
        saved.draft_id = draftId;
        window.localStorage.setItem("ESHOP_NEW_WEBSITE_DRAFT_V1", JSON.stringify(saved));
      }
      const legacyImportCleanupKey = "ESHOP_WEBSITE_DRAFT_LEGACY_CATALOG_CLEANUP_V2";
      const needsLegacyImportCleanup = window.localStorage.getItem(legacyImportCleanupKey) !== "1";
      if (needsLegacyImportCleanup) {
        saved.products = [];
        saved.categories = [];
        window.localStorage.setItem(legacyImportCleanupKey, "1");
        window.localStorage.setItem("ESHOP_NEW_WEBSITE_DRAFT_V1", JSON.stringify(saved));
        window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
      }
      const availableThemes = this.websiteThemesForPicker();
      const selectedTheme = availableThemes.some(theme => theme.id === saved.selected_theme)
        ? saved.selected_theme
        : availableThemes[0]?.id || "litrus-mixer";
      return {
        products: Array.isArray(saved.products) ? saved.products : [],
        categories: Array.isArray(saved.categories) ? saved.categories : [],
        draft_id: draftId,
        shop_name: typeof saved.shop_name === "string" ? saved.shop_name : "",
        shop_kind: typeof saved.shop_kind === "string" ? saved.shop_kind : "",
        shop_address: typeof saved.shop_address === "string" ? saved.shop_address : "",
        wizard_step: saved.wizard_step === "catalogue" ? "catalogue" : "identity",
        section_layout: saved.section_layout && typeof saved.section_layout === "object"
          ? saved.section_layout
          : { order: [], hidden: [], removed: [], added: [] },
        selected_theme: selectedTheme
      };
    } catch (error) {
      console.warn("New website draft could not be read.", error);
      return { products: [], categories: [], selected_theme: "" };
    }
  },
};

export const newStoreDraftSave = {
  saveWebsiteBuilderDraft(draft) {
    window.localStorage.setItem("ESHOP_NEW_WEBSITE_DRAFT_V1", JSON.stringify(draft));
  },
  async resetWebsiteBuilderDraft() {
    window.localStorage.removeItem("ESHOP_NEW_WEBSITE_DRAFT_V1");
    window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
    SQLiteEngine.db.tables.tenant_catalogs = AppController.tenantCatalogs().filter(item =>
      item.tenant_id !== WEBSITE_BUILDER_DRAFT_TENANT_ID);
    SQLiteEngine.save();
    if (!window.ShopSQLite) throw new Error("The app database is not ready.");
    await window.ShopSQLite.flush();
  },
};

export const newStoreEvents = {
  bindWebsiteBuilderEvents() {
    bindWizardCatalogRefresh.call(this);

    bindWizardIdentity.call(this);
    bindWizardCategories.call(this);

    bindWizardProducts.call(this);

    bindWizardClearProducts.call(this);

    bindWizardStorePicker.call(this);
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen itself,
// through StudioRenderers.renderWebStudioWebsiteTool() and postRenderSetup(); mount()/unmount() draw
// and wire this one screen on their own.
export function mount(root) {
  root.innerHTML = StudioRenderers.renderNewWebsiteProducts();
  AppController.bindWebsiteBuilderEvents();
}

export function unmount() {}
