// Online payment for POS invoices.
//
// An invoice lives on the owner's device. The owner asks for a pay link, which creates one row in
// invoice_payments and returns https://<shop>/pay/<token>. The customer opens that page, enters an email
// (Paystack needs one for the receipt) and is sent to Paystack. The payment is confirmed twice over: when the
// customer returns to the page, and by the signed Paystack webhook. The owner's device then asks for the list of
// payments and records each paid invoice as a sale.
//
// Everything that already exists for website checkout (the shop's connected subaccount, the live/test mode
// checks, the reference format, the webhook signature) is passed in rather than copied.

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;
const INVOICE_NUMBER_PATTERN = /^INV-[A-Z0-9-]{4,60}$/;
const MAX_AMOUNT_CENTS = 1_000_000_000;
const INITIALIZING_STALE_MS = 2 * 60 * 1000;
const MAX_REQUEST_BYTES = 4_096;
const RECONCILE_AT_MOST = 5;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]
));

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createInvoicePayments(deps) {
  const {
    jsonResponse, cleanText, EMAIL_PATTERN, paystackAuthorization, paystackAccountMode, paystackSubaccountReady,
    getEffectivePaystackSubaccount, paystackCurrency, paystackCurrencyLabel, paystackReference,
    transactionMatchesSubaccount, tenantHostname, authorizeOwner, limitPublicWrite, notifyShopOwner,
    formatMoneyCents, startLimit, verifyLimit
  } = deps;

  const secure = headers => ({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://checkout.paystack.com; " +
      "frame-ancestors 'none'; base-uri 'none'",
    ...headers
  });

  function page(title, body, status = 200) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f3f4f6;color:#111827}
main{max-width:30rem;margin:0 auto;padding:1.5rem 1rem}
.card{background:#fff;border-radius:14px;padding:1.5rem;box-shadow:0 1px 4px rgba(0,0,0,.12)}
h1{font-size:1.25rem;margin:0 0 .25rem}.muted{color:#6b7280;margin:.25rem 0 1rem}
.amount{font-size:2rem;font-weight:700;margin:.5rem 0 1rem}
label{display:block;font-weight:600;margin-bottom:.25rem}
input{width:100%;box-sizing:border-box;padding:.75rem;border:1px solid #d1d5db;border-radius:10px;font:inherit}
button,.btn{display:block;width:100%;box-sizing:border-box;margin-top:1rem;padding:.85rem;border:0;border-radius:10px;
background:#111827;color:#fff;font:inherit;font-weight:600;text-align:center;text-decoration:none;cursor:pointer}
.ok{color:#047857}.err{color:#b91c1c}
</style></head><body><main><div class="card">${body}</div></main></body></html>`;
    return new Response(html, { status, headers: secure({ "Content-Type": "text/html; charset=utf-8" }) });
  }

  const money = row => formatMoneyCents(Number(row.amount_cents), row.currency);

  function viewPage(token, row, { error = "" } = {}) {
    if (row.status === "paid") return paidPage(row);
    const prefilled = row.customer_email ? ` value="${escapeHtml(row.customer_email)}"` : "";
    return page(`Pay invoice ${row.invoice_number}`, `
<h1>${escapeHtml(row.shop_name || "Invoice payment")}</h1>
<p class="muted">Invoice ${escapeHtml(row.invoice_number)}${row.customer_name ? ` for ${escapeHtml(row.customer_name)}` : ""}</p>
<div class="amount">${escapeHtml(money(row))}</div>
${error ? `<p class="err" role="alert">${escapeHtml(error)}</p>` : ""}
<form method="post" action="/pay/${token}/start">
<label for="email">Your email, for the receipt</label>
<input id="email" name="email" type="email" inputmode="email" autocomplete="email" required maxlength="240"${prefilled}>
<button type="submit">Pay ${escapeHtml(money(row))}</button>
</form>
<p class="muted" style="margin-top:1rem;font-size:.85rem">You pay on Paystack's secure page by card or M-Pesa.</p>`);
  }

  function paidPage(row) {
    return page("Payment received", `
<h1 class="ok">Payment received</h1>
<p class="muted">${escapeHtml(row.shop_name || "The shop")} has been paid ${escapeHtml(money(row))} for invoice ${escapeHtml(row.invoice_number)}.</p>
<p>Thank you.</p>`);
  }

  function pendingPage(token, row) {
    return page("Waiting for confirmation", `
<h1>We have not seen the payment yet</h1>
<p class="muted">If you just paid, it can take a moment to confirm. If you did not finish paying, you can try again.</p>
<a class="btn" href="/pay/${token}/return?reference=${encodeURIComponent(row.payment_reference || "")}">Check again</a>
<a class="btn" href="/pay/${token}" style="background:#6b7280">Back to the invoice</a>`);
  }

  async function shopNameFor(env, tenantId) {
    const tenant = await env.TENANTS?.get(`tenant:${tenantId}`, "json").catch(() => null);
    return cleanText(tenant?.name || "", 120).trim();
  }

  async function findByToken(env, token) {
    return TOKEN_PATTERN.test(token)
      ? await env.DB.prepare("SELECT * FROM invoice_payments WHERE token=?").bind(token).first()
      : null;
  }

  async function findByReference(env, reference) {
    return await env.DB.prepare("SELECT * FROM invoice_payments WHERE payment_reference=?").bind(reference).first();
  }

  // Asks Paystack what happened to this payment. Returns the transaction, or null when it cannot be read.
  async function verifyWithPaystack(env, reference) {
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: paystackAuthorization(env.PAYSTACK_SECRET_KEY)
      });
      if (!response.ok) return null;
      return (await response.json())?.data || null;
    } catch {
      return null;
    }
  }

  function transactionMatches(transaction, row, mode) {
    return transaction?.reference === row.payment_reference
      && Number(transaction.amount) === Number(row.amount_cents)
      && transaction.currency === row.currency
      && transactionMatchesSubaccount(transaction, row.payment_subaccount_code, mode);
  }

  // Marks the invoice paid once, and tells the owner. A second confirmation of the same payment changes nothing.
  async function markPaid(env, ctx, row, transaction = null) {
    const now = new Date().toISOString();
    const channel = cleanText(transaction?.channel || "", 40).trim().toLowerCase() || null;
    const changed = await env.DB.prepare(
      "UPDATE invoice_payments SET status='paid',paid_at=?,channel=COALESCE(?,channel),updated_at=? WHERE token=? AND status!='paid'"
    ).bind(now, channel, now, row.token).run();
    if (Number(changed.meta?.changes || 0)) {
      notifyShopOwner(env, ctx, row.tenant_id, () => ({
        kind: "payment",
        ref: row.invoice_number,
        title: `Invoice ${row.invoice_number} paid`,
        body: `${row.customer_name || "A customer"} paid ${money(row)} for invoice ${row.invoice_number} online.`
      }));
    }
    return { ...row, status: "paid", paid_at: row.paid_at || now, channel: channel || row.channel };
  }

  async function settleFromPaystack(env, ctx, row) {
    if (row.status === "paid") return row;
    if (!row.payment_reference) return row;
    const mode = paystackAccountMode(env.PAYSTACK_SECRET_KEY);
    const transaction = await verifyWithPaystack(env, row.payment_reference);
    if (!transaction) return row;
    if (transaction.status === "success" && transactionMatches(transaction, row, mode)) {
      return await markPaid(env, ctx, row, transaction);
    }
    if (["failed", "abandoned"].includes(transaction.status) && row.status === "pending") {
      await env.DB.prepare(
        "UPDATE invoice_payments SET status='failed',updated_at=? WHERE token=? AND status='pending'"
      ).bind(new Date().toISOString(), row.token).run();
      return { ...row, status: "failed" };
    }
    return row;
  }

  // ----- owner API ---------------------------------------------------------------------------------------------

  async function createLink(request, env, tenantId) {
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST, OPTIONS" });
    if (!await authorizeOwner(request, env, tenantId)) {
      return jsonResponse({ error: "Shop owner authorization required." }, 401);
    }
    if (!env.DB) return jsonResponse({ error: "Payment storage is not configured." }, 503);
    const mode = paystackAccountMode(env.PAYSTACK_SECRET_KEY || "");
    if (!mode) return jsonResponse({ error: "Paystack is not configured on this server." }, 503);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: "Request is too large." }, 413);
    }
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }
    const invoiceNumber = typeof input?.invoice_number === "string" ? input.invoice_number.trim().toUpperCase() : "";
    const amount = Number(input?.amount);
    const cents = Math.round(amount * 100);
    const currency = typeof input?.currency === "string" ? input.currency.trim().toUpperCase() : "";
    if (!INVOICE_NUMBER_PATTERN.test(invoiceNumber)) return jsonResponse({ error: "A valid invoice number is required." }, 400);
    if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || cents < 1 || cents > MAX_AMOUNT_CENTS) {
      return jsonResponse({ error: "The invoice amount must be a positive amount." }, 400);
    }
    if (!paystackCurrency(currency)) {
      return jsonResponse({ error: `Online payment needs the invoice to be in ${paystackCurrencyLabel()}.` }, 409);
    }
    const customerName = cleanText(input?.customer_name, 160).trim();
    const suppliedEmail = cleanText(input?.customer_email, 240).trim().toLowerCase();
    const customerEmail = EMAIL_PATTERN.test(suppliedEmail) ? suppliedEmail : "";
    const subaccount = await getEffectivePaystackSubaccount(env, tenantId);
    if (!paystackSubaccountReady(subaccount, mode)) {
      return jsonResponse({
        error: mode === "live"
          ? "Connect a verified live Paystack account in Payments before sending a pay link."
          : "Connect a test Paystack account in Payments before sending a pay link.",
        error_code: "paystack_not_ready"
      }, 409);
    }
    const shopName = await shopNameFor(env, tenantId);
    const existing = await env.DB.prepare(
      "SELECT * FROM invoice_payments WHERE tenant_id=? AND invoice_number=?"
    ).bind(tenantId, invoiceNumber).first();
    const now = new Date().toISOString();
    const linkFor = token => `https://${tenantHostname(tenantId)}/pay/${token}`;
    if (existing?.status === "paid") {
      return jsonResponse({ status: "paid", paid_at: existing.paid_at, url: linkFor(existing.token) });
    }
    if (!existing) {
      const token = newToken();
      await env.DB.prepare(
        `INSERT INTO invoice_payments (token,tenant_id,invoice_number,amount_cents,currency,customer_name,customer_email,
           shop_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?, 'unpaid', ?, ?)`
      ).bind(token, tenantId, invoiceNumber, cents, currency, customerName, customerEmail, shopName, now, now).run();
      return jsonResponse({ status: "unpaid", url: linkFor(token), amount_cents: cents, currency }, 201);
    }
    // The invoice was edited after the link went out: the same link now asks for the new amount, and a payment
    // already started for the old amount is left behind.
    const changed = Number(existing.amount_cents) !== cents || existing.currency !== currency;
    if (changed) {
      await env.DB.prepare(
        `UPDATE invoice_payments SET amount_cents=?,currency=?,customer_name=?,customer_email=?,shop_name=?,status='unpaid',
           payment_reference=NULL,payment_subaccount_code=NULL,payment_authorization_url=NULL,updated_at=? WHERE token=?`
      ).bind(cents, currency, customerName, customerEmail || existing.customer_email, shopName, now, existing.token).run();
    } else {
      await env.DB.prepare(
        "UPDATE invoice_payments SET customer_name=?,customer_email=?,shop_name=?,updated_at=? WHERE token=?"
      ).bind(customerName || existing.customer_name, customerEmail || existing.customer_email, shopName || existing.shop_name,
        now, existing.token).run();
    }
    return jsonResponse({ status: changed ? "unpaid" : existing.status, url: linkFor(existing.token), amount_cents: cents, currency });
  }

  async function listPayments(request, env, tenantId, ctx) {
    if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, OPTIONS" });
    if (!await authorizeOwner(request, env, tenantId)) {
      return jsonResponse({ error: "Shop owner authorization required." }, 401);
    }
    if (!env.DB) return jsonResponse({ error: "Payment storage is not configured." }, 503);
    const found = await env.DB.prepare(
      "SELECT * FROM invoice_payments WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 500"
    ).bind(tenantId).all();
    let rows = found.results || [];
    // A missed webhook should not leave a paid invoice looking unpaid: ask Paystack about the few that are waiting.
    if (env.PAYSTACK_SECRET_KEY) {
      const waiting = rows.filter(row => row.status === "pending" && row.payment_reference).slice(0, RECONCILE_AT_MOST);
      const settled = new Map();
      for (const row of waiting) settled.set(row.token, await settleFromPaystack(env, ctx, row));
      rows = rows.map(row => settled.get(row.token) || row);
    }
    return jsonResponse({
      payments: rows.map(row => ({
        invoice_number: row.invoice_number,
        status: row.status,
        amount_cents: row.amount_cents,
        currency: row.currency,
        paid_at: row.paid_at,
        channel: row.status === "paid" ? row.channel : undefined,
        reference: row.status === "paid" ? row.payment_reference : undefined
      }))
    });
  }

  async function handleApi(request, env, tenantId, action, ctx) {
    if (action === "payment-link") return await createLink(request, env, tenantId);
    if (action === "payments") return await listPayments(request, env, tenantId, ctx);
    return jsonResponse({ error: "Unsupported invoice payment action." }, 404);
  }

  // ----- the customer's pages ----------------------------------------------------------------------------------

  async function startPayment(request, env, token, row) {
    if (request.method !== "POST") return viewPage(token, row);
    if (row.status === "paid") return paidPage(row);
    if (!await limitPublicWrite(request, env, row.tenant_id, "invoice-pay-start", startLimit)) {
      return page("Too many attempts", "<h1>Too many attempts</h1><p class=\"muted\">Please wait a few minutes and try again.</p>", 429);
    }
    const mode = paystackAccountMode(env.PAYSTACK_SECRET_KEY || "");
    if (!mode) return page("Payment unavailable", "<h1>Payment is not available</h1><p class=\"muted\">Please contact the shop.</p>", 503);
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).byteLength > 2_048) return page("Request too large", "<h1>Request too large</h1>", 413);
    const email = cleanText(new URLSearchParams(bodyText).get("email") || "", 240).trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return viewPage(token, row, { error: "Enter a valid email address." });
    // A checkout that was already started is reused, so the customer is never charged through two references.
    if (row.status === "pending" && row.payment_authorization_url) {
      return Response.redirect(row.payment_authorization_url, 303);
    }
    const subaccount = await getEffectivePaystackSubaccount(env, row.tenant_id);
    if (!paystackSubaccountReady(subaccount, mode)) {
      return page("Payment unavailable", "<h1>Payment is not available right now</h1><p class=\"muted\">Please contact the shop.</p>", 409);
    }
    const reference = paystackReference();
    const now = new Date().toISOString();
    const reserved = await env.DB.prepare(
      `UPDATE invoice_payments SET status='initializing',payment_reference=?,payment_subaccount_code=?,customer_email=?,
         payment_authorization_url=NULL,updated_at=?
       WHERE token=? AND (status IN ('unpaid','failed') OR (status='initializing' AND updated_at<=?))`
    ).bind(reference, subaccount.subaccount_code, email, now, token,
      new Date(Date.now() - INITIALIZING_STALE_MS).toISOString()).run();
    if (!Number(reserved.meta?.changes || 0)) {
      return viewPage(token, row, { error: "Payment is already being set up. Wait a moment and try again." });
    }
    const fail = async message => {
      await env.DB.prepare("UPDATE invoice_payments SET status='failed',updated_at=? WHERE token=? AND payment_reference=?")
        .bind(new Date().toISOString(), token, reference).run();
      return viewPage(token, { ...row, status: "failed" }, { error: message });
    };
    let data;
    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: paystackAuthorization(env.PAYSTACK_SECRET_KEY),
        body: JSON.stringify({
          email,
          amount: Number(row.amount_cents),
          currency: row.currency,
          subaccount: subaccount.subaccount_code,
          transaction_charge: 0,
          bearer: "subaccount",
          reference,
          callback_url: `https://${tenantHostname(row.tenant_id)}/pay/${token}/return`,
          metadata: { tenant_id: row.tenant_id, invoice_number: row.invoice_number, invoice_payment: true }
        })
      });
      if (!response.ok) return await fail("Paystack could not start this payment. Please try again.");
      data = (await response.json())?.data;
    } catch {
      return await fail("Could not reach Paystack. Please try again.");
    }
    let authorizationUrl;
    try {
      authorizationUrl = new URL(data?.authorization_url);
    } catch {
      return await fail("Paystack returned an invalid checkout link.");
    }
    if (authorizationUrl.protocol !== "https:" || authorizationUrl.hostname !== "checkout.paystack.com" ||
        data?.reference !== reference) {
      return await fail("Paystack returned an invalid checkout response.");
    }
    await env.DB.prepare(
      "UPDATE invoice_payments SET status='pending',payment_authorization_url=?,updated_at=? WHERE token=? AND payment_reference=?"
    ).bind(authorizationUrl.toString(), new Date().toISOString(), token, reference).run();
    return Response.redirect(authorizationUrl.toString(), 303);
  }

  async function returnFromPaystack(request, env, ctx, token, row) {
    if (row.status === "paid") return paidPage(row);
    if (!await limitPublicWrite(request, env, row.tenant_id, "invoice-pay-verify", verifyLimit)) {
      return page("Too many checks", "<h1>Too many checks</h1><p class=\"muted\">Please wait a few minutes and try again.</p>", 429);
    }
    const settled = await settleFromPaystack(env, ctx, row);
    return settled.status === "paid" ? paidPage(settled) : pendingPage(token, settled);
  }

  async function handlePayPage(request, env, ctx, token, view) {
    if (!env.DB) return page("Unavailable", "<h1>Payments are not available</h1>", 503);
    if (request.method !== "GET" && request.method !== "POST") {
      return new Response("Method not allowed.", { status: 405, headers: secure({ Allow: "GET, POST" }) });
    }
    const row = await findByToken(env, token);
    if (!row) return page("Not found", "<h1>This payment link is not valid</h1><p class=\"muted\">Check the link you were sent, or ask the shop for a new one.</p>", 404);
    if (view === "start") return await startPayment(request, env, token, row);
    if (view === "return") return await returnFromPaystack(request, env, ctx, token, row);
    return viewPage(token, row);
  }

  // ----- the signed Paystack webhook -----------------------------------------------------------------------------

  // Returns a Response when the reference belongs to an invoice payment, or null when it does not.
  async function settleFromWebhook(env, ctx, data, reference) {
    const row = await findByReference(env, reference);
    if (!row) return null;
    const mode = paystackAccountMode(env.PAYSTACK_SECRET_KEY);
    if (data?.status !== "success" || !transactionMatches(data, row, mode)) {
      return jsonResponse({ error: "Payment does not match the expected invoice amount and currency." }, 409);
    }
    await markPaid(env, ctx, row, data);
    return jsonResponse({ ok: true, payment_status: "paid", invoice_number: row.invoice_number });
  }

  // A signed payment that names an invoice but matches no row (the invoice was edited after the customer started
  // paying): tell the owner once, so the money is reconciled by hand instead of going unnoticed.
  async function alertUnmatched(env, ctx, data) {
    const tenantId = typeof data?.metadata?.tenant_id === "string" ? data.metadata.tenant_id : "";
    const invoiceNumber = typeof data?.metadata?.invoice_number === "string" ? data.metadata.invoice_number : "";
    if (!data?.metadata?.invoice_payment || !tenantId || !INVOICE_NUMBER_PATTERN.test(invoiceNumber)) return false;
    notifyShopOwner(env, ctx, tenantId, () => ({
      kind: "attention",
      ref: invoiceNumber,
      title: `Unmatched payment for ${invoiceNumber}`,
      body: `A customer paid for invoice ${invoiceNumber} but the payment could not be matched, probably because the invoice ` +
        "was changed after the link was sent. Check Paystack and mark the invoice paid by hand."
    }));
    return true;
  }

  return { handleApi, handlePayPage, settleFromWebhook, alertUnmatched, findByReference };
}
