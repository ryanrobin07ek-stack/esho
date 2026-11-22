// Paystack setup wiring.
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppController, AppUtils } from './main.js';

export const paystackSetupBindings = {
  async bindPaystackSetup(container, tenantId) {
    const form = container.querySelector("[data-paystack-setup]");
    if (!form) return;
    const status = container.querySelector("[data-paystack-status]");
    const formStatus = container.querySelector("[data-paystack-form-status]");
    const bankSelect = form.elements.namedItem("settlement_bank");
    const submit = form.querySelector("[data-paystack-submit]");
    const retry = form.querySelector("[data-paystack-retry]");
    if (submit) submit.disabled = true;
    const loadSetup = async () => {
      if (retry) retry.disabled = true;
      if (bankSelect) bankSelect.innerHTML = `<option value="">Loading banks…</option>`;
      const [setupResult, banksResult, defaultResult] = await Promise.allSettled([
        window.EshopInventoryBridge.getPaystackAccount(tenantId),
        window.EshopInventoryBridge.getPaystackBanks(tenantId, form.dataset.currency || "KES"),
        window.EshopInventoryBridge.getPaystackDefault(tenantId)
      ]);
      const setup = setupResult.status === "fulfilled" ? setupResult.value : null;
      const account = setup?.account || { connected: false };
      const accountModeLabel = account.account_mode === "live"
        ? account.is_verified ? "Live · verified" : "Live · not verified"
        : account.account_mode === "test" ? "Test mode" : "mode unknown";
      const defaultAccount = defaultResult.status === "fulfilled" ? defaultResult.value.default_account : null;
      const banks = banksResult.status === "fulfilled" ? banksResult.value.banks : null;
      if (status) status.textContent = setupResult.status === "rejected"
        ? "Shop owner access required"
        : account.connected
          ? `Connected · ${accountModeLabel} · ${account.bank_name} ·••${account.account_last4}`
          : defaultAccount
            ? `Default · ${defaultAccount.bank_name} ·••${defaultAccount.account_last4}`
          : account.status ? `Account status: ${account.status}` : "Not connected";
      if (banks?.length) {
        bankSelect.innerHTML = `<option value="">Choose a bank</option>${banks.map(bank =>
          `<option value="${AppUtils.escapeHTML(bank.code)}">${AppUtils.escapeHTML(bank.name)}</option>`).join("")}`;
      } else {
        bankSelect.innerHTML = `<option value="">Bank list unavailable</option>`;
      }
      if (submit) {
        submit.textContent = account.configured ? "Update account" : "Connect account";
        submit.disabled = setupResult.status !== "fulfilled" || !banks?.length;
      }
      const errors = [
        ...(setupResult.status === "rejected" ? [setupResult.reason] : []),
        ...(banksResult.status === "rejected" ? [banksResult.reason] : []),
        ...(banksResult.status === "fulfilled" && !banks?.length ? [new Error("No supported banks were returned.")] : [])
      ];
      if (formStatus) {
        formStatus.textContent = errors.length
          ? errors.map(error => error instanceof Error ? error.message : String(error)).join(" ")
          : account.connected
            ? account.account_mode === "live" && !account.is_verified
              ? "Live account is not verified by Paystack; live checkout is disabled."
              : account.account_mode === "test"
                ? "Test account only. It cannot receive live payments."
                : "Live account is verified and ready for live checkout."
            : "";
        if (errors.length) console.error("Payment account setup could not be loaded.", errors);
      }
      if (defaultResult.status === "rejected") {
        console.warn("The app-wide default Paystack account could not be loaded.", defaultResult.reason);
      }
      const loaded = setupResult.status === "fulfilled" && !!banks?.length;
      if (retry) {
        retry.hidden = loaded;
        retry.disabled = false;
      }
      return loaded;
    };
    retry?.addEventListener("click", () => { void loadSetup(); });
    void this.bindPaystackReuseSetup(container, tenantId);
    if (!await loadSetup()) return;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      submit.disabled = true;
      if (formStatus) formStatus.textContent = "Sending details securely…";
      const values = Object.fromEntries(new FormData(form).entries());
      try {
        const result = await window.EshopInventoryBridge.savePaystackAccount(tenantId, values);
        const account = result.account;
        form.reset();
        const accountModeLabel = account.account_mode === "live"
          ? account.is_verified ? "Live · verified" : "Live · not verified"
          : account.account_mode === "test" ? "Test mode" : "mode unknown";
        if (status) status.textContent =
          `Connected · ${accountModeLabel} · ${account.bank_name} ·••${account.account_last4}`;
        let defaultSaved = false;
        const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
        const sourceTenant = AppController.tenantCatalogs().find(tenant => tenant.tenant_id === tenantId);
        if (sessionToken && sourceTenant?.owner_token) {
          try {
            await window.EshopInventoryBridge.setPaystackDefault(
              tenantId, tenantId, sourceTenant.owner_token, sessionToken
            );
            defaultSaved = true;
          } catch (error) {
            console.error("Payment account was connected, but the default could not be saved.", error);
          }
        }
        if (formStatus) formStatus.textContent = defaultSaved
          ? account.account_mode === "live" && account.is_verified
            ? "Verified live account connected and set as the default for your websites."
            : "Account set as default, but live checkout remains disabled until a verified live account is connected."
          : account.account_mode === "live" && account.is_verified
            ? "Verified live account connected. Choose it below to use it for your websites."
            : "Account connected, but live checkout remains disabled until a verified live account is connected.";
        if (submit) submit.textContent = "Update account";
      } catch (error) {
        console.error("Payment account setup failed.", error);
        if (formStatus) formStatus.textContent = "Could not connect account. Check details and retry.";
      } finally {
        submit.disabled = false;
      }
    });
  },

  async bindPaystackReuseSetup(container, tenantId) {
    const form = container.querySelector("[data-paystack-reuse]");
    if (!form) return;
    const select = form.elements.namedItem("source_tenant_id");
    const status = form.querySelector("[data-paystack-reuse-status]");
    const submit = form.querySelector("[data-paystack-reuse-submit]");
    const candidates = AppController.tenantCatalogs().filter(tenant => tenant.owner_token);
    if (!candidates.length) {
      if (status) status.textContent = "No saved shop accounts are available.";
      return;
    }
    select.innerHTML = `<option value="">Checking accounts…</option>`;
    const results = await Promise.allSettled(candidates.map(async tenant => {
      const result = await window.EshopInventoryBridge.getPaystackAccount(tenant.tenant_id);
      return result.account?.connected ? { tenant, account: result.account } : null;
    }));
    const accounts = results
      .filter(result => result.status === "fulfilled" && result.value)
      .map(result => result.value);
    const errors = results.filter(result => result.status === "rejected");
    if (!accounts.length) {
      select.innerHTML = `<option value="">No connected accounts found</option>`;
      if (status) status.textContent = errors.length
        ? "Could not check saved shops. Check your connection and reload."
        : "Connect an account in a shop's Payments settings, then choose it here.";
      return;
    }
    select.innerHTML = `<option value="">Choose an account</option>${accounts.map(({ tenant, account }) =>
      `<option value="${AppUtils.escapeHTML(tenant.tenant_id)}">${AppUtils.escapeHTML(tenant.name || tenant.tenant_id)} · ${AppUtils.escapeHTML(account.bank_name)} ·••${AppUtils.escapeHTML(account.account_last4)}</option>`
    ).join("")}`;
    try {
      const currentDefault = await window.EshopInventoryBridge.getPaystackDefault(tenantId);
      if (currentDefault.default_account) {
        select.value = currentDefault.default_account.tenant_id;
        if (status) status.textContent = `Default: ${currentDefault.default_account.bank_name} ·••${currentDefault.default_account.account_last4}`;
      }
    } catch (error) {
      if (status) status.textContent = error instanceof Error
        ? error.message
        : "Could not load the default account.";
    }
    form.hidden = false;
    form.style.display = "grid";
    if (status) status.textContent = errors.length
      ? "Some of your saved shops could not be checked; listed accounts are available for reuse."
      : "";
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      if (status) status.textContent = "Saving default account…";
      try {
        const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
        const sourceTenantId = String(select.value || "");
        if (!sessionToken || !sourceTenantId) throw new Error("Sign in and choose a connected shop account.");
        const sourceTenant = candidates.find(tenant => tenant.tenant_id === sourceTenantId);
        if (!sourceTenant?.owner_token) throw new Error("The selected shop's private key is not available on this device.");
        const result = await window.EshopInventoryBridge.setPaystackDefault(
          tenantId, sourceTenantId, sourceTenant.owner_token, sessionToken
        );
        const source = accounts.find(item => item.tenant.tenant_id === sourceTenantId);
        const accountStatus = container.querySelector("[data-paystack-status]");
        if (accountStatus && source) {
          accountStatus.textContent = `Connected · ${source.account.bank_name} ·••${source.account.account_last4}`;
        }
        if (status) status.textContent = `Default account saved for websites without a separate account.`;
        return result;
      } catch (error) {
        console.error("Default payment account could not be saved.", error);
        if (status) status.textContent = "Could not save this account. Check access and retry.";
      } finally {
        submit.disabled = false;
      }
    });
  },
};
