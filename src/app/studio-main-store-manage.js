// Main Store product and category management.
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppController, AppUtils, SQLiteEngine } from './main.js';
import { mountProductPricing, posPricingValues, readProductPricingFields, webPricingValues } from '../screens/main-store/product-pricing-fields.js';

export const mainStoreManageScreens = {
  renderMainStoreProductManagement(snapshot) {
    const products = snapshot.products || [];
    const rows = products.map((product, index) => {
      const image = product.imageUri || product.webProduct?.images?.[0] || product.posProduct?.imageUri || "";
      return `<article class="main-store-product-row" data-main-product-row data-name="${AppUtils.escapeHTML(String(product.name || "").toLocaleLowerCase())}" data-sku="${AppUtils.escapeHTML(String(product.sku || "").toLocaleLowerCase())}" data-category="${AppUtils.escapeHTML(String(product.categoryName || "").trim().toLocaleLowerCase())}" data-price="${Number(product.price) || 0}" data-stock="${product.stock == null ? "" : Number(product.stock)}" data-index="${index}">
        ${image
          ? `<img src="${AppUtils.escapeHTML(image)}" alt="" loading="lazy">`
          : `<span class="main-store-product-image-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><circle cx="9" cy="10" r="2"/><path d="m4 16 5-4 3 2 3-3 5 5"/></svg></span>`}
        <div class="main-store-product-row-info">
          <strong title="${AppUtils.escapeHTML(product.name)}">${AppUtils.escapeHTML(product.name)}</strong>
          <span>${this.formatMainShopMoney(product.price, snapshot.currency || "KES")}</span>
        </div>
        <div class="main-store-product-actions">
          <button type="button" class="main-store-product-icon-button" data-main-product-edit="${index}" aria-label="Edit ${AppUtils.escapeHTML(product.name)}" title="Edit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button>
          <button type="button" class="main-store-product-icon-button" data-main-product-delete="${index}" aria-label="Delete ${AppUtils.escapeHTML(product.name)}" title="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></button>
        </div>
      </article>`;
    }).join("");
    return `<article class="bl-card main-store-product-manager">
      <header class="main-store-product-manager-header"><p>Add products or edit them in POS, Web, or both. Web changes need publishing to go live.</p><button type="button" data-main-product-add>Add product</button></header>
      <form class="main-store-product-form" data-main-store-product-form hidden>
        <input type="hidden" name="productIndex" value="">
        <div class="main-store-product-form-fields">
          <label>Product name<input name="name" maxlength="160" required></label>
          <label>Category<input name="category" maxlength="100" required></label>
          <label>Price<input name="price" type="number" min="0" step="0.01" required></label>
          <label>Cost price<input name="costPrice" type="number" min="0" step="0.01"></label>
          <label>Stock<input name="stock" type="number" min="0" step="1" required></label>
        </div>
        <div data-main-product-taxonomy></div>
        <div data-product-pricing-variants></div><div data-product-pricing-attributes></div>
        <div class="main-store-product-channels" aria-label="Save product to">
          <label><input type="checkbox" name="channels" value="pos" checked> POS</label>
          <label><input type="checkbox" name="channels" value="web" checked> Web</label>
        </div>
        <p class="main-store-product-status" data-main-product-status role="status" aria-live="polite"></p>
        <div class="main-store-product-actions"><button type="submit">Save product</button><button type="button" data-main-product-cancel>Cancel</button></div>
      </form>
      ${products.length ? `<div class="main-store-product-toolbar" data-main-product-toolbar>
        <input type="search" data-main-product-search placeholder="Search by name or SKU" aria-label="Search products" autocomplete="off">
        <select data-main-product-category-filter aria-label="Filter by category"><option value="">All categories</option>${[...new Map(products.map(product => [String(product.categoryName || "").trim().toLocaleLowerCase(), String(product.categoryName || "").trim()])).entries()]
          .filter(([key]) => key).sort((a, b) => a[1].localeCompare(b[1]))
          .map(([key, label]) => `<option value="${AppUtils.escapeHTML(key)}">${AppUtils.escapeHTML(label)}</option>`).join("")}</select>
        <select data-main-product-sort aria-label="Sort products"><option value="name">Name A to Z</option><option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option><option value="stock-asc">Stock low to high</option></select>
        <p class="main-store-product-status" data-main-product-count role="status" aria-live="polite"></p>
      </div>` : ""}
      <div class="main-store-product-list" data-main-product-list>${rows || `<p class="bl-empty">No products yet. Add one to start your catalogue.</p>`}</div>
      <p class="bl-empty" data-main-product-empty hidden>No products match your search.</p>
    </article>`;
  },

  getMainStoreCategoryRecords(snapshot) {
    const categories = new Map();
    for (const category of SQLiteEngine.getCategories()) {
    const key = category.name.trim().toLocaleLowerCase();
    categories.set(key, { name: category.name, webCategory: category, posCategory: null });
    }
    for (const category of snapshot.posCategories || []) {
    const key = category.name.trim().toLocaleLowerCase();
    const record = categories.get(key) || { name: category.name, webCategory: null, posCategory: null };
    record.posCategory = category;
    categories.set(key, record);
    }
    return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name));
  },

  renderMainStoreCategories(snapshot) {
    const categories = this.getMainStoreCategoryRecords(snapshot);
    const rows = categories.map((category, index) => {
    const products = (snapshot.products || []).filter(product =>
      String(product.categoryName || "").trim().toLocaleLowerCase() === category.name.trim().toLocaleLowerCase()).length;
    const sources = [category.posCategory ? "Store" : "", category.webCategory ? "Web" : ""].filter(Boolean).join(" · ");
    const protectedCategory = category.name.toLocaleLowerCase() === "other";
    return `<article class="main-store-category-row">
      <div class="main-store-category-row-info">
        <strong title="${AppUtils.escapeHTML(category.name)}">${AppUtils.escapeHTML(category.name)}</strong>
        <span>${products} products · ${sources || "Store"}</span>
      </div>
      <div class="main-store-product-actions">
        <button type="button" class="main-store-product-icon-button" data-main-category-open="${index}" aria-label="Products in ${AppUtils.escapeHTML(category.name)}" title="View and move products"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg></button>
        <button type="button" class="main-store-product-icon-button" data-main-category-edit="${index}" aria-label="Edit ${AppUtils.escapeHTML(category.name)}" title="Edit category" ${protectedCategory ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button>
        <button type="button" class="main-store-product-icon-button" data-main-category-delete="${index}" aria-label="Delete ${AppUtils.escapeHTML(category.name)}" title="Delete category" ${protectedCategory ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></button>
      </div>
    </article>`;
    }).join("");
    return `<article class="bl-card main-store-product-manager">
    <header class="main-store-product-manager-header"><p>Manage categories used by products in your Store and Web catalog.</p><button type="button" data-main-category-add>Add category</button></header>
    <form class="main-store-category-form" data-main-store-category-form hidden>
      <input type="hidden" name="originalName">
      <label>Category name<input name="name" maxlength="120" required></label>
      <p class="main-store-product-status" data-main-category-status role="status" aria-live="polite"></p>
      <div class="main-store-product-actions"><button type="submit">Save category</button><button type="button" data-main-category-cancel>Cancel</button></div>
    </form>
    <section class="main-store-category-contents" data-main-category-contents hidden>
      <header><strong data-category-contents-title></strong><button type="button" data-category-contents-close>Close</button></header>
      <div class="main-store-category-pick-list" data-category-contents-list></div>
      <div class="main-store-product-actions">
        <label class="main-store-category-pick"><input type="checkbox" data-category-select-all> Select all</label>
        <select data-category-move-target aria-label="Move selected products to"></select>
        <button type="button" data-category-move-selected disabled>Move selected</button>
      </div>
      <details>
        <summary>Add products from other categories</summary>
        <input type="search" data-category-add-search placeholder="Search products to add" aria-label="Search products to add" autocomplete="off">
        <div class="main-store-category-pick-list" data-category-add-list></div>
        <button type="button" data-category-add-selected disabled>Move selected here</button>
      </details>
      <p class="main-store-product-status" data-category-contents-status role="status" aria-live="polite"></p>
    </section>
    <div class="main-store-category-list">${rows || `<p class="bl-empty">No categories yet. Add one to organize your products.</p>`}</div>
    </article>`;
  },

  renderMainStoreManagement(path, snapshot) {
    const categoryTab = path.endsWith("/categories");
    const productsPath = "/store/manage/products";
    const categoriesPath = "/store/manage/categories";
    return `<nav class="main-store-management-tabs" aria-label="Store management">
    <a href="${productsPath}" data-route="${productsPath}" ${categoryTab ? "" : 'class="is-active" aria-current="page"'}>Products</a>
    <a href="${categoriesPath}" data-route="${categoriesPath}" ${categoryTab ? 'class="is-active" aria-current="page"' : ""}>Categories</a>
    </nav>
    <section class="main-store-management-content" aria-live="polite">
    ${categoryTab ? this.renderMainStoreCategories(snapshot) : this.renderMainStoreProductManagement(snapshot)}
    </section>`;
  },

  bindMainStoreCategories(container, snapshot, path) {
    const form = container.querySelector("[data-main-store-category-form]");
    if (!form) return;
    const status = form.querySelector("[data-main-category-status]");
    const originalField = form.querySelector('[name="originalName"]');
    const nameField = form.querySelector('[name="name"]');
    const categories = this.getMainStoreCategoryRecords(snapshot);
    const openForm = category => {
    form.reset();
    originalField.value = category?.name || "";
    nameField.value = category?.name || "";
    form.hidden = false;
    if (status) status.textContent = "";
    nameField.focus();
    };
    container.querySelector("[data-main-category-add]")?.addEventListener("click", () => openForm(null));
    container.querySelector("[data-main-category-cancel]")?.addEventListener("click", () => {
    form.reset();
    form.hidden = true;
    if (status) status.textContent = "";
    });
    container.querySelectorAll("[data-main-category-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const category = categories[Number(button.dataset.mainCategoryEdit)];
      if (category) openForm(category);
    });
    });
    form.addEventListener("submit", async event => {
    event.preventDefault();
    const name = nameField.value.trim();
    const originalName = originalField.value.trim();
    const original = originalName
      ? categories.find(category => category.name.trim().toLocaleLowerCase() === originalName.toLocaleLowerCase())
      : null;
    if (!name) {
      if (status) status.textContent = "Enter a category name.";
      return;
    }
    if (categories.some(category =>
      category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase() &&
      category.name.trim().toLocaleLowerCase() !== originalName.toLocaleLowerCase())) {
      if (status) status.textContent = `The category "${name}" already exists.`;
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    if (status) status.textContent = "Saving category…";
    try {
      if (original?.posCategory && original.name !== name) {
        await window.ShopPOS.renameCategory(original.posCategory.id, name);
      } else if (!original?.posCategory) {
        const posCategories = await window.ShopPOS.listCategories();
        if (!posCategories.some(category => category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
          await window.ShopPOS.createCategory(name);
        }
      }
      if (original?.webCategory) {
        SQLiteEngine.saveCategory({ id: original.webCategory.id, name });
      } else if (!original) {
        const webCategory = SQLiteEngine.getCategories().find(category =>
          category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
        if (!webCategory) SQLiteEngine.saveCategory({ name });
      }
      AppController.cacheActiveTenantCatalog();
      await window.ShopSQLite.flush();
      await this.loadMainShopWorkspace(path);
      AppUtils.showToast(original ? "Category updated." : "Category added.");
    } catch (error) {
      console.error("Store category could not be saved.", error);
      if (status) status.textContent = error instanceof Error ? error.message : "The category could not be saved.";
      submit.disabled = false;
    }
    });
    const panel = container.querySelector("[data-main-category-contents]");
    if (panel) {
      const key = value => String(value || "").trim().toLocaleLowerCase();
      const panelStatus = panel.querySelector("[data-category-contents-status]");
      const contentsList = panel.querySelector("[data-category-contents-list]");
      const addList = panel.querySelector("[data-category-add-list]");
      const moveTarget = panel.querySelector("[data-category-move-target]");
      const moveButton = panel.querySelector("[data-category-move-selected]");
      const addButton = panel.querySelector("[data-category-add-selected]");
      const addSearch = panel.querySelector("[data-category-add-search]");
      const selectAll = panel.querySelector("[data-category-select-all]");
      let openCategory = null;
      const pickRow = (product, index) =>
        `<label class="main-store-category-pick"><input type="checkbox" value="${index}"> <span>${AppUtils.escapeHTML(product.name)}${product.categoryName ? ` · ${AppUtils.escapeHTML(product.categoryName)}` : ""}</span></label>`;
      const checked = list => [...list.querySelectorAll('input[type="checkbox"]:checked')].map(input => Number(input.value));
      const refreshButtons = () => {
        moveButton.disabled = !checked(contentsList).length || !moveTarget.value;
        addButton.disabled = !checked(addList).length;
      };
      const renderPanel = () => {
        if (!openCategory) return;
        const products = snapshot.products || [];
        const inside = products.map((product, index) => ({ product, index }))
          .filter(entry => key(entry.product.categoryName) === key(openCategory.name));
        panel.querySelector("[data-category-contents-title]").textContent = `${openCategory.name} (${inside.length})`;
        contentsList.innerHTML = inside.map(entry => pickRow(entry.product, entry.index)).join("")
          || `<p class="bl-empty">No products in this category yet.</p>`;
        const query = key(addSearch.value);
        addList.innerHTML = products.map((product, index) => ({ product, index }))
          .filter(entry => key(entry.product.categoryName) !== key(openCategory.name)
            && (!query || key(entry.product.name).includes(query) || key(entry.product.sku).includes(query)))
          .slice(0, 100).map(entry => pickRow(entry.product, entry.index)).join("")
          || `<p class="bl-empty">No other products found.</p>`;
        moveTarget.innerHTML = `<option value="">Move to…</option>${categories
          .map((category, index) => ({ category, index }))
          .filter(entry => key(entry.category.name) !== key(openCategory.name))
          .map(entry => `<option value="${entry.index}">${AppUtils.escapeHTML(entry.category.name)}</option>`).join("")}`;
        selectAll.checked = false;
        refreshButtons();
      };
      const moveProducts = async (indexes, target) => {
        const items = indexes.map(index => snapshot.products[index]).filter(Boolean);
        if (!items.length || !target) return;
        panelStatus.textContent = `Moving ${items.length} product${items.length === 1 ? "" : "s"} to ${target.name}…`;
        moveButton.disabled = true;
        addButton.disabled = true;
        try {
          let posCategory = target.posCategory;
          let webCategory = target.webCategory;
          if (!posCategory && items.some(product => product.posProduct)) {
            await window.ShopPOS.addCategory(target.name);
            posCategory = (await window.ShopPOS.listCategories()).find(item => key(item.name) === key(target.name));
            if (!posCategory) throw new Error(`Could not create POS category "${target.name}".`);
          }
          if (!webCategory && items.some(product => product.webProduct)) {
            SQLiteEngine.saveCategory({ name: target.name });
            webCategory = SQLiteEngine.getCategories().find(item => key(item.name) === key(target.name));
            if (!webCategory) throw new Error(`Could not create Web category "${target.name}".`);
          }
          for (const product of items) {
            if (product.posProduct) {
              await window.ShopPOS.saveProduct({ ...product.posProduct, id: Number(product.posProduct.id), categoryId: posCategory.id });
            }
            if (product.webProduct) {
              SQLiteEngine.saveProduct({ ...product.webProduct, id: product.webProduct.id, category_id: webCategory.id });
            }
          }
          AppController.cacheActiveTenantCatalog();
          await window.ShopSQLite.flush();
          await this.loadMainShopWorkspace(path);
          AppUtils.showToast(`${items.length} product${items.length === 1 ? "" : "s"} moved to ${target.name}.`);
        } catch (error) {
          console.error("Store products could not be moved.", error);
          panelStatus.textContent = error instanceof Error ? error.message : "The products could not be moved.";
          refreshButtons();
        }
      };
      container.querySelectorAll("[data-main-category-open]").forEach(button => {
        button.addEventListener("click", () => {
          openCategory = categories[Number(button.dataset.mainCategoryOpen)] || null;
          if (!openCategory) return;
          addSearch.value = "";
          panelStatus.textContent = "";
          panel.hidden = false;
          renderPanel();
          panel.scrollIntoView?.({ block: "nearest" });
        });
      });
      panel.querySelector("[data-category-contents-close]").addEventListener("click", () => {
        panel.hidden = true;
        openCategory = null;
      });
      selectAll.addEventListener("change", () => {
        contentsList.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = selectAll.checked; });
        refreshButtons();
      });
      contentsList.addEventListener("change", refreshButtons);
      addList.addEventListener("change", refreshButtons);
      moveTarget.addEventListener("change", refreshButtons);
      addSearch.addEventListener("input", renderPanel);
      moveButton.addEventListener("click", () =>
        moveProducts(checked(contentsList), categories[Number(moveTarget.value)]));
      addButton.addEventListener("click", () => moveProducts(checked(addList), openCategory));
    }
    container.querySelectorAll("[data-main-category-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      const category = categories[Number(button.dataset.mainCategoryDelete)];
      if (!category) {
        AppUtils.showToast("That category is no longer available. Refresh the Store screen.", "danger");
        return;
      }
      if (!window.confirm(`Delete "${category.name}"? Products in the POS catalog will move to Other.`)) return;
      button.disabled = true;
      try {
        if (category.posCategory) await window.ShopPOS.deleteCategory(category.posCategory.id);
        if (category.webCategory) SQLiteEngine.deleteCategory(category.webCategory.id);
        AppController.cacheActiveTenantCatalog();
        await window.ShopSQLite.flush();
        await this.loadMainShopWorkspace(path);
        AppUtils.showToast("Category deleted.");
      } catch (error) {
        console.error("Store category could not be deleted.", error);
        AppUtils.showToast(error instanceof Error ? error.message : "The category could not be deleted.", "danger");
        button.disabled = false;
      }
    });
    });
  },

  bindMainStoreProductManagement(container, snapshot, path) {
    const form = container.querySelector("[data-main-store-product-form]");
    if (!form) return;
    const status = form.querySelector("[data-main-product-status]");
    const editField = form.querySelector('[name="productIndex"]');
    const fields = Object.fromEntries(["name", "category", "price", "costPrice", "stock"]
      .map(name => [name, form.querySelector(`[name="${name}"]`)]));
    const channelInputs = [...form.querySelectorAll('[name="channels"]')];
    const taxonomyHost = form.querySelector("[data-main-product-taxonomy]");
    // The Category text input above owns name="category"; the picker must not render a second category select.
    const renderTaxonomy = product => {
      mountProductPricing(form, product);
      if (!taxonomyHost || !window.EshopProductTaxonomy) return;
      const web = product?.webProduct;
      const pos = product?.posProduct;
      taxonomyHost.innerHTML = window.EshopProductTaxonomy.createProductTaxonomyFields({
        categoryId: web?.taxonomy_category_id || pos?.taxonomyCategoryId || "",
        categoryName: web?.taxonomy_category_name || "",
        customCategory: web?.taxonomy_custom_category || pos?.taxonomyCustomCategory || "",
        attributes: web?.taxonomy_attributes?.length ? web.taxonomy_attributes : pos?.taxonomyAttributes || [],
        storeCategoryFieldName: ""
      });
      window.EshopProductTaxonomy.bindProductTaxonomyFields(taxonomyHost);
    };
    const readTaxonomy = () => taxonomyHost?.firstElementChild && window.EshopProductTaxonomy
      ? window.EshopProductTaxonomy.readProductTaxonomyFields(form)
      : null;
    renderTaxonomy(null);
    const openForm = (product, index) => {
      form.reset();
      renderTaxonomy(product);
      editField.value = index == null ? "" : String(index);
      fields.name.value = product?.name || "";
      fields.category.value = product?.categoryName || "Uncategorized";
      fields.price.value = product?.price == null ? "" : String(product.price);
      fields.costPrice.value = product?.costPrice == null ? "" : String(product.costPrice);
      fields.stock.value = product?.stock == null ? "0" : String(product.stock);
      channelInputs.forEach(input => {
        input.checked = product
          ? input.value === "pos" ? Boolean(product.posProductId) : Boolean(product.webProductId)
          : true;
      });
      if (status) status.textContent = "";
      form.hidden = false;
      fields.name.focus();
    };

    const searchInput = container.querySelector("[data-main-product-search]");
    const filterSelect = container.querySelector("[data-main-product-category-filter]");
    const sortSelect = container.querySelector("[data-main-product-sort]");
    const productList = container.querySelector("[data-main-product-list]");
    const countLine = container.querySelector("[data-main-product-count]");
    const emptyLine = container.querySelector("[data-main-product-empty]");
    const applyProductView = () => {
      if (!productList) return;
      const query = String(searchInput?.value || "").trim().toLocaleLowerCase();
      const category = filterSelect?.value || "";
      const rows = [...productList.querySelectorAll("[data-main-product-row]")];
      const sorters = {
        name: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
        "price-asc": (a, b) => Number(a.dataset.price) - Number(b.dataset.price),
        "price-desc": (a, b) => Number(b.dataset.price) - Number(a.dataset.price),
        // Untracked stock (blank) sorts last.
        "stock-asc": (a, b) => (a.dataset.stock === "" ? Infinity : Number(a.dataset.stock))
          - (b.dataset.stock === "" ? Infinity : Number(b.dataset.stock))
      };
      const sorter = sorters[sortSelect?.value] || sorters.name;
      rows.sort((a, b) => sorter(a, b) || Number(a.dataset.index) - Number(b.dataset.index))
        .forEach(row => productList.appendChild(row));
      let shown = 0;
      rows.forEach(row => {
        const match = (!query || row.dataset.name.includes(query) || row.dataset.sku.includes(query))
          && (!category || row.dataset.category === category);
        row.hidden = !match;
        if (match) shown += 1;
      });
      if (countLine) countLine.textContent = rows.length ? `Showing ${shown} of ${rows.length} products` : "";
      if (emptyLine) emptyLine.hidden = !rows.length || shown > 0;
    };
    searchInput?.addEventListener("input", applyProductView);
    filterSelect?.addEventListener("change", applyProductView);
    sortSelect?.addEventListener("change", applyProductView);
    applyProductView();

    container.querySelector("[data-main-product-add]")?.addEventListener("click", () => openForm(null, null));
    container.querySelector("[data-main-product-cancel]")?.addEventListener("click", () => {
      form.reset();
      form.hidden = true;
      if (status) status.textContent = "";
    });
    container.querySelectorAll("[data-main-product-edit]").forEach(button => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.mainProductEdit);
        const product = snapshot.products[index];
        if (!product) {
          AppUtils.showToast("That product is no longer available. Refresh the Store screen.", "danger");
          return;
        }
        openForm(product, index);
      });
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const values = new FormData(form);
      const productIndex = String(values.get("productIndex") || "");
      const editingIndex = productIndex === "" ? -1 : Number(productIndex);
      const original = editingIndex < 0 ? null : snapshot.products[editingIndex];
      if (productIndex !== "" && !original) {
        if (status) status.textContent = "That product is no longer available. Refresh the Store screen and try again.";
        return;
      }
      const name = String(values.get("name") || "").trim();
      const categoryName = String(values.get("category") || "").trim();
      let sku = original?.sku || "";
      const price = Number(values.get("price"));
      const costText = String(values.get("costPrice") || "").trim();
      const costPrice = costText === "" ? null : Number(costText);
      const pricing = readProductPricingFields(form, message => { if (status) status.textContent = message; });
      if (!pricing) return;
      const stock = pricing.variants.length ? pricing.stock : Number(values.get("stock"));
      const channels = new Set(values.getAll("channels").map(String));
      const writePos = channels.has("pos");
      const writeWeb = channels.has("web");
      const taxonomy = readTaxonomy();
      let webSaved = false;
      let posSaved = false;

      if (!name || !categoryName || !Number.isFinite(price) || price < 0 ||
        (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) ||
        !Number.isSafeInteger(stock) || stock < 0 || (!writePos && !writeWeb)) {
        if (status) status.textContent = "Enter a product name, category, valid prices and stock, and select POS or Web.";
        return;
      }
      if (!sku) {
        const existingSkus = new Set(snapshot.products.map(product => String(product.sku || "").toLocaleUpperCase()));
        do {
          sku = SQLiteEngine.generateProductSku();
        } while (existingSkus.has(sku.toLocaleUpperCase()));
      }
      if (sku && snapshot.products.some((product, index) =>
        index !== editingIndex && String(product.sku || "").toLocaleUpperCase() === sku.toLocaleUpperCase())) {
        if (status) status.textContent = "That SKU is already used by another catalogue product.";
        return;
      }

      submit.disabled = true;
      if (status) status.textContent = "Saving product…";
      try {
        let posProducts = await window.ShopPOS.listProducts();
        let posProduct = original?.posProductId
          ? posProducts.find(item => Number(item.id) === Number(original.posProductId))
          : sku ? posProducts.find(item => String(item.sku || "").toLocaleUpperCase() === sku.toLocaleUpperCase()) : null;
        let webProduct = original?.webProductId
          ? SQLiteEngine.getProductById(original.webProductId)
          : sku ? SQLiteEngine.select("products").find(item => String(item.sku || "").toLocaleUpperCase() === sku.toLocaleUpperCase()) : null;

        const ensurePosCategory = async () => {
          let category = (await window.ShopPOS.listCategories()).find(item =>
            item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
          if (!category) {
            await window.ShopPOS.addCategory(categoryName);
            category = (await window.ShopPOS.listCategories()).find(item =>
              item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
          }
          if (!category) throw new Error(`Could not create POS category "${categoryName}".`);
          return category;
        };
        const ensureWebCategory = () => {
          let category = SQLiteEngine.getCategories().find(item =>
            item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
          if (!category) {
            SQLiteEngine.saveCategory({ name: categoryName });
            category = SQLiteEngine.getCategories().find(item =>
              item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
          }
          if (!category) throw new Error(`Could not create Web category "${categoryName}".`);
          return category;
        };
        const saveWebProduct = () => {
          const category = ensureWebCategory();
          webProduct = SQLiteEngine.saveProduct({
            ...(webProduct || {}),
            ...(webProduct ? { id: webProduct.id } : {}),
            name, sku: sku || webProduct?.sku || "", category_id: category.id,
            price, cost_price: costPrice ?? 0, stock,
            ...webPricingValues(pricing),
            ...(taxonomy ? {
              taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
              taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
              taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
              taxonomy_attributes: taxonomy.taxonomyAttributes
            } : {}),
            images: webProduct?.images || [], status: webProduct?.status || "active"
          });
          sku = String(webProduct.sku || sku);
          webSaved = true;
        };
        const savePosProduct = async () => {
          const category = await ensurePosCategory();
          const id = await window.ShopPOS.saveProduct({
            ...(posProduct || {}),
            id: Number(posProduct?.id) || 0,
            name, sku: sku || posProduct?.sku || "", categoryId: category.id,
            price, buyingPrice: costPrice == null ? "" : costPrice, stock,
            ...posPricingValues(pricing),
            imageUri: posProduct?.imageUri || webProduct?.images?.[0] || "",
            ...(taxonomy ? {
              taxonomyCategoryId: taxonomy.taxonomyCategoryId || "",
              taxonomyCustomCategory: taxonomy.taxonomyCustomCategory || "",
              taxonomyAttributes: taxonomy.taxonomyAttributes
            } : {}),
            lowStockThreshold: Number(posProduct?.lowStockThreshold) || 3
          });
          posProducts = await window.ShopPOS.listProducts();
          posProduct = posProducts.find(item => Number(item.id) === Number(id));
          if (!posProduct) throw new Error("The POS product saved, but could not be reloaded.");
          sku = String(posProduct.sku || sku);
          posSaved = true;
        };

        if (writeWeb && writePos && webProduct) saveWebProduct();
        if (writePos) {
          if (!posProduct && webProduct) {
            await this.addWebsiteProductToPos(Number(webProduct.id));
            posProducts = await window.ShopPOS.listProducts();
            posProduct = posProducts.find(item => String(item.sku || "") === String(webProduct.sku || ""));
          }
          await savePosProduct();
        }
        if (writeWeb && writePos) {
          await this.publishPosProduct(posProduct);
          if (posProduct) {
            // publishPosProduct keeps the old web taxonomy when POS has none, and copies no options,
            // so write the chosen values explicitly.
            const published = SQLiteEngine.select("products").find(item => String(item.sku || "") === String(posProduct.sku || ""));
            if (published) {
              SQLiteEngine.saveProduct({
                ...published, id: published.id,
                ...webPricingValues(pricing),
                ...(taxonomy ? {
                  taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
                  taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
                  taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
                  taxonomy_attributes: taxonomy.taxonomyAttributes
                } : {})
              });
              AppController.cacheActiveTenantCatalog();
              await window.ShopSQLite.flush();
            }
          }
          webSaved = true;
        } else if (writeWeb) {
          saveWebProduct();
          AppController.cacheActiveTenantCatalog();
          await window.ShopSQLite.flush();
          await window.EshopInventoryBridge?.setLocalStock(AppController.getActiveTenant().id, webProduct.sku, stock);
        }
        await this.loadMainShopWorkspace(path);
        AppUtils.showToast("Product saved to the selected catalogue.");
      } catch (error) {
        console.error("Main Store product could not be saved.", error);
        const detail = error instanceof Error ? error.message : "Product could not be saved.";
        if (status) {
          status.textContent = webSaved && !posSaved
            ? `The Web copy was saved, but POS could not be updated: ${detail}`
            : posSaved && !webSaved
              ? `POS was saved, but Web could not be updated: ${detail}`
              : detail;
        }
        submit.disabled = false;
      }
    });

    container.querySelectorAll("[data-main-product-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        const index = Number(button.dataset.mainProductDelete);
        const product = snapshot.products[index];
        if (!product) {
          AppUtils.showToast("That product is no longer available. Refresh the Store screen.", "danger");
          return;
        }
        const posId = Number(product.posProductId) || 0;
        const webId = Number(product.webProductId) || 0;
        const destinations = [posId ? "POS" : "", webId ? "Web" : ""].filter(Boolean).join(" and ");
        if (!window.confirm(`Delete "${product.name}" from ${destinations}? Recorded sales will remain.`)) return;
        button.disabled = true;
        const removed = [];
        try {
          if (posId) {
            await window.ShopPOS.deleteProduct(posId);
            removed.push("POS");
          }
          if (webId) {
            SQLiteEngine.deleteProduct(webId);
            removed.push("Web");
            AppController.cacheActiveTenantCatalog();
            await window.ShopSQLite.flush();
          }
          await this.loadMainShopWorkspace(path);
          AppUtils.showToast(`"${product.name}" was deleted from ${destinations}.`);
        } catch (error) {
          console.error("Main Store product could not be deleted from all selected channels.", error);
          const detail = error instanceof Error ? error.message : "Product could not be deleted.";
          AppUtils.showToast(
            removed.length ? `Removed from ${removed.join(" and ")}, but deletion was incomplete: ${detail}` : detail,
            "danger"
          );
          button.disabled = false;
        }
      });
    });
  },
};
