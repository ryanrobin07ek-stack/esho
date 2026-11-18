// Owner appointments screen (service shops). The owner app's real request code (cloudflareRequest, the
// EshopInventoryBridge methods, the renderers and the click handlers extracted from index.html) talks to the
// REAL Worker (cloudflare/worker.js) over a stubbed fetch, with real SQLite (sql.js, every migration applied).
// So URLs, methods, bodies, auth headers and error_code handling are checked against the Worker itself.
import assert from "node:assert/strict";
import { readdir, readFile as readFileRaw } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import initSqlJs from "sql.js";
import { JSDOM } from "jsdom";
import worker from "../cloudflare/worker.js";

const readFile = async (path, options) => {
  const contents = await readFileRaw(path, options);
  return typeof contents === "string" ? contents.replace(/\r\n/g, "\n") : contents;
};
const app = await readFile(new URL("../index.html", import.meta.url), "utf8");
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const settle = (ms = 40) => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------------------------
// Worker side: real Worker, real SQLite
// ---------------------------------------------------------------------------------------------
const HOST = "https://eshop-storefront.workers.dev";
const TENANT = "shop-a";
const OWNER_KEY = "owner-key-for-shop-a";

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function createWorkerEnv(store = {}) {
  const SQL = await initSqlJs({
    locateFile: file => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });
  const db = new SQL.Database();
  db.exec("PRAGMA foreign_keys = ON");
  const directory = new URL("../cloudflare/migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
    db.exec(await readFile(new URL(file, directory), "utf8"));
  }
  const statement = (sql, values = []) => ({
    sql, values,
    async first() {
      const prepared = db.prepare(sql);
      try { prepared.bind(values); return prepared.step() ? prepared.getAsObject() : null; } finally { prepared.free(); }
    },
    async all() {
      const prepared = db.prepare(sql);
      try {
        prepared.bind(values);
        const results = [];
        while (prepared.step()) results.push(prepared.getAsObject());
        return { results };
      } finally { prepared.free(); }
    },
    runSync() { db.run(sql, values); return { success: true, meta: { changes: db.getRowsModified() } }; },
    async run() { return this.runSync(); }
  });
  const DB = {
    prepare(sql) { return { ...statement(sql), bind: (...values) => statement(sql, values) }; },
    async batch(statements) {
      db.run("BEGIN");
      try {
        const results = statements.map(item => item.runSync());
        db.run("COMMIT");
        return results;
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
    }
  };
  const values = new Map();
  const TENANTS = {
    async get(key, type) { const value = values.get(key); return value && type === "json" ? JSON.parse(value) : value || null; },
    async put(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
    async list({ prefix }) { return { keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true }; }
  };
  const catalog = {
    products: [{ id: 8, name: "Haircut", price: 2500, duration_minutes: 60 }, { id: 9, name: "Trim", price: 1000, duration_minutes: 30 }],
    categories: [],
    store: {
      name: "Studio", currency: "KES", offer_type: "services", service_timezone: "Africa/Nairobi",
      service_open_time: "09:00", service_close_time: "17:00", service_days: [0, 1, 2, 3, 4, 5, 6],
      service_buffer_minutes: 0, service_deposit_percent: 0, ...store
    }
  };
  const hash = await sha256Hex(OWNER_KEY);
  await TENANTS.put(`tenant:${TENANT}`, JSON.stringify({
    id: TENANT, name: TENANT, owner_username: `owner-${TENANT}`, owner_token_hash: hash, owner_token_hashes: [hash]
  }));
  db.run("INSERT INTO catalog_snapshots (tenant_id,payload,admin_payload,updated_at) VALUES (?,?,?,?)",
    [TENANT, JSON.stringify(catalog), JSON.stringify(catalog), "2026-01-01T00:00:00.000Z"]);
  db.run("INSERT INTO accounts (username,password_salt,password_hash,email,created_at) VALUES (?,?,?,?,?)",
    [`owner-${TENANT}`, "salt", "hash", "owner@owner.example", "now"]);
  db.run("INSERT INTO account_tenants (username,tenant_id) VALUES (?,?)", [`owner-${TENANT}`, TENANT]);
  const rows = (sql, bind = []) => {
    const result = db.exec(sql, bind);
    if (!result.length) return [];
    const [{ columns, values: data }] = result;
    return data.map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
  };
  return { db, rows, env: { DB, TENANTS } };
}

let ipCounter = 0;
const freshIp = () => `10.7.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
const localDate = daysAhead => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(Date.now() + daysAhead * 86_400_000)).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

// Books through the public Worker API like a storefront visitor.
async function book(env, startsAt, { name = "Wanjiru Customer", serviceId = 8 } = {}) {
  const response = await worker.fetch(new Request(`${HOST}/api/service-appointments?tenant=${TENANT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": freshIp() },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(), service_id: serviceId, starts_at: startsAt,
      customer_name: name, customer_email: "customer@example.test", customer_phone: "+254700000111"
    })
  }), env);
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}

async function futureSlots(env, daysAhead = 3) {
  const response = await worker.fetch(new Request(`${HOST}/api/service-appointments/availability?tenant=${TENANT}&service_id=8&date=${localDate(daysAhead)}`), env);
  assert.equal(response.status, 200);
  return (await response.json()).slots.map(slot => slot.starts_at);
}

