# Storefront commerce: protection, payments, discounts and owner alerts

This document is the contract for the Worker's storefront commerce endpoints. The Litrus storefront (`public/litrus-mixer/live-catalog.js`) and the Craft owner app both rely on the shapes below. If you change a shape in `worker.js`, change it here and in `tests/cloudflare.worker.test.mjs`.

It covers migrations `0025` to `0030` (`0030` is service bookings, see "Service bookings"). Apply them before deploying (`npm run cf:d1:migrate:remote`). Without them, order creation (without a discount code), holds and every pre-existing route keep working (rate limits fall back to KV and then fail open), but the new owner endpoints need their tables (and `0028` adds `storefront_orders.discount_released`, which every order status change uses, so migrate before deploying).

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
| `POST /api/service-appointments/manage` | 120 / hour per IP per shop |
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

`GET ?limit=50&since=<ISO timestamp>` returns `{ "notifications": [ { id, kind, ref, title, body, created_at, read_at } ], "unread_count": 3 }`, newest first. `kind` is `order`, `booking`, `hold`, `attention`, or one of the service-booking kinds `booking_cancelled`, `booking_rescheduled`, `booking_refund` (see "Service bookings"). Clients should treat an unknown `kind` as a generic alert. `POST /read` takes `{ "ids": [ ... up to 100 ] }` or `{ "all": true }`.

When an order, a booking request or a hold is created, and when a payment needs attention, the Worker writes the event to the outbox and emails the owner account's recovery email (when `RESEND_API_KEY` and `EMAIL_FROM` are set; at most 20 emails per shop per hour). This is best effort under `ctx.waitUntil`: it never blocks or fails the customer's request. Events contain the order or booking reference, the product or service, totals and the customer's first name only, never an email, phone or address. The `push_subscriptions` table is the customer newsletter list and is not used for owner alerts.

## Service bookings

Shops with `store.offer_type = "services"` take appointments instead of orders. Everything below is implemented in `cloudflare/worker.js` (search for `handleServiceAppointments`), the storefront UI is in `public/litrus-mixer/live-catalog.js`, and migration `0030_service_booking_management.sql` adds the storage. All endpoints live under `/api/service-appointments` and use the same shop selection as every other endpoint (hostname, or `?tenant=<shop>` on `localhost`/`*.workers.dev`).

### Shop settings (published in `store`, all optional)

| Field | Meaning | Valid values | Default |
| --- | --- | --- | --- |
| `service_days` | open weekdays, 0 = Sunday | array of 0 to 6 | `[1,2,3,4,5,6]` |
| `service_open_time`, `service_close_time` | opening hours, shop-local `HH:MM` | close later than open | `09:00` / `17:00` |
| `service_timezone` | IANA zone the hours are in | valid zone | `Africa/Nairobi` |
| `service_buffer_minutes` | gap kept after every booking | 0, 15, 30, 45 or 60 | 0 |
| `service_deposit_percent` | deposit taken after the owner confirms | 0 to 100 (KES only) | 0 |
| `service_capacity` | bookings that may overlap at the same time (staff or chairs), shared by every service of the shop | whole number 1 to 20 | 1 |
| `service_cancel_cutoff_hours` | customers can cancel or move a booking until this many hours before it starts (0 = until the start) | whole number 0 to 168 | 2 |
| `service_max_reschedules` | how many times a customer may move one booking | whole number 0 to 10 | 2 |

An absent, blank, fractional, non-numeric or out-of-range value for the last three is stored as the default. They are validated again at publish time (`PUT /api/catalog`) and read from the published catalogue at booking time, so the owner app must send them in the catalogue's `store` object (the Litrus builder already sends `service_capacity`, `service_cancel_cutoff_hours` and `service_max_reschedules` in its publish payload). Lowering the capacity while bookings exist never evicts anyone: new bookings are simply refused until a block drops below the new limit.

Bookable start times are on the 15-minute grid, on an open day, at least 15 minutes from now, and leave room for the service length plus the buffer before closing.

### How capacity is enforced

`storefront_appointment_slots` holds one row per 15-minute block per occupied seat, primary key `(tenant_id, slot_start, seat)`. A booking inserts one row for every block it covers (service length plus buffer). Each insert takes the lowest free seat and fails with a NOT NULL violation when the block already holds `service_capacity` bookings. The inserts run in one D1 batch, which is a transaction, so a booking that does not fit in every block is rejected as a whole and parallel requests for the last seat cannot both succeed (tested with parallel requests against real SQLite). Pending requests hold their seats for 24 hours (`request_expires_at`); confirmed bookings hold them until the end of the service plus buffer. Cancelling, declining and moving release them in the same batch that changes the booking.

