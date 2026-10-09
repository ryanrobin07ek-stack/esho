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