// ---------------------------------------------------------------------------------------------
// App side: the owner app's real code, extracted from index.html
// ---------------------------------------------------------------------------------------------
const cloudflareRequestSource = app.match(/\n(  async cloudflareRequest\(path, options = \{\}[\s\S]*?)\n  \},\n\n  async loadTenantCatalog\(/)?.[1];
const bridgeStart = app.indexOf("window.EshopInventoryBridge = {");
const bridgeSource = app.slice(bridgeStart, app.indexOf("\n};", bridgeStart) + 3);
const rendererStart = app.indexOf("  serviceAppointmentFilters() {");
const rendererEnd = app.indexOf("  renderMainShopContent(path, snapshot, skipBusinessLens = false) {");
const alertsStart = app.indexOf("  renderOwnerAlertsPanel(snapshot) {");
const alertsEnd = app.indexOf("  renderDiscountPanel(snapshot) {");
const binderSource = app.match(/\n  (bindBusinessCloudActions\(container, path, snapshot, tenantId = [^\n]*\) \{[\s\S]*?)\n  \},\n\n  businessStoreId\(/)?.[1];
assert.ok(cloudflareRequestSource && bridgeStart > 0 && rendererStart > 0 && rendererEnd > rendererStart &&
  alertsStart > 0 && alertsEnd > alertsStart && binderSource, "The owner app code should be extractable from index.html.");

// Connects the extracted app code to a Worker env. `fetchLog` records every request the app sends.
function connectApp(env, { wrapFetch } = {}) {
  const fetchLog = [];
  const pending = { count: 0 };
  const realFetch = (url, init = {}) => {
    const request = new Request(url, init);
    fetchLog.push({
      url: String(url), path: new URL(String(url)).pathname + new URL(String(url)).search,
      method: request.method, authorization: request.headers.get("Authorization"),
      body: init.body ? JSON.parse(init.body) : undefined
    });
    pending.count += 1;
    return worker.fetch(request, env, { waitUntil() {} }).finally(() => { pending.count -= 1; });
  };
  const fetchStub = wrapFetch ? wrapFetch(realFetch) : realFetch;
  const controller = {
    cloudflareConnection: () => ({ token: OWNER_KEY, origin: HOST }),
    getActiveTenant: () => ({ id: TENANT }),
    isWebsiteBuilderDraftTenant: () => false,
    currentRoute: () => "/"
  };
  const methods = new Function("fetch", "navigator", "window", `return {${cloudflareRequestSource}\n  }\n}; `)(
    fetchStub, { onLine: true }, { location: { origin: HOST } }
  );
  controller.cloudflareRequest = methods.cloudflareRequest.bind(controller);
  const bridge = new Function("AppController", bridgeSource.replace("window.EshopInventoryBridge =", "return"))(controller);
  return { controller, bridge, fetchLog, pending };
}

function mountScreen(env, { wrapFetch, confirm = () => true } = {}) {
  const { controller, bridge, fetchLog, pending } = connectApp(env, { wrapFetch });
  const dom = new JSDOM(`<div id="c"></div>`, { url: "https://app.test/" });
  const { window } = dom;
  window.confirm = confirm;
  window.EshopInventoryBridge = bridge;
  const container = window.document.getElementById("c");
  const regionFactory = new Function(
    "AppUtils", "AppController", "SQLiteEngine", "window", "document", "CSS", "FormData", "console",
    `return {${app.slice(rendererStart, rendererEnd)}
      ${app.slice(alertsStart, alertsEnd)}
      formatMainShopMoney(amount, currency) { return \`\${currency} \${Number(amount).toFixed(2)}\`; },
      renderMainShopContent(path, snapshot) { return this.renderServiceAppointmentsPanel(snapshot); },
      ${binderSource}
  }
    };`
  );
  const renderers = regionFactory({ escapeHTML, showToast() {} }, controller, { getStore: () => ({ offer_type: "services" }) },
    window, window.document, { escape: value => value }, window.FormData, console);
  return {
    window, container, renderers, bridge, fetchLog, controller,
    status: () => container.querySelector("[data-online-appointments-status]")?.textContent || "",
    async open(filterKey) {
      const filter = renderers.serviceAppointmentFilter(filterKey);
      const result = await bridge.listServiceAppointments(TENANT, filter.query);
      const snapshot = {
        remoteAppointments: filter.clientFilter ? result.appointments.filter(filter.clientFilter) : result.appointments,
        remoteAppointmentsMeta: { filter: filter.key, counts: result.counts, hasMore: result.has_more === true, fetched: result.appointments.length }
      };
      container.innerHTML = renderers.renderMainShopContent("/account/web/studio/store/bookings", snapshot);
      renderers.bindBusinessCloudActions(container, "/account/web/studio/store/bookings", snapshot, TENANT);
    },
    row: id => container.querySelector(`[data-appointment-row="${id}"]`),
    rows: () => [...container.querySelectorAll("[data-appointment-row]")],
    click: element => element.click(),
    // Resolves once the screen has stopped talking to the Worker (no request in flight or newly started).
    async idle() {
      let quiet = 0;
      let seen = -1;
      while (quiet < 4) {
        await settle(10);
        quiet = pending.count === 0 && fetchLog.length === seen ? quiet + 1 : 0;
        seen = fetchLog.length;
      }
    }
  };
}

const status = screen => screen.status();
// Service 8 takes 60 minutes (4 grid blocks): every fifth slot never overlaps the one before.
const at = (slots, n) => slots[n * 5];

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

test("The list is requested from the Worker with the owner key and renders customer, service, time, status and counts", async () => {
  const { env } = await createWorkerEnv();
  const slots = await futureSlots(env);
  const first = await book(env, at(slots, 0), { name: "Wanjiru <script>" });
  await book(env, at(slots, 2), { name: "Otieno Second", serviceId: 9 });
  const screen = mountScreen(env);
  await screen.open();

  const listCall = screen.fetchLog.at(-1);
  assert.equal(listCall.method, "GET");
  assert.equal(listCall.authorization, `Bearer ${OWNER_KEY}`);
  assert.equal(listCall.path, `/api/service-appointments?tenant=${TENANT}&view=upcoming&status=pending%2Cconfirming%2Cconfirmed`);
  assert.equal(screen.rows().length, 2);
  const html = screen.row(first.appointment.id).outerHTML;
  assert.match(html, /Haircut/);
  assert.match(html, /Wanjiru &lt;script&gt;/, "Customer text is escaped.");
  assert.match(html, /customer@example\.test/);
  assert.match(html, /\+254700000111/);
  assert.match(html, /Waiting for you/);
  assert.match(html, /No deposit/);
  assert.match(screen.container.querySelector("[data-appointment-counts]").textContent, /2 waiting for you.*0 confirmed ahead.*0 deposits to refund/);
  const loadButton = screen.container.querySelector("[data-online-appointments-load]");
  assert.equal(loadButton.getAttribute("aria-label"), "Load appointments");
  assert.equal(loadButton.textContent, "Load");
  assert.equal(screen.container.querySelector("[data-appointments-filter]").value, "upcoming");
});

test("Confirm and decline send PATCH {id, action} and the list is refreshed from the Worker", async () => {
  const { env, rows } = await createWorkerEnv();
  const slots = await futureSlots(env);
  const a = await book(env, at(slots, 0), { name: "Confirm Me" });
  const b = await book(env, at(slots, 2), { name: "Decline Me" });
  const screen = mountScreen(env);
  await screen.open();

  screen.click(screen.row(a.appointment.id).querySelector('[data-service-appointment-action="confirm"]'));
  await screen.idle();
  const patch = screen.fetchLog.find(call => call.method === "PATCH");
  assert.equal(patch.path, `/api/service-appointments?tenant=${TENANT}`);
  assert.equal(patch.authorization, `Bearer ${OWNER_KEY}`);
  assert.deepEqual(patch.body, { id: a.appointment.id, action: "confirm" });
  assert.equal(rows("SELECT status FROM storefront_service_appointments WHERE id=?", [a.appointment.id])[0].status, "confirmed");
  assert.equal(screen.fetchLog.at(-1).method, "GET", "The list is reloaded after the action.");
  assert.equal(screen.row(a.appointment.id).dataset.appointmentStatus, "confirmed");
  assert.match(status(screen), /Appointment confirmed\./);

  screen.click(screen.row(b.appointment.id).querySelector('[data-service-appointment-action="reject"]'));
  await screen.idle();
  assert.deepEqual(screen.fetchLog.filter(call => call.method === "PATCH").at(-1).body, { id: b.appointment.id, action: "reject" });
  assert.equal(rows("SELECT status FROM storefront_service_appointments WHERE id=?", [b.appointment.id])[0].status, "rejected");
  assert.equal(screen.row(b.appointment.id), null, "A declined request leaves the Upcoming filter.");
  assert.match(status(screen), /declined/);
});

test("Declining is skipped when the owner dismisses the confirmation", async () => {
  const { env } = await createWorkerEnv();
  const booked = await book(env, at(await futureSlots(env), 1));
  const screen = mountScreen(env, { confirm: () => false });
  await screen.open();
  screen.click(screen.row(booked.appointment.id).querySelector('[data-service-appointment-action="reject"]'));
  await screen.idle();
  assert.equal(screen.fetchLog.filter(call => call.method === "PATCH").length, 0);
});

test("Cancel sends the optional reason and frees the slot for the next customer", async () => {
  const { env, rows } = await createWorkerEnv();
  const slots = await futureSlots(env);
  const booked = await book(env, at(slots, 1));
  const screen = mountScreen(env);
  await screen.open();
  screen.container.querySelector("[data-appointment-cancel-reason]").value = "  Stylist is ill  ";
  screen.click(screen.row(booked.appointment.id).querySelector('[data-service-appointment-action="cancel"]'));
  await screen.idle();
  assert.deepEqual(screen.fetchLog.find(call => call.method === "PATCH").body, { reason: "Stylist is ill", id: booked.appointment.id, action: "cancel" });
  const saved = rows("SELECT status,cancelled_by,cancel_reason FROM storefront_service_appointments WHERE id=?", [booked.appointment.id])[0];
  assert.deepEqual({ ...saved }, { status: "cancelled", cancelled_by: "owner", cancel_reason: "Stylist is ill" });
  assert.ok((await futureSlots(env)).includes(at(slots, 1)), "The Worker offers the slot again.");
  assert.match(status(screen), /Appointment cancelled\./);

  await screen.open("cancelled");
  const html = screen.row(booked.appointment.id).outerHTML;
  assert.match(html, /Cancelled by you: Stylist is ill/);
  assert.doesNotMatch(html, /data-service-appointment-action/, "A cancelled appointment has no further actions.");
});

test("Reschedule loads free slots from the Worker, sends the chosen time and moves the booking", async () => {
  const { env, rows } = await createWorkerEnv();
  const slots = await futureSlots(env);
  const booked = await book(env, at(slots, 1));
  const screen = mountScreen(env);
  await screen.open();
  const row = screen.row(booked.appointment.id);
  const panel = row.querySelector("[data-appointment-reschedule-panel]");
  assert.equal(panel.hidden, true);
  screen.click(row.querySelector("[data-appointment-reschedule-toggle]"));
  assert.equal(panel.hidden, false);

  const dateInput = panel.querySelector("[data-appointment-reschedule-date]");
  assert.equal(dateInput.value, localDate(3), "The date defaults to the appointment's own day in the shop's time zone.");
  dateInput.value = localDate(4);
  screen.click(panel.querySelector("[data-appointment-slots-load]"));
  await screen.idle();
  const slotsCall = screen.fetchLog.at(-1);
  assert.equal(slotsCall.method, "GET");
  assert.equal(slotsCall.path, `/api/service-appointments/availability?tenant=${TENANT}&service_id=8&date=${localDate(4)}`);
  const select = panel.querySelector("[data-appointment-reschedule-slot]");
  const options = [...select.options].filter(option => option.value);
  assert.ok(options.length > 3, "The Worker's free slots become options.");
  assert.equal(select.disabled, false);
  const confirmButton = panel.querySelector("[data-appointment-reschedule-confirm]");
  assert.equal(confirmButton.disabled, true, "Nothing is sent until a time is chosen.");
  select.value = options[1].value;
  select.dispatchEvent(new screen.window.Event("change"));
  assert.equal(confirmButton.disabled, false);
  screen.click(confirmButton);
  await screen.idle();

  const patch = screen.fetchLog.find(call => call.method === "PATCH");
  assert.deepEqual(patch.body, { starts_at: options[1].value, id: booked.appointment.id, action: "reschedule" });
  const saved = rows("SELECT starts_at,reschedule_count FROM storefront_service_appointments WHERE id=?", [booked.appointment.id])[0];
  assert.equal(saved.starts_at, options[1].value);
  assert.equal(saved.reschedule_count, 0, "An owner move does not use up the customer's limit.");
  assert.match(status(screen), /Appointment moved/);
});

test("Reschedule explains a missing date, a day without free times and a taken slot", async () => {
  const { env } = await createWorkerEnv({ service_open_time: "09:00", service_close_time: "11:00" });
  const slots = await futureSlots(env);
  const booked = await book(env, slots[0]); // 09:00-10:00
  const other = await book(env, slots[4], { name: "Other Customer", serviceId: 9 }); // 10:00-10:30
  const screen = mountScreen(env);
  await screen.open();
  const panel = screen.row(booked.appointment.id).querySelector("[data-appointment-reschedule-panel]");
  const find = panel.querySelector("[data-appointment-slots-load]");
  panel.querySelector("[data-appointment-reschedule-date]").value = "";
  screen.click(find);
  await screen.idle();
  assert.match(status(screen), /Choose the new date first/);

  // A date in the past has no free times.
  panel.querySelector("[data-appointment-reschedule-date]").value = "2020-01-01";
  screen.click(find);
  await screen.idle();
  assert.match(status(screen), /No free times on 2020-01-01/);
  assert.equal(panel.querySelector("[data-appointment-reschedule-slot]").disabled, true);

  // The Worker refuses a move onto another customer's slot with slot_unavailable.
  await assert.rejects(
    screen.bridge.updateServiceAppointment(TENANT, booked.appointment.id, "reschedule", { starts_at: other.appointment.starts_at }),
    error => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "slot_unavailable");
      assert.match(screen.renderers.serviceAppointmentErrorText(error), /not available \(outside opening hours, in the past, or fully booked\)/);
      return true;
    }
  );
});

