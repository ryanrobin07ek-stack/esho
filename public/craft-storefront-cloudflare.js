(() => {
  "use strict";

  if (window.__ESHOP_CLOUDFLARE_STOREFRONT__ !== true ||
      window.__CRAFT_CLOUDFLARE_RUNTIME__) return;
  window.__CRAFT_CLOUDFLARE_RUNTIME__ = true;

  const cartStorageKey = "storefront.cart";
  const wishlistStorageKey = "storefront.wishlist";
  const holdStorageKey = `eshop-holds:${location.host}`;

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Craft storefront activity could not read local preferences.", error);
      return fallback;
    }
  }

  async function sendJson(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Storefront request failed (${response.status}).`);
    }
    return response.json();
  }

  function installNewsletterConsent(form) {
    if (form.querySelector('[name="consent"]')) return;
    const label = document.createElement("label");
    label.style.cssText = "display:flex;gap:8px;align-items:flex-start;margin:8px 0;font-size:12px;line-height:1.5";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "consent";
    checkbox.required = true;
    const text = document.createElement("span");
    text.textContent = "I agree to receive occasional shop updates by email. I can unsubscribe at any time.";
    label.append(checkbox, text);
    form.append(label);
  }

  function statusFor(form, id) {
    let status = document.getElementById(id);
    if (!status) {
      status = document.createElement("p");
      status.id = id;
      status.className = "form-msg";
      status.setAttribute("role", "status");
      form.append(status);
    }
    return status;
  }

  function installProductHoldForm() {
    const app = document.getElementById("app");
    if (window.__ESHOP_THEME_CATALOG_LOADING__) return;
    if (!app || app.querySelector("#product-hold-form")) return;
    const addButton = app.querySelector('[data-action="add-to-cart"][data-id]');
    const actions = addButton?.closest(".form-actions");
    if (!actions) return;
    const catalogProducts = window.__ESHOP_THEME_CATALOG__?.products;
    if (Array.isArray(catalogProducts) &&
        !catalogProducts.some(product => String(product.id) === String(addButton.dataset.id) && product.booking_enabled === true)) return;
    const form = document.createElement("form");
    form.id = "product-hold-form";
    form.className = "form-grid";
    form.dataset.productId = addButton.dataset.id;
    form.style.cssText = "margin-top:18px;max-width:420px";
    const heading = document.createElement("h2");
    heading.className = "section-title";
    heading.textContent = "Reserve this product";
    const note = document.createElement("p");
    note.className = "slot-note";
    const holdHours = Number(window.__ESHOP_THEME_CATALOG__?.store?.hold_duration_hours) || 24;
    note.textContent = `Reserve the selected quantity immediately for up to ${holdHours} hours.`;
    form.append(heading, note);
    for (const [name, title, type, autocomplete] of [
      ["customer_name", "Your name", "text", "name"],
      ["contact", "Email or phone", "text", "email"],
      ["quantity", "Quantity", "number", ""]
    ]) {
      const field = document.createElement("div");
      field.className = "field";
      const label = document.createElement("label");
      label.textContent = title;
      const input = document.createElement("input");
      input.className = "input";
      input.name = name;
      input.type = type;
      input.required = true;
      if (autocomplete) input.autocomplete = autocomplete;
      if (name === "quantity") {
        input.min = "1";
        input.max = "99";
        input.step = "1";
        input.value = "1";
      }
      label.append(input);
      field.append(label);
      form.append(field);
    }
    const button = document.createElement("button");
    button.className = "btn btn--outline";
    button.type = "submit";
    button.textContent = "Reserve this product";
    const status = document.createElement("p");
    status.id = "product-hold-msg";
    status.className = "form-msg";
    status.setAttribute("role", "status");
    form.append(button, status);
    actions.insertAdjacentElement("afterend", form);
  }

  async function subscribe(form) {
    installNewsletterConsent(form);
    const emailInput = form.querySelector('input[type="email"]');
    const consent = form.querySelector('[name="consent"]');
    const status = statusFor(form, "newsletter-msg");
    if (!emailInput?.reportValidity() || !consent?.checked) {
      if (status) status.textContent = "Enter a valid email and agree to newsletter emails.";
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    status.textContent = "Sending confirmation email…";
    try {
      const result = await sendJson("/api/newsletter/subscribe", {
        email: emailInput.value.trim(),
        consent: true
      });
      status.textContent = result.subscribed
        ? "This email is already subscribed."
        : "Check your email and confirm your subscription.";
      form.reset();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Newsletter signup failed.";
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function requestProductHold(form) {
    if (!form.reportValidity()) return;
    const productId = form.dataset.productId;
    const data = new FormData(form);
    const quantity = Number(data.get("quantity"));
    const button = form.querySelector('button[type="submit"]');
    const status = statusFor(form, "product-hold-msg");
    if (!productId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
      status.textContent = "Choose a valid product and quantity.";
      return;
    }
    if (!form.dataset.idempotencyKey) form.dataset.idempotencyKey = crypto.randomUUID();
    if (button) button.disabled = true;
    status.textContent = "Reserving the requested quantity…";
    try {
      const result = await sendJson("/api/product-holds", {
        idempotency_key: form.dataset.idempotencyKey,
        product_id: productId,
        quantity,
        customer_name: String(data.get("customer_name") || "").trim(),
        contact: String(data.get("contact") || "").trim()
      });
      try {
        const holds = readStorage(holdStorageKey, []);
        const savedHolds = Array.isArray(holds) ? holds : [];
        savedHolds.push({
          id: result.hold.id,
          product_id: String(result.hold.product_id),
          quantity: Number(result.hold.quantity),
          expires_at: result.hold.expires_at,
          customer_name: String(data.get("customer_name") || "").trim(),
          contact: String(data.get("contact") || "").trim()
        });
        localStorage.setItem(holdStorageKey, JSON.stringify(savedHolds.slice(-100)));
      } catch (error) {
        console.warn("The hold was created but could not be saved on this device.", error);
      }
      status.textContent = `Held until ${new Date(result.hold.expires_at).toLocaleString()}.`;
      form.reset();
      delete form.dataset.idempotencyKey;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Your hold request could not be sent.";
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function startCheckout(form) {
    if (!form.reportValidity()) return;
    const status = statusFor(form, "pay-status");
    const button = form.querySelector('button[type="submit"]');
    const cart = readStorage(cartStorageKey, []);
    if (!Array.isArray(cart) || cart.length === 0) {
      status.textContent = "Your cart has no valid items.";
      return;
    }
    const items = cart
      .filter(item => item && item.productId != null)
      .map(item => ({
        product_id: String(item.productId),
        quantity: Math.max(1, Math.min(99, Math.floor(Number(item.qty) || 1)))
      }));
    if (!items.length) {
      status.textContent = "Your cart has no valid items.";
      return;
    }
    const cartProductIds = new Set(items.map(item => item.product_id));
    const holds = readStorage(holdStorageKey, []);
    const holdIds = Array.isArray(holds) ? holds.filter(hold =>
      hold && typeof hold.id === "string" && cartProductIds.has(String(hold.product_id))
      && Date.parse(hold.expires_at) > Date.now()
      && String(hold.customer_name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase()
        === String(form.querySelector("#co-name").value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase()
      && (String(hold.contact || "").includes("@")
        ? String(hold.contact).trim().toLocaleLowerCase() === String(form.querySelector("#co-email").value || "").trim().toLocaleLowerCase()
        : String(hold.contact || "").replace(/\D/g, "") === String(form.querySelector("#co-phone").value || "").replace(/\D/g, "")))
      .map(hold => hold.id) : [];
    const signature = JSON.stringify({ items, holdIds });
    if (form.dataset.cartSignature !== signature || !form.dataset.idempotencyKey) {
      form.dataset.cartSignature = signature;
      form.dataset.idempotencyKey = crypto.randomUUID();
    }
    if (button) button.disabled = true;
    status.textContent = "Creating your order…";
    try {
      const customer = {
        customer_name: form.querySelector("#co-name").value.trim(),
        customer_email: form.querySelector("#co-email").value.trim(),
        customer_phone: form.querySelector("#co-phone").value.trim(),
        shipping_address: form.querySelector("#co-address").value.trim(),
        city: form.querySelector("#co-city").value.trim(),
        region: form.querySelector("#co-region").value.trim(),
        postal_code: form.querySelector("#co-postal").value.trim()
      };
      const created = await sendJson("/api/orders", {
        idempotency_key: form.dataset.idempotencyKey,
        ...customer,
        hold_ids: holdIds,
        items
      });
      if (!created.order?.order_number) throw new Error("The shop did not confirm the order.");
      status.textContent = "Opening secure payment…";
      const payment = await sendJson("/api/payments/paystack/initialize", {
        order_number: created.order.order_number
      });
      const authorizationUrl = new URL(payment.authorization_url);
      if (authorizationUrl.protocol !== "https:" ||
          authorizationUrl.hostname !== "checkout.paystack.com") {
        throw new Error("The payment provider returned an unsafe checkout link.");
      }
      location.assign(authorizationUrl.toString());
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Checkout could not be started.";
      if (button) button.disabled = false;
    }
  }

  async function verifyPaymentReturn() {
    const match = location.hash.match(/^#\/checkout\/confirmation(?:\?(.*))?$/);
    if (!match) return;
    const query = new URLSearchParams(match[1] || "");
    const reference = query.get("reference") || "";
    const orderNumber = query.get("orderId") || "";
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = '<div class="container"><section class="card-panel"><h1 class="panel-title">Checking payment</h1><p class="panel-note">Please wait while the shop verifies your payment.</p></section></div>';
    try {
      if (!/^ESHOP_[A-F0-9]{32}$/.test(reference)) throw new Error("The payment reference is invalid.");
      const response = await fetch(`/api/payments/paystack/verify?reference=${encodeURIComponent(reference)}`, {
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Payment could not be verified.");
      if (result.payment_status === "paid") {
        const cart = readStorage(cartStorageKey, []);
        localStorage.setItem(cartStorageKey, "[]");
        const purchasedProductIds = new Set(Array.isArray(cart)
          ? cart.map(item => String(item?.productId ?? "")).filter(Boolean)
          : []);
        const holds = readStorage(holdStorageKey, []);
        if (Array.isArray(holds)) {
          localStorage.setItem(holdStorageKey, JSON.stringify(holds.filter(hold =>
            !purchasedProductIds.has(String(hold?.product_id)))));
        }
        app.innerHTML = `<div class="container"><section class="card-panel"><h1 class="panel-title">Order confirmed</h1><p class="panel-note">Your payment was verified securely.</p><p><strong>Order ${String(result.order_number || orderNumber).replace(/[&<>"']/g, "")}</strong></p><a class="btn" href="/#/">Continue shopping</a></section></div>`;
      } else {
        throw new Error("The payment is not confirmed yet. Your order remains recorded; contact the shop if you were charged.");
      }
    } catch (error) {
      app.innerHTML = `<div class="container"><section class="card-panel"><h1 class="panel-title">Payment status</h1><p class="panel-note">${String(error instanceof Error ? error.message : "Payment could not be verified.").replace(/[&<>"']/g, "")}</p><p>Order ${String(orderNumber).replace(/[&<>"']/g, "")}</p><a class="btn btn--outline" href="/#/">Return to shop</a></section></div>`;
    }
  }

  document.addEventListener("submit", event => {
    const form = event.target;
    if (form?.id === "checkout-form") {
      event.preventDefault();
      event.stopImmediatePropagation();
      void startCheckout(form);
    } else if (form?.id === "product-hold-form") {
      event.preventDefault();
      event.stopImmediatePropagation();
      void requestProductHold(form);
    } else if (form?.matches(".newsletter-form")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void subscribe(form);
    }
  }, true);

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    const action = target?.closest("[data-action][data-id]");
    const productId = action?.dataset.id;
    if (!productId) return;
    if (action.dataset.action === "add-to-cart" || action.dataset.action === "qty-inc") {
      window.__ESHOP_TRACK_STOREFRONT_EVENT__?.(productId, "cart_add");
    } else if (action.dataset.action === "toggle-wishlist") {
      setTimeout(() => {
        const wishlist = readStorage(wishlistStorageKey, []);
        if (Array.isArray(wishlist) && wishlist.map(String).includes(String(productId))) {
          window.__ESHOP_TRACK_STOREFRONT_EVENT__?.(productId, "wishlist_add");
        }
      }, 0);
    }
  }, true);

  function trackCurrentProductView() {
    const rawPath = location.hash
      ? location.hash.replace(/^#\/?/, "").split("?")[0]
      : location.pathname.replace(/^\/+|\/+$/g, "");
    const [route, encodedId] = rawPath.split("/");
    if (!["product", "products", "p"].includes(route) || !encodedId) return;
    let productId = encodedId;
    try {
      productId = decodeURIComponent(encodedId);
    } catch {
      productId = encodedId;
    }
    const catalogProducts = window.__ESHOP_THEME_CATALOG__?.products;
    const product = Array.isArray(catalogProducts) && catalogProducts.find(item =>
      String(item.id) === productId || String(item.slug || "") === productId);
    const canonicalId = product ? String(product.id) : productId;
    window.__ESHOP_TRACK_STOREFRONT_EVENT__?.(canonicalId, "view");
  }

  for (const form of document.querySelectorAll(".newsletter-form")) installNewsletterConsent(form);
  installProductHoldForm();
  const storefrontApp = document.getElementById("app");
  if (storefrontApp && typeof MutationObserver === "function") {
    new MutationObserver(installProductHoldForm).observe(storefrontApp, { childList: true, subtree: true });
  }
  window.addEventListener("hashchange", installProductHoldForm);
  window.addEventListener("hashchange", trackCurrentProductView);
  window.addEventListener("eshop:catalog-ready", installProductHoldForm);
  trackCurrentProductView();
  void verifyPaymentReturn();
})();
