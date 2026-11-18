# Storefront commerce: protection, payments, discounts and owner alerts

This document is the contract for the Worker's storefront commerce endpoints. The Litrus storefront (`public/litrus-mixer/live-catalog.js`) and the Craft owner app both rely on the shapes below. If you change a shape in `worker.js`, change it here and in `tests/cloudflare.worker.test.mjs`.

It covers migrations `0025` to `0029`. Apply them before deploying (`npm run cf:d1:migrate:remote`). Without them, order creation (without a discount code), holds and every pre-existing route keep working (rate limits fall back to KV and then fail open), but the new owner endpoints need their tables (and `0028` adds `storefront_orders.discount_released`, which every order status change uses, so migrate before deploying).

Conventions:

* All money in `*_cents` fields is an integer in minor units. Fields without the suffix (`subtotal`, `discount`, `shipping`, `total`) are the same amounts as decimals. The default currency is KES.
* "Owner" endpoints accept the shop owner key, a signed-in account session that owns the shop, or the admin key (`Authorization: Bearer <token>`), except where noted. Other shops' keys are rejected (401) and other shops' rows are never visible.
* The shop is chosen by hostname (`<shop>.rrobin.co.ke`, a mapped custom domain) or, on `localhost`/`*.workers.dev`, by `?tenant=<shop>`.
* Errors are `{ "error": "message" }` with an HTTP status, plus an `error_code` where listed.

## Customer endpoints

### `POST /api/orders`

Request (JSON, at most 64 KB):

```json
{
  "idempotency_key": "uuid (required, stable per checkout attempt)",
  "customer_name": "required",
  "customer_email": "valid email; may be blank ONLY when payment_method is \"manual\" (see below)",
  "payment_method": "optional: \"manual\" (the shop settles it, e.g. cash or mobile money) or \"paystack\". Older storefronts send neither and keep needing an email",
  "customer_phone": "optional",
  "shipping_address": "string", "city": "string", "postal_code": "string", "country": "string",
  "delivery_method": "delivery | pickup (default delivery)",
  "discount_code": "optional, case-insensitive, whitespace trimmed",
  "hold_ids": ["optional: ids of the customer's own approved holds"],
  "items": [
    { "product_id": "catalogue id or published theme id", "quantity": 1,
      "variant_id": "optional, see Variants" }
  ]
}
```

The Worker prices the order itself from the published catalogue. Any client-supplied price, subtotal, discount, total or option label is ignored.

Response `201` (or `200` with `"duplicate": true` when the idempotency key was already used):

```json
{
  "order": {
    "order_number": "ORD-...", "status": "pending",
    "customer_name": "", "customer_email": "", "customer_phone": "",
    "shipping_address": "", "city": "", "postal_code": "", "country": "", "currency": "KES",
    "subtotal": 62.5, "discount": 2.5, "shipping": 100, "total": 160,
    "subtotal_cents": 6250, "discount_cents": 250, "shipping_cents": 10000, "total_cents": 16000,
    "payment_status": "unpaid | initializing | pending | paid | failed",
    "payment_method": "null | paystack | cash | mobile_money | bank | other",
    "discount_code": "SAVE10 or null",
    "needs_attention": false, "attention_reason": null,
    "items": [
      { "product_id": 20, "name": "Sneaker", "sku": "SNK-20", "quantity": 2, "unit_price": 30,
        "variant_id": "v42", "variant_label": "Size: 42",
        "option1_name": "Size", "option1_value": "42", "option2_name": "", "option2_value": "" }
    ],
    "created_at": "", "updated_at": ""
  },
  "discount_cents": 250
}
```

`subtotal` is before the discount and excludes shipping, so `total = subtotal - discount + shipping`. Lines for products without options have no `variant_*` / `option*` keys. `hold_ids` are never echoed.

Errors: `400` malformed request, `409` item/stock/hold/discount problems, `413` too large, `429` throttled (with `Retry-After`).

Item errors (`409`, with `error_code`): `variant_required`, `variant_unavailable`, `variant_out_of_stock`, `price_invalid`, `discount_invalid`. Without a code: unavailable product, bad quantity (1 to 99), not enough stock, or a claimed hold that is expired or does not match the customer's name and contact.

#### Variants

Products with options carry `variants` in the published catalogue: `{ id, option1_name, option1_value, option2_name, option2_value, size, color, price, stock }`. To buy one, send its `id` as `variant_id` on the line.