test("Past confirmed appointments can be marked completed or no-show; future ones cannot", async () => {
  const { env, db, rows } = await createWorkerEnv();
  const slots = await futureSlots(env);
  const done = await book(env, at(slots, 0), { name: "Finished Visit" });
  const missed = await book(env, at(slots, 1), { name: "Did Not Come" });
  const future = await book(env, at(slots, 2), { name: "Still Ahead" });
  const screen = mountScreen(env);
  for (const id of [done.appointment.id, missed.appointment.id, future.appointment.id]) {
    await screen.bridge.updateServiceAppointment(TENANT, id, "confirm");
  }
  const past = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const pastEnd = new Date(Date.now() - 2 * 3_600_000).toISOString();
  db.run("UPDATE storefront_service_appointments SET starts_at=?, ends_at=?, slot_reserved_until=? WHERE id IN (?,?)",
    [past, pastEnd, pastEnd, done.appointment.id, missed.appointment.id]);

  await screen.open("past");
  assert.deepEqual(screen.rows().map(row => row.dataset.appointmentRow).sort(), [done.appointment.id, missed.appointment.id].sort());
  for (const row of screen.rows()) {
    const actions = [...row.querySelectorAll("[data-service-appointment-action]")].map(button => button.dataset.serviceAppointmentAction);
    assert.deepEqual(actions, ["complete", "no_show"], "A started confirmed appointment only offers completed / no-show.");
  }
  screen.click(screen.row(done.appointment.id).querySelector('[data-service-appointment-action="complete"]'));
  await screen.idle();
  assert.equal(rows("SELECT status FROM storefront_service_appointments WHERE id=?", [done.appointment.id])[0].status, "completed");
  assert.match(status(screen), /marked completed/);

  screen.click(screen.row(missed.appointment.id).querySelector('[data-service-appointment-action="no_show"]'));
  await screen.idle();
  assert.equal(rows("SELECT status FROM storefront_service_appointments WHERE id=?", [missed.appointment.id])[0].status, "no_show");
  assert.deepEqual(screen.fetchLog.filter(call => call.method === "PATCH").map(call => call.body.action), ["confirm", "confirm", "confirm", "complete", "no_show"]);

  await screen.open("upcoming");
  const futureActions = [...screen.row(future.appointment.id).querySelectorAll("[data-service-appointment-action]")].map(button => button.dataset.serviceAppointmentAction);
  assert.deepEqual(futureActions, ["cancel"]);
  await assert.rejects(screen.bridge.updateServiceAppointment(TENANT, future.appointment.id, "complete"), error => {
    assert.equal(error.code, "not_started");
    assert.match(screen.renderers.serviceAppointmentErrorText(error), /only after its start time/);
    return true;
  });
});

