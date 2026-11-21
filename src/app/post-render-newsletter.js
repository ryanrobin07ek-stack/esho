// Storefront newsletter sign-up wiring.
// Moved verbatim out of AppController.postRenderSetup in src/app/main.js; it is called there with this = AppController.

export function bindNewsletterSignup() {
  const newsletterForm = document.getElementById("web-newsletter-signup");
  if (newsletterForm) {
    newsletterForm.querySelector("[data-enable-notifications]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = newsletterForm.querySelector('[role="status"]');
      button.disabled = true;
      try {
        const message = await window.BusinessNotifications.enable(this.getActiveTenant().id);
        if (status) status.textContent = message;
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not enable notifications.";
      } finally {
        button.disabled = false;
      }
    });
    newsletterForm.querySelector("[data-disable-notifications]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = newsletterForm.querySelector('[role="status"]');
      button.disabled = true;
      try {
        const message = await window.BusinessNotifications.disable(this.getActiveTenant().id);
        if (status) status.textContent = message;
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not turn notifications off.";
      } finally {
        button.disabled = false;
      }
    });
    newsletterForm.addEventListener("submit", async event => {
      event.preventDefault();
      const status = newsletterForm.querySelector('[role="status"]');
      const button = newsletterForm.querySelector('button[type="submit"]');
      const email = String(new FormData(newsletterForm).get("email") || "").trim().toLocaleLowerCase();
      if (button) button.disabled = true;
      if (status) status.textContent = "";
      try {
        const tenantId = this.getActiveTenant().id;
        const result = await this.cloudflareRequest(
          `/api/newsletter/subscribe?tenant=${encodeURIComponent(tenantId)}`,
          { method: "POST", body: JSON.stringify({ email, consent: true }) },
          tenantId,
          true
        );
        newsletterForm.reset();
        if (status) status.textContent = result.subscribed
          ? "This email is already subscribed."
          : "Check your email for a confirmation link to finish subscribing.";
      } catch (error) {
        console.error("Newsletter subscription could not be sent.", error);
        if (status) status.textContent = error instanceof Error ? error.message : "Could not send the subscription request.";
      } finally {
        if (button) button.disabled = false;
      }
    });
  }
}
