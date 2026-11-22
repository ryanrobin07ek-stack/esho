// Orders, owner alerts, discounts and service appointments panels.
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppUtils } from './main.js';

export const ordersPanels = {
  manualPaymentLabel(method) {
    return ({ cash: "Cash", mobile_money: "Mobile money", bank: "Bank transfer", other: "Other", paystack: "Paystack" })[method] || String(method || "");
  },

  orderAttentionText(reason) {
    const text = String(reason || "");
    const stock = text.match(/^insufficient_stock:(.*)$/);
    if (stock) {
      return `Paid, but stock ran short${stock[1] ? ` for ${stock[1].split(",").join(", ")}` : ""}. Contact the customer or restock.`;
    }
    if (text.startsWith("paid_after_cancel")) {
      return "The customer paid for an order you cancelled. Refund the customer or reopen the order.";
    }
    if (text.startsWith("duplicate_payment")) {
      return "This order was marked paid by hand and the customer also paid online. Refund one of the payments.";
    }
    return `This order needs your attention${text ? ` (${text})` : ""}.`;
  },

  renderRemoteOrderRow(order, currency) {
    const escape = AppUtils.escapeHTML;
    const orderNumber = escape(order.order_number);
    const orderCurrency = order.currency || currency;
    const paid = order.payment_status === "paid";
    const cancelled = order.status === "cancelled";
    const attention = order.needs_attention === true;
    const discountAmount = Number(order.discount) || 0;
    const paymentLabel = paid
      ? `paid${order.payment_method ? ` via ${this.manualPaymentLabel(order.payment_method)}` : ""}${order.payment_method && order.payment_reference ? ` (ref ${order.payment_reference})` : ""}`
      : order.payment_status || "unpaid";
    return `<article class="studio-list-row studio-order-card studio-online-order-card" data-online-order-row${attention ? " data-needs-attention" : ""}>
      <div class="studio-order-header"><div><strong>${orderNumber}</strong><span>${escape(order.customer_name || "Customer not recorded")} · ${escape(order.customer_email || "No email")} · ${escape(AppUtils.formatDateTime(order.created_at))}</span></div><strong class="studio-order-total">${this.formatMainShopMoney(order.total, orderCurrency)}</strong></div>
      <div class="studio-order-items">${(order.items || []).map(item => `${escape(item.name)} × ${Number(item.quantity) || 0}`).join(" · ") || "No item details"}</div>
      <div class="studio-order-meta"><span>Payment: ${escape(paymentLabel)}</span><span>Status: ${escape(order.status || "pending")}</span>${discountAmount > 0 ? `<span>Discount${order.discount_code ? ` (${escape(order.discount_code)})` : ""}: -${this.formatMainShopMoney(discountAmount, orderCurrency)}</span>` : ""}</div>
      ${attention ? `<p class="studio-panel-note" role="alert" data-order-attention><strong>Needs attention.</strong> ${escape(this.orderAttentionText(order.attention_reason))}</p>` : ""}
      <div class="studio-order-controls"><label>Status<select data-online-order-status="${orderNumber}">${["pending", "confirmed", "processing", "ready", "fulfilled", "cancelled"].map(status => `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
        <button type="button" class="btn-secondary" data-online-order-update="${orderNumber}">Save status</button></div>
      ${!paid && !cancelled ? `<div class="studio-order-controls"><label>Payment received<select data-online-order-pay-method>${["cash", "mobile_money", "bank", "other"].map(method => `<option value="${method}">${escape(this.manualPaymentLabel(method))}</option>`).join("")}</select></label>
        <button type="button" class="btn-secondary" data-online-order-pay="${orderNumber}">Mark paid</button></div>
        <div class="studio-order-controls" style="grid-template-columns:minmax(0,1fr)"><label>Payment reference (optional)<input data-online-order-pay-ref maxlength="120" autocomplete="off"></label></div>` : ""}
      </article>`;
  },

  renderOrderAttentionSummary(orders) {
    const flagged = (orders || []).filter(order => order.needs_attention === true);
    return flagged.length
      ? `<p class="studio-panel-note" role="alert" data-orders-attention><strong>${flagged.length} order${flagged.length === 1 ? "" : "s"} need${flagged.length === 1 ? "s" : ""} attention:</strong> ${flagged.map(order => AppUtils.escapeHTML(order.order_number)).join(", ")}</p>`
      : "";
  },

  renderOwnerAlertsPanel(snapshot) {
    const escape = AppUtils.escapeHTML;
    const alerts = snapshot.remoteAlerts;
    const rows = (alerts?.notifications || []).map(alert => {
      const route = this.ownerAlertRoute(alert.kind);
      return `<article class="studio-list-row" data-owner-alert="${escape(alert.id)}" data-owner-alert-kind="${escape(alert.kind || "")}"><div><strong>${escape(alert.title)}</strong><span>${escape(alert.body)}</span><small>${escape(this.ownerAlertKindLabel(alert.kind))} · ${escape(alert.created_at || "")}${route ? ` · <a href="${route}" data-route="${route}">Open appointments</a>` : ""}</small></div><div class="studio-row-end"><span>${alert.read_at ? "" : "New"}</span></div></article>`;
    }).join("");
    const note = snapshot.remoteAlertsError
      ? escape(snapshot.remoteAlertsError)
      : alerts ? `${alerts.unread_count} unread alert${alerts.unread_count === 1 ? "" : "s"}.` : "New orders, booking requests, holds and payments that need attention appear here.";
    return `<article class="studio-panel" data-owner-alerts-panel><div class="studio-panel-heading"><h2>Shop alerts</h2><button type="button" class="btn-secondary studio-load-button" data-owner-alerts-load aria-label="Load shop alerts">Load</button></div>
      <p class="studio-panel-note" data-owner-alerts-status>${note}</p>
      ${rows || `<p class="store-workspace-empty">No shop alerts loaded.</p>`}
      ${alerts?.unread_count ? `<button type="button" class="btn-secondary" data-owner-alerts-read-all>Mark all read</button>` : ""}</article>`;
  },

  renderDiscountPanel(snapshot) {
    const escape = AppUtils.escapeHTML;
    const currency = snapshot.currency || "KES";
    const discounts = Array.isArray(snapshot.remoteDiscounts) ? snapshot.remoteDiscounts : [];
    const rows = discounts.map(discount => {
      const offer = discount.type === "percent"
        ? `${Number(discount.value)}% off`
        : `${this.formatMainShopMoney(Number(discount.value) / 100, currency)} off`;
      const details = [
        offer,
        discount.min_order_cents ? `min spend ${this.formatMainShopMoney(Number(discount.min_order_cents) / 100, currency)}` : "",
        `used ${Number(discount.used_count) || 0}${discount.usage_limit == null ? "" : ` of ${Number(discount.usage_limit)}`}`,
        discount.ends_at ? `expires ${String(discount.ends_at).slice(0, 10)}` : "",
        discount.active ? "active" : "disabled"
      ].filter(Boolean).join(" · ");
      const code = escape(discount.code);
      return `<article class="studio-list-row" data-discount-row="${code}"><div><strong>${code}</strong><span>${escape(details)}</span></div><div class="studio-row-end">
        <button type="button" class="btn-secondary" data-discount-toggle="${code}" data-discount-active="${discount.active ? "1" : "0"}">${discount.active ? "Disable" : "Enable"}</button>
        <button type="button" class="btn-secondary" data-discount-delete="${code}">Delete</button></div></article>`;
    }).join("");
    const note = snapshot.remoteDiscountsError
      ? escape(snapshot.remoteDiscountsError)
      : snapshot.remoteDiscounts ? `${discounts.length} discount code${discounts.length === 1 ? "" : "s"}. Customers enter a code at checkout; shipping is never discounted.` : "Create codes customers can enter at checkout.";
    return `<article class="studio-panel" data-discounts-panel><div class="studio-panel-heading"><h2>Discount codes</h2><button type="button" class="btn-secondary studio-load-button" data-discounts-load aria-label="Load discount codes">Load</button></div>
      <p class="studio-panel-note" data-discounts-status>${note}</p>
      <form class="store-workspace-form" data-discount-form>
        <label>Code<input name="code" required minlength="2" maxlength="32" pattern="[A-Za-z0-9_\\-]{2,32}" autocomplete="off"></label>
        <label>Type<select name="type"><option value="percent">Percent off</option><option value="fixed">Fixed amount off (${escape(currency)})</option></select></label>
        <label>Value (percent, or amount in ${escape(currency)})<input name="value" type="number" min="1" step="any" required></label>
        <label>Minimum spend in ${escape(currency)} (optional)<input name="min_order" type="number" min="0" step="any"></label>
        <label>Expires on (optional)<input name="ends_at" type="date"></label>
        <label>Usage limit (optional)<input name="usage_limit" type="number" min="1" step="1"></label>
        <button type="submit" class="btn-primary">Add discount code</button>
        <p role="status" aria-live="polite"></p>
      </form>
      ${rows || `<p class="store-workspace-empty">No discount codes loaded.</p>`}</article>`;
  },

  // ----- Owner appointments (service shops). Contract: cloudflare/STOREFRONT_COMMERCE.md "Service bookings". -----
  serviceAppointmentFilters() {
    // `query` is sent to GET /api/service-appointments; `clientFilter` narrows what the Worker cannot filter.
    return [
      { key: "upcoming", label: "Upcoming", query: { view: "upcoming", status: "pending,confirming,confirmed" } },
      { key: "pending", label: "Waiting for your answer", query: { view: "upcoming", status: "pending" } },
      { key: "past", label: "Past", query: { view: "past" } },
      { key: "refunds", label: "Deposits to refund", query: { view: "all", status: "cancelled", limit: 200 }, clientFilter: appointment => appointment.deposit_refund_due === true },
      { key: "cancelled", label: "Cancelled or declined", query: { view: "all", status: "cancelled,rejected" } },
      { key: "all", label: "All", query: { view: "all" } }
    ];
  },

  serviceAppointmentFilter(key) {
    const filters = this.serviceAppointmentFilters();
    return filters.find(filter => filter.key === key) || filters[0];
  },

  serviceAppointmentErrorText(error, fallback = "Could not update this appointment.") {
    const code = error && typeof error === "object" ? String(error.code || "") : "";
    const status = error && typeof error === "object" ? Number(error.status) || 0 : 0;
    const messages = {
      unauthorized: "Your sign-in for this shop has expired. Sign in again, then retry.",
      appointment_not_found: "This appointment no longer exists. Reload the list.",
      invalid_state: "This appointment cannot be changed that way any more. Reload the list to see its current status.",
      not_started: "You can mark an appointment completed or no-show only after its start time.",
      appointment_started: "This appointment has already started, so it can no longer be moved, declined or cancelled. Mark it completed or no-show instead.",
      appointment_busy: "A deposit link is still being created for this appointment. Wait a moment, then try again.",
      slot_unavailable: "That time is not available (outside opening hours, in the past, or fully booked). Choose another time.",
      slot_unchanged: "That is already the time of this appointment. Choose a different time.",
      appointment_changed: "The appointment was changed while you were working (for example the customer moved it). The list has been reloaded. Check it, then try again.",
      deposit_unavailable: "A deposit link cannot be created yet. Finish Paystack setup for this shop (KES, NGN or ZAR, with a ready payout account) or set the deposit to 0%, then confirm again.",
      service_unavailable: "This service is no longer in your published catalogue.",
      invalid_request: "The request was not accepted. Reload the list and try again.",
      too_large: "The request was too large. Shorten the reason and try again.",
      payment_provider_error: "Paystack did not return a payment link. The appointment is still waiting; try again in a moment.",
      rate_limited: "Too many requests. Wait a minute, then try again.",
      storage_unavailable: "The shop's booking storage is unavailable right now. Try again shortly."
    };
    if (messages[code]) return messages[code];
    if (status === 401) return messages.unauthorized;
    if (status === 429) return messages.rate_limited;
    return (error instanceof Error && error.message) || fallback;
  },

  serviceAppointmentStatusLabel(appointment) {
    if (appointment.expired === true) return "Expired";
    return ({
      pending: "Waiting for you", confirming: "Creating deposit link", confirmed: "Confirmed",
      rejected: "Declined", cancelled: "Cancelled", completed: "Completed", no_show: "No-show"
    })[appointment.status] || String(appointment.status || "pending");
  },

  serviceAppointmentLocalDate(isoTime, timeZone) {
    try {
      return new Date(isoTime).toLocaleDateString("en-CA", { timeZone: timeZone || undefined });
    } catch {
      return String(isoTime || "").slice(0, 10);
    }
  },

  // Shop-local date (YYYY-MM-DD) and time (HH:MM) to a UTC ISO string, or "" when it cannot be resolved.
  serviceAppointmentLocalToIso(date, time, timeZone) {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
    const t = /^(\d{2}):(\d{2})$/.exec(String(time || ""));
    if (!d || !t) return "";
    const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone || undefined, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
      const offsetAt = ms => {
        const p = Object.fromEntries(formatter.formatToParts(new Date(ms)).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
        return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
      };
      let guess = wall - offsetAt(wall);
      guess = wall - offsetAt(guess);
      return guess + offsetAt(guess) === wall ? new Date(guess).toISOString() : "";
    } catch {
      return "";
    }
  },

  // One Orders screen for the whole shop. The counter, the website and the booking diary used to be
  // three separate lists in two different shells that disagreed about the same day's takings. The
  // till keeps its own fast screens; this is where the owner sees everything together.
  renderUnifiedOrderList(snapshot, sales, currency) {
    const escape = AppUtils.escapeHTML;
    const time = value => {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const entries = [];
    for (const sale of sales || []) {
      const counter = !/web/i.test(String(sale.channel || ""));
      entries.push({
        at: time(sale.date),
        channel: counter ? "counter" : "website",
        html: `<article class="studio-list-row studio-order-card"><div><strong>${escape(sale.reference)}</strong><span>${escape(sale.customerName || "Customer not recorded")} · ${escape(AppUtils.formatDateTime(sale.date))}</span><small>${escape(counter ? "Counter" : "Website")} · ${sale.itemCount} item${sale.itemCount === 1 ? "" : "s"}</small></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(sale.total, currency)}</strong><span>${escape(sale.status || "recorded")}</span></div></article>`
      });
    }
    for (const order of snapshot.remoteOrders || []) {
      entries.push({ at: time(order.created_at), channel: "website", html: this.renderRemoteOrderRow(order, currency) });
    }
    for (const appointment of snapshot.remoteAppointments || []) {
      entries.push({
        at: time(appointment.starts_at || appointment.created_at),
        channel: "booking",
        html: this.renderServiceAppointmentRow(appointment)
      });
    }
    for (const invoice of snapshot.posInvoices || []) {
      const paid = String(invoice.status || "unpaid") === "paid";
      entries.push({
        at: time(invoice.created_at),
        channel: "invoice",
        html: `<article class="studio-list-row studio-order-card"><div><strong>${escape(invoice.invoice_number || `Invoice ${invoice.id}`)}</strong><span>${escape(invoice.customer_name || "Customer not recorded")} · ${escape(AppUtils.formatDateTime(invoice.created_at))}</span><small>Invoice · ${(invoice.items || []).length} item${(invoice.items || []).length === 1 ? "" : "s"}${invoice.due_date ? ` · due ${escape(invoice.due_date)}` : ""}</small></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(invoice.total, currency)}</strong><span>${paid ? "paid" : "unpaid"}</span></div></article>`
      });
    }
    for (const quote of snapshot.posQuotations || []) {
      const converted = Boolean(quote.invoice_id);
      entries.push({
        at: time(quote.created_at),
        channel: "quote",
        html: `<article class="studio-list-row studio-order-card"><div><strong>${escape(quote.quotation_number || `Quote ${quote.id}`)}</strong><span>${escape(quote.customer_name || "Customer not recorded")} · ${escape(AppUtils.formatDateTime(quote.created_at))}</span><small>Quotation · ${(quote.items || []).length} item${(quote.items || []).length === 1 ? "" : "s"}</small></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(quote.total, currency)}</strong><span>${converted ? "invoiced" : "open"}</span></div></article>`
      });
    }
    entries.sort((first, second) => second.at - first.at);
    const counts = {
      all: entries.length,
      counter: entries.filter(entry => entry.channel === "counter").length,
      website: entries.filter(entry => entry.channel === "website").length,
      booking: entries.filter(entry => entry.channel === "booking").length,
      invoice: entries.filter(entry => entry.channel === "invoice").length,
      quote: entries.filter(entry => entry.channel === "quote").length
    };
    const filters = [["all", "All"], ["counter", "Counter"], ["website", "Website"], ["booking", "Bookings"], ["invoice", "Invoices"], ["quote", "Quotes"]];
    const rows = entries.map(entry =>
      `<div class="store-order-entry" data-order-channel="${entry.channel}">${entry.html}</div>`).join("")
      || `<p class="store-workspace-empty">Nothing recorded yet. Counter sales, website orders and bookings all appear here.</p>`;
    return `<article class="studio-panel" data-orders-panel data-orders-filter-value="all">
      <div class="studio-panel-heading"><h2>Orders</h2><span>${counts.all} recorded</span></div>
      <div class="store-order-filters" role="group" aria-label="Filter orders by where they came from">
        ${filters.map(([key, label]) => `<button type="button" class="store-order-filter${key === "all" ? " is-active" : ""}" data-orders-filter="${key}" aria-pressed="${key === "all"}">${label} · ${counts[key]}</button>`).join("")}
      </div>
      ${rows}
    </article>`;
  },

  renderServiceAppointmentRow(appointment, nowMs = Date.now()) {
    const escape = AppUtils.escapeHTML;
    const id = escape(appointment.id);
    const startMs = new Date(appointment.starts_at).getTime();
    const started = Number.isFinite(startMs) && startMs <= nowMs;
    const expired = appointment.expired === true;
    const live = !expired && !started && (appointment.status === "pending" || appointment.status === "confirmed");
    const depositLink = appointment.payment_status !== "paid" && appointment.status === "confirmed" &&
      typeof appointment.payment_authorization_url === "string" &&
      /^https:\/\/checkout\.paystack\.com\//.test(appointment.payment_authorization_url)
      ? appointment.payment_authorization_url : "";
    const phone = String(appointment.customer_phone || "").replace(/\D/g, "");
    const shareText = `Hi ${appointment.customer_name}, your ${appointment.service_name} appointment is confirmed. Please pay your deposit here: ${depositLink}`;
    const whatsappLink = depositLink && phone ? `https://wa.me/${phone}?text=${encodeURIComponent(shareText)}` : "";
    let appointmentTime = String(appointment.starts_at || "");
    try {
      appointmentTime = new Date(appointment.starts_at).toLocaleString(undefined, { timeZone: appointment.timezone || undefined });
    } catch { /* keep the raw timestamp */ }
    const depositCents = Number(appointment.deposit_cents) || 0;
    const deposit = Number(appointment.deposit_percent) > 0
      ? `${Number(appointment.deposit_percent)}% deposit (${this.formatMainShopMoney(depositCents / 100, appointment.currency)})`
      : "No deposit";
    const payment = ({ not_required: "not required", initializing: "being set up", pending: "waiting for the customer", paid: "paid", failed: "failed" })[appointment.payment_status] || String(appointment.payment_status || "");
    const notes = [];
    if (appointment.cancelled_by) {
      notes.push(`Cancelled by ${appointment.cancelled_by === "customer" ? "the customer" : "you"}${appointment.cancel_reason ? `: ${appointment.cancel_reason}` : ""}`);
    }
    if (Number(appointment.reschedule_count) > 0) notes.push(`moved ${Number(appointment.reschedule_count)} time${Number(appointment.reschedule_count) === 1 ? "" : "s"} by the customer`);
    if (appointment.deposit_refunded_at) notes.push(`deposit refunded ${String(appointment.deposit_refunded_at).slice(0, 10)}`);
    const refundDue = appointment.deposit_refund_due === true;
    const button = (action, label, kind = "btn-secondary") =>
      `<button type="button" class="${kind}" data-service-appointment-action="${action}" data-appointment-id="${id}">${label}</button>`;
    const actions = [];
    if (appointment.status === "pending" && live) {
      actions.push(button("confirm", Number(appointment.deposit_percent) > 0 ? "Confirm & create deposit link" : "Confirm appointment", "btn-primary"));
      actions.push(button("reject", "Decline"));
    }
    if (live) {
      actions.push(`<button type="button" class="btn-secondary" data-appointment-reschedule-toggle="${id}">Reschedule</button>`);
      actions.push(button("cancel", "Cancel appointment"));
    }
    if (appointment.status === "confirmed" && started) {
      actions.push(button("complete", "Mark completed", "btn-primary"));
      actions.push(button("no_show", "Mark no-show"));
    }
    if (refundDue) actions.push(button("deposit_refunded", "Mark deposit refunded", "btn-primary"));
    const reschedulePanel = live
      ? `<div class="studio-order-controls" data-appointment-reschedule-panel="${id}" data-timezone="${escape(appointment.timezone || "")}" hidden>
          <label>New date<input type="date" data-appointment-reschedule-date value="${escape(this.serviceAppointmentLocalDate(appointment.starts_at, appointment.timezone))}"></label>
          <button type="button" class="btn-secondary" data-appointment-slots-load="${id}" data-service-id="${escape(appointment.service_id)}">Find free times</button>
          <label>Free times<select data-appointment-reschedule-slot disabled><option value="">Find free times first</option></select></label>
          <label>Or an exact time (shop time, 15-minute steps; use this to move it slightly, for example 15 minutes later)<input type="time" step="900" data-appointment-reschedule-time></label>
          <button type="button" class="btn-primary" data-appointment-reschedule-confirm="${id}" disabled>Move appointment</button>
        </div>
        <div class="studio-order-controls" style="grid-template-columns:minmax(0,1fr)"><label>Reason if you cancel (optional, shown to the customer)<input data-appointment-cancel-reason maxlength="200" autocomplete="off"></label></div>`
      : "";
    return `<article class="studio-list-row studio-order-card" data-appointment-row="${id}" data-appointment-status="${escape(appointment.status)}"${refundDue ? " data-needs-attention" : ""}>
      <div class="studio-order-header"><div><strong>${escape(appointment.service_name)} · ${escape(appointmentTime)}</strong><span>${escape(appointment.customer_name)} · ${escape(appointment.customer_email)} · ${escape(appointment.customer_phone)}</span></div><strong class="studio-order-total">${escape(this.serviceAppointmentStatusLabel(appointment))}</strong></div>
      <div class="studio-order-meta"><span>${escape(appointment.duration_minutes)} min</span><span>${escape(deposit)}</span><span>Payment: ${escape(payment)}</span>${appointment.reference ? `<span>Ref ${escape(appointment.reference)}</span>` : ""}</div>
      ${notes.length ? `<p class="studio-panel-note" data-appointment-notes>${escape(notes.join(" · "))}</p>` : ""}
      ${refundDue ? `<p class="studio-panel-note" role="alert" data-appointment-refund-due><strong>Deposit to refund.</strong> The customer paid ${escape(this.formatMainShopMoney(depositCents / 100, appointment.currency))} for a cancelled appointment. Refund it in your Paystack dashboard, then mark it refunded here.</p>` : ""}
      ${appointment.status === "confirming" ? `<p class="studio-panel-note">A deposit link is being created. Reload in a moment.</p>` : ""}
      ${depositLink ? `<div class="studio-order-meta"><a href="${escape(depositLink)}" target="_blank" rel="noopener noreferrer">Open deposit link</a>${whatsappLink ? `<a href="${escape(whatsappLink)}" target="_blank" rel="noopener noreferrer">Share by WhatsApp</a>` : ""}</div>` : ""}
      ${actions.length ? `<div class="studio-order-controls">${actions.join("")}</div>` : ""}
      ${reschedulePanel}
    </article>`;
  },

  renderServiceAppointmentsPanel(snapshot) {
    const escape = AppUtils.escapeHTML;
    const meta = snapshot.remoteAppointmentsMeta || {};
    const filter = this.serviceAppointmentFilter(meta.filter);
    const appointments = Array.isArray(snapshot.remoteAppointments) ? snapshot.remoteAppointments : [];
    const counts = meta.counts || null;
    const loaded = Array.isArray(snapshot.remoteAppointments);
    const note = snapshot.remoteAppointmentsError
      ? escape(snapshot.remoteAppointmentsError)
      : loaded
        ? `${appointments.length} appointment${appointments.length === 1 ? "" : "s"} shown${meta.hasMore ? " (more available)" : ""}.`
        : "Customers choose a free time on your website; confirm, decline, move or cancel their requests here.";
    const summary = counts
      ? `<div class="studio-order-meta" data-appointment-counts><span>${Number(counts.pending) || 0} waiting for you</span><span>${Number(counts.upcoming_confirmed) || 0} confirmed ahead</span><span>${Number(counts.refunds_due) || 0} deposit${Number(counts.refunds_due) === 1 ? "" : "s"} to refund</span></div>`
      : "";
    const rows = appointments.map(appointment => this.renderServiceAppointmentRow(appointment)).join("")
      || `<p class="store-workspace-empty">${loaded ? "No appointments match this filter." : "Load appointments from the live storefront."}</p>`;
    return `<article class="studio-panel" data-appointments-panel><div class="studio-panel-heading"><h2>Service appointments</h2><button type="button" class="btn-secondary studio-load-button" data-online-appointments-load aria-label="Load appointments">Load</button></div>
      <p class="studio-panel-note" data-online-appointments-status role="status" aria-live="polite">${note}</p>
      ${summary}
      <div class="studio-order-controls" style="grid-template-columns:minmax(0,1fr)"><label>Show<select data-appointments-filter>${this.serviceAppointmentFilters().map(item => `<option value="${item.key}"${item.key === filter.key ? " selected" : ""}>${escape(item.label)}</option>`).join("")}</select></label></div>
      ${rows}
      ${meta.hasMore ? `<button type="button" class="btn-secondary" data-appointments-more>Load more</button>` : ""}</article>`;
  },

  ownerAlertKindLabel(kind) {
    return ({
      order: "Order", booking: "Booking request", hold: "Hold request", attention: "Needs attention",
      booking_cancelled: "Booking cancelled", booking_rescheduled: "Booking moved", booking_refund: "Deposit to refund"
    })[kind] || "Alert";
  },

  ownerAlertRoute(kind) {
    return ["booking", "booking_cancelled", "booking_rescheduled", "booking_refund"].includes(kind)
      ? "/account/web/studio/store/bookings" : "";
  },
};
