# craft.ke Worker: variables and secrets (names only)

Every `env.*` name `cloudflare/worker.js` reads. Values are never written down here or in any file.

- Plain vars live in `cloudflare/wrangler.craftke.jsonc` under `vars`. They are not secret.
- Secrets are set one at a time against the new account, never in a file:
  `wrangler secret put <NAME> --config cloudflare/wrangler.craftke.jsonc`
- Bindings (`DB`, `TENANTS`, `BUSINESS_ARCHIVE`, `ASSETS`) come from the config, not from variables.

Nothing here has been deployed or set yet.

## Plain vars (in the config)

| Name | Set in config as | What it is for / if missing |
| --- | --- | --- |
| `DOMAIN_ROOT` | `craft.ke` | Root domain of this deployment: shop hostnames, sitemaps, canonical URLs, Google sign-in redirect, homepage origin. Missing or invalid: falls back to `rrobin.co.ke`, so a craft.ke deployment would then treat craft.ke as a foreign host. Must be set. |
| `TURNSTILE_SITE_KEY` | `REPLACE_WITH_NEW_TURNSTILE_SITE_KEY` | Public Turnstile widget key sent to the sign-up page. Missing: the page gets an empty key and sign-up cannot be completed. The production widget will not work on craft.ke, so a new widget is needed. |
| `EMAIL_FROM` | `Craft <noreply@craft.ke>` | From address for recovery codes and notification emails. Missing (or no `RESEND_API_KEY`): password recovery returns 503 and notification emails are skipped. The sending domain must be verified in Resend. |
| `VAPID_SUBJECT` | `mailto:admin@craft.ke` | Contact claim for web push. Missing or not a `mailto:`: push sending returns 503. |
| `AI_MODEL` | OpenRouter model id | Model for the Craft AI assistant. Missing or malformed: the built-in default model is used. |
| `CLOUDFLARE_ZONE_ID` | `REPLACE_WITH_NEW_ZONE_ID` | Zone of craft.ke, used to create custom hostnames for shops. Missing: custom-domain management returns 503. |
| `CUSTOM_HOSTNAME_TARGET` | `customers.craft.ke` | CNAME target shown to shop owners for their own domains; also switches on custom-domain lookup for foreign hosts. Missing: custom domains are off and every non-craft.ke host gets a "not connected" page. |
| `SERVICE_REMINDER_WINDOW_HOURS` | not in config (optional) | Hours ahead for booking reminder emails (1 to 72). Missing or out of range: the built-in default window. |

## Secrets (`wrangler secret put`)

| Name | What it is for / if missing |
| --- | --- |
| `PUBLISH_TOKEN` | Administrator bearer token for admin-only endpoints; also the fallback salt for hashing client IPs in rate-limit counters. Missing: admin endpoints always refuse, and rate limiting uses an empty salt unless `RATE_LIMIT_SALT` is set. |
| `RATE_LIMIT_SALT` | Optional salt for hashing client IPs in rate-limit counters. Missing: falls back to `PUBLISH_TOKEN`. |
| `TURNSTILE_SECRET_KEY` | Server side of Turnstile for sign-up. Missing: registration returns 503 ("Sign-up is unavailable"). |
| `RESEND_API_KEY` | Resend key for outgoing email. Missing: recovery email returns 503, notification and booking-reminder emails are skipped. |
| `GOOGLE_OAUTH_CLIENT_ID` | Google sign-in client id. Missing: Google sign-in returns 503. The OAuth client must list `https://app.craft.ke/api/auth/google/callback` as a redirect URI. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google sign-in client secret. Missing: Google sign-in returns 503. |
| `PAYSTACK_SECRET_KEY` | Platform Paystack key: shop payments, subaccounts, deposits and webhook checks. Missing: payment and deposit flows return 503 or 409 messages; ordering without online payment still works. |
| `CLOUDFLARE_API_TOKEN` | API token (custom hostnames on the craft.ke zone) for custom domains. Missing: custom-domain management returns 503. Give it only the permission it needs, in the new account. |
| `OPENROUTER_API_KEY` | OpenRouter key for Craft AI. Missing: Craft AI returns 503. |
| `VAPID_PUBLIC_KEY` | Public half of the web-push key pair. Missing: push subscribe and send return 503. |
| `VAPID_PRIVATE_KEY` | Private half of the web-push key pair. Missing: push sending returns 503. |
| `UNSPLASH_ACCESS_KEY` | Optional stock-photo search provider. Missing: that provider is skipped. |
| `PIXABAY_API_KEY` | Optional stock-photo search provider. Missing: that provider is skipped. |
| `PEXELS_API_KEY` | Optional stock-photo search provider. Missing: that provider is skipped. |

## Never set in production

| Name | Warning |
| --- | --- |
| `DEV_SKIP_SHOP_CREATE_LIMIT` | Development only. The value `true` turns off the limit of 5 new shops per hour per client. Do NOT set it, as a var or a secret, on the craft.ke Worker or on production. |

There is no other test-only variable in the Worker. The test suites pass their own fake `env` objects and never need a real value.
