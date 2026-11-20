// Storefront search results screen (/search).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StoreRenderers } from '../../app/main.js';

export const searchScreen = {
  renderSearch(query = "", sort = "featured") {
    const { items, totalCount } = SQLiteEngine.getProducts({ query, sort });

    AppUtils.updateSEO({
      title: query ? `Search: "${query}" — Craft` : "Search Catalog — Craft",
      description: `Search results for ${query} across our luxury editorial catalog.`
    });

    return `
      ${StoreRenderers.renderNavbar()}
      <main class="container" style="padding: 48px 0 80px;">
        <div class="breadcrumbs">
          <a href="/" data-route="/">Home</a>
          <span>/</span>
          <span>Search</span>
        </div>

        <div style="margin-bottom: 32px;">
          <span class="section-eyebrow">Catalog Search</span>
          <h1 class="section-heading">
            ${query ? `Search Results for "${AppUtils.escapeHTML(query)}"` : "Discover Artifacts"}
          </h1>
          <p style="color: var(--text-muted); margin-top: 6px;">
            ${items.length} ${items.length === 1 ? 'item' : 'items'} found matching your search.
          </p>
        </div>

        <div style="max-width: 600px; margin-bottom: 32px;">
          <form id="search-page-form" style="display: flex; gap: 12px;">
            <input type="text" id="search-page-input" class="search-input" value="${AppUtils.escapeHTML(query)}" placeholder="Search outerwear, chronometers, leather, glassware..." />
            <button type="submit" class="btn-primary" style="flex: 0 0 120px;">Search</button>
          </form>
        </div>

        ${items.length === 0 ? `
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 64px 24px; text-align: center; max-width: 720px; margin: 0 auto;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5" style="margin: 0 auto 16px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <h3 style="font-size: 1.25rem; font-weight: 500; margin-bottom: 8px;">No pieces matched "${AppUtils.escapeHTML(query)}"</h3>
            <p style="color: var(--text-muted); margin-bottom: 24px;">Try another search or browse the available collections.</p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
              ${SQLiteEngine.getCategories().map(category => `<a href="/category/${encodeURIComponent(category.slug)}" class="option-chip" data-route="/category/${encodeURIComponent(category.slug)}">${AppUtils.escapeHTML(category.name)}</a>`).join("")}
              ${SQLiteEngine.getCategories().length ? "" : `<a href="/categories" class="option-chip" data-route="/categories">View Collections</a>`}
            </div>
          </div>
        ` : `
          <div class="products-grid">
            ${items.map(p => StoreRenderers.renderProductCard(p)).join("")}
          </div>
        `}
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StoreRenderers.renderSearch(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root, query = "", sort = "featured") {
  root.innerHTML = StoreRenderers.renderSearch(query, sort);
}

export function unmount() {}
