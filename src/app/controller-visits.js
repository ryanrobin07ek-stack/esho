// Storefront visit and event recording.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { SQLiteEngine } from './main.js';

export const visitsController = {
  isStorefrontVisitPath(path) {
    return typeof path === "string" && (
      path === "/categories" ||
      path.startsWith("/pages/") ||
      path.startsWith("/category/") ||
      path.startsWith("/product/") ||
      ["/search", "/bag", "/checkout", "/checkout/confirmation", "/favorites"].includes(path)
    );
  },

  recordWebVisit(path) {
    if (!this.isStorefrontVisitPath(path)) return;
    try {
      if (!Array.isArray(SQLiteEngine.db.tables.web_visits)) SQLiteEngine.db.tables.web_visits = [];
      const tenantId = this.getActiveTenant().id;
      const visitorKey = `ESHOP_WEB_VISITOR_V1:${encodeURIComponent(tenantId)}`;
      const sessionKey = `ESHOP_WEB_SESSION_V1:${encodeURIComponent(tenantId)}`;
      const getOrCreateId = (storage, key) => {
        let id = storage.getItem(key);
        if (!id) {
          id = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
          storage.setItem(key, id);
        }
        return id;
      };
      let device = "Desktop";
      if (/tablet|ipad/i.test(navigator.userAgent)) device = "Tablet";
      else if (/mobile|android|iphone/i.test(navigator.userAgent)) device = "Mobile";
      const sessionId = getOrCreateId(window.sessionStorage, sessionKey);
      SQLiteEngine.insert("web_visits", {
        tenant_id: tenantId,
        visitor_id: getOrCreateId(window.localStorage, visitorKey),
        session_id: sessionId,
        path: path || "/",
        device,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        created_at: new Date().toISOString()
      });
      const recordedVisits = SQLiteEngine.db.tables.web_visits;
      if (recordedVisits.length > 10000) {
        recordedVisits.splice(0, recordedVisits.length - 10000);
        SQLiteEngine.save();
      }
      if (path === "/checkout") this.recordWebEvent("checkout_started");
      void window.ShopSQLite?.flush().catch(error => console.error("Storefront visit could not be saved.", error));
    } catch (error) {
      console.error("Storefront visit could not be recorded.", error);
    }
  },

  recordWebEvent(event, details = {}) {
    try {
      const tenantId = this.getActiveTenant().id;
      const getOrCreateId = (storage, key) => {
        let id = storage.getItem(key);
        if (!id) {
          id = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
          storage.setItem(key, id);
        }
        return id;
      };
      SQLiteEngine.insert("web_events", {
        tenant_id: tenantId,
        visitor_id: getOrCreateId(window.localStorage, `ESHOP_WEB_VISITOR_V1:${encodeURIComponent(tenantId)}`),
        session_id: getOrCreateId(window.sessionStorage, `ESHOP_WEB_SESSION_V1:${encodeURIComponent(tenantId)}`),
        event,
        ...details,
        created_at: new Date().toISOString()
      });
      const events = SQLiteEngine.db.tables.web_events;
      if (events.length > 10000) {
        events.splice(0, events.length - 10000);
        SQLiteEngine.save();
      }
      void window.ShopSQLite?.flush().catch(error => console.error("Storefront activity could not be saved.", error));
    } catch (error) {
      console.error("Storefront activity could not be recorded.", error);
    }
  },
};
