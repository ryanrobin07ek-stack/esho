// Storefront category screen (/category/:slug) and its sort and filter controls.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppController, AppUtils, SQLiteEngine, StoreRenderers } from '../../app/main.js';

export const categoryScreen = {
  renderCategory(slug, sort = "featured", minPrice, maxPrice, inStockOnly, studioView = false) {
    const category = SQLiteEngine.getCategoryBySlug(slug);
    if (!category) {
      return `
        ${StoreRenderers.renderNavbar(studioView ? "/account/category" : "/")}
        <main class="container" style="padding: 80px 0; text-align: center;">
          <h1 class="section-heading">Collection Not Found</h1>
          <p style="color: var(--text-muted); margin: 16px 0 24px;">The collection you requested does not exist or has been relocated.</p>
          <a href="${studioView ? "/account/categories" : "/categories"}" class="hero-cta" data-route="${studioView ? "/account/categories" : "/categories"}">${studioView ? "Return to Categories" : "Browse All Collections"}</a>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    }

    const { items, totalCount } = SQLiteEngine.getProducts({
      categorySlug: slug,
      sort,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      inStockOnly: inStockOnly === "1" || inStockOnly === true
    });

    const otherCategories = SQLiteEngine.getCategories().filter(c => c.slug !== slug).slice(0, 5);

    AppUtils.updateSEO({
      title: `${category.name} — Craft`,
      description: category.description,
      image: category.image,
      schema: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": category.name,
        "description": category.description,
        "itemListElement": items.map((p, idx) => ({
          "@type": "ListItem",
          "position": idx + 1,
          "name": p.name,
          "url": `${window.location.origin}/product/${p.slug}`
        }))
      }
    });

    return `
      ${StoreRenderers.renderNavbar(studioView ? "/account/category" : `/category/${slug}`, studioView ? category.name : "")}
      ${studioView ? `
        <section class="container studio-department-heading">
          <button type="button" class="btn-primary" data-action="studio-add-department-product" data-category-id="${category.id}" style="height:42px;padding:0 16px;">+ Add Product</button>
        </section>
      ` : `
      <div class="category-hero-header">
        <div class="container">
          <div class="breadcrumbs">
            <a href="/" data-route="/">Home</a>
            <span>/</span>
            <a href="/categories" data-route="/categories">Collections</a>
            <span>/</span>
            <span>${AppUtils.escapeHTML(category.name)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap;">
            <div>
              <span class="section-eyebrow">Curated Collection</span>
              <h1 class="section-heading" style="font-size: 2.5rem; margin-top: 4px;">${AppUtils.escapeHTML(category.name)}</h1>
              <p style="color: var(--text-muted); max-width: 640px; margin-top: 8px;">${AppUtils.escapeHTML(category.description)}</p>
            </div>
            <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 500;">
              Showing ${items.length} of ${totalCount} pieces
            </div>
          </div>
        </div>
      </div>
      `}

      <main class="container ${studioView ? "studio-department-content" : ""}" style="padding-bottom: 80px;">
        <div class="filter-bar">
          <div class="filter-group">
            <select id="cat-sort-select" class="filter-select">
              <option value="featured" ${sort === 'featured' ? 'selected' : ''}>Filter</option>
              <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest Additions</option>
              <option value="price-asc" ${sort === 'price-asc' ? 'selected' : ''}>Price: Low to High</option>
              <option value="price-desc" ${sort === 'price-desc' ? 'selected' : ''}>Price: High to Low</option>
              <option value="rating" ${sort === 'rating' ? 'selected' : ''}>Highest Rated</option>
              <option value="bestseller" ${sort === 'bestseller' ? 'selected' : ''}>Best Sellers</option>
            </select>

            <select id="cat-price-filter" class="filter-select">
              <option value="">All Price Tiers</option>
              <option value="0-200" ${maxPrice == 200 ? 'selected' : ''}>Under $200</option>
              <option value="200-500" ${minPrice == 200 && maxPrice == 500 ? 'selected' : ''}>$200 — $500</option>
              <option value="500-1000" ${minPrice == 500 && maxPrice == 1000 ? 'selected' : ''}>$500 — $1,000</option>
              <option value="1000+" ${minPrice == 1000 ? 'selected' : ''}>$1,000 & Above</option>
            </select>

            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem; cursor: pointer; margin-left: 8px;">
              <input type="checkbox" id="cat-stock-filter" ${inStockOnly ? 'checked' : ''}>
              <span>In Stock Only</span>
            </label>
          </div>

          ${!studioView ? `<div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 0.8125rem; color: var(--text-muted);">Related:</span>
            ${otherCategories.map(c => `
              <a href="/category/${c.slug}" class="option-chip" data-route="/category/${c.slug}" style="font-size: 0.75rem; padding: 4px 10px;">${AppUtils.escapeHTML(c.name)}</a>
            `).join("")}
          </div>` : ""}
        </div>

        ${items.length === 0 ? `
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 64px 24px; text-align: center;">
            <h3 style="font-size: 1.25rem; font-weight: 500; margin-bottom: 8px;">${studioView ? "No products in this department yet" : "No pieces matched these exact filter parameters"}</h3>
            ${!studioView ? `<p style="color: var(--text-muted); margin-bottom: 24px;">Try resetting the price filter or viewing all pieces in this department.</p>` : ""}
            ${!studioView ? `<button class="btn-primary" id="reset-cat-filters" style="max-width: 200px; margin: 0 auto;">Clear Filters</button>` : ""}
          </div>
        ` : `
          <div class="products-grid">
            ${items.map(p => StoreRenderers.renderProductCard(p)).join("")}
          </div>
        `}
        ${studioView ? `<div id="product-modal-container"></div>` : ""}
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

export const categoryController = {
  initCategoryFilters() {
    const sortSelect = document.getElementById("cat-sort-select");
    const priceFilter = document.getElementById("cat-price-filter");
    const stockFilter = document.getElementById("cat-stock-filter");
    const resetBtn = document.getElementById("reset-cat-filters");

    const apply = () => {
      const path = this.currentRoute().split("?")[0];
      const params = new URLSearchParams();
      if (new URLSearchParams(this.currentRoute().split("?")[1] || "").get("studio") === "1") params.set("studio", "1");
      if (sortSelect && sortSelect.value !== "featured") params.set("sort", sortSelect.value);
      if (priceFilter && priceFilter.value) {
        if (priceFilter.value === "0-200") params.set("maxPrice", "200");
        else if (priceFilter.value === "200-500") { params.set("minPrice", "200"); params.set("maxPrice", "500"); }
        else if (priceFilter.value === "500-1000") { params.set("minPrice", "500"); params.set("maxPrice", "1000"); }
        else if (priceFilter.value === "1000+") params.set("minPrice", "1000");
      }
      if (stockFilter && stockFilter.checked) params.set("inStock", "1");
      const qs = params.toString();
      this.navigate(path + (qs ? `?${qs}` : ""));
    };

    if (sortSelect) sortSelect.onchange = apply;
    if (priceFilter) priceFilter.onchange = apply;
    if (stockFilter) stockFilter.onchange = apply;
    if (resetBtn) resetBtn.onclick = () => {
      const path = this.currentRoute().split("?")[0];
      const isStudioView = new URLSearchParams(this.currentRoute().split("?")[1] || "").get("studio") === "1";
      this.navigate(path + (isStudioView ? "?studio=1" : ""));
    };
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StoreRenderers.renderCategory(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root, slug, sort = "featured", minPrice, maxPrice, inStockOnly) {
  root.innerHTML = StoreRenderers.renderCategory(slug, sort, minPrice, maxPrice, inStockOnly);
  AppController.initCategoryFilters();
}

export function unmount() {}
