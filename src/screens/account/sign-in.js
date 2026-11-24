// Craft account screen (/app-account): sign in, Google sign-in, recovery email.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, StudioRenderers } from '../../app/main.js';

export const signInScreen = {
  renderAppAccount() {
    const username = window.localStorage.getItem("ESHOP_ACCOUNT_USERNAME_V1") || "";
    const recoveryEmail = window.localStorage.getItem("ESHOP_ACCOUNT_EMAIL_V1") || "";
    const signedIn = Boolean(window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") && username);
    const accountQuery = new URLSearchParams((window.location.hash.split("?")[1] || ""));
    const googleError = accountQuery.get("google_error") || "";
    const googleStatus = googleError === "cancelled"
      ? "Google sign-in was cancelled."
      : googleError === "existing_account"
        ? "A Craft account already uses this Google email. Sign in with your Craft username and password, then link Google from this screen."
        : googleError === "linked_elsewhere"
          ? "That Google account is already linked to a different Craft account."
          : googleError
            ? "Google sign-in could not be completed. Please try again."
            : accountQuery.has("google_linked")
              ? "Google account linked. You can now use it to sign in."
              : "";
    AppUtils.updateSEO({ title: "App account — Craft", description: "Create or sign in to your Craft app account." });
    return `
      <main class="app-account-screen" aria-label="Craft app account">
        <header class="app-account-header">
          <p class="app-account-kicker">Craft · Account</p>
          <h1 class="app-account-title">Your app account</h1>
          <p class="app-account-description">Sign in once to use your account in POS and Web Builder.</p>
        </header>
        ${googleStatus ? `<p class="profile-page-card" role="${googleError ? "alert" : "status"}">${AppUtils.escapeHTML(googleStatus)}</p>` : ""}
        <section class="profile-page-content" aria-label="App account">
          ${signedIn ? `
            <article class="profile-page-card">
              <h2>Account</h2>
              <p>Username: <strong>${AppUtils.escapeHTML(username)}</strong></p>
              <form id="app-account-recovery-email-form" class="app-account-form">
                <label class="form-field"><span class="form-label">Recovery email</span><input class="form-input" name="email" type="email" required maxlength="254" autocomplete="email" value="${AppUtils.escapeHTML(recoveryEmail)}" placeholder="you@example.com"></label>
                <label class="form-field"><span class="form-label">Current password</span><input class="form-input" name="password" type="password" required minlength="12" maxlength="128" autocomplete="current-password" placeholder="Confirm your password"></label>
                <label class="form-field" id="app-account-recovery-code-field" hidden><span class="form-label">Code from the email</span><input class="form-input" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" placeholder="6-digit code"></label>
                <p id="app-account-recovery-email-status" role="status" hidden style="color:var(--text-muted);margin:0;"></p>
                <p id="app-account-recovery-email-error" role="alert" hidden style="color:#b42318;margin:0;"></p>
                <button class="btn-secondary" type="submit">Save recovery email</button>
              </form>
              <div class="profile-website-actions">
                <button class="btn-secondary" type="button" id="app-account-google-link">Link Google account</button>
                <a class="btn-primary" href="/pos" data-route="/pos">Open POS</a>
                <a class="btn-secondary" href="/account" data-route="/account">Open Web Builder</a>
                <button class="btn-secondary" type="button" id="app-account-signout">Sign out</button>
              </div>
            </article>
          ` : `
            <form id="app-account-form" data-auth-mode="login" class="app-account-form">
              <article class="profile-page-card app-account-form">
                <h2 id="app-account-heading">Sign in to your app account</h2>
                <div class="app-account-mode">
                  <button class="btn-secondary" type="button" data-app-auth-mode="register" aria-pressed="false">Create account</button>
                  <button class="btn-primary" type="button" data-app-auth-mode="login" aria-pressed="true">Sign in</button>
                </div>
                <label class="form-field"><span class="form-label">Username</span><input class="form-input" name="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]+" autocomplete="username" placeholder="Choose a username"></label>
                <label class="form-field" id="app-account-email-field" hidden><span class="form-label">Recovery email</span><input class="form-input" name="email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com"></label>
                <label class="form-field"><span class="form-label">Password</span><span class="app-account-password-row"><input class="form-input" name="password" type="password" required minlength="12" maxlength="128" autocomplete="current-password" placeholder="Password"><button class="btn-secondary app-account-password-toggle" type="button" data-app-toggle-password="password" aria-label="Show password">Show</button></span></label>
                <label class="form-field" id="app-account-confirm-field" hidden><span class="form-label">Confirm password</span><span class="app-account-password-row"><input class="form-input" name="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="Enter password again"><button class="btn-secondary app-account-password-toggle" type="button" data-app-toggle-password="confirmPassword" aria-label="Show confirm password">Show</button></span></label>
                <div id="app-account-turnstile" hidden style="min-height:65px;" aria-label="Cloudflare human verification"></div>
                <p id="app-account-verification-help" role="status" hidden style="color:var(--text-muted);margin:0;"></p>
                <p id="app-account-error" role="alert" hidden style="color:#b42318;margin:0;"></p>
                <button class="btn-primary app-account-submit" type="submit">Sign in</button>
                <button class="btn-secondary" type="button" id="app-account-google">Continue with Google</button>
                <button class="btn-secondary" type="button" id="app-account-forgot-password">Forgot password?</button>
              </article>
            </form>
            <article class="profile-page-card app-account-form" id="app-account-recovery" hidden>
              <h2>Password recovery</h2>
              <p id="app-account-recovery-status" role="status">Enter the recovery email you used when creating your account.</p>
              <label class="form-field" id="app-account-recovery-email-field"><span class="form-label">Recovery email</span><input class="form-input" id="app-account-recovery-email" type="email" maxlength="254" autocomplete="email" required placeholder="you@example.com"></label>
              <button class="btn-primary" type="button" id="app-account-send-reset-code">Send recovery code</button>
              <label class="form-field" id="app-account-recovery-code-field" hidden><span class="form-label">6-digit code</span><input class="form-input" id="app-account-recovery-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456"></label>
              <button class="btn-primary" type="button" id="app-account-verify-reset-code" hidden>Verify code</button>
              <label class="form-field" id="app-account-new-password-field" hidden><span class="form-label">New password</span><input class="form-input" id="app-account-new-password" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="At least 12 characters"></label>
              <label class="form-field" id="app-account-confirm-new-password-field" hidden><span class="form-label">Confirm new password</span><input class="form-input" id="app-account-confirm-new-password" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="Enter password again"></label>
              <button class="btn-primary" type="button" id="app-account-reset-password" hidden>Reset password</button>
              <p id="app-account-recovery-error" role="alert" hidden style="color:#b42318;margin:0;"></p>
              <button class="btn-secondary" type="button" id="app-account-recovery-cancel">Back to sign in</button>
            </article>
          `}
          <article class="profile-page-card app-account-note">
            <h2>Your app data</h2>
            <p>Your recovery email is used only for password recovery, not marketing. Signing in makes your account available throughout the app. Your POS sales and inventory remain on this device; signing in does not upload or sync them.</p>
          </article>
        </section>
      </main>
    `;
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StudioRenderers.renderAppAccount(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root) {
  root.innerHTML = StudioRenderers.renderAppAccount();
}

export function unmount() {}