test("A paid deposit on a cancelled booking shows as deposit to refund and can be marked refunded", async () => {
  const { env, db, rows } = await createWorkerEnv();
  const booked = await book(env, at(await futureSlots(env), 1), { name: "Paid Customer" });
  db.run(`UPDATE storefront_service_appointments SET status='cancelled', cancelled_by='customer', cancelled_at=?,
          payment_status='paid', deposit_percent=20, deposit_cents=50000, deposit_refund_due=1 WHERE id=?`,
    [new Date().toISOString(), booked.appointment.id]);
  const screen = mountScreen(env);
  await screen.open("refunds");

  const listCall = screen.fetchLog.at(-1);
  assert.equal(listCall.path, `/api/service-appointments?tenant=${TENANT}&limit=200&view=all&status=cancelled`);
  assert.match(screen.container.querySelector("[data-appointment-counts]").textContent, /1 deposit to refund/);
  const row = screen.row(booked.appointment.id);
  assert.ok(row.hasAttribute("data-needs-attention"));
  assert.match(row.querySelector("[data-appointment-refund-due]").textContent, /KES 500\.00.*Refund it in your Paystack dashboard/);
  assert.match(row.textContent, /Cancelled by the customer/);
  assert.match(row.textContent, /20% deposit \(KES 500\.00\)/);
  assert.match(row.textContent, /Payment: paid/);

  screen.click(row.querySelector('[data-service-appointment-action="deposit_refunded"]'));
  await screen.idle();
  assert.deepEqual(screen.fetchLog.find(call => call.method === "PATCH").body, { id: booked.appointment.id, action: "deposit_refunded" });
  const saved = rows("SELECT deposit_refund_due, deposit_refunded_at FROM storefront_service_appointments WHERE id=?", [booked.appointment.id])[0];
  assert.equal(saved.deposit_refund_due, 0);
  assert.ok(saved.deposit_refunded_at);
  assert.equal(screen.row(booked.appointment.id), null, "It leaves the refunds filter.");
  assert.match(status(screen), /marked as refunded/);
});

