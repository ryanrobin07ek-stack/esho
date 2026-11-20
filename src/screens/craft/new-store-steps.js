// New-website wizard (/account/web/studio/websites/webmaker): the catalog refresh, shop identity,
// categories and clear-products steps. Each function is one block of AppController.bindWebsiteBuilderEvents,
// called with this = AppController.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StudioRenderers, WEBSITE_BUILDER_DRAFT_SYNC_KEY } from '../../app/main.js';

export function bindWizardCatalogRefresh() {
  const editorRouteParams = new URLSearchParams(this.currentRoute().split("?")[1] || "");
  const draftEditor = editorRouteParams.get("new") === "1" && editorRouteParams.get("edit") === "1";
  const sharedCatalogRefresh = document.getElementById("website-wizard-refresh-catalog");
  const sharedCatalogStatus = document.getElementById("website-wizard-catalog-status");
  const sharedCategoryList = document.getElementById("website-wizard-category-list");
  const sharedProductList = document.getElementById("website-wizard-product-list");
  const sharedProductSearch = document.getElementById("website-wizard-product-search");
  const sharedProductCount = document.getElementById("website-wizard-product-count");
  if (sharedCatalogRefresh && sharedCatalogStatus && sharedCategoryList && sharedProductList &&
      sharedProductSearch && sharedProductCount) {
    let products = SQLiteEngine.select("products").filter(product => product.status !== "archived");
    let categories = SQLiteEngine.getCategories();
    const renderSharedCatalog = () => {
      const categoryById = new Map(categories.map(category => [String(category.id), category.name]));
      sharedCategoryList.innerHTML = categories.map(category =>
        `<div class="website-wizard-category-row"><span>${AppUtils.escapeHTML(category.name)}</span></div>`
      ).join("") || `<p class="studio-panel-note">No Store categories yet. Add them in Store or POS.</p>`;
      const query = sharedProductSearch.value.trim().toLocaleLowerCase();
      const matches = products.filter(product =>
        `${product.name || ""} ${product.sku || ""} ${product.category_name || ""}`.toLocaleLowerCase().includes(query));
      const visible = matches.slice(0, 50);
      sharedProductCount.textContent = query
        ? `Showing ${visible.length} of ${matches.length} matches · ${products.length} total`
        : `Showing ${visible.length} of ${products.length} products`;
      sharedProductList.innerHTML = visible.map(product => {
        const image = Array.isArray(product.images)
          ? product.images.find(value => typeof value === "string" && /^(data:image\/|https?:\/\/|\/)/i.test(value))
          : "";
        const category = product.category_name || categoryById.get(String(product.category_id ?? product.categoryId)) || "Uncategorized";
        return `<article class="website-wizard-product-row">
          ${image ? `<img class="website-wizard-product-thumb" src="${AppUtils.escapeHTML(image)}" alt="">` : `<span class="website-wizard-product-thumb" aria-hidden="true"></span>`}
          <span class="website-wizard-product-copy"><strong>${AppUtils.escapeHTML(product.name || "Unnamed product")}</strong><span>${AppUtils.escapeHTML(category)}</span></span>
          <span>${AppUtils.escapeHTML(String(product.stock ?? 0))} in stock</span>
          <strong>${AppUtils.formatMoney(product.price ?? 0)}</strong>
        </article>`;
      }).join("") || `<p class="studio-panel-note">${query ? "No Store products match your search." : "No Store products yet. Add products in Store or POS to show them here."}</p>`;
    };
    sharedProductSearch.oninput = renderSharedCatalog;
    const refreshSharedCatalog = async () => {
      sharedCatalogRefresh.disabled = true;
      sharedCatalogStatus.textContent = "Refreshing the Main Store/POS catalog…";
      try {
        const catalog = await this.websiteBuilderSourceCatalog();
        products = catalog.products;
        categories = catalog.categories;
        const draft = StudioRenderers.websiteBuilderDraft();
        draft.products = products;
        draft.categories = categories;
        StudioRenderers.saveWebsiteBuilderDraft(draft);
        window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
        renderSharedCatalog();
        sharedCatalogStatus.textContent = `Showing ${products.length} products and ${categories.length} categories${catalog.posConnected ? ` from Main Store/POS${catalog.posProductCount ? `, including ${catalog.posProductCount} POS-only products` : ""}` : " from Main Store; POS is unavailable on this device"}. Edit the catalog in Store or POS.`;
      } catch (error) {
        console.error("The shared Store/POS catalog could not be loaded in Webmaker.", error);
        sharedCatalogStatus.textContent = error instanceof Error ? error.message : "The shared catalog could not be loaded.";
        AppUtils.showToast(sharedCatalogStatus.textContent, "danger");
      } finally {
        sharedCatalogRefresh.disabled = false;
      }
    };
    sharedCatalogRefresh.onclick = () => { void refreshSharedCatalog(); };
    renderSharedCatalog();
    void refreshSharedCatalog();
  }
}

