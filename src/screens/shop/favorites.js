// Storefront favorites screen (/favorites).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StoreRenderers } from '../../app/main.js';

export const favoritesScreen = {
  renderFavorites() {
    const favs = SQLiteEngine.getFavorites();

    AppUtils.updateSEO({
      title: "Favorites — Craft",
      description: "Review your saved pieces, curated wardrobe foundations, and wishlist."
    });

    return `
      ${StoreRenderers.renderNavbar('/favorites')}
      <main class="container" style="padding: 48px 0 80px;">
        <div class="breadcrumbs">
          <a href="/" data-route="/">Home</a>
          <span>/</span>
          <span>Favorites</span>
        </div>

        <div style="margin-bottom: 32px;">
          <h1 class="section-heading" style="font-size: 2.25rem;">Saved Favorites</h1>
          <p style="color: var(--text-muted); margin-top: 4px;">${favs.length} ${favs.length === 1 ? 'artifact' : 'artifacts'} saved in your personal archive.</p>
        </div>

        ${favs.length === 0 ? `
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 80px 24px; text-align: center; max-width: 600px; margin: 0 auto;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5" style="margin: 0 auto 16px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <h2 style="font-size: 1.5rem; font-family: var(--font-serif); font-weight: 400; margin-bottom: 8px;">No pieces saved yet</h2>
            <p style="color: var(--text-muted); margin-bottom: 24px;">Explore our collections and tap the heart icon on pieces you wish to curate.</p>
            <a href="/categories" class="btn-primary" data-route="/categories" style="display: inline-flex; padding: 0 32px; max-width: 240px; margin: 0 auto;">Discover Artifacts</a>
          </div>
        ` : `
          <div class="products-grid">
            ${favs.map(p => StoreRenderers.renderProductCard(p)).join("")}
          </div>
        `}
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  }
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StoreRenderers.renderFavorites(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root) {
  root.innerHTML = StoreRenderers.renderFavorites();
}

export function unmount() {}
