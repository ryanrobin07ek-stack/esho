// Studio, category and product modals; nav badges.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { AppUtils, SQLiteEngine } from './main.js';
import { mountProductPricing, readProductPricingFields } from '../screens/main-store/product-pricing-fields.js';

export const modalsController = {
  initStudioModals() {
    this.initTenantManager();
    const publishButton = document.getElementById("btn-publish-cloudflare");
    if (publishButton) publishButton.onclick = () => this.openCloudflarePublishModal();

    const productSearch = document.getElementById("admin-prod-search");
    const productCategory = document.getElementById("admin-prod-cat");
    const productList = document.getElementById("admin-products-list");
    if (productSearch && productCategory && productList) {
      const filterProducts = () => {
        const query = productSearch.value.trim().toLowerCase();
        const categoryId = productCategory.value;
        productList.querySelectorAll(".product-list-item").forEach(item => {
          const matchesQuery = !query || item.dataset.search.includes(query);
          const matchesCategory = !categoryId || item.dataset.categoryId === categoryId;
          item.hidden = !matchesQuery || !matchesCategory;
        });
      };
      productSearch.addEventListener("input", filterProducts);
      productCategory.addEventListener("change", filterProducts);
    }

    // 1. Add Product Trigger
    const btnAddProd = document.getElementById("btn-add-product");
    const modalContainer = document.getElementById("product-modal-container");
    if (btnAddProd && modalContainer) {
      btnAddProd.onclick = () => this.openProductModal(null);
    }

    // 2. Settings form
    const settingsForm = document.getElementById("store-settings-form");
    if (settingsForm) {
      const customColorInput = document.getElementById("custom-store-color");
      const customColorRadio = settingsForm.querySelector(".store-custom-color-choice input[type='radio']");
      const selectedAppearance = () => ({
        primary_color: settingsForm.querySelector('input[name="primaryColor"]:checked')?.value || this.getStudioAppearance().primary_color,
        card_radius: settingsForm.querySelector('input[name="cardRadius"]:checked')?.value || "4px"
      });
      settingsForm.addEventListener("change", () => this.applyThemeSettings(selectedAppearance()));
      if (customColorInput && customColorRadio) {
        customColorInput.addEventListener("input", () => {
          customColorRadio.value = customColorInput.value.toUpperCase();
          customColorRadio.checked = true;
          this.applyThemeSettings(selectedAppearance());
        });
      }
      settingsForm.onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(settingsForm);
        const appearance = selectedAppearance();
        window.localStorage.setItem(this.studioAppearanceKey(), JSON.stringify(appearance));
        SQLiteEngine.updateStore({
          announcement: fd.get("announcement"),
          announcement_active: fd.get("announcementActive") ? 1 : 0
        });
        this.cacheActiveTenantCatalog();
        this.applyThemeSettings(appearance);
        AppUtils.showToast("App appearance saved. It now applies throughout the app.");
      };
    }

    // 3. Web form
    const webForm = document.getElementById("store-web-form");
    if (webForm) {
      webForm.onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(webForm);
        SQLiteEngine.updateStore({
          name: fd.get("name"),
          tagline: fd.get("tagline"),
          title: fd.get("seoTitle"),
          description: fd.get("seoDescription")
        });
        AppUtils.showToast("Web appearance updated");
      };
    }

    const websiteStoreForm = document.getElementById("website-store-form");
    if (websiteStoreForm) {
      websiteStoreForm.onsubmit = async event => {
        event.preventDefault();
        const data = new FormData(websiteStoreForm);
        SQLiteEngine.updateStore({
          name: String(data.get("name") || "").trim(),
          tagline: String(data.get("tagline") || "").trim(),
          description: String(data.get("description") || "").trim(),
          location: String(data.get("location") || "").trim(),
          email: String(data.get("email") || "").trim(),
          phone: String(data.get("phone") || "").trim(),
          announcement: String(data.get("announcement") || "").trim(),
          announcement_active: data.get("announcementActive") ? 1 : 0,
          install_prompt_enabled: data.get("installPromptEnabled") ? 1 : 0
        });
        this.cacheActiveTenantCatalog();
        try {
          if (!window.ShopSQLite) throw new Error("The app SQLite database is not ready.");
          await window.ShopSQLite.flush();
          AppUtils.showToast("Store details saved. Publish the website to apply changes live.");
        } catch (error) {
          console.error("Store details could not be saved.", error);
          AppUtils.showToast(error.message || "Could not save store details.", "danger");
        }
      };
    }

  },

  openCategoryModal(category) {
    const modalContainer = document.getElementById("category-modal-container");
    if (!modalContainer) return;
    const isEdit = !!category;
    const returnRoute = this.currentRoute().startsWith("/account/web/site")
      ? "/account/web/site"
      : "/account/categories";

    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="category-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="category-editor-title">
        <div class="modal-card">
          <button class="modal-close-btn" id="category-modal-close" aria-label="Close">&times;</button>
          <h2 class="product-editor-title" id="category-editor-title">${isEdit ? "Edit category" : "Add category"}</h2>
          <form id="category-editor-form" class="product-editor-form" style="display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" name="id" value="${category ? category.id : ""}">
            <div class="form-field">
              <label class="form-label" for="category-name">Category name *</label>
              <input id="category-name" type="text" name="name" class="form-input" required maxlength="80" value="${category ? AppUtils.escapeHTML(category.name) : ""}">
            </div>
            <div class="form-field">
              <label class="form-label" for="category-description">Description</label>
              <textarea id="category-description" name="description" class="form-input" maxlength="500" style="height:90px;padding-top:8px;">${category ? AppUtils.escapeHTML(category.description || "") : ""}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="category-image">Department image URL</label>
              <input id="category-image" type="url" name="image" class="form-input" value="${category ? AppUtils.escapeHTML(category.image || "") : ""}" placeholder="https://...">
            </div>
            <div class="product-editor-actions" style="margin-top:8px;">
              <button type="submit" class="btn-primary">${isEdit ? "Save Changes" : "Create Category"}</button>
              <button type="button" class="btn-secondary" id="category-modal-cancel">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ""; };
    document.getElementById("category-modal-close").onclick = close;
    document.getElementById("category-modal-cancel").onclick = close;
    document.getElementById("category-modal-overlay").onclick = (event) => {
      if (event.target.id === "category-modal-overlay") close();
    };

    const form = document.getElementById("category-editor-form");
    form.onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const id = data.get("id");
      SQLiteEngine.saveCategory({
        id: id ? Number(id) : undefined,
        name: String(data.get("name")).trim(),
        description: String(data.get("description") || "").trim(),
        image: String(data.get("image") || "").trim(),
        featured: category ? category.featured : 0
      });
      AppUtils.showToast(isEdit ? "Category updated" : "Category created");
      close();
      this.handleRoute(returnRoute, false);
    };
    document.getElementById("category-name").focus();
  },

  readProductImage(file) {
    return AppUtils.compressImageFile(file);
  },

  openProductModal(product, initialCategoryId = null) {
    const modalContainer = document.getElementById("product-modal-container");
    if (!modalContainer) return;
    const returnToWebsite = this.currentRoute().startsWith("/account/web/site");
    const categories = SQLiteEngine.getCategories();
    const isEdit = !!product;
    const currentImage = product && product.images && product.images[0] ? product.images[0] : "";

    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="prod-modal-overlay">
        <div class="modal-card">
          <button class="modal-close-btn" id="modal-close-x">&times;</button>
          <h2 class="product-editor-title">
            ${isEdit ? 'Edit product' : 'Add product'}
          </h2>
          <form id="modal-product-form" class="product-editor-form" style="display: flex; flex-direction: column; gap: 14px;">
            <input type="hidden" name="id" value="${product ? product.id : ''}" />
            <input type="hidden" name="brand" value="${AppUtils.escapeHTML(product ? product.brand : '')}" />
            <input type="hidden" name="sku" value="${AppUtils.escapeHTML(product ? product.sku : '')}" />
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Product Name *</label>
                <input type="text" name="name" class="form-input" required value="${product ? AppUtils.escapeHTML(product.name) : ''}" />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Category *</label>
                <select name="categoryId" class="form-input" required>
                  <option value="">Choose a category</option>
                  ${categories.map(c => `
                    <option value="${c.id}" ${product ? product.category_id === c.id ? 'selected' : '' : Number(initialCategoryId) === c.id ? 'selected' : ''}>${AppUtils.escapeHTML(c.name)}</option>
                  `).join("")}
                </select>
              </div>
            </div>
            <div data-product-pricing-variants></div><div data-product-pricing-attributes></div>

            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Selling Price ($) *</label>
                <input type="number" name="price" class="form-input" required value="${product ? product.price : ''}" />
              </div>
              <div class="form-field">
                <label class="form-label">Cost Price ($) *</label>
                <input type="number" name="costPrice" class="form-input" required value="${product ? product.cost_price : ''}" />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Warehouse Stock Units *</label>
                <input type="number" name="stock" class="form-input" required value="${product ? product.stock : ''}" />
              </div>
              <div class="form-field">
                <label class="form-label">Discount Percentage (%)</label>
                <input type="number" name="discount" class="form-input" value="${product ? product.discount : 0}" />
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">Product photos (up to 8)</label>
              <input type="url" name="image" class="form-input" value="${AppUtils.escapeHTML(currentImage)}" placeholder="Optional image URL" />
              <input type="file" name="imageFile" class="form-input" accept="image/*" multiple aria-label="Upload up to 8 product photos" />
              <small style="color: var(--text-muted);">Choose up to 8 photos to save in this device's SQLite catalog. Selected photos replace existing photos and the URL.</small>
              <img id="product-image-preview" src="${AppUtils.escapeHTML(currentImage)}" alt="Product photo preview" ${currentImage ? "" : "hidden"} style="width: 88px; height: 88px; object-fit: cover; border-radius: 8px;" />
              <small data-product-image-selection role="status" aria-live="polite"></small>
            </div>

            <div class="form-field">
              <label class="form-label">Description</label>
              <textarea name="description" class="form-input" style="height: 80px; padding-top: 8px;">${product ? AppUtils.escapeHTML(product.description) : ''}</textarea>
            </div>

            <div class="product-editor-checks" style="margin: 8px 0;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem;">
                <input type="checkbox" name="isFlagship" ${product && product.is_flagship ? 'checked' : ''} />
                <span>Feature on storefront</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem;">
                <input type="checkbox" name="isFeatured" ${product && product.is_featured ? 'checked' : ''} />
                <span>Show as featured</span>
              </label>
            </div>

            <div class="product-editor-actions" style="margin-top: 8px;">
              <button type="submit" class="btn-primary">${isEdit ? 'Save Changes' : 'Create Product'}</button>
              <button type="button" class="btn-secondary" id="modal-btn-cancel">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ""; };
    document.getElementById("modal-close-x").onclick = close;
    document.getElementById("modal-btn-cancel").onclick = close;

    const modalForm = document.getElementById("modal-product-form");
    const imageInput = modalForm.elements.namedItem("imageFile");
    const imagePreview = document.getElementById("product-image-preview");
    const imageSelectionStatus = modalForm.querySelector("[data-product-image-selection]");
    const taxonomyMarkup = document.createElement("div");
    taxonomyMarkup.innerHTML = window.EshopProductTaxonomy.createProductTaxonomyFields({
      categoryId: product?.taxonomy_category_id || "",
      categoryName: product?.taxonomy_category_name || "",
      customCategory: product?.taxonomy_custom_category || "",
      attributes: product?.taxonomy_attributes || []
    });
    const taxonomyFields = taxonomyMarkup.firstElementChild;
    modalForm.elements.namedItem("categoryId").closest(".form-grid").insertAdjacentElement("afterend", taxonomyFields);
    window.EshopProductTaxonomy.bindProductTaxonomyFields(taxonomyFields);
    mountProductPricing(modalForm, product);
    let previewObjectUrl = "";
    imageInput.addEventListener("change", () => {
      const files = Array.from(imageInput.files || []);
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = "";
      if (!files.length) {
        imagePreview.src = currentImage;
        imagePreview.hidden = !currentImage;
        if (imageSelectionStatus) imageSelectionStatus.textContent = "";
        return;
      }
      if (files.length > 8 || files.some(file => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
        AppUtils.showToast("Choose up to 8 images, each smaller than 5 MB.", "danger");
        imageInput.value = "";
        imagePreview.src = currentImage;
        imagePreview.hidden = !currentImage;
        if (imageSelectionStatus) imageSelectionStatus.textContent = "";
        return;
      }
      previewObjectUrl = URL.createObjectURL(files[0]);
      imagePreview.src = previewObjectUrl;
      imagePreview.hidden = false;
      if (imageSelectionStatus) imageSelectionStatus.textContent = `${files.length} photo${files.length === 1 ? "" : "s"} selected.`;
    });
    modalForm.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(modalForm);
      const prodId = fd.get("id");
      const selectedImages = Array.from(imageInput.files || []);
      if (selectedImages.length > 8 || selectedImages.some(file => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
        AppUtils.showToast("Choose up to 8 images, each smaller than 5 MB.", "danger");
        return;
      }
      let saved;
      try {
        const imageUrl = String(fd.get("image") || "").trim();
        const images = selectedImages.length
          ? await Promise.all(selectedImages.map(file => this.readProductImage(file)))
          : imageUrl !== currentImage
            ? imageUrl ? [imageUrl] : []
            : Array.isArray(product?.images) ? product.images.slice(0, 8) : currentImage ? [currentImage] : [];
        const taxonomy = window.EshopProductTaxonomy.readProductTaxonomyFields(modalForm);
        const productVariants = readProductPricingFields(modalForm);
        saved = SQLiteEngine.saveProduct({
          id: prodId ? Number(prodId) : undefined,
          name: fd.get("name"),
          brand: fd.get("brand"),
          sku: fd.get("sku"),
          category_id: Number(fd.get("categoryId")),
          price: Number(fd.get("price")),
          cost_price: Number(fd.get("costPrice")),
          original_price: Number(fd.get("price")),
          discount: Number(fd.get("discount") || 0),
          stock: productVariants.stock ?? Number(fd.get("stock")),
          description: fd.get("description"),
          is_flagship: fd.get("isFlagship") ? 1 : 0,
          is_featured: fd.get("isFeatured") ? 1 : 0,
          taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
          taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
          taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
          taxonomy_attributes: taxonomy.taxonomyAttributes,
          ...productVariants,
          images
        });
        if (saved.sku && Number.isSafeInteger(Number(saved.stock))) {
          await window.EshopInventoryBridge?.setLocalStock(
            this.getActiveTenant().id, saved.sku, Number(saved.stock)
          );
        }
      } catch (error) {
        console.error("Could not save the product photo and product to SQLite.", error);
        AppUtils.showToast("Product could not be saved. Check the selected photo and try again.", "danger");
        return;
      }
      AppUtils.showToast(`Product "${saved.name}" saved`);
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      close();
      this.handleRoute(returnToWebsite ? "/account/web/site" : initialCategoryId ? this.currentRoute() : "/account/products");
    };
  },

  updateNavBadges() {
    const cart = SQLiteEngine.getCart();
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const badge = document.getElementById("nav-cart-badge");
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    }
  },
};