### Statuses

`pending` (waiting for the owner, valid for 24 hours), `confirming` (deposit link being created, internal and short-lived), `confirmed`, `rejected` (declined by the owner), `cancelled`, `completed`, `no_show`. `cancelled`, `rejected`, `completed` and `no_show` are final. A `pending` booking older than `request_expires_at` keeps its status but reports `expired: true`, no longer holds its seats and cannot be confirmed.

### Customer endpoints (no login)

Every customer response is `Cache-Control: private, no-store`, never contains the customer's email, phone or name, and never contains another customer's data.

#### `GET /api/service-appointments/availability?service_id=<id>&date=YYYY-MM-DD`

`200 { "date", "timezone", "capacity": 2, "slots": [ { "starts_at": "2026-11-20T06:00:00.000Z", "label": "9:00 AM", "remaining": 2 } ] }`. `remaining` is how many more bookings the slot can take (the minimum over every block it covers). Full, closed and past slots are left out; a closed day returns an empty list. Errors: `400 invalid_request`, `404`/`409 service_unavailable`.

#### `POST /api/service-appointments`

Request (JSON, at most 8 KB, throttled 10 per hour per IP per shop):

```json
{
  "idempotency_key": "uuid, stable per attempt (required)",
  "service_id": "8", "starts_at": "2026-11-20T06:00:00.000Z (UTC, milliseconds, taken from availability)",
  "customer_name": "required", "customer_email": "required, valid", "customer_phone": "required",
  "duration_minutes": "optional: the length the page showed; a different published length is 409 service_changed"
}
```

`201`:

```json
{ "appointment": { "id": "uuid", "reference": "AB12CD34", "service_name": "Haircut", "starts_at": "...", "status": "pending" },
  "manage_token": "43 URL-safe characters" }
```

`manage_token` is shown exactly once. Only its SHA-256 is stored (`cancel_token_hash`). A replay of the same `idempotency_key` answers `200 { "appointment": { id, reference, service_name, starts_at, status, payment_status }, "duplicate": true }` WITHOUT the token, so the storefront saves the token from the first response (localStorage `eshop-appointments:<host>`) and the booking email carries it too.

The booking starts `pending`: the owner confirms or declines it. Errors: `400 invalid_request`, `409 slot_unavailable` (outside hours, in the past, or no seat left), `409 service_changed`, `409 service_unavailable`, `404 shop_not_found`, `413 too_large`, `429 rate_limited`, `503 storage_unavailable`.

#### `POST /api/service-appointments/manage`

The customer's self-service door. One endpoint, one credential: the manage token. Throttled 120 per hour per IP per shop. Request (JSON, at most 2 KB): `{ "token": "...", "action": "view" | "cancel" | "reschedule" | "slots", ... }`.

* A token that is malformed, unknown, or belongs to another shop is always `404 { error_code: "appointment_not_found" }`. The appointment id is not a credential and is never accepted.
* The storefront link is `https://<shop host>/#/booking/<token>` (a fragment, so the token never reaches a server log or Referer header). The Litrus storefront renders the manage page for that route.

Successful responses (except `slots`) are `200 { "appointment": <view> }`, where the customer view is:

```json
{
  "reference": "AB12CD34", "service_id": "8", "service_name": "Haircut",
  "starts_at": "...", "ends_at": "...", "timezone": "Africa/Nairobi", "duration_minutes": 60,
  "status": "pending | confirming | confirmed | rejected | cancelled | completed | no_show",
  "expired": false,
  "payment_status": "not_required | initializing | pending | paid | failed",
  "currency": "KES", "price_cents": 250000, "deposit_cents": 50000,
  "payment_authorization_url": "https://checkout.paystack.com/... or null (only while a confirmed booking's deposit is unpaid)",
  "cancelled_by": "you | shop | null", "cancel_reason": "shown only when the shop cancelled",
  "deposit_refund_due": false, "deposit_refunded": false,
  "can_cancel": true, "can_reschedule": true,
  "cancel_cutoff_at": "ISO time after which the customer can no longer change it",
  "cancel_cutoff_hours": 2, "reschedules_used": 0, "reschedules_remaining": 2, "max_reschedules": 2
}
```

`can_cancel` is true for a live booking (`pending` and not expired, or `confirmed`) that has not started and is not inside the cutoff window. `can_reschedule` additionally needs reschedules left.

