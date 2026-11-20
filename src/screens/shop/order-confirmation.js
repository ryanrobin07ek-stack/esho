// Storefront order confirmation screen (/checkout/confirmation).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StoreRenderers } from '../../app/main.js';

export const orderConfirmationScreen = {
  renderOrderConfirmation(orderNumber, paymentReference = "") {
    const order = SQLiteEngine.getOrder(orderNumber);

    AppUtils.updateSEO({
      title: `Order Received: ${orderNumber} — Craft`,
      description: "Your order was received and is awaiting payment confirmation."
    });

    if (!order) {
      if (paymentReference) {
        return `
          ${StoreRenderers.renderNavbar()}
          <main class="container" style="padding: 80px 0; text-align: center;">
            <h1 class="section-heading">Verifying your order</h1>
            <p style="color: var(--text-muted); margin: 16px 0 24px;" data-payment-status>Checking payment with Paystack…</p>
          </main>
          ${StoreRenderers.renderFooter()}
        `;
      }
      return `
        ${StoreRenderers.renderNavbar()}
        <main class="container" style="padding: 80px 0; text-align: center;">
          <h1 class="section-heading">Order Receipt</h1>
          <p style="color: var(--text-muted); margin: 16px 0 24px;">Order ${AppUtils.escapeHTML(orderNumber)} was not found.</p>
          <a href="/" class="btn-primary" data-route="/" style="max-width: 200px; margin: 0 auto;">Return to Home</a>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    }

    return `
      ${StoreRenderers.renderNavbar()}
      <main class="container" style="padding: 64px 0 96px; max-width: 800px;">
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 48px; text-align: center; box-shadow: var(--shadow-sm);">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--success-bg); color: var(--success); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span class="section-eyebrow" style="color: var(--success);" data-payment-status>${order.payment_status === "paid" || order.status === "paid" ? "Payment confirmed by Paystack" : "Order Received · Payment Pending"}</span>
          <h1 style="font-family: var(--font-serif); font-size: 2.25rem; font-weight: 400; margin: 8px 0 12px;">Thank You, ${AppUtils.escapeHTML(order.customer_name)}</h1>
          <p style="color: var(--text-muted); font-size: 1rem; max-width: 520px; margin: 0 auto 24px;">
            Your order has been received, but payment has not been collected. Keep this order number for reference: <strong>${AppUtils.escapeHTML(order.order_number)}</strong>.
          </p>

          <div style="display: inline-block; padding: 8px 20px; background: var(--surface-subtle); border-radius: var(--radius); font-weight: 700; font-size: 1.125rem; letter-spacing: 0.05em; margin-bottom: 32px;">
            ${order.order_number}
          </div>

          <div style="text-align: left; border-top: 1px solid var(--border); padding-top: 24px; margin-top: 16px;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 16px;">Itemized Manifest</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${(order.items || []).map(i => `
                <div style="display: flex; justify-content: space-between; font-size: 0.9375rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
                  <div>
                    <span style="font-weight: 500;">${AppUtils.escapeHTML(i.name)}</span>
                    <span style="color: var(--text-muted); font-size: 0.8125rem;"> (${i.size || 'Standard'}) &times; ${i.quantity}</span>
                  </div>
                  <span style="font-weight: 600;">${AppUtils.formatMoney(i.price * i.quantity)}</span>
                </div>
              `).join("")}
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 1.125rem; font-weight: 700; margin-top: 16px;">
              <span>Total Due</span>
              <span>${AppUtils.formatMoney(order.total)}</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-top: 32px; padding: 20px; background: var(--surface-subtle); border-radius: var(--radius); font-size: 0.875rem;">
            <div>
              <strong style="display: block; margin-bottom: 4px;">Payment status:</strong>
              <div>${AppUtils.escapeHTML(order.payment_method)}</div>
            </div>
            </div>
          </div>

          <div style="display: flex; gap: 16px; justify-content: center; margin-top: 40px;">
            ${order.payment_status === "paid" || order.status === "paid" ? "" : `<button type="button" class="btn-primary" data-paystack-retry>Continue to secure payment</button>`}
            <a href="/" class="btn-primary" data-route="/" style="padding: 0 32px;">Continue Shopping</a>
            <a href="/account/dashboard" class="btn-secondary" data-route="/account/dashboard" style="padding: 0 24px;">View in Studio Dashboard</a>
          </div>
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StoreRenderers.renderOrderConfirmation(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root, orderNumber, paymentReference = "") {
  root.innerHTML = StoreRenderers.renderOrderConfirmation(orderNumber, paymentReference);
}

export function unmount() {}