test("Filters send the Worker's query and Load more asks for the next page", async () => {
  const { env } = await createWorkerEnv();
  const slots = await futureSlots(env);
  for (let index = 0; index < 5; index += 1) await book(env, at(slots, index), { name: `Customer ${index}` });
  // Make the Worker page in twos so one screen of results is not enough.
  const screen = mountScreen(env, {
    wrapFetch: realFetch => (url, init) => {
      const target = new URL(String(url));
      if ((init?.method || "GET") === "GET" && target.pathname === "/api/service-appointments") target.searchParams.set("limit", "2");
      return realFetch(target.toString(), init);
    }
  });
  await screen.open();
  assert.equal(screen.rows().length, 2);
  assert.match(status(screen), /2 appointments shown \(more available\)/);
  screen.click(screen.container.querySelector("[data-appointments-more]"));
  await screen.idle();
  const more = screen.fetchLog.at(-1);
  assert.match(more.path, /offset=2/);
  assert.equal(screen.rows().length, 4, "The next page is appended.");
  screen.click(screen.container.querySelector("[data-appointments-more]"));
  await screen.idle();
  assert.equal(screen.rows().length, 5);
  assert.equal(screen.container.querySelector("[data-appointments-more]"), null);

  const select = screen.container.querySelector("[data-appointments-filter]");
  select.value = "pending";
  select.dispatchEvent(new screen.window.Event("change"));
  await screen.idle();
  assert.match(screen.fetchLog.at(-1).path, /view=upcoming&status=pending/);
  assert.equal(screen.container.querySelector("[data-appointments-filter]").value, "pending", "The chosen filter is kept after redraw.");
  assert.deepEqual(screen.renderers.serviceAppointmentFilters().map(filter => filter.key),
    ["upcoming", "pending", "past", "refunds", "cancelled", "all"]);
});

test("Every Worker error_code the owner can hit has a plain message; wrong keys and stale rows are handled", async () => {
  const { env, db } = await createWorkerEnv({ service_deposit_percent: 20 });
  const slots = await futureSlots(env);
  const booked = await book(env, at(slots, 1));
  const screen = mountScreen(env);
  const text = error => screen.renderers.serviceAppointmentErrorText(error);

  // deposit_unavailable: a deposit is configured but Paystack is not set up in this environment.
  await assert.rejects(screen.bridge.updateServiceAppointment(TENANT, booked.appointment.id, "confirm"), error => {
    assert.equal(error.code, "deposit_unavailable");
    assert.match(text(error), /Finish Paystack setup/);
    return true;
  });
  // appointment_not_found
  await assert.rejects(screen.bridge.updateServiceAppointment(TENANT, crypto.randomUUID(), "cancel"), error => {
    assert.equal(error.code, "appointment_not_found");
    assert.match(text(error), /no longer exists/);
    return true;
  });
  // invalid_request (unknown action)
  await assert.rejects(screen.bridge.updateServiceAppointment(TENANT, booked.appointment.id, "explode"), error => {
    assert.equal(error.code, "invalid_request");
    assert.match(text(error), /not accepted/);
    return true;
  });
  // slot_unchanged
  await assert.rejects(screen.bridge.updateServiceAppointment(TENANT, booked.appointment.id, "reschedule", { starts_at: booked.appointment.starts_at }), error => {
    assert.equal(error.code, "slot_unchanged");
    assert.match(text(error), /already the time/);
    return true;
  });
  // appointment_started: cancelling something that has already begun.
  db.run("UPDATE storefront_service_appointments SET starts_at=?, ends_at=?, slot_reserved_until=? WHERE id=?",
    [new Date(Date.now() - 600_000).toISOString(), new Date(Date.now() + 3_000_000).toISOString(), new Date(Date.now() + 3_000_000).toISOString(), booked.appointment.id]);
  await assert.rejects(screen.bridge.updateServiceAppointment(TENANT, booked.appointment.id, "cancel"), error => {
    assert.equal(error.code, "appointment_started");
    assert.match(text(error), /already started/);
    return true;
  });
  // invalid_state: confirming a booking that is already rejected.
  db.run("UPDATE storefront_service_appointments SET status='rejected' WHERE id=?", [booked.appointment.id]);
  await assert.rejects(screen.bridge.updateServiceAppointment(TENANT, booked.appointment.id, "confirm"), error => {
    assert.equal(error.code, "invalid_state");
    assert.match(text(error), /cannot be changed that way any more/);
    return true;
  });
  // unauthorized: a key that does not belong to the shop.
  const wrongKey = connectApp(env);
  wrongKey.controller.cloudflareConnection = () => ({ token: "not-this-shops-key", origin: HOST });
  await assert.rejects(wrongKey.bridge.listServiceAppointments(TENANT), error => {
    assert.equal(error.status, 401);
    assert.equal(error.code, "unauthorized");
    assert.match(text(error), /sign-in for this shop has expired/);
    return true;
  });

  // Codes the Worker documents but a test cannot easily provoke still get specific text.
  for (const code of ["appointment_busy", "appointment_changed", "service_unavailable", "too_large", "payment_provider_error", "rate_limited", "storage_unavailable"]) {
    const message = text(Object.assign(new Error("raw server text"), { code }));
    assert.notEqual(message, "raw server text", `${code} must not fall back to the raw message`);
    assert.ok(message.length > 20);
  }
  assert.equal(text(Object.assign(new Error("boom"), { status: 500 })), "boom", "Unknown failures show the server's own message.");
  assert.equal(text("not an error"), "Could not update this appointment.");
  assert.match(text(Object.assign(new Error("x"), { status: 429 })), /Too many requests/);
});