export function bindWizardIdentity() {
  const identityForm = document.getElementById("website-wizard-identity-form");
  if (identityForm) {
    const nameInput = identityForm.elements.name;
    const addressInput = identityForm.elements.address;
    const slugify = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "").slice(0, 40).replace(/-$/g, "");
    let addressEdited = Boolean(addressInput.value);
    addressInput.addEventListener("input", () => { addressEdited = true; });
    nameInput.addEventListener("input", () => {
      if (!addressEdited) addressInput.value = slugify(nameInput.value);
    });
    identityForm.onsubmit = event => {
      event.preventDefault();
      const error = document.getElementById("website-wizard-identity-error");
      const name = nameInput.value.trim();
      const address = slugify(addressInput.value);
      if (!name || !address) {
        if (error) {
          error.textContent = "Enter a shop name and a website address.";
          error.hidden = false;
        }
        return;
      }
      const draft = StudioRenderers.websiteBuilderDraft();
      draft.shop_name = name;
      draft.shop_kind = identityForm.elements.kind.value.trim();
      draft.shop_address = address;
      draft.wizard_step = "catalogue";
      StudioRenderers.saveWebsiteBuilderDraft(draft);
      this.handleRoute(this.currentRoute());
    };
  }
  const editIdentity = document.getElementById("website-wizard-edit-identity");
  if (editIdentity) editIdentity.onclick = () => {
    const draft = StudioRenderers.websiteBuilderDraft();
    draft.wizard_step = "identity";
    StudioRenderers.saveWebsiteBuilderDraft(draft);
    this.handleRoute(this.currentRoute());
  };
}

export function bindWizardCategories() {
  const categoryForm = document.getElementById("website-wizard-category-form");
  if (categoryForm) categoryForm.onsubmit = event => {
    event.preventDefault();
    const formData = new FormData(categoryForm);
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    const draft = StudioRenderers.websiteBuilderDraft();
    const categoryId = String(formData.get("id") || "");
    if (draft.categories.some(category => String(category.id) !== categoryId &&
        category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      AppUtils.showToast("That category is already in your new website draft.", "danger");
      return;
    }
    if (categoryId) {
      const category = draft.categories.find(item => String(item.id) === categoryId);
      if (!category) {
        AppUtils.showToast("That category is no longer in this website draft.", "danger");
        return;
      }
      category.name = name;
      draft.products.forEach(product => {
        if (String(product.category_id) === categoryId) product.category_name = name;
      });
    } else {
      draft.categories.push({ id: Date.now() + draft.categories.length, name });
    }
    StudioRenderers.saveWebsiteBuilderDraft(draft);
    this.handleRoute(this.currentRoute());
  };
  const categoryList = document.getElementById("website-wizard-category-list");
  if (categoryList) categoryList.onclick = event => {
    const removeButton = event.target.closest("[data-remove-wizard-category]");
    if (removeButton) {
      const draft = StudioRenderers.websiteBuilderDraft();
      const removeId = removeButton.dataset.removeWizardCategory;
      const inUse = draft.products.filter(product => String(product.category_id) === removeId).length;
      if (inUse) {
        AppUtils.showToast(`${inUse} product${inUse === 1 ? " is" : "s are"} in this category. Move or remove ${inUse === 1 ? "it" : "them"} first.`, "danger");
        return;
      }
      draft.categories = draft.categories.filter(category => String(category.id) !== removeId);
      window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
      StudioRenderers.saveWebsiteBuilderDraft(draft);
      this.handleRoute(this.currentRoute());
      return;
    }
    const button = event.target.closest("[data-edit-wizard-category]");
    if (!button || !categoryForm) return;
    const category = StudioRenderers.websiteBuilderDraft().categories.find(item =>
      String(item.id) === button.dataset.editWizardCategory);
    if (!category) return;
    categoryForm.hidden = false;
    categoryForm.elements.id.value = String(category.id);
    categoryForm.elements.name.value = category.name;
    categoryForm.querySelector('button[type="submit"]').textContent = "Save category";
    categoryForm.elements.name.focus();
  };
}

export function bindWizardClearProducts() {
  const clearProducts = document.getElementById("website-wizard-clear-products");
  if (clearProducts) clearProducts.onclick = () => {
    const draft = StudioRenderers.websiteBuilderDraft();
    draft.products = [];
    window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
    StudioRenderers.saveWebsiteBuilderDraft(draft);
    this.handleRoute(this.currentRoute());
  };
}
