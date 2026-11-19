// Sell screen: product grid, receipt panel, cart footer, discount and variant dialogs.
import { durationLabel, escapeHtml, fromCents, money, toCents } from '../../till/format.js';
import { variantPrice } from '../../till/pricing.js';

export function createSellScreen({ state, button, empty, cartLineKey, renderCurrent, field }) {
  function renderStore() {
    return `<section class="pos-content">
      <form class="pos-filter-row" data-pos-form="store-filter">
        <input name="search" value="${escapeHtml(state.search)}" placeholder="Search products" aria-label="Search products">
        <select name="category"><option value="">All</option>${state.categories.map((item) =>
          `<option value="${item.id}" ${String(item.id) === state.category ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select>
      </form>
      <div class="pos-form-actions pos-scanner-entry">
        ${button('Scan with camera', 'scan-sale-barcode', '', true)}
      </div>
      <div class="pos-store-layout">
        ${renderCartPanelMarkup()}
        <section id="pos-product-grid" class="pos-product-grid" aria-label="Products">${renderProductTiles()}</section>
      </div>
    </section>`;
  }

  function renderCartPanelMarkup() {
    const emptyCart = state.cart.length === 0;
    return `<section id="pos-cart-panel" class="pos-card pos-cart ${emptyCart ? 'is-empty' : 'is-open'}" aria-label="Sale receipt">
      <div class="pos-cart-heading"><strong>Receipt</strong><span>${state.cart.length} item${state.cart.length === 1 ? '' : 's'}</span></div>
      ${state.cart.length ? `<div class="pos-cart-items">${state.cart.map((item) => `
        <div class="pos-cart-item">
          <strong>${escapeHtml(item.name)}${item.variantLabel ? ` · ${escapeHtml(item.variantLabel)}` : ''}${item.attributesLabel ? ` · ${escapeHtml(item.attributesLabel)}` : ''}</strong>
          <button type="button" class="pos-quantity-button" data-pos-action="cart-minus" data-line="${escapeHtml(cartLineKey(item))}" aria-label="Decrease">−</button>
          <input type="number" min="1" max="99999" value="${item.quantity}" aria-label="Quantity" data-pos-quantity="${escapeHtml(cartLineKey(item))}">
          <button type="button" class="pos-quantity-button" data-pos-action="cart-plus" data-line="${escapeHtml(cartLineKey(item))}" aria-label="Increase">+</button>
        </div>`).join('')}</div>` : empty('Your sale is empty', 'Tap a product to add it here.')}
      ${renderCartFooter()}
      ${renderDiscountModalMarkup()}
      ${renderVariantModalMarkup()}
    </section>`;
  }

  function updateCartPanel() {
    const panel = document.getElementById('pos-cart-panel');
    if (!panel) {
      renderCurrent();
      return;
    }
    const shouldAnimate = panel.classList.contains('is-empty') && state.cart.length > 0;
    panel.outerHTML = renderCartPanelMarkup();
    if (state.discountDialogOpen) document.querySelector?.('[data-pos-discount-input]')?.focus();
    if (shouldAnimate && window.matchMedia?.('(max-width: 760px)').matches) {
      const updatedPanel = document.getElementById('pos-cart-panel');
      if (updatedPanel) {
        updatedPanel.classList.add('is-entering');
        void updatedPanel.offsetHeight;
        window.requestAnimationFrame(() => updatedPanel.classList.remove('is-entering'));
      }
    }
  }

  function renderVariantModalMarkup() {
    const product = state.products.find((item) => item.id === state.variantPickerProductId);
    const variants = product?.variants || [];
    const priced = product?.pricedAttributes || [];
    if (!product || (!variants.length && !priced.length)) return '';
    // Choices that carry a price are asked for alongside the options that carry stock, so the till
    // charges exactly what the website charges for the same thing.
    const pricedMarkup = priced.map((attribute) => `<label class="pos-field">
      <span>${escapeHtml(attribute.attributeName)}</span>
      <select data-pos-priced-attribute="${escapeHtml(attribute.attributeName)}">
        <option value="">Not chosen</option>
        ${(attribute.values || []).map((value) => {
          const delta = Number(value.priceDelta) || 0;
          const shown = delta === 0 ? '' : ` (${delta > 0 ? '+' : '-'}${money(Math.abs(delta), state.settings.currency)})`;
          return `<option value="${escapeHtml(value.value)}">${escapeHtml(value.value)}${escapeHtml(shown)}</option>`;
        }).join('')}
      </select>
    </label>`).join('');
    const variantButtons = variants.map((variant) => {
      const soldOut = Number(variant.stock) <= 0;
      return `<button type="button" class="btn-secondary" data-pos-action="pick-variant" data-id="${product.id}"
        data-variant="${escapeHtml(variant.id)}" ${soldOut ? 'disabled' : ''}>
        <strong>${escapeHtml(variant.label)}</strong>
        <span>${money(variantPrice(product, variant), state.settings.currency)}</span>
        <small>${soldOut ? 'Sold out' : `${variant.stock} left`}</small>
      </button>`;
    }).join('');
    return `<div class="pos-discount-modal">
      <button class="pos-discount-backdrop" type="button" data-pos-action="close-variant" aria-label="Close options"></button>
      <section class="pos-discount-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-variant-title">
        <h3 id="pos-variant-title">${escapeHtml(product.name)}</h3>
        <p>${variants.length ? 'Choose the option being sold.' : 'Choose what is being sold.'}</p>
        ${pricedMarkup}
        ${variants.length
          ? `<div class="pos-variant-options">${variantButtons}</div>`
          : `<div class="pos-variant-options"><button type="button" class="btn-primary"
              data-pos-action="pick-variant" data-id="${product.id}">Add to sale</button></div>`}
        <div class="pos-discount-actions"><button class="btn-secondary" type="button" data-pos-action="close-variant">Cancel</button></div>
      </section>
    </div>`;
  }

  function renderProductTiles() {
    return state.products.filter((product) => product.active && (!state.category || String(product.categoryId) === state.category)
      && product.name.toLocaleLowerCase().includes(state.search.toLocaleLowerCase())).map((product) => `
        <button class="pos-product-tile" type="button" data-pos-action="add-cart" data-id="${product.id}">
          ${product.imageUri ? `<img src="${escapeHtml(product.imageUri)}" alt="">` : '<span class="pos-product-placeholder">+</span>'}
          <strong>${escapeHtml(product.name)}</strong>
          <span>${money(product.price, state.settings.currency)}</span>
          <small>${product.isService ? `Service · ${durationLabel(product.durationMinutes)}`
            : product.variants?.length ? `${product.variants.length} options · ${product.stock} in stock`
            : product.stock === null ? 'Stock not tracked' : `${product.stock} in stock`}</small>
        </button>`).join('') || empty(state.search ? 'No matching products' : 'No products yet', 'Add items in Inventory to start selling.');
  }

  function renderCartFooter() {
    if (!state.cart.length) return '';
    const subtotal = state.cart.reduce((sum, item) => sum + toCents(item.unitPrice) * item.quantity, 0);
    const discountCents = Math.min(subtotal, Math.max(0, toCents(state.discount || 0)));
    const discountPercent = subtotal ? (discountCents / subtotal * 100).toFixed(1).replace(/\.0$/, '') : '0';
    const tax = Math.round((subtotal - discountCents) * state.settings.taxRate / 100);
    return `<form class="pos-form pos-checkout" data-pos-form="checkout">
      <input type="hidden" name="paymentMethod" value="${escapeHtml(state.paymentMethod)}">
      <div class="pos-payment-options" role="group" aria-label="Payment method">
        <button class="pos-payment-option ${state.paymentMethod === 'Cash' ? 'is-selected' : ''}" type="button"
          data-pos-action="checkout-method" data-method="Cash" aria-pressed="${state.paymentMethod === 'Cash'}"><span>Cash</span>
        </button>
        <button class="pos-payment-option ${state.paymentMethod === 'Mobile money' ? 'is-selected' : ''}" type="button"
          data-pos-action="checkout-method" data-method="Mobile money" aria-pressed="${state.paymentMethod === 'Mobile money'}">
          <span>Mobile money</span>
        </button>
        <button class="pos-payment-option ${state.paymentMethod === 'Card' ? 'is-selected' : ''}" type="button"
          data-pos-action="checkout-method" data-method="Card" aria-pressed="${state.paymentMethod === 'Card'}">
          <svg class="pos-payment-logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg><span>Card</span>
        </button>
        <button class="pos-payment-option ${state.paymentMethod === 'Bank' ? 'is-selected' : ''}" type="button"
          data-pos-action="checkout-method" data-method="Bank" aria-pressed="${state.paymentMethod === 'Bank'}"><span>Bank</span>
        </button>
        <button class="pos-payment-option ${state.paymentMethod === 'Other' ? 'is-selected' : ''}" type="button"
          data-pos-action="checkout-method" data-method="Other" aria-pressed="${state.paymentMethod === 'Other'}">
          <svg class="pos-payment-logo" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg><span>Other</span>
        </button>
      </div>
      ${state.paymentMethod === 'Mobile money' ? `<p class="pos-help">Confirm the payment with the mobile-money provider before completing this sale.</p>
        ${field('M-Pesa reference · optional', 'mpesaRef', '', { placeholder: 'e.g. QGH7XXXXXX' })}` : ''}
      <div class="pos-customer-fields">
        ${field('Name', 'customerName', '', { placeholder: 'Optional' })}
        ${field('Phone', 'customerPhone', '', { placeholder: 'Optional', type: 'tel' })}
      </div>
      <div class="pos-checkout-totals">
        <div class="pos-total-line"><span>Subtotal</span><b>${money(fromCents(subtotal), state.settings.currency)}</b></div>
        <input type="hidden" name="discount" value="${state.discount || 0}">
        ${discountCents ? `<div class="pos-total-line"><span>Discount · ${discountPercent}%</span><b>−${money(fromCents(discountCents), state.settings.currency)}</b></div>` : ''}
        <div class="pos-total-line"><span>Tax · ${state.settings.taxRate}%</span><b>${money(fromCents(tax), state.settings.currency)}</b></div>
        <div class="pos-total-line is-total"><span>Total</span><b>${money(fromCents(subtotal - discountCents + tax), state.settings.currency)}</b></div>
      </div>
      <details class="pos-credit-details"><summary>Credit sale</summary>${field('Due date · optional', 'dueDate', '', { type: 'date' })}</details>
      <div class="pos-checkout-actions">
        <button class="btn-secondary" type="button" data-pos-action="park-ticket">Park order</button>
        <button class="btn-secondary" type="button" data-pos-action="cancel-sale">Cancel sale</button>
        <button class="btn-secondary pos-discount-button" type="button" data-pos-action="set-discount">
          Discount${discountCents ? ` · ${discountPercent}%` : ''}
        </button>
        <button class="btn-primary pos-checkout-complete" type="submit">Complete sale</button>
      </div>
    </form>`;
  }

  function renderDiscountModalMarkup() {
    if (!state.discountDialogOpen || !state.cart.length) return '';
    const subtotal = state.cart.reduce((sum, item) => sum + toCents(item.unitPrice) * item.quantity, 0);
    return `<div class="pos-discount-modal">
      <button class="pos-discount-backdrop" type="button" data-pos-action="close-discount" aria-label="Close discount dialog"></button>
      <section class="pos-discount-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-discount-title">
        <h3 id="pos-discount-title">Enter discount amount</h3>
        <p>Amount in ${escapeHtml(state.settings.currency)}. The percentage is calculated from the subtotal.</p>
        <form class="pos-discount-form" data-pos-form="discount">
          <label class="pos-discount-field">
            <span>Discount amount</span>
            <input type="number" name="discountAmount" min="0" step="0.01" value="${state.discount || ''}"
              inputmode="decimal" data-pos-discount-input aria-describedby="pos-discount-hint">
          </label>
          <small id="pos-discount-hint">Cannot exceed ${money(fromCents(subtotal), state.settings.currency)}.</small>
          <div class="pos-discount-actions">
            <button class="btn-secondary" type="button" data-pos-action="close-discount">Cancel</button>
            <button class="btn-primary" type="submit">Apply</button>
          </div>
        </form>
      </section>
    </div>`;
  }

  return { renderStore, updateCartPanel, renderProductTiles };
}
