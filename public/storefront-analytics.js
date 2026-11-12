(() => {
  "use strict";

  if (window.__ESHOP_STOREFRONT_EVENT_RUNTIME__) return;
  window.__ESHOP_STOREFRONT_EVENT_RUNTIME__ = true;

  const allowedTypes = new Set(["view", "wishlist_add", "cart_add"]);
  const params = new URLSearchParams(location.search);
  const tenantKey = params.get("tenant") || location.hostname;
  const storageKey = `eshop:storefront-events:v1:${tenantKey}`;
  const pending = new Map();
  let flushing = false;

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...pending.values()]));
    } catch (error) {
      console.warn("Storefront analytics events could not be saved locally.", error);
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(saved)) {
      for (const item of saved) {
        const productId = String(item?.product_id || "").trim();
        if (productId && productId.length <= 80 && allowedTypes.has(item?.type) &&
            Number.isSafeInteger(item?.n) && item.n > 0 && item.n <= 500) {
          pending.set(`${productId}\u0000${item.type}`, {
            product_id: productId,
            type: item.type,
            n: item.n
          });
        }
      }
    }
  } catch (error) {
    console.warn("Saved storefront analytics events could not be read.", error);
  }

  function track(productId, type, count = 1) {
    const id = String(productId || "").trim();
    const amount = Number(count);
    if (!id || id.length > 80 || /[\u0000-\u001f]/.test(id) ||
        !allowedTypes.has(type) || !Number.isSafeInteger(amount) || amount < 1) return;
    const key = `${id}\u0000${type}`;
    const existing = pending.get(key);
    pending.set(key, {
      product_id: id,
      type,
      n: Math.min(500, (existing?.n || 0) + amount)
    });
    persist();
  }

  window.__ESHOP_TRACK_STOREFRONT_EVENT__ = track;
  const earlyEvents = window.__ESHOP_PENDING_STOREFRONT_EVENTS__;
  if (Array.isArray(earlyEvents)) {
    for (const [productId, type, count] of earlyEvents) track(productId, type, count);
    earlyEvents.length = 0;
  }

  function endpoint() {
    const url = new URL("/api/analytics/events", location.href);
    const requestedTenant = params.get("tenant");
    if (requestedTenant) url.searchParams.set("tenant", requestedTenant);
    if (params.get("_mapped_tenant") === "1") url.searchParams.set("_mapped_tenant", "1");
    return url.href;
  }

  function removeSent(batch) {
    for (const item of batch) {
      const key = `${item.product_id}\u0000${item.type}`;
      const current = pending.get(key);
      if (!current) continue;
      const remaining = current.n - item.n;
      if (remaining > 0) pending.set(key, { ...current, n: remaining });
      else pending.delete(key);
    }
    persist();
  }

  async function flush() {
    if (flushing || pending.size === 0) return;
    flushing = true;
    try {
      const batches = [];
      const items = [...pending.values()];
      for (let index = 0; index < items.length; index += 50) {
        batches.push(items.slice(index, index + 50));
      }
      for (const batch of batches) {
        const body = JSON.stringify({ items: batch });
        if (document.visibilityState === "hidden" && navigator.sendBeacon) {
          const queued = navigator.sendBeacon(endpoint(), new Blob([body], { type: "application/json" }));
          if (queued) removeSent(batch);
          continue;
        }
        const response = await fetch(endpoint(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true
        });
        if (!response.ok) throw new Error(`Analytics batch failed (${response.status}).`);
        removeSent(batch);
      }
    } catch (error) {
      console.warn("Storefront analytics remain queued for retry.", error);
    } finally {
      flushing = false;
    }
  }

  window.setInterval(() => { void flush(); }, 30_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("pagehide", () => { void flush(); });
})();