* The unit price is the variant's `price`, or the product price when the variant price is `null`.
* The quantity (all lines of the same variant added together) must not exceed the variant's `stock`.
* The stored line carries the variant id and a label built from the catalogue (`"Size: 42 / Color: Red"`), not from the client.
* Sending a `variant_id` that the product does not have is `409 variant_unavailable`.
* A product that has variants needs a `variant_id`, otherwise `409 variant_required`. The one exception is older storefronts that cannot send variants: when no variant changes the price, the line is accepted without one and is priced at the product price.
* Several variants of one product may appear as separate lines. Stock for shared inventory is still deducted per product SKU.

#### Holds on an order

`hold_ids` lists the customer's approved, unexpired holds. Every claimed hold must belong to the same name (case and spacing ignored) and the same email, or phone digits, used on the order, and its product must be in the order, otherwise `409` ("One of these holds is expired or does not match..."). The claimed quantity is not counted against the stock available to this order. Holds are released when the order is paid or cancelled.

### `POST /api/discounts/validate`

Preview only: it never redeems a code. Throttled (30 / 10 min per IP per shop).

Request: `{ "code": "SAVE10", "items": [ { "product_id": 7, "quantity": 2, "variant_id": "optional" } ] }` (1 to 50 items).

Response `200`:

* valid: `{ "valid": true, "code": "SAVE10", "type": "percent", "subtotal_cents": 2500, "discount_cents": 250, "discount": 2.5 }`
* not valid: `{ "valid": false, "error": "That discount code has expired." }` (also for unknown codes, other shops' codes, an unmet minimum spend and unusable items; the message never says which shop owns a code).

The preview is advisory. The order endpoint re-evaluates the code atomically.

### `POST /api/payments/paystack/initialize`

`{ "order_number": "ORD-..." }` returns `{ "order_number", "reference", "authorization_url" }`. Throttled (10 / 10 min per IP per shop). A cancelled or already paid order is `409`. An order stuck in `initializing` for more than 10 minutes can be initialized again. A shop that does not exist is `404 { error: "Shop not found." }` (checked before the rate limit, so made-up shops cost nothing). Every reference issued for an order is kept in `storefront_payment_attempts`: if a customer pays an older link after the order was re-initialized, the webhook and verify still match the order and settle it (the paid reference becomes the order's reference).

### `GET /api/payments/paystack/verify?reference=ESHOP_...`

Verifies with Paystack and settles the order (see Settlement). Returns `{ "tenant_id", "order", "order_number", "payment_status", "paid_at" }`.

### `POST /api/product-holds`

Request: `{ "idempotency_key": "uuid", "product_id": 7, "quantity": 1, "customer_name": "", "contact": "email or phone" }`. Response `201` `{ "hold": { "id", "status": "approved", "expires_at", ... } }`, or `200` with `"duplicate": true` for a repeated idempotency key. The browser keeps `hold.id` and sends it later in `hold_ids`.

Holds are auto-approved for anonymous visitors, so they are capped: at most 5 items per request, at most 3 holds per IP per shop counted over the shop's hold duration (a hold that is refused, or a retry, does not use a slot), and all active holds together cannot exceed 75% of a product's stock. Larger quantities must be ordered (`409`). Throttled at 12 / 10 min per IP per shop.

## Rate limits

Public write endpoints are throttled per client IP with an atomic D1 counter (`rate_limit_counters`). Counter keys contain only a salted hash of the IP (`RATE_LIMIT_SALT`, falling back to the admin key; both are Worker secrets), never a raw address. If the table is unavailable the Worker uses a best-effort KV counter, and with no storage it fails open so a storage problem never takes the storefront down. A throttled request returns `429` with `Retry-After`. Limits are constants at the top of `worker.js`:

| Endpoint | Limit |
| --- | --- |
| `POST /api/orders` | 20 / 10 min per IP per shop, plus 300 / hour per shop |
| `POST /api/product-holds` | 12 / 10 min per IP per shop |
| `POST /api/payments/paystack/initialize` | 10 / 10 min per IP per shop |
| `POST /api/service-appointments` | 10 / hour per IP per shop |
| `POST /api/discounts/validate` | 30 / 10 min per IP per shop |
| `POST /api/analytics/events` | 120 / 10 min per IP per shop |
| `POST /api/analytics/visit` | 120 / 10 min per IP per shop |
| `POST /api/product-interest` | 240 / 10 min per IP per shop |

The per-shop order limit means a determined attacker with many IPs can still slow ordering for one shop; it protects the database, not the shop's availability.

### Order response shapes: customer versus owner

Customer-reachable responses (order create, idempotent replay, Paystack verify) never include `payment_method`, `payment_reference`, `needs_attention` or `attention_reason`. Owner responses (`GET`/`PATCH /api/orders`, the manual payment endpoint) add `payment_method`, `payment_reference` (the reference typed when marking paid, or the Paystack reference for online payments), `needs_attention` and `attention_reason`.

### Email, Paystack and the published `paystack_connected` flag

* `customer_email` may be blank only for `payment_method: "manual"`; a non-blank email must always be valid. The order is stored with an empty email, so no receipt is sent.
* `POST /api/payments/paystack/initialize` on an order without an email answers `409 { error_code: "email_required" }`.
* Every served Litrus page carries `store.paystack_connected` (`1` or `0`) in its embedded catalogue: `1` only when the shop has a ready Paystack account (the same test initialize uses) and the server has a Paystack key. If the state cannot be read the field is omitted and the storefront keeps its default (Paystack offered, email required). The flag is as fresh as the page cache (at most one hour after the owner connects or disconnects Paystack); payment initialize re-checks the real state, so a stale flag never takes money wrongly.

### Storefront analytics events

`POST /api/analytics/events` also accepts `checkout_start`, `purchase` and `booking_submitted` (migration `0029` widens the table's CHECK). `GET` adds `checkout_starts`, `purchases` and `booking_submissions` to every `product_activity` row; existing fields are unchanged.

### Known behaviour: cancelling a paid order

Cancelling an order that is already paid releases its holds and discount redemption but does NOT put the deducted stock back and does not refund the money. The owner restocks and refunds by hand. This is deliberate until the owner decides otherwise.

## Owner endpoints

### Manual payments: `POST /api/store/orders/:order_number/payment`

Request: `{ "method": "cash | mobile_money | bank | other", "reference": "optional note, e.g. an M-Pesa code", "amount_cents": "optional, must equal the order total" }`. Only full payments are recorded.

Response `200`: `{ "ok": true, "duplicate": false, "needs_attention": false, "order": { ... } }`. `duplicate: true` means the order was already paid (by an earlier call, or by a Paystack payment that landed first); the first recorded method wins and nothing is deducted again. A cancelled order is `409`; an unknown or other shop's order is `404`; an unknown method is `400`.

### Orders: `GET /api/orders`, `PATCH /api/orders`

`GET` lists the shop's latest 200 orders (shape above, plus the owner-only fields below). Both methods accept the same credentials as every other owner endpoint (owner key, an account session that owns the shop, or the admin key). `PATCH { "order_number", "status": "pending | confirmed | processing | ready | fulfilled | cancelled" }` returns `{ "order": {...} }`. Moving an order to `cancelled` releases its holds and gives its discount redemption back, exactly once even when the request is repeated or sent in parallel. Moving a cancelled order back to any open status re-takes the redemption (within `usage_limit`); if the code's limit has meanwhile been used up by other orders the request is `409 { error_code: "discount_limit_reached" }` and the order stays cancelled.

### Discount codes: `/api/store/discounts`

* `GET` returns `{ "discounts": [ ... ] }` (up to 200, newest first).
* `POST` creates, `PATCH` updates (fields left out are kept), `DELETE ?code=SAVE10` removes.

Fields: `code` (2 to 40 characters of letters, numbers, `-` or `_`; stored upper-case), `type` (`percent` or `fixed`), `value` (percent: whole number 1 to 100; fixed: whole cents greater than zero), `min_order_cents` (default 0, checked against the item subtotal), `starts_at` / `ends_at` (ISO 8601 or null; `ends_at` after `starts_at`), `usage_limit` (whole number at least 1, or null for unlimited), `active` (boolean, default true).

A discount object is `{ code, type, value, min_order_cents, starts_at, ends_at, usage_limit, used_count, active, created_at, updated_at }`. `POST` returns `201 { "discount" }`, `PATCH` returns `200 { "discount" }`, `DELETE` returns `{ "ok": true, "deleted": "SAVE10" }`. A duplicate code is `409`, an unknown code `404`, a shop can have 200 codes.

How a code is applied: percent discounts round down to whole cents; fixed discounts never exceed the item subtotal; shipping is never discounted. `used_count` is increased atomically when the order is created (concurrent checkouts cannot exceed `usage_limit`), is not increased by an idempotent replay, and is given back when the order is cancelled. The order stores `discount_cents` and `discount_code`.

### Owner alerts: `GET /api/store/notifications`, `POST /api/store/notifications/read`

`GET ?limit=50&since=<ISO timestamp>` returns `{ "notifications": [ { id, kind, ref, title, body, created_at, read_at } ], "unread_count": 3 }`, newest first. `kind` is `order`, `booking`, `hold` or `attention`. `POST /read` takes `{ "ids": [ ... up to 100 ] }` or `{ "all": true }`.

When an order, a booking request or a hold is created, and when a payment needs attention, the Worker writes the event to the outbox and emails the owner account's recovery email (when `RESEND_API_KEY` and `EMAIL_FROM` are set; at most 20 emails per shop per hour). This is best effort under `ctx.waitUntil`: it never blocks or fails the customer's request. Events contain the order or booking reference, the product or service, totals and the customer's first name only, never an email, phone or address. The `push_subscriptions` table is the customer newsletter list and is not used for owner alerts.

## Settlement

Settlement of any payment (manual, Paystack webhook, Paystack verify) is idempotent and race safe: stock is deducted once per order and SKU, and only the call that actually records the payment reports a problem, so parallel webhooks, verifies and manual records produce one alert.

* Money is never lost. If stock changed since checkout and the stock trigger refuses a deduction, the order is still recorded as paid, the lines that can be deducted are deducted, and the order gets `needs_attention = true`, `attention_reason = "insufficient_stock:SKU1,SKU2"` and an `attention` alert.
* A payment that arrives for an order cancelled in the meantime is recorded as paid with `attention_reason = "paid_after_cancel"`. Stock is not deducted. The owner should refund or reopen it.
* A second payment for an order that is already paid (a Paystack charge after a manual record, or a second checkout link of the same order paid as well) adds `duplicate_payment` to `attention_reason` (joined with `;` when the order is already flagged for something else) and sends one alert, so the customer can be refunded.
* A signed `charge.success` whose reference matches nothing but whose metadata names an existing order flags that order `attention_reason = "unmatched_payment"`, alerts the owner once and still answers `404` (Paystack retries).
* Holds the order claimed are released as part of settlement.

## Stuck states and publishing

* A `payment_status = 'initializing'` order older than 10 minutes can be re-initialized.
* A Paystack `setup_in_progress` lock older than 5 minutes is cleared by the next setup attempt.
* A service appointment stuck in `confirming` with `payment_status = 'initializing'` for more than 10 minutes returns to `pending` when the owner next opens or updates it.
* While a catalogue is saved ahead of its republish, the shop keeps serving its last published storefront (with the live catalogue data injected) instead of an error. A shop whose catalogue names a retired or unknown theme, or no hosted theme at all, also keeps serving its last published storefront. Without any published storefront the visitor sees a plain "This website is not available" 404 page, and the shop is left out of `/shops` and the sitemaps.
* Only Litrus Mixer (and the Craft platform's own storefront) can be published. Publishing a retired theme returns `422`; shops published earlier keep working.

## Sessions and owner tokens

Account sign-in mints one owner token per shop, recorded in the tenant record (`owner_login_tokens`, with username and session) and capped at 20 per shop (oldest dropped first). `POST /api/auth/logout` revokes the token minted by that session. A password reset revokes every sign-in token and trims unattributable legacy tokens, and the admin owner-key recovery route (`PUT /api/tenants/:id/owner-key`) revokes them as well. The shop's original owner key (`owner_token_hash`) is not touched by logout or password reset.

`POST /api/inventory/sale` (the register's shared-stock sale sync) requires the shop owner key, an owner account session or the admin key.

## Shop deletion

`DELETE /api/tenants/:id` (owner key or admin key) removes the shop's D1 rows (orders, customer contact details, holds, newsletter subscribers, inventory, discounts, notifications, analytics, Paystack subaccount record, custom hostname and the account link), its R2 objects (`media/`, `published-sites/`, `business/`, `push/`) and its KV records (published pointer, product aliases, Search Console tag, cached AI data, the cached shop directory), and asks Cloudflare to release the custom hostname. A Paystack subaccount row that is still another shop's owner default is retained without the bank name. The tenant record (with the owner keys) is deleted last, so a partly failed delete can be retried. The response reports `failed_tables`, `custom_hostname_released`, `paystack_subaccount` and `r2_objects_deleted`. The address is reserved for its previous owner account for 90 days (`tenant-tombstone:<id>` in KV) so nobody else can claim it.

## Retention

`scheduled()` runs daily (`triggers.crons` in `wrangler.jsonc`, `17 3 * * *` UTC). It deletes `storefront_event_daily`, `storefront_visits` and `storefront_product_interest` older than 400 days, `owner_notifications` older than 90 days, expired `rate_limit_counters` (hold caps are kept for up to 32 days, everything else for 2 days) and expired appointment slots, in bounded batches. Analytics events are only recorded for products that exist in the shop's published catalogue; unknown product ids are ignored.

## Search

Litrus Mixer routes with `#/p/<product id>`. The Worker serves real `/products/<slug>` URLs for Litrus shops, emits Product JSON-LD and canonical tags for them, lists them in `sitemap.xml` and bridges the path to the Litrus route in the browser. Categories and pages are not advertised for Litrus because it has no route for them.
