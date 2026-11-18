# Google Search Console: merchant-managed setup

Craft does not connect to Google accounts or submit sitemaps through Google's APIs. Each merchant can choose to manage Search Console directly with their own Google account. This avoids requesting Google OAuth access to merchant accounts and does not require Craft's Search Console OAuth app review.

## What Craft provides automatically

- Each shop has a public sitemap at `https://<shop>.rrobin.co.ke/sitemap.xml`.
- The sitemap is generated from that shop's published catalog. For Litrus Mixer shops it lists the home page and the product pages (`/products/<slug>`); categories and custom pages have no Litrus route and are not listed.
- Shop owners can paste a Google HTML verification tag into **Profile → Webs → Website settings → Google Search**. Craft publishes the tag on that shop's website.

## Merchant steps (optional)

1. Sign in to the shop owner's own Google account and open [Google Search Console](https://search.google.com/search-console).
2. Add a **URL-prefix** property using the full shop URL, for example `https://mama.rrobin.co.ke/`.
3. Select **HTML tag** as the ownership verification method and copy Google's complete `<meta name="google-site-verification" content="...">` tag.
4. In Craft, open **Profile → Webs → Website settings → Google Search**, paste the complete tag, and choose **Publish verification tag**.
5. Return to Search Console and select **Verify**.
6. In Search Console's **Sitemaps** section, submit `https://mama.rrobin.co.ke/sitemap.xml`.

Google decides whether and when to crawl or index pages. Submitting a sitemap does not guarantee indexing or rankings. Craft stores only the public verification token needed to publish the tag; it does not receive or store the merchant's Google credentials or OAuth tokens. A shop owner can remove the tag from the same settings screen.

This flow is built for Craft-hosted `*.rrobin.co.ke` shop URLs. Custom hostnames are mapped to a shop by the Worker, but verifying a Search Console property on a custom domain has not been tested; check the sitemap and canonical URLs on that domain before relying on it.