**`view`** returns the view. **`cancel`** (optional `reason`, 200 characters) cancels, frees every seat, records `cancelled_by = "customer"`, and sets `deposit_refund_due = 1` when a deposit was paid (see Deposits). It notifies the owner (`booking_cancelled`) and emails the customer. Repeating it answers `200` with `"already_cancelled": true` and changes nothing.

**`reschedule`** takes `{ "starts_at": "<UTC ISO from slots>" }`. The new time is validated exactly like a new booking (grid, open day, hours, at least 15 minutes ahead, capacity). The move is one atomic batch: the old seats are released only if the new seats are taken, so a failed move leaves the booking untouched and a booking's own seats never block a move that overlaps its current time. It counts against `service_max_reschedules`, keeps the status (a `pending` booking gets a fresh 24 hour hold), re-arms the reminder, and notifies the owner (`booking_rescheduled`).

**`slots`** takes `{ "date": "YYYY-MM-DD" }` and answers `200 { "date", "timezone", "capacity", "slots": [ ... same shape as availability ... ] }` for the booked service, without counting the booking's own seats. Use it to fill the reschedule picker.

Errors (all with `error_code`): `400 invalid_request`, `404 appointment_not_found`, `404 shop_not_found`, `409 not_changeable` (final or expired booking; also carries `status` and `expired`), `409 appointment_busy` (a deposit link is being created, retry in a moment), `409 appointment_started`, `409 cutoff_passed` (also carries `cancel_cutoff_at`), `409 reschedule_limit`, `409 slot_unchanged`, `409 slot_unavailable`, `409 appointment_changed` (lost a race with the owner; reload), `409 service_unavailable` (the service was removed from the catalogue), `413 too_large`, `429 rate_limited`.

#### `GET /api/service-appointments/payment?reference=ESHOP_...`

Verifies a deposit with Paystack and records it (unchanged). Response `{ "appointment": { id, status, payment_status } }`. Errors now carry `error_code`: `400 invalid_request`, `404 appointment_not_found`, `409 payment_mismatch`, `502 payment_provider_error`, `503 payments_unavailable`.

### Owner endpoints

Authenticated exactly like `/api/store/*`: the shop owner key, an account session that owns the shop, or the admin key (`Authorization: Bearer <token>`). Anything else is `401 { error_code: "unauthorized" }`. A key for another shop is rejected and other shops' rows are never visible. Owner responses are the only ones that carry customer contact details.

The owner appointment object:

```json
{
  "id": "uuid", "reference": "AB12CD34", "service_id": "8", "service_name": "Haircut",
  "service_price_cents": 250000, "currency": "KES", "duration_minutes": 60,
  "starts_at": "...", "ends_at": "...", "slot_reserved_until": "...", "timezone": "Africa/Nairobi",
  "customer_name": "", "customer_email": "", "customer_phone": "",
  "status": "pending", "expired": false, "request_expires_at": "...",
  "deposit_percent": 20, "deposit_cents": 50000,
  "payment_status": "not_required | initializing | pending | paid | failed",
  "payment_reference": null, "payment_authorization_url": null,
  "cancelled_by": "customer | owner | null", "cancelled_at": null, "cancel_reason": null,
  "deposit_refund_due": false, "deposit_refunded_at": null,
  "reschedule_count": 0, "rescheduled_at": null, "reminded_at": null,
  "created_at": "", "updated_at": ""
}
```

`cancel_token_hash` and the Paystack subaccount code are never returned.

#### `GET /api/service-appointments`

Query (all optional): `view=all|upcoming|past` (upcoming = starts after now, soonest first; past = started already, newest first; `all` = newest first, the original behaviour), `status=pending,confirmed` (comma list of the statuses above), `service_id`, `from` / `to` (ISO date or UTC timestamp on `starts_at`, `to` exclusive), `limit` (1 to 200, default 100), `offset`.

`200`:

```json
{ "appointments": [ <owner appointment> ], "counts": { "pending": 3, "upcoming_confirmed": 12, "refunds_due": 1 },
  "limit": 100, "offset": 0, "has_more": false }
```

`counts` covers the whole shop regardless of filters: `pending` = open requests still awaiting an answer (not expired, not started), `upcoming_confirmed`, and `refunds_due` = bookings flagged `deposit_refund_due`. A typical "needs action" screen is `?view=upcoming&status=pending,confirming,confirmed`. Bad filters are `400 invalid_request`.

#### `PATCH /api/service-appointments`

