# Craft AI business assistant

Craft AI is a read-only chat assistant shown in Studio, business, and POS screens. It explains the active shop's online orders, paid revenue, storefront visits, popular pages, published catalogue stock, and (on POS/business screens) a local register roll-up. POS figures are summarized on the device before transmission; customer names, phone numbers, emails, and individual order details are not included in the analytics context.

The Worker builds online analytics from tenant-scoped D1 records, including order/revenue comparisons, average paid order value, storefront traffic and popular pages, product/category counts, and a limited product/price/stock summary. It accepts validated POS summaries from the signed-in shop owner's device, including inventory, top-selling items, estimated gross profit where captured item costs exist, and expense totals by category. POS data is summarized before transmission; customer records and identifiers are excluded. Each request requires the active shop's owner credential. Questions and business aggregates are sent from the Worker to OpenRouter and its selected model; the API key remains in a Worker secret. AI responses only provide analysis and suggestions; they cannot change shop data.

## Configure OpenRouter

Set `OPENROUTER_API_KEY` as a Worker secret using the project's local Wrangler version. From the app directory, run:

```powershell
npm exec -- wrangler secret put OPENROUTER_API_KEY --config cloudflare\wrangler.jsonc
```

Enter the key at Wrangler's prompt; do not put it in `wrangler.jsonc`, source files, or chat. Wrangler's `secret put` operation deploys the secret version. The configured `AI_MODEL` defaults to `nvidia/nemotron-3-ultra-550b-a55b:free`; change that non-secret variable in `cloudflare\wrangler.jsonc` to select a different OpenRouter model.

## Caching

- Tenant-scoped online analytics aggregates are cached in Workers KV for up to five minutes.
- Successful AI answers are cached in Workers KV for up to 24 hours. The cache key includes the tenant, a hash of the authorized shop credential, model, screen, conversation, and current aggregate analytics. Updated analytics therefore produce a different answer key.
- API responses use `Cache-Control: private, no-store`; shared browser/CDN caches must not store assistant responses.
- Chat history stays in the current app session and is not written to the Worker database. Cached values expire automatically.
- Product-count questions distinguish the published online catalogue from the local POS register; the assistant does not assume those counts are identical.

The endpoint is `POST /api/ai/assistant?tenant=<shop-id>`. It accepts a question, up to eight prior user/assistant messages, a screen route, and an optional validated local aggregate. It returns an answer and whether the model response came from the private cache.
