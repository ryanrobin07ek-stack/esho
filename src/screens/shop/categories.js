// Storefront category list screen (/categories).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StoreRenderers } from '../../app/main.js';

export const categoriesScreen = {
  renderCategoriesList() {
    const categories = SQLiteEngine.getCategories();

    AppUtils.updateSEO({
      title: "Collections — Craft",
      description: "Browse the collections available in this store.",
      schema: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Craft Collections",
        "description": "Comprehensive list of our product departments."
      }
    });

    return `
      ${StoreRenderers.renderNavbar('/categories')}
      <main class="container" style="padding: 48px 0 80px;">
        <div class="breadcrumbs">
          <a href="/" data-route="/">Home</a>
          <span>/</span>
          <span>Collections</span>
        </div>
        <div style="margin-bottom: 40px;">
          <span class="section-eyebrow">Departments</span>
          <h1 class="section-heading" style="font-size: 2.75rem;">Collections</h1>
          <p style="color: var(--text-muted); max-width: 600px; margin-top: 8px;">
            Browse this store's collections.
          </p>
        </div>
        ${categories.length ? `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px;">
          ${categories.map(cat => {
            const count = SQLiteEngine.getProducts({ categoryId: cat.id }).totalCount;
            return `
              <a href="/category/${cat.slug}" class="product-card" data-route="/category/${cat.slug}" style="text-decoration: none;">
                ${cat.image ? `<div style="aspect-ratio: 16 / 10; overflow: hidden; background: var(--surface-subtle);"><img src="${AppUtils.escapeHTML(cat.image)}" alt="" style="width: 100%; height: 100%; object-fit: cover;"></div>` : ""}
                <div style="padding: 20px;">
                  <div style="font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted);">${count} products</div>
                  <h3 style="font-family: var(--font-serif); font-size: 1.5rem; margin: 6px 0 8px; font-weight: 400; color: var(--text-main);">${AppUtils.escapeHTML(cat.name)}</h3>
                  <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">${AppUtils.escapeHTML(cat.description)}</p>
                </div>
              </a>
            `;
          }).join("")}
        </div>` : `<div style="padding: 40px 24px; border: 1px solid var(--border); border-radius: var(--radius); text-align: center;">
          <h2 style="font-size: 1.25rem; margin-bottom: 8px;">No categories yet</h2>
          <p style="color: var(--text-muted);">Add categories in Web Builder to organize your products.</p>
          <a href="/account/categories" class="btn-primary" data-route="/account/categories" style="display: inline-flex; margin-top: 18px;">Open Categories</a>
        </div>`}
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StoreRenderers.renderCategoriesList(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root) {
  root.innerHTML = StoreRenderers.renderCategoriesList();
}

export function unmount() {}