Request `{ "id": "<appointment uuid>", "action": "...", ...}` (JSON, at most 4 KB). Success is always `200 { "appointment": <owner appointment> }` with the updated row.

| `action` | Allowed when | Effect |
| --- | --- | --- |
| `confirm` | `pending`, not expired, not started | `confirmed`. With a deposit configured it creates the Paystack checkout (`payment_status: "pending"`, `payment_authorization_url`); the customer is emailed the link and sees it on the manage page. Without a deposit nothing else is needed. |
| `reject` (alias `decline`) | `pending`, not expired, not started | `rejected`, seats freed, customer emailed. |
| `cancel` | `pending` or `confirmed`, not started. No cutoff for the owner | `cancelled` with `cancelled_by = "owner"`, seats freed. Optional `reason` (200 characters) is stored and shown to the customer. Sets `deposit_refund_due` when a deposit was paid. Customer emailed. Repeating it on a cancelled booking is a no-op `200`. |
| `reschedule` | `pending` (not expired) or `confirmed`, not started | needs `starts_at` (UTC ISO with milliseconds). Same atomic move and validation as the customer's, but no cutoff and it does not use up the customer's `service_max_reschedules` (`reschedule_count` is unchanged). Customer emailed. |
| `complete` | `confirmed` and `starts_at` is in the past | `completed`. |
| `no_show` | `confirmed` and `starts_at` is in the past | `no_show`. The deposit is kept; refund it yourself if you choose and mark it refunded. |
| `deposit_refunded` | `deposit_refund_due = 1` | clears the flag and stamps `deposit_refunded_at`. Repeating it is a no-op `200`. |

Errors (all with `error_code`): `400 invalid_request` (bad id, unknown action, bad time), `401 unauthorized`, `404 appointment_not_found`, `409 invalid_state` (the booking is not in a state that allows the action), `409 not_started` (`complete` / `no_show` before the start), `409 appointment_started`, `409 appointment_busy`, `409 slot_unavailable` (reschedule target is closed, past or full), `409 slot_unchanged`, `409 appointment_changed` (it changed under you, for example the customer moved the booking while you confirmed it; nothing was confirmed, reload), `409 deposit_unavailable` (confirming a deposit booking needs Paystack set up: no key, non-KES, no ready subaccount), `409 service_unavailable`, `413 too_large`, `502 payment_provider_error` (Paystack did not return a usable checkout; the booking stays `pending`).

A booking stuck in `confirming` for more than 10 minutes (the Worker died between reserving the deposit and reaching Paystack) returns to `pending` the next time the owner sends any PATCH for it.

### Deposits and refunds (the Worker never moves money)

* A deposit is only requested when the owner confirms; the payment is verified by the Paystack webhook or `GET .../payment`.
* Cancelling a booking whose `payment_status` is `paid` (and deposit above zero) sets `deposit_refund_due = 1`, and the owner notification says to refund it in Paystack. The owner refunds in the Paystack dashboard and then sends `deposit_refunded`. The customer view shows `deposit_refund_due` / `deposit_refunded` so the page never promises more than the state.
* A deposit that arrives AFTER the booking was cancelled (the customer paid an old link) is recorded as `paid` and flagged `deposit_refund_due = 1`, with a `booking_refund` owner notification. Cancelling clears `payment_authorization_url`.
* `no_show` and `completed` bookings are never flagged.

### Owner notifications (outbox, see Owner alerts)

New `kind` values, each with `ref = appointment id`, a first name only and no contact details: `booking` (new request, unchanged), `booking_cancelled` (customer cancelled; mentions a paid deposit to refund), `booking_rescheduled` (customer moved a booking), `booking_refund` (a deposit arrived for a cancelled booking). Owner-initiated changes are not notified back to the owner. The owner email is sent the same way as before (best effort, 20 per hour per shop).

### Customer emails and reminders (best effort, never block anything)

Emails use Resend (`RESEND_API_KEY` and `EMAIL_FROM`, the same secrets as the other emails); with either missing nothing is sent, nothing is marked as sent, and every request still succeeds. They go to the address the customer typed on the booking form, as plain text:

