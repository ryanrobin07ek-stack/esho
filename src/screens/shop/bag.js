// Storefront shopping bag screen (/bag).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StoreRenderers } from '../../app/main.js';

export const bagScreen = {
  renderBag() {
    const cart = SQLiteEngine.getCart();
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal;

    AppUtils.updateSEO({
      title: "Your Bag — Craft",
      description: "Review your selected luxury items, adjust sizing, and proceed to secure checkout."
    });

    return `
      ${StoreRenderers.renderNavbar('/bag')}
      <main class="container" style="padding: 40px 0 80px;">
        <div class="breadcrumbs">
          <a href="/" data-route="/">Home</a>
          <span>/</span>
          <span>Shopping Bag</span>
        </div>

        <div style="margin-bottom: 32px;">
          <h1 class="section-heading" style="font-size: 2.25rem;">Shopping Bag</h1>
          <p style="color: var(--text-muted); margin-top: 4px;">${cart.length} unique ${cart.length === 1 ? 'item' : 'items'} in your curation.</p>
        </div>

        ${cart.length === 0 ? `
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 80px 24px; text-align: center; max-width: 600px; margin: 0 auto;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5" style="margin: 0 auto 16px;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <h2 style="font-size: 1.5rem; font-family: var(--font-serif); font-weight: 400; margin-bottom: 8px;">Your shopping bag is empty</h2>
            <p style="color: var(--text-muted); margin-bottom: 24px;">Discover contemporary essentials and timeless craftsmanship in our collections.</p>
            <a href="/categories" class="btn-primary" data-route="/categories" style="display: inline-flex; padding: 0 32px; max-width: 240px; margin: 0 auto;">Explore Collections</a>
          </div>
        ` : `
          <div class="bag-layout">
            <div class="bag-items-list">
              ${cart.map(item => `
                <div class="bag-item-card" data-cart-id="${item.id}">
                  <img src="${item.image}" alt="${AppUtils.escapeHTML(item.name)}" class="bag-item-thumb" width="100" height="125">
                  <div class="bag-item-info">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">${AppUtils.escapeHTML(item.brand || '')}</div>
                    <h3 style="font-size: 1.0625rem; font-weight: 500;">
                      <a href="/product/${item.sku ? item.sku.toLowerCase() : ''}" style="color: inherit;">${AppUtils.escapeHTML(item.name)}</a>
                    </h3>
                    <div style="font-size: 0.8125rem; color: var(--text-muted);">
                      ${item.size ? `${AppUtils.escapeHTML(item.option1_name || "Size")}: <strong>${AppUtils.escapeHTML(item.size)}</strong>` : ""}
                      ${item.color ? ` &bull; ${AppUtils.escapeHTML(item.option2_name || "Color")}: <strong>${AppUtils.escapeHTML(item.color)}</strong>` : ""}
                    </div>
                    <div class="bag-item-price">${AppUtils.formatMoney(item.price)}</div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 12px;">
                      <div class="quantity-stepper" style="height: 36px;">
                        <button class="stepper-btn" data-action="cart-qty" data-id="${item.id}" data-delta="-1">&minus;</button>
                        <span class="stepper-input" style="line-height: 36px;">${item.quantity}</span>
                        <button class="stepper-btn" data-action="cart-qty" data-id="${item.id}" data-delta="1">&plus;</button>
                      </div>
                      <button data-action="cart-remove" data-id="${item.id}" style="color: var(--danger); font-size: 0.8125rem; font-weight: 500;">Remove</button>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>

            <!-- Order Summary Card -->
            <div class="order-summary-card">
              <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 20px;">Order Summary</h2>
              <div class="summary-row">
                <span>Subtotal</span>
                <span style="font-weight: 600; color: var(--text-main);">${AppUtils.formatMoney(subtotal)}</span>
              </div>
              <div class="summary-row total">
                <span>Total Amount</span>
                <span>${AppUtils.formatMoney(total)}</span>
              </div>

              <a href="/checkout" class="btn-primary" data-route="/checkout" style="width: 100%; text-align: center;">Proceed to Checkout</a>
              <div style="text-align: center; margin-top: 16px;">
                <a href="/categories" data-route="/categories" style="font-size: 0.8125rem; color: var(--text-muted); text-decoration: underline;">Continue Shopping</a>
              </div>
            </div>
          </div>
        `}
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StoreRenderers.renderBag(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root) {
  root.innerHTML = StoreRenderers.renderBag();
}

export function unmount() {}
