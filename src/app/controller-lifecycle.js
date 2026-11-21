// App start-up, owner alert polling and pending storefront order sync.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { AppUtils, SQLiteEngine, categories, demoAnalytics, plans, products, storeInfo } from './main.js';

export const lifecycleController = {
  async init() {
    // Initialize SQLite Engine
    if (window.ShopPOSReady) await window.ShopPOSReady;
    else if (window.ShopSQLiteReady) await window.ShopSQLiteReady;
    await SQLiteEngine.init(categories, products, storeInfo, plans, demoAnalytics);
    this.cacheActiveTenantCatalog();
    this.installBuilderSqliteBridge();
    await SQLiteEngine.resetBuildYourWebDataOnce();

    // Apply saved store theme settings
    this.applyThemeSettings();

    // Attach global click & route interception
    this.bindEvents();
    window.addEventListener("online", () => {
      void this.syncPendingStorefrontOrders().catch(error => {
        console.error("Queued storefront orders could not be synced.", error);
      });
    });
    void this.syncPendingStorefrontOrders().catch(error => {
      console.error("Queued storefront orders could not be synced.", error);
    });

    // Handle initial route
    this.handleRoute(this.currentRoute());
    window.dispatchEvent(new Event("craft:app-ready"));
    this.startOwnerAlertPolling();

    // Browser back / forward buttons. A screen with unsaved work (the website builder) can refuse to
    // be left; the address is then put back without another hashchange.
    this.lastHashRoute = this.currentRoute();
    window.addEventListener("hashchange", () => {
      const next = this.currentRoute();
      if (next !== this.lastHashRoute && !this.confirmRouteLeave(next)) {
        window.history.replaceState(window.history.state, "", `#${this.lastHashRoute}`);
        return;
      }
      this.lastHashRoute = next;
      this.handleRoute(next, true);
    });
  },

  // Shows each Worker outbox alert (new order, booking, hold, paid-but-short-stock) once.
  startOwnerAlertPolling() {
    const owner = window.BusinessNotifications?.owner;
    if (!owner || this.ownerAlertTimer) return;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      const tenantId = this.getActiveTenant().id;
      const result = await owner.poll(tenantId);
      if (!result || this.getActiveTenant().id !== tenantId) return;
      result.fresh.slice(0, 3).forEach(alert =>
        AppUtils.showToast(alert.title, alert.kind === "attention" || alert.kind === "booking_refund" ? "danger" : "success"));
      if (result.fresh.length > 3) {
        AppUtils.showToast(`${result.fresh.length - 3} more new shop alerts.`);
      }
    };
    this.ownerAlertTimer = window.setInterval(() => void check(), owner.pollIntervalMs);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void check();
    });
    window.setTimeout(() => void check(), 5000);
  },

  async syncPendingStorefrontOrders() {
    if (navigator.onLine === false || !window.EshopInventoryBridge?.createStorefrontOrder) return;
    const prefix = "ESHOP_PENDING_STOREFRONT_ORDERS_V1:";
    const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter(key => key?.startsWith(prefix));
    for (const key of keys) {
      let pending;
      try {
        pending = JSON.parse(window.localStorage.getItem(key) || "[]");
      } catch (error) {
        console.error("A queued storefront order could not be read.", error);
        continue;
      }
      if (!Array.isArray(pending)) continue;
      const tenantId = decodeURIComponent(key.slice(prefix.length));
      const remaining = [];
      for (const item of pending) {
        try {
          const response = await window.EshopInventoryBridge.createStorefrontOrder(tenantId, item.payload);
          const order = response.order;
          this.update("orders", saved => saved.order_number === item.local_order_number, saved => ({
            ...saved, ...order, id: saved.id, order_number: order.order_number
          }));
          await window.ShopSQLite.flush();
        } catch (error) {
          remaining.push(item);
          console.warn("A queued storefront order is still waiting to sync.", error);
        }
      }
      if (remaining.length) window.localStorage.setItem(key, JSON.stringify(remaining));
      else window.localStorage.removeItem(key);
    }
  },
};