* booking received (with the manage link), confirmed (with the deposit link when one is due), declined, cancelled (by the shop, or by the customer), moved (by the shop, or by the customer with the manage link). Capped at 60 per shop per hour, so a stranger cannot use a shop's booking form as a mail relay beyond that.
* reminders: `scheduled()` (the daily cron, `17 3 * * *` UTC) emails every `confirmed` booking that starts within the next 36 hours (`SERVICE_REMINDER_WINDOW_HOURS`, 1 to 72, optional Worker variable) and has no reminder yet. Because the cron is daily, a booking is reminded between 12 and 36 hours before it starts; for a closer reminder add an hourly cron trigger and set the window to about 26. A reminder is claimed with an atomic `UPDATE ... SET reminded_at WHERE reminded_at IS NULL` before it is sent, so overlapping or repeated runs never double-send. A failed send releases the claim and is retried by the next run, up to 3 attempts (`reminder_attempts`). Moving a booking clears `reminded_at`, so the new time gets its own reminder. Reminders cap at 200 per shop per hour. They do not contain the manage link (only a hash of the token is stored); they point to the booking email and the shop. SMS is not implemented.

### Migration and deploy order

`0030_service_booking_management.sql` rebuilds `storefront_service_appointments` (new statuses, `cancel_token_hash`, `cancelled_by`, `cancelled_at`, `cancel_reason`, `deposit_refund_due`, `deposit_refunded_at`, `reschedule_count`, `rescheduled_at`, `reminded_at`, `reminder_attempts`) and `storefront_appointment_slots` (adds `seat` to the primary key). Existing rows are copied; existing slots become seat 1. Apply it BEFORE deploying this Worker: the new Worker inserts `seat` and `cancel_token_hash`, which the old tables do not have, so booking would fail until the migration runs. The reverse (old Worker, new tables) mostly keeps working for single-seat shops because `seat` defaults to 1, but the old Worker cannot see the new statuses and answers a taken slot with a 500 instead of `409 slot_unavailable`.

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
* A service appointment stuck in `confirming` with `payment_status = 'initializing'` for more than 10 minutes returns to `pending` when the owner next sends a PATCH for it.
* While a catalogue is saved ahead of its republish, the shop keeps serving its last published storefront (with the live catalogue data injected) instead of an error. A shop whose catalogue names a retired or unknown theme, or no hosted theme at all, also keeps serving its last published storefront. Without any published storefront the visitor sees a plain "This website is not available" 404 page, and the shop is left out of `/shops` and the sitemaps.
* Only Litrus Mixer (and the Craft platform's own storefront) can be published. Publishing a retired theme returns `422`; shops published earlier keep working.

## Sessions and owner tokens

Account sign-in mints one owner token per shop, recorded in the tenant record (`owner_login_tokens`, with username and session) and capped at 20 per shop (oldest dropped first). `POST /api/auth/logout` revokes the token minted by that session. A password reset revokes every sign-in token and trims unattributable legacy tokens, and the admin owner-key recovery route (`PUT /api/tenants/:id/owner-key`) revokes them as well. The shop's original owner key (`owner_token_hash`) is not touched by logout or password reset.

`POST /api/inventory/sale` (the register's shared-stock sale sync) requires the shop owner key, an owner account session or the admin key.

## Shop deletion

`DELETE /api/tenants/:id` (owner key or admin key) removes the shop's D1 rows (orders, customer contact details, holds, newsletter subscribers, inventory, discounts, notifications, analytics, Paystack subaccount record, custom hostname and the account link), its R2 objects (`media/`, `published-sites/`, `business/`, `push/`) and its KV records (published pointer, product aliases, Search Console tag, cached AI data, the cached shop directory), and asks Cloudflare to release the custom hostname. A Paystack subaccount row that is still another shop's owner default is retained without the bank name. The tenant record (with the owner keys) is deleted last, so a partly failed delete can be retried. The response reports `failed_tables`, `custom_hostname_released`, `paystack_subaccount` and `r2_objects_deleted`. The address is reserved for its previous owner account for 90 days (`tenant-tombstone:<id>` in KV) so nobody else can claim it.

## Retention

`scheduled()` runs daily (`triggers.crons` in `wrangler.jsonc`, `17 3 * * *` UTC). It first sends the best-effort booking reminders (see "Service bookings"), then deletes `storefront_event_daily`, `storefront_visits` and `storefront_product_interest` older than 400 days, `owner_notifications` older than 90 days, expired `rate_limit_counters` (hold caps are kept for up to 32 days, everything else for 2 days) and expired appointment slots, in bounded batches. Analytics events are only recorded for products that exist in the shop's published catalogue; unknown product ids are ignored.

## Search

Litrus Mixer routes with `#/p/<product id>`. The Worker serves real `/products/<slug>` URLs for Litrus shops, emits Product JSON-LD and canonical tags for them, lists them in `sitemap.xml` and bridges the path to the Litrus route in the browser. Categories and pages are not advertised for Litrus because it has no route for them.
