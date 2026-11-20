// New-website wizard: the Store picker that brings products and categories in from the Main Store.
// One block of AppController.bindWebsiteBuilderEvents, called with this = AppController.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, StudioRenderers } from '../../app/main.js';

export function bindWizardStorePicker() {
  const loadStore = document.getElementById("website-wizard-load-store");
  if (loadStore) loadStore.onclick = async () => {
    const picker = document.getElementById("website-wizard-store-picker");
    const status = document.getElementById("website-wizard-store-count");
    const list = document.getElementById("website-wizard-store-list");
    const closeButton = document.getElementById("website-wizard-store-close");
    const importButton = document.getElementById("website-wizard-import-store");
    const searchInput = document.getElementById("website-wizard-store-search");
    const categoryFilter = document.getElementById("website-wizard-store-category");
    const selectAll = document.getElementById("website-wizard-store-select-all");
    if (!picker || !status || !list || !importButton || !searchInput || !categoryFilter || !selectAll) return;

    picker.hidden = false;
    picker.scrollIntoView({ block: "start", behavior: "smooth" });
    list.innerHTML = "";
    status.textContent = "Loading all Store products…";
    loadStore.disabled = true;
    loadStore.textContent = "Loading Store…";
    if (closeButton) closeButton.onclick = () => { picker.hidden = true; };

    try {
      if (!window.ShopPOS?.listProducts || !window.ShopPOS?.listCategories) {
        throw new Error("Store inventory is not available in this app session.");
      }
      const products = await window.ShopPOS.listProducts();
      const categories = await window.ShopPOS.listCategories();
      if (!Array.isArray(products) || !Array.isArray(categories)) {
        throw new Error("Store returned an invalid product catalog.");
      }
      const categoryName = product => String(product.categoryName || product.category_name ||
        categories.find(category => Number(category.id) === Number(product.categoryId ?? product.category_id))?.name || "").trim();
      const namedCategories = [...new Set(products.map(categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      categoryFilter.innerHTML = `<option value="all">All categories</option><option value="general">General (uncategorized)</option>${namedCategories.map(name => `<option value="${AppUtils.escapeHTML(name.toLocaleLowerCase())}">${AppUtils.escapeHTML(name)}</option>`).join("")}`;
      const selectedProductIds = new Set();
      const renderStoreProducts = () => {
        const query = searchInput.value.trim().toLocaleLowerCase();
        const selectedCategory = categoryFilter.value;
        const matchingProducts = products.map((product, index) => ({ product, index, category: categoryName(product) }))
          .filter(({ product, category }) => {
            const categoryMatches = selectedCategory === "all" ||
              (selectedCategory === "general" ? !category : category.toLocaleLowerCase() === selectedCategory);
            return categoryMatches && (!query || `${product.name} ${product.sku || ""} ${product.description || ""} ${category}`.toLocaleLowerCase().includes(query));
          });
        // Every Store product, drawn like the website product rows so they look the way they do in Store.
        const visibleProducts = matchingProducts;
        list.innerHTML = visibleProducts.map(({ product, index, category }) => {
          const image = product.imageUri || (Array.isArray(product.images) ? product.images.find(value => typeof value === "string" && value) : "");
          return `<label class="website-wizard-product-row website-wizard-store-row">
          <input type="checkbox" data-wizard-store-product="${index}" ${selectedProductIds.has(index) ? "checked" : ""} aria-label="Select ${AppUtils.escapeHTML(product.name || "product")}">
          ${image ? `<img class="website-wizard-product-thumb" src="${AppUtils.escapeHTML(image)}" alt="">` : `<span class="website-wizard-product-thumb" aria-hidden="true"></span>`}
          <span class="website-wizard-product-copy"><strong>${AppUtils.escapeHTML(product.name || "Unnamed product")}</strong><span>${AppUtils.escapeHTML(category || "General")} · ${AppUtils.escapeHTML(String(product.stock ?? 0))} in stock</span></span>
          <strong>${AppUtils.formatMoney(product.price ?? 0)}</strong>
        </label>`;
        }).join("") || `<p class="studio-panel-note">No products match this filter.</p>`;
        status.textContent = `${visibleProducts.length < matchingProducts.length ? `Showing ${visibleProducts.length} of ${matchingProducts.length} matches` : `${matchingProducts.length} matches`} · ${products.length} Store products · ${selectedProductIds.size} selected`;
        importButton.disabled = selectedProductIds.size === 0;
        selectAll.checked = visibleProducts.length > 0 && visibleProducts.every(({ index }) => selectedProductIds.has(index));
        selectAll.indeterminate = !selectAll.checked && visibleProducts.some(({ index }) => selectedProductIds.has(index));
      };
      list.onchange = event => {
        const checkbox = event.target.closest("[data-wizard-store-product]");
        if (!checkbox) return;
        const index = Number(checkbox.dataset.wizardStoreProduct);
        if (checkbox.checked) selectedProductIds.add(index);
        else selectedProductIds.delete(index);
        renderStoreProducts();
      };
      searchInput.oninput = renderStoreProducts;
      categoryFilter.onchange = renderStoreProducts;
      selectAll.onchange = () => {
        const query = searchInput.value.trim().toLocaleLowerCase();
        const selectedCategory = categoryFilter.value;
        products.map((product, index) => ({ product, index, category: categoryName(product) }))
          .filter(({ product, category }) => {
            const categoryMatches = selectedCategory === "all" ||
              (selectedCategory === "general" ? !category : category.toLocaleLowerCase() === selectedCategory);
            return categoryMatches && (!query || `${product.name} ${product.sku || ""} ${product.description || ""} ${category}`.toLocaleLowerCase().includes(query));
          })
          .forEach(({ index }) => {
            if (selectAll.checked) selectedProductIds.add(index);
            else selectedProductIds.delete(index);
          });
        renderStoreProducts();
      };
      importButton.onclick = () => {
        const draft = StudioRenderers.websiteBuilderDraft();
        let addedCount = 0;
        for (const index of selectedProductIds) {
          const product = products[index];
          if (!product) continue;
          const name = categoryName(product) || "General";
          let category = draft.categories.find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
          if (!category) {
            category = { id: Date.now() + draft.categories.length, name };
            draft.categories.push(category);
          }
          if (draft.products.some(item => item.source_product_id === product.id)) continue;
          draft.products.push({
            id: Date.now() + draft.products.length,
            source_product_id: product.id,
            name: String(product.name || "Unnamed product"),
            sku: String(product.sku || ""),
            brand: String(product.brand || ""),
            price: Number(product.price ?? product.selling_price) || 0,
            cost_price: Number(product.cost_price ?? product.costPrice ?? product.buyingPrice) || 0,
            stock: Math.max(0, Number(product.stock) || 0),
            description: String(product.description || ""),
            images: Array.isArray(product.images) ? product.images.slice(0, 8) : product.imageUri ? [product.imageUri] : [],
            media_type: ["image", "cutout", "spin", "video"].includes(product.media_type) ? product.media_type : "image",
            spin_frames: Array.isArray(product.spin_frames) ? product.spin_frames.slice() : [],
            video_path: String(product.video_path || ""),
            video_url: String(product.video_url || ""),
            // Store hands products over in camelCase (src/pos.js listProducts); keep both spellings.
            taxonomy_category_id: product.taxonomy_category_id || product.taxonomyCategoryId || null,
            taxonomy_category_name: String(product.taxonomy_category_name || product.taxonomyCategoryName || ""),
            taxonomy_custom_category: product.taxonomy_custom_category || product.taxonomyCustomCategory || null,
            taxonomy_attributes: Array.isArray(product.taxonomy_attributes) ? product.taxonomy_attributes
              : Array.isArray(product.taxonomyAttributes) ? product.taxonomyAttributes : [],
            priced_attributes: Array.isArray(product.priced_attributes) ? product.priced_attributes
              : Array.isArray(product.pricedAttributes) ? product.pricedAttributes : [],
            duration_minutes: Number(product.duration_minutes ?? product.durationMinutes) || 0,
            sizes: Array.isArray(product.sizes) ? product.sizes : [],
            colors: Array.isArray(product.colors) ? product.colors : [],
            variants: Array.isArray(product.variants) ? product.variants : [],
            category_id: category.id,
            category_name: category.name
          });
          addedCount += 1;
        }
        StudioRenderers.saveWebsiteBuilderDraft(draft);
        AppUtils.showToast(`${addedCount} Store product${addedCount === 1 ? "" : "s"} added to the new website draft.`);
        this.handleRoute(this.currentRoute());
      };
      renderStoreProducts();
    } catch (error) {
      console.error("Store products could not be loaded for the new website wizard.", error);
      status.textContent = error.message || "Store products could not be loaded.";
      AppUtils.showToast(status.textContent, "danger");
    } finally {
      loadStore.disabled = false;
      loadStore.textContent = "Add from Store";
    }
  };
}
