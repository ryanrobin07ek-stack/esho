(() => {
  "use strict";

  if (window.__ESHOP_CLOUDFLARE_STOREFRONT__ !== true ||
      window.__CRAFT_CLOUDFLARE_RUNTIME__) return;
  window.__CRAFT_CLOUDFLARE_RUNTIME__ = true;

  const cartStorageKey = "storefront.cart";
  const wishlistStorageKey = "storefront.wishlist";
  const holdStorageKey = `eshop-holds:${location.host}`;
  const newsletterFormSelector = ".newsletter-form, .sole-newsletter-form, #web-newsletter-signup";

  function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Craft storefront activity could not read local preferences.", error);
      return fallback;
    }
  }

  // Funnel events carry real catalogue ids only: anything the published catalogue does not
  // list is dropped instead of polluting the owner's analytics.
  function trackFunnelEvent(productId, type, count = 1) {
    const id = String(productId ?? "").trim();
    const products = window.__ESHOP_THEME_CATALOG__?.products;
    if (!id || typeof window.__ESHOP_TRACK_STOREFRONT_EVENT__ !== "function") return;
    if (Array.isArray(products) && !products.some(product => String(product.id) === id)) return;
    window.__ESHOP_TRACK_STOREFRONT_EVENT__(id, type, count);
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
    checkbox.style.cssText = "flex:0 0 16px;width:16px;height:16px;margin:2px 0 0;padding:0";
    const text = document.createElement("span");
    text.textContent = "I agree to receive occasional shop updates by email. I can unsubscribe at any time.";
    label.append(checkbox, text);
    form.append(label);
  }

  async function requestPushJson(path, method = "GET", payload) {
    const response = await fetch(path, {
      method,
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Push request failed (${response.status}).`);
    return result;
  }

  function installPushControls(form) {
    if (form.querySelector("[data-enable-notifications], [data-storefront-push-controls]")) return;
    // A browser that cannot do push would only ever show an error, so it gets no notification controls at all.
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    const controls = document.createElement("div");
    controls.dataset.storefrontPushControls = "true";
    controls.style.cssText = "display:grid;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #ddd";
    const description = document.createElement("p");
    description.textContent = "Get occasional shop updates on this device. You can turn notifications off anytime.";
    description.style.cssText = "margin:0;font-size:13px;line-height:1.5";
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;flex-wrap:wrap;gap:8px";
    const enable = document.createElement("button");
    enable.type = "button";
    enable.dataset.storefrontPushEnable = "true";
    enable.textContent = "Enable notifications";
    enable.style.cssText = "padding:10px 14px;min-height:44px;border:0;border-radius:6px;background:#111;color:#fff;cursor:pointer";
    const disable = document.createElement("button");
    disable.type = "button";
    disable.dataset.storefrontPushDisable = "true";
    disable.textContent = "Turn off notifications";
    disable.style.cssText = "padding:10px 14px;min-height:44px;border:1px solid #888;border-radius:6px;background:transparent;color:inherit;cursor:pointer";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.style.cssText = "margin:0;font-size:12px;line-height:1.5";
    actions.append(enable, disable);
    controls.append(description, actions, status);
    form.append(controls);
    // Show only the button that makes sense: Enable until this device is subscribed, then Turn off.
    const showState = on => { enable.hidden = on; disable.hidden = !on; };
    showState(false);
    navigator.serviceWorker.getRegistration().then(registration => registration?.pushManager.getSubscription())
      .then(subscription => showState(Boolean(subscription))).catch(() => {});

    enable.addEventListener("click", async () => {
      enable.disabled = true;
      status.textContent = "Enabling notifications…";
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
          throw new Error("Push notifications are not supported by this browser.");
        }
        if (!window.isSecureContext) throw new Error("Push notifications require a secure HTTPS website.");
        const permissionPromise = Notification.permission === "default"
          ? Notification.requestPermission()
          : Promise.resolve(Notification.permission);
        const [config, permission] = await Promise.all([
          requestPushJson("/api/push/config"),
          permissionPromise
        ]);
        if (permission !== "granted") throw new Error("Notification permission was not granted.");
        if (!await navigator.serviceWorker.getRegistration()) {
          await navigator.serviceWorker.register("/sw.js");
        }
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        const subscription = existing || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeBase64Url(config.public_key)
        });
        await requestPushJson("/api/push/subscriptions", "POST", subscription.toJSON());
        status.textContent = "Notifications enabled on this device.";
        showState(true);
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Could not enable notifications.";
      } finally {
        enable.disabled = false;
      }
    });

    disable.addEventListener("click", async () => {
      disable.disabled = true;
      status.textContent = "Turning off notifications…";
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) {
          status.textContent = "Notifications are already off on this device.";
          showState(false);
          return;
        }
        const saved = subscription.toJSON();
        await subscription.unsubscribe();
        try {
          await requestPushJson("/api/push/subscriptions", "DELETE", { endpoint: saved.endpoint });
        } catch (error) {
          throw new Error(`Notifications are off on this device, but cloud cleanup failed: ${error instanceof Error ? error.message : "service unavailable"}`);
        }
        status.textContent = "Notifications turned off on this device.";
        showState(false);
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Could not turn off notifications.";
      } finally {
        disable.disabled = false;
      }
    });
  }

  // The WhatsApp chat button: bottom right, the real WhatsApp logo. It exists only while the owner has the
  // WhatsApp button switched on and a usable number is saved, so a shop that never set it shows nothing.
  function storefrontWhatsAppNumber(store) {
    const link = String(store?.whatsapp_url || "").trim();
    const fromLink = link.match(/wa\.me\/\+?(\d{7,15})/i) || link.match(/[?&]phone=\+?(\d{7,15})/i);
    if (fromLink) return fromLink[1];
    const typedNumber = /^\+?[\d\s().-]{7,22}$/.test(link) ? link.replace(/\D/g, "") : "";
    if (typedNumber.length >= 7 && typedNumber.length <= 15) return typedNumber;
    const saved = String(store?.whatsapp || store?.whatsapp_number || "").replace(/\D/g, "");
    if (saved.length >= 7 && saved.length <= 15) return saved;
    // A phone number is only trusted when it already carries its country code.
    const phone = String(store?.phone || "").trim();
    const phoneDigits = phone.startsWith("+") ? phone.replace(/\D/g, "") : "";
    return phoneDigits.length >= 7 && phoneDigits.length <= 15 ? phoneDigits : "";
  }

  function installWhatsAppButton() {
    const store = window.__ESHOP_THEME_CATALOG__?.store;
    const existing = document.getElementById("craft-whatsapp-button");
    const enabled = store && (store.whatsapp_enabled === 1 || store.whatsapp_enabled === true || store.whatsapp_enabled === "1");
    const number = enabled ? storefrontWhatsAppNumber(store) : "";
    if (!number) {
      existing?.remove();
      return;
    }
    const storeName = String(store.name || "").trim();
    const message = storeName ? `Hello ${storeName}, I have a question.` : "Hello, I have a question.";
    const href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    if (existing) {
      existing.href = href;
      return;
    }
    const link = document.createElement("a");
    link.id = "craft-whatsapp-button";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Chat with us on WhatsApp");
    link.style.cssText = "position:fixed;z-index:2147482000;right:calc(16px + env(safe-area-inset-right, 0px));bottom:calc(16px + env(safe-area-inset-bottom, 0px));width:56px;height:56px;border-radius:50%;background:#25D366;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.28);text-decoration:none";
    link.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="#fff" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
    (document.body || document.documentElement).append(link);
  }

  function installStorefrontForms() {
    for (const form of document.querySelectorAll(newsletterFormSelector)) {
      installNewsletterConsent(form);
      installPushControls(form);
    }
  }

  let deferredInstallPrompt = null;
  let installBanner = null;
  let installBannerTimer = 0;
  let installBannerDismissed = false;

  function storefrontInstallEnabled() {
    const setting = window.__ESHOP_THEME_CATALOG__?.store?.install_prompt_enabled;
    return setting !== 0 && setting !== "0" && setting !== false;
  }

  function storefrontIsInstalled() {
    return Boolean(window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true);
  }

  function hideStorefrontInstallBanner() {
    window.clearTimeout(installBannerTimer);
    installBanner?.remove();
    installBanner = null;
  }

  function showStorefrontInstallBanner() {
    if (!storefrontInstallEnabled() || storefrontIsInstalled() || installBanner || installBannerDismissed) return;
    const storeName = String(window.__ESHOP_THEME_CATALOG__?.store?.name || "this store").trim();
    const banner = document.createElement("aside");
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Install this store");
    banner.style.cssText = "position:fixed;z-index:2147483000;left:50%;bottom:calc(16px + env(safe-area-inset-bottom, 0px));transform:translateX(-50%);width:min(440px,calc(100vw - 24px));box-sizing:border-box;padding:14px 16px;border:1px solid #d5d5d5;border-radius:14px;background:#fff;color:#161616;box-shadow:0 12px 40px #0003;font:14px/1.45 system-ui,sans-serif";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:flex-start;gap:12px";
    const copy = document.createElement("div");
    copy.style.cssText = "flex:1;min-width:0";
    const heading = document.createElement("strong");
    heading.textContent = `Install ${storeName}`;
    const description = document.createElement("p");
    description.textContent = "Add this store to your home screen for quicker access.";
    description.style.cssText = "margin:3px 0 0;color:#555";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "×";
    dismiss.setAttribute("aria-label", "Dismiss install invitation");
    dismiss.style.cssText = "flex:0 0 auto;min-width:44px;min-height:44px;border:0;background:transparent;color:inherit;font-size:22px;line-height:1;cursor:pointer";
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:12px";
    const install = document.createElement("button");
    install.type = "button";
    install.textContent = "Install";
    install.style.cssText = "padding:9px 14px;min-height:44px;border:0;border-radius:8px;background:#171717;color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer";
    const status = document.createElement("span");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.style.cssText = "color:#555;font-size:12px";
    copy.append(heading, description);
    actions.append(install, status);
    row.append(copy, dismiss);
    banner.append(row, actions);
    (document.body || document.documentElement).append(banner);
    installBanner = banner;
    installBannerTimer = window.setTimeout(hideStorefrontInstallBanner, 5000);

    dismiss.addEventListener("click", () => {
      installBannerDismissed = true;
      hideStorefrontInstallBanner();
    });
    install.addEventListener("click", async () => {
      window.clearTimeout(installBannerTimer);
      if (!deferredInstallPrompt) {
        const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        status.textContent = isAppleMobile
          ? "Tap Share, then choose Add to Home Screen."
          : "Open your browser menu and choose Install app or Add to Home screen.";
        return;
      }
      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = null;
      install.disabled = true;
      status.textContent = "Opening the browser install prompt…";
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        status.textContent = choice?.outcome === "accepted"
          ? `${storeName} was installed.`
          : "Installation was canceled.";
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "The install prompt could not be opened.";
      } finally {
        install.disabled = false;
      }
    });
  }

  function installStorefrontAppPrompt() {
    if (!storefrontInstallEnabled() || storefrontIsInstalled()) return;
    if (typeof navigator.serviceWorker?.register === "function" && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js").catch(error => {
        console.warn("The storefront service worker could not be registered for app installation.", error);
      });
    }
    window.addEventListener("beforeinstallprompt", event => {
      if (!storefrontInstallEnabled() || storefrontIsInstalled()) return;
      event.preventDefault();
      deferredInstallPrompt = event;
      showStorefrontInstallBanner();
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      hideStorefrontInstallBanner();
    });
    window.setTimeout(showStorefrontInstallBanner, 800);
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
    if (form.dataset.checkoutTracked !== form.dataset.idempotencyKey) {
      form.dataset.checkoutTracked = form.dataset.idempotencyKey;
      for (const productId of cartProductIds) trackFunnelEvent(productId, "checkout_start");
    }
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
        const trackedKey = "eshop:purchase-tracked";
        if (Array.isArray(cart) && readStorage(trackedKey, "") !== reference) {
          try {
            localStorage.setItem(trackedKey, JSON.stringify(reference));
          } catch (error) {
            console.warn("The purchase could not be remembered on this device.", error);
          }
          for (const item of cart) {
            if (item?.productId == null) continue;
            trackFunnelEvent(String(item.productId), "purchase", Math.max(1, Math.min(99, Math.floor(Number(item.qty) || 1))));
          }
        }
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
    } else if (form?.matches(newsletterFormSelector)) {
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

  installStorefrontForms();
  installStorefrontAppPrompt();
  installProductHoldForm();
  if (typeof MutationObserver === "function") {
    const storefrontRoot = document.body || document.documentElement;
    new MutationObserver(() => {
      installStorefrontForms();
      installProductHoldForm();
    }).observe(storefrontRoot, { childList: true, subtree: true });
  }
  window.addEventListener("hashchange", installProductHoldForm);
  window.addEventListener("hashchange", trackCurrentProductView);
  window.addEventListener("eshop:catalog-ready", installProductHoldForm);
  trackCurrentProductView();
  installWhatsAppButton();
  window.addEventListener("eshop:catalog-ready", installWhatsAppButton);
  void verifyPaymentReturn();
})();