test("appointment_changed shows the explanation, reloads the list and does not leave the button stuck", async () => {
  const { env } = await createWorkerEnv();
  const booked = await book(env, at(await futureSlots(env), 1));
  let patches = 0;
  const screen = mountScreen(env, {
    wrapFetch: realFetch => async (url, init) => {
      if ((init?.method || "GET") === "PATCH") {
        patches += 1;
        return new Response(JSON.stringify({ error: "This booking changed.", error_code: "appointment_changed" }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
      return realFetch(url, init);
    }
  });
  await screen.open();
  const before = screen.fetchLog.length;
  screen.click(screen.row(booked.appointment.id).querySelector('[data-service-appointment-action="confirm"]'));
  await screen.idle();
  assert.equal(patches, 1);
  assert.equal(screen.fetchLog.length, before + 1, "The list is reloaded from the Worker after the conflict.");
  assert.match(status(screen), /changed while you were working.*reloaded/);
  assert.equal(screen.row(booked.appointment.id).querySelector('[data-service-appointment-action="confirm"]').disabled, false);
});

test("A failed action shows the specific message and re-enables the button; the list stays as it was", async () => {
  const { env } = await createWorkerEnv({ service_deposit_percent: 20 });
  const booked = await book(env, at(await futureSlots(env), 1));
  const screen = mountScreen(env);
  await screen.open();
  const button = screen.row(booked.appointment.id).querySelector('[data-service-appointment-action="confirm"]');
  assert.match(button.textContent, /Confirm & create deposit link/);
  screen.click(button);
  await screen.idle();
  assert.match(status(screen), /Finish Paystack setup/);
  assert.equal(button.disabled, false);
  assert.equal(screen.row(booked.appointment.id).dataset.appointmentStatus, "pending");
});

test("Expired requests and requests being confirmed offer no actions", () => {
  const renderers = new Function("AppUtils", `return {${app.slice(rendererStart, rendererEnd)}
    formatMainShopMoney(amount, currency) { return \`\${currency} \${Number(amount).toFixed(2)}\`; } };`)({ escapeHTML });
  const base = {
    id: "11111111-1111-4111-8111-111111111111", reference: "AB12CD34", service_id: "8", service_name: "Haircut",
    starts_at: new Date(Date.now() + 86_400_000).toISOString(), timezone: "Africa/Nairobi", duration_minutes: 60,
    customer_name: "Pat", customer_email: "pat@example.test", customer_phone: "0700", status: "pending", expired: false,
    deposit_percent: 0, deposit_cents: 0, currency: "KES", payment_status: "not_required",
    deposit_refund_due: false, reschedule_count: 0
  };
  const expired = renderers.renderServiceAppointmentRow({ ...base, expired: true });
  assert.match(expired, /Expired/);
  assert.doesNotMatch(expired, /data-service-appointment-action|data-appointment-reschedule/);
  const confirming = renderers.renderServiceAppointmentRow({ ...base, status: "confirming", payment_status: "initializing" });
  assert.match(confirming, /deposit link is being created/);
  assert.doesNotMatch(confirming, /data-service-appointment-action/);
  const confirmed = renderers.renderServiceAppointmentRow({
    ...base, status: "confirmed", deposit_percent: 20, deposit_cents: 50000, payment_status: "pending",
    payment_authorization_url: "https://checkout.paystack.com/abc123"
  });
  assert.match(confirmed, /Open deposit link/);
  assert.match(confirmed, /data-appointment-reschedule-toggle/);
  const lookalike = renderers.renderServiceAppointmentRow({
    ...base, status: "confirmed", payment_status: "pending", payment_authorization_url: "https://evil.example/checkout.paystack.com/"
  });
  assert.doesNotMatch(lookalike, /Open deposit link/, "Only real Paystack checkout links are offered.");
  const rescheduledNote = renderers.renderServiceAppointmentRow({ ...base, reschedule_count: 2 });
  assert.match(rescheduledNote, /moved 2 times by the customer/);
});

// ---------------------------------------------------------------------------------------------
// Owner alerts for the new notification kinds
// ---------------------------------------------------------------------------------------------

test("Booking, cancellation, move and refund alerts from the Worker show with a clear label and a link to appointments", async () => {
  const { env, db } = await createWorkerEnv();
  const slots = await futureSlots(env, 5);
  const first = await book(env, at(slots, 0), { name: "Cancelling Customer" });
  const second = await book(env, at(slots, 2), { name: "Moving Customer" });
  const manage = (token, body) => worker.fetch(new Request(`${HOST}/api/service-appointments/manage?tenant=${TENANT}`, {
    method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": freshIp() }, body: JSON.stringify({ token, ...body })
  }), env, { waitUntil() {} });
  // Customer cancels one booking (with a paid deposit) and moves another.
  db.run("UPDATE storefront_service_appointments SET payment_status='paid', deposit_percent=20, deposit_cents=50000 WHERE id=?", [first.appointment.id]);
  assert.equal((await manage(first.manage_token, { action: "cancel" })).status, 200);
  assert.equal((await manage(second.manage_token, { action: "reschedule", starts_at: at(slots, 4) })).status, 200);
  // A deposit that arrives for a cancelled booking raises its own alert in the outbox.
  db.run(`INSERT INTO owner_notifications (id,tenant_id,kind,ref,title,body,created_at,read_at)
          VALUES (?,?,?,?,?,?,?,NULL)`,
    [crypto.randomUUID(), TENANT, "booking_refund", first.appointment.id, "Deposit to refund", "Wanjiru paid a deposit for a cancelled booking.", new Date().toISOString()]);

  const screen = mountScreen(env);
  globalThis.window = { localStorage: { getItem: () => null, setItem() {} }, AppController: screen.controller };
  try {
    await import("../src/business-notifications.js?owner-appointments-alerts");
    const list = await globalThis.window.BusinessNotifications.owner.list(TENANT);
    const kinds = list.notifications.map(row => row.kind);
    for (const kind of ["booking", "booking_cancelled", "booking_rescheduled", "booking_refund"]) {
      assert.ok(kinds.includes(kind), `the outbox contains ${kind}`);
    }
    const html = screen.renderers.renderOwnerAlertsPanel({ remoteAlerts: list });
    const dom = new JSDOM(`<div id="c">${html}</div>`);
    const rowFor = kind => dom.window.document.querySelector(`[data-owner-alert-kind="${kind}"]`);
    assert.match(rowFor("booking_cancelled").textContent, /Booking cancelled/);
    assert.match(rowFor("booking_rescheduled").textContent, /Booking moved/);
    assert.match(rowFor("booking_refund").textContent, /Deposit to refund/);
    assert.match(rowFor("booking").textContent, /Booking request/);
    for (const kind of ["booking", "booking_cancelled", "booking_rescheduled", "booking_refund"]) {
      assert.equal(rowFor(kind).querySelector("a").getAttribute("href"), "/account/web/studio/store/bookings");
    }
    assert.equal(screen.renderers.ownerAlertKindLabel("something_new"), "Alert", "An unknown kind is a generic alert.");
    assert.equal(screen.renderers.ownerAlertRoute("order"), "");
    assert.doesNotMatch(html, /customer@example\.test|\+254700000111/, "Alerts never carry contact details.");
  } finally {
    delete globalThis.window;
  }
});

test("Owner alert toasts mark deposits to refund as urgent like attention alerts", async () => {
  const method = app.match(/\n  (startOwnerAlertPolling\(\) \{[\s\S]*?)\n  \},\n\n  async syncPendingStorefrontOrders/)?.[1];
  assert.ok(method);
  const toasts = [];
  let first;
  const fakeWindow = {
    BusinessNotifications: { owner: { pollIntervalMs: 1e9, poll: async () => ({ fresh: [
      { title: "New booking", kind: "booking" }, { title: "Deposit to refund", kind: "booking_refund" }, { title: "Stock short", kind: "attention" }
    ] }) } },
    setInterval: () => 1,
    setTimeout: callback => { first = callback; return 1; }
  };
  const run = new Function("window", "document", "AppUtils", `return {${method}\n  }\n};`)(
    fakeWindow, { visibilityState: "visible", addEventListener() {} },
    { showToast: (message, tone) => toasts.push([message, tone]) }
  );
  run.getActiveTenant = () => ({ id: TENANT });
  run.startOwnerAlertPolling();
  first();
  await settle(10);
  assert.deepEqual(toasts, [["New booking", "success"], ["Deposit to refund", "danger"], ["Stock short", "danger"]]);
});

// ---------------------------------------------------------------------------------------------
// Publishing keeps the three booking settings
// ---------------------------------------------------------------------------------------------

test("The builder's capacity, cancellation cutoff and reschedule limit survive the owner app's save and are sent back to the builder", async () => {
  const saveMethod = app.match(/async saveLitrusMixerCatalog\(input, isDraftEditor, expectedTenantId\) \{([\s\S]*?)\n  \},\n\n  openCloudflarePublishModal/)?.[1];
  assert.ok(saveMethod);
  const run = async shop => {
    const tenant = { id: "shop", name: "Test shop" };
    const save = new Function("SQLiteEngine", "window", `return async function (input, isDraftEditor, expectedTenantId) {${saveMethod}\n};`)(
      { select: () => [] }, { ShopSQLite: { async flush() {} } }
    );
    let saved = null;
    await save.call({
      getActiveTenant: () => tenant,
      tenantCatalogs: () => [{ tenant_id: "shop", categories: [], store: { service_capacity: 9 }, products: [] }],
      setActiveTenantCatalog(_tenant, catalog) { saved = catalog; }
    }, { catalog: { shop: { name: "Studio", offer_type: "services", ...shop }, categories: [], products: [] } }, false, "shop");
    return saved.store;
  };
  const custom = await run({ service_capacity: 3, service_cancel_cutoff_hours: 0, service_max_reschedules: 0 });
  assert.equal(custom.service_capacity, 3);
  assert.equal(custom.service_cancel_cutoff_hours, 0, "A cutoff of 0 is kept, not replaced by the default.");
  assert.equal(custom.service_max_reschedules, 0, "A reschedule limit of 0 is kept.");
  const defaults = await run({});
  assert.deepEqual([defaults.service_capacity, defaults.service_cancel_cutoff_hours, defaults.service_max_reschedules], [1, 2, 2]);
  const clamped = await run({ service_capacity: 99, service_cancel_cutoff_hours: 500, service_max_reschedules: 50 });
  assert.deepEqual([clamped.service_capacity, clamped.service_cancel_cutoff_hours, clamped.service_max_reschedules], [20, 168, 10],
    "The same bounds as the Worker.");

  // The catalogue posted to the builder carries the saved values.
  const sendCatalog = app.match(/const sendCatalog = \(\) => \{([\s\S]*?)\n        \};/)?.[1];
  const messages = [];
  new Function("SQLiteEngine", "StudioRenderers", "isDraftEditor", "litrusFrame", "window", "savedLitrusRecipe",
    "validLitrusHtml", "savedLitrusHtml", "AppUtils", sendCatalog)(
    {
      getStore: () => ({ name: "Studio", offer_type: "services", service_capacity: 4, service_cancel_cutoff_hours: 0, service_max_reschedules: 1 }),
      getCategories: () => [], select: () => []
    },
    {}, false, { contentWindow: { postMessage: message => messages.push(message) } },
    { location: { origin: "https://app.test" } }, null, () => false, "", { showToast() {} }
  );
  const shop = messages[0].catalog.shop;
  assert.deepEqual([shop.service_capacity, shop.service_cancel_cutoff_hours, shop.service_max_reschedules], [4, 0, 1]);
});

test("An exact time lets the owner move a booking 15 minutes later even though the slot list hides overlapping times", async () => {
  const { env, rows } = await createWorkerEnv(); // capacity 1
  const slots = await futureSlots(env);
  const booked = await book(env, at(slots, 1)); // 60-minute Haircut
  const start = new Date(booked.appointment.starts_at);
  const later = new Date(start.getTime() + 15 * 60 * 1000).toISOString();
  const screen = mountScreen(env);
  await screen.open();
  const panel = screen.row(booked.appointment.id).querySelector("[data-appointment-reschedule-panel]");
  screen.click(screen.row(booked.appointment.id).querySelector("[data-appointment-reschedule-toggle]"));
  panel.querySelector("[data-appointment-slots-load]").click();
  await screen.idle();
  const offered = [...panel.querySelectorAll("[data-appointment-reschedule-slot] option")].map(option => option.value);
  assert.ok(!offered.includes(later), "The public list does not offer a time that overlaps the booking's own seats (Worker limitation).");

  const confirmButton = panel.querySelector("[data-appointment-reschedule-confirm]");
  assert.equal(confirmButton.disabled, true);
  const time = panel.querySelector("[data-appointment-reschedule-time]");
  assert.equal(panel.dataset.timezone, "Africa/Nairobi");
  const localParts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(later)).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  time.value = `${localParts.hour}:${localParts.minute}`;
  time.dispatchEvent(new screen.window.Event("input"));
  assert.equal(confirmButton.disabled, false, "Typing an exact time enables the move button.");
  screen.click(confirmButton);
  await screen.idle();

  const patch = screen.fetchLog.find(call => call.method === "PATCH");
  assert.deepEqual(patch.body, { starts_at: later, id: booked.appointment.id, action: "reschedule" });
  assert.equal(patch.authorization, `Bearer ${OWNER_KEY}`);
  assert.equal(rows("SELECT starts_at FROM storefront_service_appointments WHERE id=?", [booked.appointment.id])[0].starts_at, later);
  assert.match(status(screen), /Appointment moved/);
});

test("An exact time that the Worker refuses shows the slot_unavailable message and a bad date is caught before any request", async () => {
  const { env, rows } = await createWorkerEnv();
  const slots = await futureSlots(env);
  const booked = await book(env, at(slots, 1));
  await book(env, at(slots, 3), { name: "Other Customer" });
  const screen = mountScreen(env);
  await screen.open();
  const panel = screen.row(booked.appointment.id).querySelector("[data-appointment-reschedule-panel]");
  const time = panel.querySelector("[data-appointment-reschedule-time]");
  const confirmButton = panel.querySelector("[data-appointment-reschedule-confirm]");

  // 03:00 is outside the 09:00-17:00 opening hours.
  panel.querySelector("[data-appointment-reschedule-date]").value = localDate(3);
  time.value = "03:00";
  time.dispatchEvent(new screen.window.Event("input"));
  screen.click(confirmButton);
  await screen.idle();
  assert.match(status(screen), /not available/);
  assert.equal(rows("SELECT starts_at FROM storefront_service_appointments WHERE id=?", [booked.appointment.id])[0].starts_at, booked.appointment.starts_at);

  const before = screen.fetchLog.length;
  panel.querySelector("[data-appointment-reschedule-date]").value = "";
  screen.click(confirmButton);
  await screen.idle();
  assert.equal(screen.fetchLog.length, before, "No request is sent without a valid date.");
  assert.match(status(screen), /valid date and time/);
});

test("serviceAppointmentLocalToIso converts shop-local wall time to UTC across zones and rejects bad input", () => {
  const { renderers } = mountScreen({});
  assert.equal(renderers.serviceAppointmentLocalToIso("2026-11-21", "09:15", "Africa/Nairobi"), "2026-11-21T06:15:00.000Z");
  assert.equal(renderers.serviceAppointmentLocalToIso("2026-07-01", "09:00", "America/New_York"), "2026-07-01T13:00:00.000Z");
  assert.equal(renderers.serviceAppointmentLocalToIso("2026-01-15", "09:00", "America/New_York"), "2026-01-15T14:00:00.000Z");
  assert.equal(renderers.serviceAppointmentLocalToIso("2026-03-08", "02:30", "America/New_York"), "", "A time skipped by daylight saving is rejected.");
  assert.equal(renderers.serviceAppointmentLocalToIso("", "09:00", "Africa/Nairobi"), "");
  assert.equal(renderers.serviceAppointmentLocalToIso("2026-11-21", "", "Africa/Nairobi"), "");
  assert.equal(renderers.serviceAppointmentLocalToIso("2026-11-21", "09:00", "Not/AZone"), "");
});
