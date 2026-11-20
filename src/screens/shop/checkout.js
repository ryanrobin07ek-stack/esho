// Storefront checkout screen (/checkout): the order form and the Paystack return.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppController, AppUtils, SQLiteEngine, StoreRenderers } from '../../app/main.js';

export const checkoutScreen = {
  renderCheckout() {
    const cart = SQLiteEngine.getCart();
    if (cart.length === 0) {
      return `
        ${StoreRenderers.renderNavbar()}
        <main class="container" style="padding: 80px 0; text-align: center;">
          <h1 class="section-heading">Your Bag is Empty</h1>
          <p style="color: var(--text-muted); margin: 16px 0 24px;">Please add items to your shopping bag before proceeding to checkout.</p>
          <a href="/categories" class="hero-cta" data-route="/categories">Browse Collections</a>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 0;
    const discount = 0;
    const total = subtotal;

    AppUtils.updateSEO({
      title: "Checkout — Craft",
      description: "Encrypted 256-bit checkout for your luxury order."
    });

    return `
      ${StoreRenderers.renderNavbar()}
      <main class="container" style="padding: 40px 0 80px;">
        <div class="breadcrumbs">
          <a href="/" data-route="/">Home</a>
          <span>/</span>
          <a href="/bag" data-route="/bag">Bag</a>
          <span>/</span>
          <span>Checkout</span>
        </div>

        <div style="margin-bottom: 32px;">
          <span class="section-eyebrow">Encrypted 256-Bit Transaction</span>
          <h1 class="section-heading" style="font-size: 2.25rem;">Checkout</h1>
        </div>

        <div class="checkout-layout">
          <!-- Checkout Form Fields -->
          <form id="checkout-main-form" class="checkout-form-section">
            <div class="form-group-card">
              <h2 class="form-card-title">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #FFF; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">1</span>
                <span>Client Identification</span>
              </h2>
              <div class="form-grid">
                <div class="form-field">
                  <label class="form-label">First Name *</label>
                  <input type="text" name="firstName" class="form-input" required />
                </div>
                <div class="form-field">
                  <label class="form-label">Last Name *</label>
                  <input type="text" name="lastName" class="form-input" required />
                </div>
              </div>
              <div class="form-grid" style="margin-top: 16px;">
                <div class="form-field">
                  <label class="form-label">Email Address (Order Confirmation) *</label>
                  <input type="email" name="email" class="form-input" required />
                </div>
                <div class="form-field">
                  <label class="form-label">Mobile Phone (optional)</label>
                  <input type="tel" name="phone" class="form-input" />
                </div>
              </div>
            </div>

            <div class="form-group-card">
              <h2 class="form-card-title">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #FFF; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">2</span>
                <span>Order Submission</span>
              </h2>
              <p class="studio-panel-note">Submit your order to continue to Paystack’s secure payment page. Your order is marked paid only after Paystack confirms the payment. Card details are entered on Paystack, not stored by this shop.</p>
            </div>

            <div class="form-group-card">
              <h2 class="form-card-title">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #FFF; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">3</span>
                <span>Payment</span>
              </h2>
              <p class="studio-panel-note">After you submit, you should be redirected to Paystack to choose a payment method and complete the transaction.</p>
            </div>

            <button type="submit" class="btn-primary" style="height: 56px; font-size: 1rem;">
              <span>Place Order &amp; Continue to Paystack (${AppUtils.formatMoney(total)})</span>
            </button>
          </form>

          <!-- Order Summary Sidebar -->
          <div>
            <div class="order-summary-card">
              <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 20px;">Order Review (${cart.length} items)</h2>
              <div style="display: flex; flex-direction: column; gap: 16px; max-height: 320px; overflow-y: auto; margin-bottom: 20px;">
                ${cart.map(i => `
                  <div style="display: flex; gap: 12px; align-items: center;">
                    <img src="${i.image}" alt="${AppUtils.escapeHTML(i.name)}" style="width: 52px; height: 65px; object-fit: cover; border-radius: var(--radius-sm);" />
                    <div style="flex: 1; font-size: 0.875rem;">
                      <div style="font-weight: 500;">${AppUtils.escapeHTML(i.name)}</div>
                      <div style="color: var(--text-dim); font-size: 0.75rem;">Qty: ${i.quantity} ${i.size ? `&bull; ${i.size}` : ''}</div>
                    </div>
                    <div style="font-weight: 600; font-size: 0.875rem;">${AppUtils.formatMoney(i.price * i.quantity)}</div>
                  </div>
                `).join("")}
              </div>

              <div class="summary-row">
                <span>Subtotal</span>
                <span>${AppUtils.formatMoney(subtotal)}</span>
              </div>
              ${discount > 0 ? `
                <div class="summary-row" style="color: var(--success);">
                  <span>Discount</span>
                  <span>-${AppUtils.formatMoney(discount)}</span>
                </div>
              ` : ""}
              <div class="summary-row total">
                <span>Total Due</span>
                <span>${AppUtils.formatMoney(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

export const checkoutController = {
  initCheckoutForm() {
    const form = document.getElementById("checkout-main-form");
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton?.disabled) return;
        const submitLabel = submitButton?.textContent || "";
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Submitting order…";
        }
        const formData = new FormData(form);
        const cart = SQLiteEngine.getCart();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = 0;
        const discount = 0;
        const total = subtotal;
        const tenantId = this.getActiveTenant().id;

        const orderData = {
          tenant_id: tenantId,
          customer_name: `${formData.get("firstName")} ${formData.get("lastName")}`.trim(),
          customer_email: formData.get("email"),
          customer_phone: formData.get("phone"),
          shipping_address: "",
          city: "",
          postal_code: "",
          country: "",
          payment_method: "Unpaid order",
          subtotal,
          discount,
          shipping,
          total
        };

        const idempotencyKey = crypto.randomUUID();
        let holdIds = [];
        try {
          const storedHolds = JSON.parse(window.localStorage.getItem(`eshop-holds:${location.host}`) || "[]");
          const cartProductIds = new Set(cart.map(item => String(item.product_id)));
          const orderName = orderData.customer_name.replace(/\s+/g, " ").toLocaleLowerCase();
          const orderEmail = String(orderData.customer_email || "").trim().toLocaleLowerCase();
          const orderPhone = String(orderData.customer_phone || "").replace(/\D/g, "");
          if (Array.isArray(storedHolds)) {
            holdIds = storedHolds.filter(hold => hold && typeof hold.id === "string"
              && cartProductIds.has(String(hold.product_id))
              && Date.parse(hold.expires_at) > Date.now()
              && String(hold.customer_name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase() === orderName
              && (String(hold.contact || "").includes("@")
                ? String(hold.contact).trim().toLocaleLowerCase() === orderEmail
                : String(hold.contact || "").replace(/\D/g, "") === orderPhone)).map(hold => hold.id);
          }
        } catch (error) {
          console.warn("Product holds could not be attached to the storefront order.", error);
        }
        const orderPayload = {
          idempotency_key: idempotencyKey,
          customer_name: orderData.customer_name,
          customer_email: orderData.customer_email,
          customer_phone: orderData.customer_phone,
          hold_ids: holdIds,
          items: cart.map(item => ({ product_id: item.product_id, quantity: Number(item.quantity || 1) }))
        };
        let serverOrder = null;
        let orderSyncPending = false;
        try {
          const response = await window.EshopInventoryBridge.createStorefrontOrder(tenantId, orderPayload);
          serverOrder = response.order;
          orderData.order_number = serverOrder.order_number;
          orderData.total = serverOrder.total;
          orderData.subtotal = serverOrder.subtotal;
          orderData.discount = serverOrder.discount;
          orderData.shipping = serverOrder.shipping;
          orderData.payment_status = serverOrder.payment_status;
          orderData.status = serverOrder.status;
          orderData.created_at = serverOrder.created_at;
          orderData.currency = serverOrder.currency;
        } catch (error) {
          const canRetry = navigator.onLine === false || error?.status === 404 || error?.status >= 500
            || error instanceof TypeError || error?.name === "AbortError";
          if (!canRetry) {
            AppUtils.showToast(error instanceof Error ? error.message : "The shop could not accept this order.", "danger");
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = submitLabel;
            }
            return;
          }
          orderData.order_number = `ORD-${idempotencyKey.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
          orderSyncPending = true;
          const pendingKey = `ESHOP_PENDING_STOREFRONT_ORDERS_V1:${encodeURIComponent(tenantId)}`;
          const pending = JSON.parse(window.localStorage.getItem(pendingKey) || "[]");
          pending.push({ idempotency_key: idempotencyKey, payload: orderPayload, local_order_number: orderData.order_number });
          window.localStorage.setItem(pendingKey, JSON.stringify(pending.slice(-100)));
          console.warn("Storefront order saved locally and queued for server sync.", error);
        }
        const orderItems = serverOrder
          ? serverOrder.items.map(item => ({
            product_id: item.product_id, name: item.name, quantity: item.quantity, price: item.unit_price
          }))
          : cart;
        orderData.status ||= "pending";
        const created = SQLiteEngine.createOrder(orderData, orderItems);
        await window.ShopSQLite.flush();
        if (serverOrder && !orderSyncPending) {
          try {
            const payment = await window.EshopInventoryBridge.initializeStorefrontPayment(tenantId, serverOrder.order_number);
            window.location.assign(payment.authorization_url);
            return;
          } catch (error) {
            AppUtils.showToast(
              `Order saved unpaid. ${error instanceof Error ? error.message : "Paystack checkout could not start."}`,
              "danger"
            );
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = submitLabel;
            }
            this.navigate(`/checkout/confirmation?orderId=${created.order_number}`);
            return;
          }
        }
        AppUtils.showToast(orderSyncPending
          ? "Unpaid order saved on this device and queued to sync when internet returns."
          : "Unpaid order saved with the shop. No payment has been collected.");
        this.navigate(`/checkout/confirmation?orderId=${created.order_number}`);
      };
    }
  },
  async initPaystackReturn() {
    const [path, queryString] = this.currentRoute().split("?");
    if (path !== "/checkout/confirmation") return;
    const params = new URLSearchParams(queryString || "");
    const reference = params.get("reference");
    const status = document.querySelector("[data-payment-status]");
    const retryButton = document.querySelector("[data-paystack-retry]");
    retryButton?.addEventListener("click", async () => {
      retryButton.disabled = true;
      retryButton.textContent = "Opening secure payment…";
      try {
        const orderNumber = params.get("orderId");
        const order = SQLiteEngine.getOrder(orderNumber);
        if (!orderNumber || !order) throw new Error("Order details are not available on this device.");
        const payment = await window.EshopInventoryBridge.initializeStorefrontPayment(
          order.tenant_id || this.getActiveTenant().id, orderNumber
        );
        window.location.assign(payment.authorization_url);
      } catch (error) {
        retryButton.disabled = false;
        retryButton.textContent = "Continue to secure payment";
        if (status) status.textContent = error instanceof Error ? error.message : "Paystack checkout could not start.";
      }
    });
    if (!reference) return;
    if (status) status.textContent = "Checking payment with Paystack…";
    try {
      const result = await window.EshopInventoryBridge.verifyStorefrontPayment(
        params.get("tenant") || this.getActiveTenant().id, reference
      );
      let localOrder = SQLiteEngine.getOrder(result.order_number);
      if (!localOrder && result.order) {
        const remoteOrder = result.order;
        localOrder = SQLiteEngine.insert("orders", {
          tenant_id: result.tenant_id,
          order_number: remoteOrder.order_number,
          customer_name: remoteOrder.customer_name,
          customer_email: remoteOrder.customer_email,
          customer_phone: remoteOrder.customer_phone,
          total: remoteOrder.total,
          subtotal: remoteOrder.subtotal,
          discount: remoteOrder.discount,
          shipping: 0,
          currency: remoteOrder.currency,
          payment_method: result.payment_status === "paid" ? "Paystack" : "Paystack payment pending",
          payment_status: result.payment_status,
          status: result.payment_status === "paid" ? "paid" : remoteOrder.status,
          created_at: remoteOrder.created_at,
          items: remoteOrder.items.map(item => ({
            product_id: item.product_id, name: item.name, quantity: item.quantity, price: item.unit_price
          }))
        });
        await window.ShopSQLite.flush();
        this.handleRoute(this.currentRoute(), false);
        return;
      }
      SQLiteEngine.update("orders", order => order.order_number === result.order_number
        && (!result.tenant_id || !order.tenant_id || order.tenant_id === result.tenant_id), order => ({
        ...order,
        ...(result.payment_status === "paid" ? { status: "paid", payment_method: "Paystack" } : {}),
        payment_status: result.payment_status
      }));
      if (result.payment_status === "paid") {
        await window.ShopSQLite.flush();
        if (status) status.textContent = "Payment confirmed by Paystack";
      } else if (status) {
        status.textContent = result.payment_status === "failed"
          ? "Payment was not confirmed. No payment has been recorded."
          : "Payment is pending confirmation.";
      }
      if (result.payment_status !== "paid") await window.ShopSQLite.flush();
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Payment confirmation is not available yet.";
    }
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StoreRenderers.renderCheckout(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root) {
  root.innerHTML = StoreRenderers.renderCheckout();
  AppController.initCheckoutForm();
  AppController.initPaystackReturn();
}

export function unmount() {}
