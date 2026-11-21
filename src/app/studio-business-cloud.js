// Business cloud actions (Main Store sync, orders, payments wiring).
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppController, AppUtils, SQLiteEngine } from './main.js';
import { bindDirectPayments } from '../screens/craft/direct-payments.js';

export const businessCloudActions = {
  bindBusinessCloudActions(container, path, snapshot, tenantId = AppController.getActiveTenant().id) {
    if (["/account/payments", "/account/web/studio/payments"].includes(path)) {
      this.bindPaystackSetup(container, tenantId);
      bindDirectPayments(container);
    }
    const websiteCurrencyForm = container.querySelector("[data-app-website-currency]");
    if (websiteCurrencyForm && window.Capacitor?.isNativePlatform?.() === true) {
      websiteCurrencyForm.addEventListener("submit", async event => {
        event.preventDefault();
        const status = websiteCurrencyForm.querySelector('[role="status"]');
        const submit = websiteCurrencyForm.querySelector('button[type="submit"]');
        const currency = String(new FormData(websiteCurrencyForm).get("currency") || "").trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) {
          if (status) status.textContent = "Choose a valid three-letter currency code.";
          return;
        }
        if (submit) submit.disabled = true;
        if (status) status.textContent = "Saving website currency…";
        try {
          const currencySymbol = new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency
          }).formatToParts(0).find(part => part.type === "currency")?.value || currency;
          SQLiteEngine.updateStore({ currency, currency_symbol: currencySymbol });
          AppController.cacheActiveTenantCatalog();
          if (!window.ShopSQLite) throw new Error("The app SQLite database is not ready.");
          await window.ShopSQLite.flush();
          if (status) status.textContent = `${currency} saved for this website. Product prices were not converted; publish the catalog to update the live site.`;
          AppUtils.showToast(`Website currency saved as ${currency}.`);
        } catch (error) {
          console.error("Website currency could not be saved.", error);
          if (status) status.textContent = error instanceof Error
            ? error.message
            : "Could not save the website currency.";
        } finally {
          if (submit) submit.disabled = false;
        }
      });
    }
    const branchesUrl = `/api/business/branches?tenant=${encodeURIComponent(tenantId)}`;
    const renderNewsletterSubscribers = (subscribers, actionStatus = "") => {
      const updatedSnapshot = { ...snapshot, remoteNewsletter: subscribers, remoteNewsletterError: "" };
      container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
      const status = container.querySelector("[data-newsletter-action-status]");
      if (status) status.textContent = actionStatus;
      this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
    };
    container.querySelector("[data-business-newsletter-refresh]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await window.EshopInventoryBridge.listNewsletterSubscribers(tenantId);
        const subscribers = Array.isArray(result.subscribers) ? result.subscribers : [];
        renderNewsletterSubscribers(subscribers, `${subscribers.length} subscriber${subscribers.length === 1 ? "" : "s"} loaded.`);
      } catch (error) {
        const note = container.querySelector(".studio-panel-note");
        if (note) note.textContent = error instanceof Error ? error.message : "Could not load newsletter subscribers.";
        button.disabled = false;
      }
    });
    const removeRemoteSubscribers = async ids => {
      const removedIds = new Set();
      const failures = [];
      for (const id of ids) {
        try {
          await window.EshopInventoryBridge.removeNewsletterSubscriber(tenantId, id);
          removedIds.add(String(id));
        } catch (error) {
          failures.push(error instanceof Error ? error.message : "A subscriber could not be removed.");
        }
      }
      const subscribers = (snapshot.remoteNewsletter || []).filter(subscriber => !removedIds.has(String(subscriber.id)));
      const actionStatus = failures.length
        ? `Removed ${removedIds.size} of ${ids.length} subscribers. ${failures.length} failed: ${failures[0]}`
        : `Removed ${removedIds.size} subscriber${removedIds.size === 1 ? "" : "s"}.`;
      renderNewsletterSubscribers(subscribers, actionStatus);
    };
    const newsletterSelectAll = container.querySelector("[data-newsletter-select-all]");
    const newsletterChecks = [...container.querySelectorAll("[data-newsletter-subscriber-select]")];
    const newsletterSelectedCount = container.querySelector("[data-newsletter-selection-count]");
    const newsletterRemoveSelected = container.querySelector("[data-newsletter-remove-selected]");
    const updateNewsletterSelection = () => {
      const selectedCount = newsletterChecks.filter(input => input.checked).length;
      if (newsletterSelectedCount) newsletterSelectedCount.textContent = `${selectedCount} selected`;
      if (newsletterRemoveSelected) newsletterRemoveSelected.disabled = selectedCount === 0;
      if (newsletterSelectAll) {
        newsletterSelectAll.checked = newsletterChecks.length > 0 && selectedCount === newsletterChecks.length;
        newsletterSelectAll.indeterminate = selectedCount > 0 && selectedCount < newsletterChecks.length;
      }
    };
    newsletterSelectAll?.addEventListener("change", () => {
      newsletterChecks.forEach(input => { input.checked = newsletterSelectAll.checked; });
      updateNewsletterSelection();
    });
    newsletterChecks.forEach(input => input.addEventListener("change", updateNewsletterSelection));
    newsletterRemoveSelected?.addEventListener("click", async () => {
      const ids = newsletterChecks.filter(input => input.checked).map(input => input.value).filter(Boolean);
      if (!ids.length || !window.confirm(`Remove ${ids.length} selected subscriber${ids.length === 1 ? "" : "s"}?`)) return;
      newsletterRemoveSelected.disabled = true;
      newsletterChecks.forEach(input => { input.disabled = true; });
      const status = container.querySelector("[data-newsletter-action-status]");
      if (status) status.textContent = `Removing ${ids.length} subscriber${ids.length === 1 ? "" : "s"}…`;
      await removeRemoteSubscribers(ids);
    });
    container.querySelector("[data-business-newsletter-send]")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const status = form.querySelector('[role="status"]');
      const data = new FormData(form);
      const subject = String(data.get("subject") || "").trim();
      const message = String(data.get("message") || "").trim();
      const count = (snapshot.remoteNewsletter || []).filter(subscriber => subscriber.status === "subscribed").length;
      if (!subject || !message || count < 1) {
        if (status) status.textContent = "A subject, message, and confirmed subscribers are required.";
        return;
      }
      if (!window.confirm(`Send this newsletter to ${count} confirmed subscriber${count === 1 ? "" : "s"}?`)) return;
      if (submit) submit.disabled = true;
      if (status) status.textContent = "Sending newsletter…";
      try {
        const result = await window.EshopInventoryBridge.sendNewsletterCampaign(tenantId, subject, message);
        if (status) status.textContent = result.failed
          ? `Provider accepted ${result.accepted} of ${result.attempted} emails; ${result.failed} failed.`
          : `Provider accepted all ${result.accepted} emails. Inbox delivery is not guaranteed.`;
        if (result.failed) console.error("Newsletter campaign had failed recipient batches.", result);
        form.reset();
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not send the newsletter.";
      } finally {
        if (submit) submit.disabled = false;
      }
    });
    container.querySelectorAll("[data-remove-remote-subscriber]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.removeRemoteSubscriber;
        if (!id || !window.confirm("Remove this subscriber from the shop newsletter list?")) return;
        button.disabled = true;
        await removeRemoteSubscribers([id]);
      });
    });
    const renderWithBranches = (branches, statusText) => {
      try {
        window.localStorage.setItem(
          `ESHOP_BUSINESS_BRANCHES_V1:${tenantId}`,
          JSON.stringify(branches)
        );
      } catch (error) {
        console.warn("Could not cache synced business branches on this device.", error);
      }
      const merged = this.mergeRemoteBusinessData(snapshot, branches);
      container.innerHTML = this.renderMainShopContent(path, merged);
      const status = container.querySelector(".bl-sync-status");
      if (status) status.textContent = statusText;
      this.bindBusinessCloudActions(container, path, snapshot, tenantId);
    };
    container.querySelector("[data-business-branches]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector(".bl-sync-status");
      button.disabled = true;
      if (status) status.textContent = "Loading synced registers…";
      try {
        const result = await AppController.cloudflareRequest(branchesUrl, {}, tenantId);
        const branches = Array.isArray(result.branches) ? result.branches : [];
        renderWithBranches(branches, `${branches.length} register${branches.length === 1 ? "" : "s"} loaded from the private archive.`);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not load synced registers.";
        button.disabled = false;
      }
    });
    // Counter, website and booking rows live in one list; these just narrow it down.
    container.querySelectorAll("[data-orders-filter]").forEach(button => {
      button.addEventListener("click", () => {
        const panel = button.closest("[data-orders-panel]");
        if (!panel) return;
        panel.dataset.ordersFilterValue = button.dataset.ordersFilter || "all";
        panel.querySelectorAll("[data-orders-filter]").forEach(other => {
          const active = other === button;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", String(active));
        });
      });
    });
    container.querySelector("[data-business-online-orders-load]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector("[data-online-orders-status]");
      button.disabled = true;
      if (status) status.textContent = "Loading recent orders from Cloudflare…";
      try {
        const result = await window.EshopInventoryBridge.listStorefrontOrders(tenantId);
        const remoteOrders = Array.isArray(result.orders) ? result.orders : [];
        const updatedSnapshot = {
          ...snapshot,
          remoteOrders,
          sales: window.BusinessLens?.mergeStorefrontOrders
            ? window.BusinessLens.mergeStorefrontOrders(snapshot.sales, remoteOrders)
            : snapshot.sales
        };
        container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
        const updatedStatus = container.querySelector("[data-online-orders-status]");
        if (updatedStatus) updatedStatus.textContent = `${updatedSnapshot.remoteOrders.length} server-backed order${updatedSnapshot.remoteOrders.length === 1 ? "" : "s"} loaded.`;
        this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not load online orders.";
        button.disabled = false;
      }
    });
    container.querySelectorAll("[data-online-order-update]").forEach(button => {
      button.addEventListener("click", async () => {
        const orderNumber = button.dataset.onlineOrderUpdate;
        const statusSelect = container.querySelector(`[data-online-order-status="${CSS.escape(orderNumber)}"]`);
        const status = container.querySelector("[data-online-orders-status]");
        button.disabled = true;
        try {
          const updated = await window.EshopInventoryBridge.updateStorefrontOrder(tenantId, orderNumber, statusSelect.value);
          const saved = updated?.order?.order_number === orderNumber ? updated.order : null;
          const updatedSnapshot = {
            ...snapshot,
            remoteOrders: (snapshot.remoteOrders || []).map(order =>
              order.order_number === orderNumber ? (saved || { ...order, status: statusSelect.value }) : order)
          };
          if (window.BusinessLens?.mergeStorefrontOrders) {
            updatedSnapshot.sales = window.BusinessLens.mergeStorefrontOrders(
              snapshot.sales,
              updatedSnapshot.remoteOrders
            );
          }
          container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
          const updatedStatus = container.querySelector("[data-online-orders-status]");
          if (updatedStatus) updatedStatus.textContent = `${orderNumber} status saved.`;
          this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not update this order.";
          button.disabled = false;
        }
      });
    });
    const rerenderWith = (updatedSnapshot, statusSelector, text) => {
      container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
      const updatedStatus = statusSelector ? container.querySelector(statusSelector) : null;
      if (updatedStatus && text) updatedStatus.textContent = text;
      this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
    };
    const withOrders = (remoteOrders) => {
      const updatedSnapshot = { ...snapshot, remoteOrders };
      if (window.BusinessLens?.mergeStorefrontOrders) {
        updatedSnapshot.sales = window.BusinessLens.mergeStorefrontOrders(snapshot.sales, remoteOrders);
      }
      return updatedSnapshot;
    };
    container.querySelectorAll("[data-online-order-pay]").forEach(button => {
      button.addEventListener("click", async () => {
        const orderNumber = button.dataset.onlineOrderPay;
        const row = button.closest("[data-online-order-row]");
        const method = row?.querySelector("[data-online-order-pay-method]")?.value || "";
        const reference = String(row?.querySelector("[data-online-order-pay-ref]")?.value || "").trim();
        const status = container.querySelector("[data-online-orders-status]");
        if (!window.confirm(`Record ${orderNumber} as paid (${this.manualPaymentLabel(method)})? This marks the order paid and deducts its stock.`)) return;
        button.disabled = true;
        try {
          const result = await window.EshopInventoryBridge.recordStorefrontOrderPayment(
            tenantId, orderNumber, { method, ...(reference ? { reference } : {}) }
          );
          const saved = result.order && result.order.order_number === orderNumber ? result.order : null;
          rerenderWith(
            withOrders((snapshot.remoteOrders || []).map(order => order.order_number === orderNumber
              ? (saved || { ...order, payment_status: "paid", payment_method: method })
              : order)),
            "[data-online-orders-status]",
            result.duplicate
              ? `${orderNumber} was already marked paid.`
              : result.needs_attention
                ? `${orderNumber} marked paid, but stock ran short. Review it below.`
                : `${orderNumber} marked paid.`
          );
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not record this payment.";
          button.disabled = false;
        }
      });
    });
    container.querySelector("[data-discounts-load]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector("[data-discounts-status]");
      button.disabled = true;
      if (status) status.textContent = "Loading discount codes…";
      try {
        const result = await window.EshopInventoryBridge.listDiscountCodes(tenantId);
        const updatedSnapshot = { ...snapshot, remoteDiscounts: Array.isArray(result.discounts) ? result.discounts : [] };
        delete updatedSnapshot.remoteDiscountsError;
        rerenderWith(updatedSnapshot);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not load discount codes.";
        button.disabled = false;
      }
    });
    container.querySelector("[data-discount-form]")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = form.querySelector('[role="status"]');
      const submit = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const type = data.get("type") === "fixed" ? "fixed" : "percent";
      const entered = Number(data.get("value"));
      const value = type === "percent" ? entered : Math.round(entered * 100);
      if (!Number.isSafeInteger(value) || value < 1 || (type === "percent" && value > 100)) {
        if (status) status.textContent = type === "percent"
          ? "A percent discount must be a whole number from 1 to 100."
          : "Enter a fixed discount of at least one cent.";
        return;
      }
      const minOrder = Math.round((Number(data.get("min_order")) || 0) * 100);
      const limitText = String(data.get("usage_limit") || "").trim();
      const usageLimit = limitText ? Number(limitText) : null;
      if (!Number.isSafeInteger(minOrder) || minOrder < 0 ||
          (usageLimit !== null && (!Number.isSafeInteger(usageLimit) || usageLimit < 1))) {
        if (status) status.textContent = "Minimum spend must be 0 or more and the usage limit a whole number of at least 1.";
        return;
      }
      const endsText = String(data.get("ends_at") || "").trim();
      const endsAt = endsText ? new Date(`${endsText}T23:59:59`) : null;
      if (endsAt && !Number.isFinite(endsAt.getTime())) {
        if (status) status.textContent = "Choose a valid expiry date.";
        return;
      }
      const body = {
        code: String(data.get("code") || "").trim().toUpperCase(),
        type,
        value,
        min_order_cents: minOrder,
        usage_limit: usageLimit,
        active: true,
        ...(endsAt ? { ends_at: endsAt.toISOString() } : {})
      };
      if (submit) submit.disabled = true;
      if (status) status.textContent = "Saving discount code…";
      try {
        const result = await window.EshopInventoryBridge.createDiscountCode(tenantId, body);
        const updatedSnapshot = {
          ...snapshot,
          remoteDiscounts: [result.discount, ...(snapshot.remoteDiscounts || []).filter(item => item.code !== result.discount.code)]
        };
        delete updatedSnapshot.remoteDiscountsError;
        rerenderWith(updatedSnapshot, "[data-discounts-status]", `${result.discount.code} created.`);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not save this discount code.";
        if (submit) submit.disabled = false;
      }
    });
    container.querySelectorAll("[data-discount-toggle]").forEach(button => {
      button.addEventListener("click", async () => {
        const code = button.dataset.discountToggle;
        const status = container.querySelector("[data-discounts-status]");
        button.disabled = true;
        try {
          const result = await window.EshopInventoryBridge.updateDiscountCode(
            tenantId, { code, active: button.dataset.discountActive !== "1" }
          );
          rerenderWith({
            ...snapshot,
            remoteDiscounts: (snapshot.remoteDiscounts || []).map(item => item.code === code ? result.discount : item)
          }, "[data-discounts-status]", `${code} ${result.discount.active ? "enabled" : "disabled"}.`);
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not update this discount code.";
          button.disabled = false;
        }
      });
    });
    container.querySelectorAll("[data-discount-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        const code = button.dataset.discountDelete;
        const status = container.querySelector("[data-discounts-status]");
        if (!window.confirm(`Delete discount code ${code}? Customers will no longer be able to use it.`)) return;
        button.disabled = true;
        try {
          await window.EshopInventoryBridge.deleteDiscountCode(tenantId, code);
          rerenderWith({
            ...snapshot,
            remoteDiscounts: (snapshot.remoteDiscounts || []).filter(item => item.code !== code)
          }, "[data-discounts-status]", `${code} deleted.`);
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not delete this discount code.";
          button.disabled = false;
        }
      });
    });
    container.querySelector("[data-owner-alerts-load]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector("[data-owner-alerts-status]");
      button.disabled = true;
      if (status) status.textContent = "Loading shop alerts…";
      try {
        const updatedSnapshot = { ...snapshot, remoteAlerts: await window.BusinessNotifications.owner.list(tenantId) };
        delete updatedSnapshot.remoteAlertsError;
        rerenderWith(updatedSnapshot);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not load shop alerts.";
        button.disabled = false;
      }
    });
    container.querySelector("[data-owner-alerts-read-all]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector("[data-owner-alerts-status]");
      button.disabled = true;
      try {
        await window.BusinessNotifications.owner.markRead(tenantId, "all");
        const readAt = new Date().toISOString();
        rerenderWith({
          ...snapshot,
          remoteAlerts: {
            unread_count: 0,
            notifications: (snapshot.remoteAlerts?.notifications || []).map(alert => ({ ...alert, read_at: alert.read_at || readAt }))
          }
        }, "[data-owner-alerts-status]", "All alerts marked read.");
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not mark alerts read.";
        button.disabled = false;
      }
    });
    const appointmentStatusLine = () => container.querySelector("[data-online-appointments-status]");
    // Fetches one page of appointments for a filter and redraws the panel. `append` adds the next page.
    const loadAppointments = async (filterKey, { append = false, message = "" } = {}) => {
      const filter = this.serviceAppointmentFilter(filterKey);
      const previous = snapshot.remoteAppointmentsMeta || {};
      const offset = append ? Number(previous.fetched) || 0 : 0;
      const result = await window.EshopInventoryBridge.listServiceAppointments(
        tenantId, { ...filter.query, ...(offset ? { offset } : {}) }
      );
      const fetched = Array.isArray(result.appointments) ? result.appointments : [];
      const rows = filter.clientFilter ? fetched.filter(filter.clientFilter) : fetched;
      const updatedSnapshot = {
        ...snapshot,
        remoteAppointments: append ? [...(snapshot.remoteAppointments || []), ...rows] : rows,
        remoteAppointmentsMeta: {
          filter: filter.key,
          counts: result.counts || null,
          hasMore: result.has_more === true,
          fetched: offset + fetched.length
        }
      };
      delete updatedSnapshot.remoteAppointmentsError;
      rerenderWith(updatedSnapshot, "[data-online-appointments-status]", message);
    };
    container.querySelector("[data-online-appointments-load]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = appointmentStatusLine();
      button.disabled = true;
      if (status) status.textContent = "Loading service appointments…";
      try {
        await loadAppointments((snapshot.remoteAppointmentsMeta || {}).filter);
      } catch (error) {
        if (status) status.textContent = this.serviceAppointmentErrorText(error, "Could not load service appointments.");
        button.disabled = false;
      }
    });
    container.querySelector("[data-appointments-filter]")?.addEventListener("change", async event => {
      const status = appointmentStatusLine();
      if (status) status.textContent = "Loading service appointments…";
      try {
        await loadAppointments(event.currentTarget.value);
      } catch (error) {
        if (status) status.textContent = this.serviceAppointmentErrorText(error, "Could not load service appointments.");
      }
    });
    container.querySelector("[data-appointments-more]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = appointmentStatusLine();
      button.disabled = true;
      try {
        await loadAppointments((snapshot.remoteAppointmentsMeta || {}).filter, { append: true });
      } catch (error) {
        if (status) status.textContent = this.serviceAppointmentErrorText(error, "Could not load more appointments.");
        button.disabled = false;
      }
    });
    // Sends one owner action, then reloads the current filter so rows, filters and counts match the Worker.
    const runAppointmentAction = async (button, id, action, extra, successText) => {
      const status = appointmentStatusLine();
      const filterKey = (snapshot.remoteAppointmentsMeta || {}).filter;
      button.disabled = true;
      let result;
      try {
        result = await window.EshopInventoryBridge.updateServiceAppointment(tenantId, id, action, extra);
      } catch (error) {
        const text = this.serviceAppointmentErrorText(error);
        if (error && error.code === "appointment_changed") {
          try {
            await loadAppointments(filterKey, { message: text });
            return;
          } catch { /* fall through and show the message on the current screen */ }
        }
        if (status) status.textContent = text;
        button.disabled = false;
        return;
      }
      const text = typeof successText === "function" ? successText(result.appointment || {}) : successText;
      try {
        await loadAppointments(filterKey, { message: text });
      } catch {
        // The change itself worked; show the updated row even though the refresh failed.
        rerenderWith({
          ...snapshot,
          remoteAppointments: (snapshot.remoteAppointments || []).map(appointment =>
            appointment.id === id && result.appointment ? result.appointment : appointment)
        }, "[data-online-appointments-status]", `${text} (Reload to refresh the list.)`);
      }
    };
    container.querySelectorAll("[data-service-appointment-action]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.appointmentId;
        const action = button.dataset.serviceAppointmentAction;
        const row = button.closest("[data-appointment-row]");
        const extra = {};
        if (action === "cancel") {
          if (!window.confirm("Cancel this appointment? The customer is told by email. If they paid a deposit you will need to refund it yourself.")) return;
          const reason = String(row?.querySelector("[data-appointment-cancel-reason]")?.value || "").trim();
          if (reason) extra.reason = reason.slice(0, 200);
        }
        if (action === "reject" && !window.confirm("Decline this appointment request? The customer is told by email.")) return;
        if (action === "no_show" && !window.confirm("Mark this customer as a no-show? Any deposit stays with you.")) return;
        await runAppointmentAction(button, id, action, extra, appointment => ({
          confirm: Number(appointment.deposit_percent) > 0
            ? "Appointment confirmed. The customer was emailed the deposit link; you can also share it from here."
            : "Appointment confirmed.",
          reject: "Appointment declined.",
          cancel: appointment.deposit_refund_due ? "Appointment cancelled. A deposit was paid: refund it in Paystack, then mark it refunded." : "Appointment cancelled.",
          complete: "Appointment marked completed.",
          no_show: "Appointment marked as a no-show.",
          deposit_refunded: "Deposit marked as refunded."
        })[action] || "Appointment updated.");
      });
    });
    container.querySelectorAll("[data-appointment-reschedule-toggle]").forEach(button => {
      button.addEventListener("click", () => {
        const panel = container.querySelector(`[data-appointment-reschedule-panel="${CSS.escape(button.dataset.appointmentRescheduleToggle)}"]`);
        if (panel) panel.hidden = !panel.hidden;
      });
    });
    container.querySelectorAll("[data-appointment-slots-load]").forEach(button => {
      button.addEventListener("click", async () => {
        const panel = button.closest("[data-appointment-reschedule-panel]");
        const date = String(panel?.querySelector("[data-appointment-reschedule-date]")?.value || "");
        const select = panel?.querySelector("[data-appointment-reschedule-slot]");
        const confirmButton = panel?.querySelector("[data-appointment-reschedule-confirm]");
        const status = appointmentStatusLine();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          if (status) status.textContent = "Choose the new date first.";
          return;
        }
        button.disabled = true;
        if (status) status.textContent = "Looking for free times…";
        try {
          const result = await window.EshopInventoryBridge.listServiceSlots(tenantId, button.dataset.serviceId, date);
          const slots = Array.isArray(result.slots) ? result.slots : [];
          if (select) {
            select.innerHTML = "";
            const placeholder = container.ownerDocument.createElement("option");
            placeholder.value = "";
            placeholder.textContent = slots.length ? "Choose a time" : "No free times that day";
            select.appendChild(placeholder);
            slots.forEach(slot => {
              const option = container.ownerDocument.createElement("option");
              option.value = String(slot.starts_at);
              option.textContent = `${slot.label || slot.starts_at}${Number(result.capacity) > 1 && slot.remaining ? ` (${slot.remaining} left)` : ""}`;
              select.appendChild(option);
            });
            select.disabled = !slots.length;
          }
          if (confirmButton) confirmButton.disabled = true;
          if (status) status.textContent = slots.length
            ? `${slots.length} free time${slots.length === 1 ? "" : "s"} on ${date}. Choose one, then move the appointment.`
            : `No free times on ${date}. Try another date.`;
        } catch (error) {
          if (status) status.textContent = this.serviceAppointmentErrorText(error, "Could not load free times.");
        } finally {
          button.disabled = false;
        }
      });
    });
    container.querySelectorAll("[data-appointment-reschedule-slot]").forEach(select => {
      select.addEventListener("change", () => {
        const panel = select.closest("[data-appointment-reschedule-panel]");
        const confirmButton = panel?.querySelector("[data-appointment-reschedule-confirm]");
        if (confirmButton) confirmButton.disabled = !select.value && !panel.querySelector("[data-appointment-reschedule-time]")?.value;
      });
    });
    container.querySelectorAll("[data-appointment-reschedule-time]").forEach(input => {
      const sync = () => {
        const panel = input.closest("[data-appointment-reschedule-panel]");
        const confirmButton = panel?.querySelector("[data-appointment-reschedule-confirm]");
        const slotSelect = panel?.querySelector("[data-appointment-reschedule-slot]");
        if (confirmButton) confirmButton.disabled = !input.value && !slotSelect?.value;
      };
      input.addEventListener("input", sync);
      input.addEventListener("change", sync);
    });
    container.querySelectorAll("[data-appointment-reschedule-confirm]").forEach(button => {
      button.addEventListener("click", async () => {
        const panel = button.closest("[data-appointment-reschedule-panel]");
        let startsAt = String(panel?.querySelector("[data-appointment-reschedule-slot]")?.value || "");
        const exactTime = String(panel?.querySelector("[data-appointment-reschedule-time]")?.value || "");
        if (exactTime) {
          // The Worker's slot list also counts this booking's own seats, so it can never offer a time that
          // overlaps the current one. An exact time is checked by the Worker itself (hours, grid, capacity).
          const date = String(panel?.querySelector("[data-appointment-reschedule-date]")?.value || "");
          startsAt = this.serviceAppointmentLocalToIso(date, exactTime, panel?.dataset.timezone);
          if (!startsAt) {
            const status = appointmentStatusLine();
            if (status) status.textContent = "Choose a valid date and time first.";
            return;
          }
        }
        if (!startsAt) return;
        await runAppointmentAction(button, button.dataset.appointmentRescheduleConfirm, "reschedule", { starts_at: startsAt },
          "Appointment moved. The customer was emailed the new time.");
      });
    });
    container.querySelector("[data-online-holds-load]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector("[data-online-holds-status]");
      button.disabled = true;
      if (status) status.textContent = "Loading customer hold requests…";
      try {
        const result = await window.EshopInventoryBridge.listStorefrontHolds(tenantId);
        const updatedSnapshot = { ...snapshot, remoteHolds: Array.isArray(result.holds) ? result.holds : [] };
        container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
        this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not load storefront hold requests.";
        button.disabled = false;
      }
    });
    container.querySelectorAll("[data-product-hold-action]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.holdId;
        const action = button.dataset.productHoldAction;
        const status = container.querySelector("[data-online-holds-status]");
        button.disabled = true;
        try {
          const result = await window.EshopInventoryBridge.updateStorefrontHold(tenantId, id, action);
          const updatedSnapshot = {
            ...snapshot,
            remoteHolds: (snapshot.remoteHolds || []).map(hold => hold.id === id ? result.hold : hold)
          };
          container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
          const updatedStatus = container.querySelector("[data-online-holds-status]");
          if (updatedStatus) updatedStatus.textContent = `Hold request ${({ approve: "approved", reject: "rejected", release: "released" })[action]}.`;
          this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not update this hold request.";
          button.disabled = false;
        }
      });
    });
    container.querySelectorAll("[data-business-product-analytics]").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Refreshing...";
        const status = container.querySelector("[data-product-analytics-status]");
        if (status) status.textContent = "Refreshing live product activity…";
        try {
          const analytics = await window.EshopInventoryBridge.fetchStorefrontEventAnalytics(tenantId, 30);
          const updatedSnapshot = {
            ...snapshot,
            remoteProductAnalytics: analytics,
            remoteProductAnalyticsUpdatedAt: new Date().toISOString()
          };
          delete updatedSnapshot.remoteProductAnalyticsError;
          container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
          this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
        } catch (error) {
          const note = container.querySelector("[data-product-analytics-status]");
          if (note) note.textContent = error instanceof Error ? error.message : "Could not load product activity.";
          button.textContent = "Refresh";
          button.disabled = false;
        }
      });
    });
    container.querySelectorAll("[data-business-cloud-analytics]").forEach(button => {
      button.addEventListener("click", async () => {
        const status = button.closest(".studio-panel")?.querySelector("[data-business-cloud-analytics-status], [data-analytics-status]");
        button.disabled = true;
        if (status) {
          status.hidden = false;
          status.textContent = "Loading…";
        }
        try {
          const analytics = await window.EshopInventoryBridge.fetchStorefrontAnalytics(tenantId, this.analyticsDays());
          const updatedSnapshot = { ...snapshot, remoteAnalytics: analytics };
          container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
          this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
        } catch (error) {
          console.error("Storefront analytics could not be loaded.", error);
          if (status) status.textContent = "Could not load analytics.";
          button.disabled = false;
        }
      });
    });
    container.querySelector("[data-business-sync]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector(".bl-sync-status");
      button.disabled = true;
      if (status) status.textContent = "Saving this register's snapshot to the private cloud archive…";
      try {
        const activeTenant = AppController.getActiveTenant();
        const instance = snapshot.instances?.[0];
        const storeId = this.businessStoreId(tenantId);
        if (!window.ShopPOS?.listBusinessRecords) {
          throw new Error("Register business records are not available for cloud sync.");
        }
        const [suppliers, purchaseOrders, tickets] = await Promise.all([
          window.ShopPOS.listBusinessRecords("supplier", tenantId),
          window.ShopPOS.listBusinessRecords("purchase", tenantId),
          window.ShopPOS.listBusinessRecords("ticket", tenantId)
        ]);
        const synced = await AppController.cloudflareRequest(
          `/api/business/sync?tenant=${encodeURIComponent(tenantId)}`,
          {
            method: "POST",
            body: JSON.stringify({
              store_id: storeId,
              store_name: String(instance?.name || activeTenant.name || "Primary register").slice(0, 120),
              snapshot: {
                currency: snapshot.currency || "KES",
                sales: snapshot.sales,
                expenses: snapshot.expenses,
                categories: [...(snapshot.categories || []), ...(snapshot.posCategories || [])],
                products: (snapshot.posProducts || snapshot.products).map(product => ({
                  id: product.id, sku: product.sku, name: product.name,
                  category: product.categoryName || product.category,
                  price: product.price, costPrice: product.costPrice, stock: product.stock
                })),
                visits: SQLiteEngine.select("web_visits", item => item.tenant_id === tenantId && AppController.isStorefrontVisitPath(item.path)),
                events: SQLiteEngine.select("web_events", item => item.tenant_id === tenantId),
                newsletter: SQLiteEngine.select("newsletter_subscribers", item => item.tenant_id === tenantId),
                points: SQLiteEngine.select("customer_points", item => item.tenant_id === tenantId),
                bookings: SQLiteEngine.select("booking_holds", item => item.tenant_id === tenantId),
                instances: snapshot.instances,
                suppliers,
                purchase_orders: purchaseOrders,
                tickets,
                settings: snapshot.settings || {}
              }
            })
          },
          tenantId
        );
        const branchesResult = await AppController.cloudflareRequest(branchesUrl, {}, tenantId);
        renderWithBranches(
          branchesResult.branches || [],
          `Saved to R2 · ${synced.snapshot_id.slice(0, 12)}…`
        );
      } catch (error) {
        if (status) status.textContent = error instanceof Error
          ? error.message
          : "Register sync failed. Local data is unchanged.";
        button.disabled = false;
      }
    });
    container.querySelector("[data-enable-notifications]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector(".bl-push-status") ||
        document.querySelector("#web-newsletter-signup [role='status']");
      button.disabled = true;
      try {
        const message = await window.BusinessNotifications.enable(tenantId);
        if (status) status.textContent = message;
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not enable notifications.";
      } finally {
        button.disabled = false;
      }
    });
    container.querySelector("[data-disable-notifications]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector(".bl-push-status") ||
        document.querySelector("#web-newsletter-signup [role='status']");
      button.disabled = true;
      try {
        const message = await window.BusinessNotifications.disable(tenantId);
        if (status) status.textContent = message;
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not turn notifications off.";
      } finally {
        button.disabled = false;
      }
    });
    container.querySelector("[data-business-broadcast]")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = Object.fromEntries(new FormData(form).entries());
      if (!fields.title || !fields.body) return;
      if (!window.confirm("Send this notification now to all devices subscribed to this shop?")) return;
      const submit = form.querySelector('button[type="submit"]');
      const status = form.querySelector('[role="status"]');
      if (submit) submit.disabled = true;
      if (status) status.textContent = "Sending to opted-in devices…";
      try {
        const result = await AppController.cloudflareRequest(
          `/api/push/broadcast?tenant=${encodeURIComponent(tenantId)}`,
          { method: "POST", body: JSON.stringify(fields) },
          tenantId
        );
        if (status) status.textContent = result.attempted === 0
          ? "No devices have opted in to notifications yet."
          : `Push service accepted ${result.accepted} request${result.accepted === 1 ? "" : "s"} · ${result.failed} failed, ${result.expired} expired.`;
        form.reset();
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Push broadcast failed.";
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  },

  businessStoreId(tenantId) {
    const key = `ESHOP_BUSINESS_STORE_ID_V1:${tenantId}`;
    let id = window.localStorage.getItem(key);
    if (!id || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
      const randomBytes = window.crypto.getRandomValues(new Uint8Array(16));
      id = `device-${[...randomBytes].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
      window.localStorage.setItem(key, id);
    }
    return id;
  },

  mergeRemoteBusinessData(snapshot, branches) {
    const localId = this.businessStoreId(AppController.getActiveTenant().id);
    const others = branches.filter(branch => branch.store_id !== localId);
    const remoteSales = others.flatMap(branch => (branch.snapshot?.sales || []).map(sale => ({
      ...sale, storeId: branch.store_id, storeName: branch.store_name
    })));
    const remoteExpenses = others.flatMap(branch => (branch.snapshot?.expenses || []).map(expense => ({
      ...expense, storeName: branch.store_name
    })));
    const productRows = [...snapshot.products];
    const bySku = new Map(productRows.filter(product => product.sku).map(product => [String(product.sku), product]));
    for (const branch of others) {
      for (const product of branch.snapshot?.products || []) {
        const current = product.sku ? bySku.get(String(product.sku)) : null;
        if (current) {
          if (current.stock != null && product.stock != null) current.stock = Number(current.stock) + Number(product.stock);
        } else {
          const copy = { ...product, stock: product.stock == null ? null : Number(product.stock) };
          productRows.push(copy);
          if (copy.sku) bySku.set(String(copy.sku), copy);
        }
      }
    }
    return {
      ...snapshot,
      products: productRows,
      sales: [...snapshot.sales, ...remoteSales],
      expenses: [...snapshot.expenses, ...remoteExpenses],
      remoteBranches: branches,
      remoteVisits: others.flatMap(branch => branch.snapshot?.visits || []),
      remoteEvents: others.flatMap(branch => branch.snapshot?.events || []),
      remoteNewsletter: others.flatMap(branch => branch.snapshot?.newsletter || []),
      remotePoints: others.flatMap(branch => branch.snapshot?.points || [])
    };
  },
};
