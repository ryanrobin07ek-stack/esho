function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

window.BusinessNotifications = {
  async enable(tenantId) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      throw new Error("Push notifications are not supported by this browser or app webview.");
    }
    if (!window.isSecureContext) throw new Error("Push notifications require a secure HTTPS website.");
    const controller = window.AppController;
    if (!controller?.cloudflareRequest) throw new Error("The shop connection is not ready.");
    const permissionPromise = Notification.permission === "default"
      ? Notification.requestPermission()
      : Promise.resolve(Notification.permission);
    const [config, permission] = await Promise.all([
      controller.cloudflareRequest(
        `/api/push/config?tenant=${encodeURIComponent(tenantId)}`, {}, tenantId, true
      ),
      permissionPromise
    ]);
    if (permission !== "granted") throw new Error("Notification permission was not granted.");
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(config.public_key)
    });
    await controller.cloudflareRequest(
      `/api/push/subscriptions?tenant=${encodeURIComponent(tenantId)}`,
      { method: "POST", body: JSON.stringify(subscription.toJSON()) },
      tenantId,
      true
    );
    return "Notifications enabled on this device. The shop may send product updates.";
  },
  async disable(tenantId) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return "Notifications are already off on this device.";
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return "Notifications are already off on this device.";
    const saved = subscription.toJSON();
    await subscription.unsubscribe();
    try {
      await window.AppController.cloudflareRequest(
        `/api/push/subscriptions?tenant=${encodeURIComponent(tenantId)}`,
        { method: "DELETE", body: JSON.stringify({ endpoint: saved.endpoint }) },
        tenantId,
        true
      );
    } catch (error) {
      throw new Error(`Notifications are off on this device, but cloud cleanup failed: ${error instanceof Error ? error.message : "service unavailable"}`);
    }
    return "Notifications turned off on this device.";
  }
};

// Owner alerts. The Worker writes new orders, booking requests, holds and "needs attention"
// payments to an outbox (GET /api/store/notifications). The app polls it and shows each
// alert once. Customer web push (enable/disable above) is a separate newsletter list and is
// never used for these alerts, so the two channels cannot double up.
const OWNER_ALERT_SEEN_LIMIT = 300;
const OWNER_ALERT_POLL_MS = 60_000;
const OWNER_ALERT_MAX_BACKOFF_MS = 15 * 60_000;
const ownerAlertKey = tenantId => `ESHOP_OWNER_ALERTS_SEEN_V1:${encodeURIComponent(tenantId)}`;
const ownerAlertInflight = new Map();
const ownerAlertBackoff = new Map();

function readOwnerAlertSeen(tenantId) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ownerAlertKey(tenantId)) || "null");
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === "string") : null;
  } catch {
    return null;
  }
}

function writeOwnerAlertSeen(tenantId, ids) {
  try {
    window.localStorage.setItem(ownerAlertKey(tenantId), JSON.stringify(ids.slice(0, OWNER_ALERT_SEEN_LIMIT)));
  } catch (error) {
    console.warn("Owner alert history could not be saved on this device.", error);
  }
}

// Pure: given the outbox rows and the ids already alerted on this device, returns the rows to
// alert now and the updated id list. The first poll on a device only records the existing
// backlog (the unread count still shows it) so reinstalling never replays old alerts.
export function selectFreshOwnerAlerts(notifications, seenIds) {
  const rows = Array.isArray(notifications)
    ? notifications.filter(row => row && typeof row.id === "string")
    : [];
  const seen = new Set(seenIds || []);
  const fresh = seenIds === null || seenIds === undefined
    ? []
    : rows.filter(row => !row.read_at && !seen.has(row.id));
  const next = [...rows.map(row => row.id), ...(seenIds || []).filter(id => !rows.some(row => row.id === id))];
  return { fresh, seenIds: [...new Set(next)].slice(0, OWNER_ALERT_SEEN_LIMIT) };
}

async function fetchOwnerAlerts(tenantId, limit) {
  const controller = window.AppController;
  if (!controller?.cloudflareRequest) throw new Error("The shop connection is not ready.");
  const result = await controller.cloudflareRequest(
    `/api/store/notifications?tenant=${encodeURIComponent(tenantId)}&limit=${Math.min(100, Math.max(1, Number(limit) || 50))}`,
    {}, tenantId
  );
  return {
    notifications: Array.isArray(result.notifications) ? result.notifications : [],
    unread_count: Number(result.unread_count) || 0
  };
}

window.BusinessNotifications.owner = {
  pollIntervalMs: OWNER_ALERT_POLL_MS,
  // For the alerts list: rows the owner is looking at must not toast again on the next poll.
  async list(tenantId, limit = 50) {
    const listed = await fetchOwnerAlerts(tenantId, limit);
    writeOwnerAlertSeen(tenantId, selectFreshOwnerAlerts(listed.notifications, readOwnerAlertSeen(tenantId)).seenIds);
    return listed;
  },
  async markRead(tenantId, target = "all") {
    const controller = window.AppController;
    if (!controller?.cloudflareRequest) throw new Error("The shop connection is not ready.");
    const body = target === "all" ? { all: true } : { ids: [].concat(target) };
    await controller.cloudflareRequest(
      `/api/store/notifications/read?tenant=${encodeURIComponent(tenantId)}`,
      { method: "POST", body: JSON.stringify(body) }, tenantId
    );
  },
  // Resolves to { fresh, unread_count, notifications } or null when polling is skipped.
  // Overlapping calls share one request, and a failing shop backs off instead of retrying hot.
  poll(tenantId) {
    const controller = window.AppController;
    if (!tenantId || !controller?.cloudflareRequest || controller.isWebsiteBuilderDraftTenant?.(tenantId)) {
      return Promise.resolve(null);
    }
    if (navigator.onLine === false) return Promise.resolve(null);
    if (!controller.cloudflareConnection?.(tenantId)?.token) return Promise.resolve(null);
    const backoff = ownerAlertBackoff.get(tenantId);
    if (backoff && Date.now() < backoff.until) return Promise.resolve(null);
    if (ownerAlertInflight.has(tenantId)) return ownerAlertInflight.get(tenantId);
    const task = (async () => {
      try {
        const listed = await fetchOwnerAlerts(tenantId, 50);
        ownerAlertBackoff.delete(tenantId);
        const selected = selectFreshOwnerAlerts(listed.notifications, readOwnerAlertSeen(tenantId));
        writeOwnerAlertSeen(tenantId, selected.seenIds);
        return { fresh: selected.fresh, unread_count: listed.unread_count, notifications: listed.notifications };
      } catch (error) {
        const failures = (backoff?.failures || 0) + 1;
        ownerAlertBackoff.set(tenantId, {
          failures,
          until: Date.now() + Math.min(OWNER_ALERT_MAX_BACKOFF_MS, OWNER_ALERT_POLL_MS * 2 ** Math.min(failures, 4))
        });
        console.warn("Owner alerts could not be checked.", error instanceof Error ? error.message : error);
        return null;
      } finally {
        ownerAlertInflight.delete(tenantId);
      }
    })();
    ownerAlertInflight.set(tenantId, task);
    return task;
  }
};
