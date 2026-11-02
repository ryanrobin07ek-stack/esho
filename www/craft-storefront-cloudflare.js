(() => {
  "use strict";

  if (window.__ESHOP_CLOUDFLARE_STOREFRONT__ !== true ||
      window.__CRAFT_CLOUDFLARE_RUNTIME__) return;
  window.__CRAFT_CLOUDFLARE_RUNTIME__ = true;

  const visitorStorageKey = "ESHOP_STOREFRONT_VISITOR_V1";
  const cartStorageKey = "storefront.cart";
  const wishlistStorageKey = "storefront.wishlist";

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Craft storefront activity could not read local preferences.", error);
      return fallback;
    }
  }

  function visitorId() {
    try {
      let id = localStorage.getItem(visitorStorageKey);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(visitorStorageKey, id);
      }
      return id;
    } catch (error) {
      console.warn("Craft storefront activity could not initialize a visitor ID.", error);
      return "";
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

  function reportInterest(productId, action, value) {
    const id = visitorId();
    if (!id || !productId) return;
    const data = action === "cart"
      ? { quantity: value }
      : { saved: value };
    void sendJson("/api/product-interest", {
      visitor_id: id,
      product_id: String(productId),
      action,
      ...data
    }).catch(error => console.warn("Craft product activity was not synced.", error));
  }

  function reportVisit() {
    if (/^\/(?:account|pos)(?:\/|$)/.test(location.pathname)) return;
    const id = visitorId();
    if (!id) return;
    const hashRoute = location.hash.startsWith("#/")
      ? location.hash.slice(1).split("?", 1)[0]
      : "";
    void sendJson("/api/analytics/visit", {
      visitor_id: id,
      path: hashRoute || location.pathname.split(/[?#]/, 1)[0] || "/"
    }).catch(error => console.warn("Craft storefront visit was not synced.", error));
  }

  function reportAllInterests() {
    const cart = readStorage(cartStorageKey, []);
    const wishlist = readStorage(wishlistStorageKey, []);
    const quantities = new Map();
    if (Array.isArray(cart)) {
      for (const item of cart.slice(0, 100)) {
        if (!item || item.productId == null) continue;
        quantities.set(String(item.productId), Math.min(99, Math.max(0, Number(item.qty) || 0)));
      }
    }
    const savedIds = new Set(Array.isArray(wishlist) ? wishlist.slice(0, 100).map(String) : []);
    const productIds = new Set([...quantities.keys(), ...savedIds]);
    for (const productId of productIds) {
      reportInterest(productId, "cart", quantities.get(productId) || 0);
      reportInterest(productId, "wishlist", savedIds.has(productId));
    }
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
    if (!app || app.querySelector("#product-hold-form")) return;
    const addButton = app.querySelector('[data-action="add-to-cart"][data-id]');
    const actions = addButton?.closest(".form-actions");
    if (!actions) return;
    const form = document.createElement("form");
    form.id = "product-hold-form";
    form.className = "form-grid";
    form.dataset.productId = addButton.dataset.id;
    form.style.cssText = "margin-top:18px;max-width:420px";
    const heading = document.createElement("h2");
    heading.className = "section-title";
    heading.textContent = "Request a hold";
    const note = document.createElement("p");
    note.className = "slot-note";
    note.textContent = "Ask the shop to hold this item. It is not reserved until the shop approves your request.";
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
    button.textContent = "Request a hold";
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
    status.textContent = "Sending your request to the shop…";
    try {
      await sendJson("/api/product-holds", {
        idempotency_key: form.dataset.idempotencyKey,
        product_id: productId,
        quantity,
        customer_name: String(data.get("customer_name") || "").trim(),
        contact: String(data.get("contact") || "").trim()
      });
      status.textContent = "Request sent. The shop must approve it before the item is reserved.";
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
    const signature = JSON.stringify(items);
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
        if (Array.isArray(cart)) {
          for (const item of cart.slice(0, 100)) {
            if (item?.productId != null) reportInterest(item.productId, "cart", 0);
          }
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
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const type = action.dataset.action;
    const productId = action.dataset.id;
    if (!productId || !["toggle-wishlist", "add-to-cart", "qty-inc", "qty-dec", "remove-item"].includes(type)) return;
    setTimeout(() => {
      const cart = readStorage(cartStorageKey, []);
      const item = Array.isArray(cart) ? cart.find(row => String(row?.productId) === String(productId)) : null;
      reportInterest(productId, "cart", item ? Math.min(99, Math.max(0, Number(item.qty) || 0)) : 0);
      if (type === "toggle-wishlist") {
        const wishlist = readStorage(wishlistStorageKey, []);
        reportInterest(productId, "wishlist", Array.isArray(wishlist) && wishlist.map(String).includes(String(productId)));
      }
    }, 0);
  }, true);

  const pushState = history.pushState;
  history.pushState = function (...args) {
    const result = pushState.apply(this, args);
    reportVisit();
    return result;
  };
  window.addEventListener("popstate", reportVisit);
  window.addEventListener("hashchange", reportVisit);

  for (const form of document.querySelectorAll(".newsletter-form")) installNewsletterConsent(form);
  installProductHoldForm();
  const storefrontApp = document.getElementById("app");
  if (storefrontApp && typeof MutationObserver === "function") {
    new MutationObserver(installProductHoldForm).observe(storefrontApp, { childList: true, subtree: true });
  }
  window.addEventListener("hashchange", installProductHoldForm);
  reportVisit();
  reportAllInterests();
  void verifyPaymentReturn();
})();
