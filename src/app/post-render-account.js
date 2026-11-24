// Account sign-in wiring: Google sign-in, the app account form, recovery email and sign-out.
// Moved verbatim out of AppController.postRenderSetup in src/app/main.js; it is called there with this = AppController.
import { AppUtils } from './main.js';

export function bindAccountSignIn() {
  const googleAuthParams = new URLSearchParams(this.currentRoute().split("?")[1] || "");
  const googleTicket = googleAuthParams.get("google_ticket");
  // A ticket is good for one use. The page can render twice while it is still in the address, and the second pass
  // would try the used ticket, fail, and show an error on top of a sign-in that had just worked.
  this.handledGoogleTickets = this.handledGoogleTickets || new Set();
  if (googleTicket && !this.googleAuthCompleting && !this.handledGoogleTickets.has(googleTicket)) {
    this.handledGoogleTickets.add(googleTicket);
    this.googleAuthCompleting = true;
    void (async () => {
      try {
        const completionSecret = window.localStorage.getItem("ESHOP_GOOGLE_AUTH_COMPLETION_SECRET_V1") || "";
        window.localStorage.removeItem("ESHOP_GOOGLE_AUTH_COMPLETION_SECRET_V1");
        const result = await this.cloudflareRequest(
          "/api/auth/google/complete",
          {
            method: "POST",
            body: JSON.stringify({ ticket: googleTicket, completion_secret: completionSecret })
          },
          "main",
          true
        );
        if (!result.ok || !result.session_token) throw new Error("Craft could not complete Google sign-in.");
        window.localStorage.setItem("ESHOP_ACCOUNT_SESSION_V1", result.session_token);
        window.localStorage.setItem("ESHOP_ACCOUNT_USERNAME_V1", result.username || "");
        window.localStorage.setItem("ESHOP_ACCOUNT_EMAIL_V1", result.email || "");
        await this.restoreAccountWebsites(result.tenants, this.cloudflareConnection("main").origin);
        this.navigate(`/app-account?${result.google_linked ? "google_linked=1" : ""}`);
      } catch (error) {
        console.error("Google sign-in could not be completed.", error);
        this.navigate("/app-account?google_error=failed");
      } finally {
        this.googleAuthCompleting = false;
      }
    })();
  }
  if (googleAuthParams.has("google_error")) {
    window.localStorage.removeItem("ESHOP_GOOGLE_AUTH_COMPLETION_SECRET_V1");
  }
  const startGoogleAuth = async (button, mode) => {
    if (!button) return;
    button.disabled = true;
    try {
      const sessionToken = mode === "link"
        ? window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || ""
        : "";
      const result = await this.cloudflareRequest(
        "/api/auth/google/start",
        {
          method: "POST",
          body: JSON.stringify({
            mode,
            native: window.Capacitor?.isNativePlatform?.() === true
          })
        },
        "main",
        mode !== "link",
        sessionToken
      );
      if (!result.authorization_url) throw new Error("Google did not provide a sign-in link.");
      if (!result.completion_secret) throw new Error("Craft did not provide a secure sign-in verifier.");
      window.localStorage.setItem("ESHOP_GOOGLE_AUTH_COMPLETION_SECRET_V1", result.completion_secret);
      if (window.Capacitor?.isNativePlatform?.()) {
        if (!window.EshopAuthBrowser?.open) {
          throw new Error("Secure Google sign-in is unavailable. Update the Craft app and try again.");
        }
        await window.EshopAuthBrowser.open({ url: result.authorization_url });
        return;
      }
      window.location.assign(result.authorization_url);
    } catch (error) {
      console.error("Google account sign-in could not be started.", error);
      const accountError = document.getElementById("app-account-error");
      if (accountError) {
        accountError.textContent = error.message || "Google sign-in could not be started.";
        accountError.hidden = false;
      } else {
        AppUtils.showToast(error.message || "Google sign-in could not be started.", "danger");
      }
      button.disabled = false;
    }
  };
  document.getElementById("app-account-google")?.addEventListener("click", event => {
    void startGoogleAuth(event.currentTarget, "login");
  });
  document.getElementById("app-account-google-link")?.addEventListener("click", event => {
    void startGoogleAuth(event.currentTarget, "link");
  });
  const appAccountForm = document.getElementById("app-account-form");
  if (appAccountForm) {
    const accountError = document.getElementById("app-account-error");
    const passwordField = appAccountForm.elements.namedItem("password");
    const confirmField = appAccountForm.elements.namedItem("confirmPassword");
    const emailField = appAccountForm.elements.namedItem("email");
    const emailContainer = document.getElementById("app-account-email-field");
    const confirmContainer = document.getElementById("app-account-confirm-field");
    const forgotPasswordButton = document.getElementById("app-account-forgot-password");
    const recoveryPanel = document.getElementById("app-account-recovery");
    const turnstileContainer = document.getElementById("app-account-turnstile");
    const verificationHelp = document.getElementById("app-account-verification-help");
    const submitButton = appAccountForm.querySelector('button[type="submit"]');
    let turnstileWidgetId = null;
    let turnstileSetupStarted = false;
    let turnstileRequested = false;
    let turnstileToken = "";
    let autoSubmitEnabled = true;
    let authSubmitting = false;
    const getWorkerOrigin = () => this.cloudflareConnection("main").origin;
    const setAuthMode = mode => {
      const registering = mode === "register";
      appAccountForm.dataset.authMode = registering ? "register" : "login";
      accountError.hidden = true;
      accountError.textContent = "";
      verificationHelp.hidden = true;
      verificationHelp.textContent = "";
      emailContainer.hidden = !registering;
      emailField.required = registering;
      confirmContainer.hidden = !registering;
      turnstileContainer.hidden = !registering || !turnstileRequested;
      if (!registering) {
        turnstileRequested = false;
        turnstileToken = "";
        if (turnstileWidgetId !== null) window.turnstile?.reset(turnstileWidgetId);
      }
      confirmField.required = registering;
      confirmField.value = "";
      passwordField.autocomplete = registering ? "new-password" : "current-password";
      document.getElementById("app-account-heading").textContent = registering
        ? "Create your app account"
        : "Sign in to your app account";
      submitButton.textContent = appAccountForm.dataset.authMode === "register" ? "Create app account" : "Sign in";
      forgotPasswordButton.hidden = registering;
      appAccountForm.querySelectorAll("[data-app-auth-mode]").forEach(button => {
        const active = button.dataset.appAuthMode === (registering ? "register" : "login");
        button.setAttribute("aria-pressed", String(active));
        button.className = active ? "btn-primary" : "btn-secondary";
      });
    };
    const fetchAuth = async (endpoint, body) => {
      let response;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
        response = await fetch(new URL(endpoint, getWorkerOrigin()), {
          method: body ? "POST" : "GET",
          headers: body ? { "Content-Type": "application/json" } : {},
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal
        });
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        throw new Error(error.name === "AbortError"
          ? "Cloudflare account service took too long to respond. Check your connection and try again."
          : `Could not connect to Cloudflare account service. Check internet access and the Worker URL. ${error.message || ""}`.trim());
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const codes = Array.isArray(result.error_codes) && result.error_codes.length
          ? ` (${result.error_codes.join(", ")})`
          : "";
        const error = new Error(`${result.error || `Account service returned HTTP ${response.status}.`}${codes}`);
        error.status = response.status;
        throw error;
      }
      return result;
    };
    appAccountForm.querySelectorAll("[data-app-auth-mode]").forEach(button => {
      button.onclick = () => {
        const registering = button.dataset.appAuthMode === "register";
        setAuthMode(button.dataset.appAuthMode);
        if (!registering) return;
      };
    });
    const updateTurnstileVisibility = () => {
      const registering = appAccountForm.dataset.authMode === "register";
      const fieldsValid = appAccountForm.elements.namedItem("username").checkValidity()
        && passwordField.checkValidity()
        && confirmField.checkValidity()
        && passwordField.value === confirmField.value;
      const shouldShow = registering && fieldsValid;
      if (!shouldShow) {
        turnstileRequested = false;
        turnstileToken = "";
        turnstileContainer.hidden = true;
        verificationHelp.hidden = true;
        if (turnstileWidgetId !== null) window.turnstile?.reset(turnstileWidgetId);
        return;
      }
      if (turnstileRequested) return;
      turnstileRequested = true;
      turnstileContainer.hidden = false;
      void configureTurnstile();
    };
    appAccountForm.addEventListener("input", () => {
      autoSubmitEnabled = true;
      accountError.hidden = true;
      updateTurnstileVisibility();
    });
    appAccountForm.querySelectorAll("[data-app-toggle-password]").forEach(button => {
      button.onclick = () => {
        const field = appAccountForm.elements.namedItem(button.dataset.appTogglePassword);
        if (!field) return;
        const visible = field.type === "password";
        field.type = visible ? "text" : "password";
        button.textContent = visible ? "Hide" : "Show";
        button.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${button.dataset.appTogglePassword === "password" ? "password" : "confirm password"}`);
      };
    });
    const configureTurnstile = async () => {
      if (turnstileWidgetId !== null || turnstileSetupStarted) return;
      turnstileSetupStarted = true;
      const widget = document.getElementById("app-account-turnstile");
      try {
        const config = await fetchAuth("/api/auth/config");
        if (!config.turnstile_site_key) throw new Error("Human verification is not configured yet. Please try again later.");
        if (!window.turnstile) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.async = true;
            script.defer = true;
            const timeout = setTimeout(() => reject(new Error("Cloudflare verification is taking too long to load. Check your connection and try again.")), 15000);
            script.onload = () => { clearTimeout(timeout); resolve(); };
            script.onerror = () => { clearTimeout(timeout); reject(new Error("Cloudflare human verification could not be loaded.")); };
            document.head.appendChild(script);
          });
        }
        if (!turnstileRequested || appAccountForm.dataset.authMode !== "register") return;
        turnstileWidgetId = window.turnstile.render(widget, {
          sitekey: config.turnstile_site_key,
          appearance: "always",
          callback(token) {
            turnstileToken = token;
            accountError.hidden = true;
            verificationHelp.textContent = autoSubmitEnabled
              ? "Verification complete. Creating your account…"
              : "Verification refreshed. Tap Create app account to try again.";
            verificationHelp.hidden = false;
            if (autoSubmitEnabled && !authSubmitting) appAccountForm.requestSubmit(submitButton);
          },
          "expired-callback"() { turnstileToken = ""; },
          "error-callback"(code) {
            turnstileToken = "";
            widget.classList.add("app-account-turnstile-error");
            widget.setAttribute("role", "alert");
            widget.textContent = `Cloudflare verification failed${code ? ` (${code})` : ""}. Check the site key and allowed hostnames, including localhost for Android.`;
          }
        });
      } catch (error) {
        widget.textContent = error.message || "Cloudflare human verification is unavailable.";
        widget.setAttribute("role", "alert");
        console.error("Turnstile could not be initialized.", error);
      } finally {
        turnstileSetupStarted = false;
      }
    };
    setAuthMode("login");
    appAccountForm.onsubmit = async event => {
      event.preventDefault();
      if (authSubmitting) return;
      const formData = new FormData(appAccountForm);
      const username = String(formData.get("username") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");
      const confirmPassword = String(formData.get("confirmPassword") || "");
      const registering = appAccountForm.dataset.authMode === "register";
      accountError.hidden = true;
      if (registering && password !== confirmPassword) {
        accountError.textContent = "The passwords do not match.";
        accountError.hidden = false;
        return;
      }
      if (registering && !turnstileToken) {
        accountError.textContent = "Complete the Cloudflare checkbox to create your account.";
        accountError.hidden = false;
        return;
      }
      authSubmitting = true;
      submitButton.disabled = true;
      submitButton.textContent = registering ? "Creating account…" : "Signing in…";
      try {
        const origin = getWorkerOrigin();
        const result = await fetchAuth(`/api/auth/${registering ? "register" : "login"}`, {
          username,
          password,
          ...(registering ? {
            email: String(formData.get("email") || "").trim(),
            turnstile_token: turnstileToken
          } : {})
        });
        if (!result.ok || !result.session_token) throw new Error("The account service did not create a secure session.");
        window.localStorage.setItem("ESHOP_ACCOUNT_SESSION_V1", result.session_token);
        window.localStorage.setItem("ESHOP_ACCOUNT_USERNAME_V1", result.username || username);
        window.localStorage.setItem("ESHOP_ACCOUNT_EMAIL_V1", result.email || "");
        await this.restoreAccountWebsites(result.tenants, origin);
        AppUtils.showToast(registering ? "Your Craft app account is ready." : "You are signed in.");
        const continueTo = new URLSearchParams(this.currentRoute().split("?")[1] || "").get("continue") || "";
        if (continueTo.startsWith("/account/web/site?new=1&finish=1&theme=") ||
            continueTo.startsWith("/account/web/site?new=1&theme=")) this.navigate(continueTo);
        else this.handleRoute("/app-account");
      } catch (error) {
        console.error("App account sign-in failed.", error);
        if (registering && error.status === 409) {
          setAuthMode("login");
          accountError.textContent = "This account already exists. Sign in to keep using it—no new account is needed.";
          accountError.hidden = false;
          return;
        }
        accountError.textContent = error.message || "Could not sign in to the app account.";
        accountError.hidden = false;
        if (registering) {
          autoSubmitEnabled = false;
          turnstileToken = "";
          if (turnstileWidgetId !== null) window.turnstile?.reset(turnstileWidgetId);
        }
      } finally {
        authSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = registering ? "Create app account" : "Sign in";
      }
    };
    const recoveryEmail = document.getElementById("app-account-recovery-email");
    const recoveryCode = document.getElementById("app-account-recovery-code");
    const recoveryError = document.getElementById("app-account-recovery-error");
    const recoveryStatus = document.getElementById("app-account-recovery-status");
    const recoveryStepFields = [
      ["app-account-recovery-code-field", "app-account-verify-reset-code"],
      ["app-account-new-password-field", "app-account-confirm-new-password-field", "app-account-reset-password"]
    ];
    let resetToken = "";
    const showRecoveryStep = step => {
      recoveryStepFields.forEach((fields, index) => {
        fields.forEach(id => { document.getElementById(id).hidden = index !== step - 1; });
      });
      document.getElementById("app-account-recovery-email-field").hidden = step >= 2;
      document.getElementById("app-account-send-reset-code").hidden = step >= 1;
    };
    const showRecoveryError = error => {
      recoveryError.textContent = error.message || "Could not reset the password.";
      recoveryError.hidden = false;
    };
    forgotPasswordButton.onclick = () => {
      recoveryError.hidden = true;
      recoveryEmail.value = emailField.value.trim();
      resetToken = "";
      showRecoveryStep(0);
      appAccountForm.hidden = true;
      recoveryPanel.hidden = false;
      recoveryEmail.focus();
    };
    document.getElementById("app-account-recovery-cancel").onclick = () => {
      recoveryPanel.hidden = true;
      appAccountForm.hidden = false;
      recoveryError.hidden = true;
      resetToken = "";
    };
    document.getElementById("app-account-send-reset-code").onclick = async event => {
      const button = event.currentTarget;
      recoveryError.hidden = true;
      if (!recoveryEmail.reportValidity()) return;
      button.disabled = true;
      button.textContent = "Sending code…";
      try {
        const result = await fetchAuth("/api/auth/request-reset-code", { email: recoveryEmail.value.trim() });
        recoveryStatus.textContent = result.message || "If an account uses that email, a reset code will arrive shortly.";
        recoveryCode.required = true;
        showRecoveryStep(1);
        recoveryCode.focus();
      } catch (error) {
        showRecoveryError(error);
      } finally {
        button.disabled = false;
        button.textContent = "Send recovery code";
      }
    };
    document.getElementById("app-account-verify-reset-code").onclick = async event => {
      const button = event.currentTarget;
      recoveryError.hidden = true;
      if (!recoveryCode.reportValidity()) return;
      button.disabled = true;
      button.textContent = "Verifying…";
      try {
        const result = await fetchAuth("/api/auth/verify-reset-code", {
          email: recoveryEmail.value.trim(),
          code: recoveryCode.value.trim()
        });
        if (!result.reset_token) throw new Error("The recovery code was not accepted.");
        resetToken = result.reset_token;
        recoveryCode.required = false;
        showRecoveryStep(2);
        document.getElementById("app-account-new-password").focus();
      } catch (error) {
        showRecoveryError(error);
      } finally {
        button.disabled = false;
        button.textContent = "Verify code";
      }
    };
    document.getElementById("app-account-reset-password").onclick = async event => {
      const button = event.currentTarget;
      const newPassword = document.getElementById("app-account-new-password");
      const confirmNewPassword = document.getElementById("app-account-confirm-new-password");
      recoveryError.hidden = true;
      if (!newPassword.reportValidity() || !confirmNewPassword.reportValidity()) return;
      if (newPassword.value !== confirmNewPassword.value) {
        showRecoveryError(new Error("The passwords do not match."));
        return;
      }
      button.disabled = true;
      button.textContent = "Resetting password…";
      try {
        const result = await fetchAuth("/api/auth/reset-password", {
          reset_token: resetToken,
          password: newPassword.value
        });
        recoveryStatus.textContent = result.message || "Your password has been reset. Sign in with your new password.";
        recoveryPanel.hidden = true;
        appAccountForm.hidden = false;
        setAuthMode("login");
        accountError.textContent = "Password reset. Sign in with your new password.";
        accountError.hidden = false;
        passwordField.value = "";
        newPassword.value = "";
        confirmNewPassword.value = "";
        resetToken = "";
      } catch (error) {
        showRecoveryError(error);
      } finally {
        button.disabled = false;
        button.textContent = "Reset password";
      }
    };
  }
  const appAccountSignout = document.getElementById("app-account-signout");
  const recoveryEmailForm = document.getElementById("app-account-recovery-email-form");
  if (recoveryEmailForm) {
    recoveryEmailForm.onsubmit = async event => {
      event.preventDefault();
      const button = recoveryEmailForm.querySelector('button[type="submit"]');
      const status = document.getElementById("app-account-recovery-email-status");
      const errorMessage = document.getElementById("app-account-recovery-email-error");
      const formData = new FormData(recoveryEmailForm);
      const codeField = document.getElementById("app-account-recovery-code-field");
      const code = String(formData.get("code") || "").trim();
      // Second step: the code that was emailed to the new address.
      const confirming = Boolean(codeField && !codeField.hidden && code);
      status.hidden = true;
      errorMessage.hidden = true;
      button.disabled = true;
      try {
        const response = await fetch(new URL(confirming ? "/api/auth/verify-recovery-email" : "/api/auth/set-recovery-email", this.cloudflareConnection("main").origin), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || ""}`
          },
          body: JSON.stringify(confirming ? { code } : {
            email: String(formData.get("email") || "").trim(),
            password: String(formData.get("password") || "")
          })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Account service returned HTTP ${response.status}.`);
        if (result.verification_required) {
          // The address is not saved yet: ask for the code that was sent to it.
          if (codeField) codeField.hidden = false;
          button.textContent = "Confirm recovery email";
          status.textContent = `We sent a 6-digit code to ${result.email}. Enter it above to save this address.`;
          status.hidden = false;
          return;
        }
        window.localStorage.setItem("ESHOP_ACCOUNT_EMAIL_V1", result.email || "");
        recoveryEmailForm.elements.namedItem("password").value = "";
        if (codeField) { codeField.hidden = true; recoveryEmailForm.elements.namedItem("code").value = ""; }
        button.textContent = "Save recovery email";
        status.textContent = "Recovery email saved. Use an address you can access to receive password reset codes.";
        status.hidden = false;
      } catch (error) {
        errorMessage.textContent = error.message || "Could not save the recovery email.";
        errorMessage.hidden = false;
      } finally {
        button.disabled = false;
      }
    };
  }
  if (appAccountSignout) {
    appAccountSignout.onclick = async () => {
      const session = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
      let revokeFailed = false;
      try {
        const response = await fetch(new URL("/api/auth/logout", this.cloudflareConnection("main").origin), {
          method: "POST",
          headers: { Authorization: `Bearer ${session}` }
        });
        if (!response.ok) throw new Error(`Account service returned HTTP ${response.status}.`);
      } catch (error) {
        console.error("Could not revoke the app account session remotely.", error);
        revokeFailed = true;
      }
      window.localStorage.removeItem("ESHOP_ACCOUNT_SESSION_V1");
      window.localStorage.removeItem("ESHOP_ACCOUNT_USERNAME_V1");
      window.localStorage.removeItem("ESHOP_ACCOUNT_EMAIL_V1");
      if (revokeFailed) AppUtils.showToast("Signed out on this device, but the server session could not be revoked.", "danger");
      else AppUtils.showToast("You are signed out.");
      this.navigate("/", true);
    };
  }
}
