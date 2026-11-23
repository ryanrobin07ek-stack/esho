# Nigeria and South Africa: parked for later

**Decision (2026-11-23): Craft launches with Paystack for Kenya only.** Shops in other countries use "order now, pay the shop directly" (bank transfer or cash, owner marks the order paid). The NGN and ZAR code is kept, not deleted.

## Why it is parked
Paystack currencies follow the country the business is registered in. A Kenyan Paystack account can take KES and USD, not NGN or ZAR. Paystack's own support told the owner this, and their help pages agree
(<https://support.paystack.com/en/articles/2130690>). Nigerian and South African online payments need a Paystack account in each country, which needs a business registered there with local documents and a local bank account. Not yet confirmed: Paystack's exact onboarding requirements for Nigeria and South Africa.

## Where the code is
- Git tag **`parked/paystack-ngn-zar`** points at commit `7d6f754` ("Paystack payments now work for Nigeria (NGN) and South Africa (ZAR)"). `git show parked/paystack-ngn-zar` lists every file it touched.
- `cloudflare/worker.js` line ~96: `PAYSTACK_MARKETS` maps `KES`, `NGN`, `ZAR` to a country. Checkout, appointment deposits and the bank list (`/api/payments/paystack/banks?currency=`) accept only these.
- `src/screens/craft/payments.js`: the website-currency list and the note saying which currencies take online payment.
- `src/app/studio-orders.js`, `studio-paystack.js`, `studio-workspace.js`, `inventory-bridge.js`: currency and placeholder wording.
- Tests: `tests/cloudflare.worker.test.mjs` (NGN/ZAR cases).

## What is still missing before Nigeria or South Africa can take real payments
1. A Paystack account in each country (its own live secret key and its own webhook URL).
2. The Worker holds one `PAYSTACK_SECRET_KEY`. It needs a key per country, chosen by the shop's currency, and webhook verification that tries the right key. **Not built.**
3. Plan prices for NGN and ZAR, and removing Kenya-only copy (M-Pesa wording, `en-KE` price formatting).
4. A real-money test in each country.

## Other options for those markets
- South Africa: a local provider such as PayFast or Ozow.
- Nigeria: bank transfer with an "I have paid" step and a reference, or Flutterwave.
- Flutterwave covers Kenya, Nigeria and South Africa; its account and entity rules are not verified.

## The switch (added 2026-11-23)
Worker variable **`PAYSTACK_CURRENCIES`**, a comma list. Default (unset) is `KES`, so NGN and ZAR are refused for checkout, deposits and bank lists, and shops fall back to paying the shop directly. `cloudflare/wrangler.craftke.jsonc` sets it to `"KES"` explicitly.

To switch Nigeria or South Africa on later: first do items 1 and 2 above (a Paystack account and key per country), then set `"PAYSTACK_CURRENCIES": "KES,NGN,ZAR"` and deploy the Worker. Test: `tests/cloudflare.worker.test.mjs` ("banks" test) covers both the default and the enabled case.

Not changed: the website-currency note in the owner app (`src/screens/craft/payments.js`) still lists NGN and ZAR as online-payment currencies; the app does not read this variable. Update that wording when you decide the app copy.
