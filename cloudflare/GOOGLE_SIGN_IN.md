# Google sign-in for Craft accounts

Google sign-in is only for creating or accessing a Craft app account. It is separate from Google Search Console: Search Console verification and sitemap submission remain merchant-managed in each merchant's own Google account.

## Google Cloud setup

1. Create or select a Google Cloud project.
2. Configure the OAuth consent screen as **External** for customers outside your organization. Use Craft's real public homepage, support email, and privacy policy when ready to publish.
3. Request only these sign-in scopes:
   - `openid`
   - `email`
4. Create an OAuth client ID of type **Web application** and add this exact authorized redirect URI:

   `https://rrobin.co.ke/api/auth/google/callback`

5. For app testing, add your Google account under the OAuth consent screen's test users. Google limits Testing-mode use; before making Google sign-in available to all customers, publish the consent screen and complete any review Google requires. Because this integration asks only for basic OpenID identity and email, it does not request Search Console, Gmail, or Drive access.
6. Add the web client credentials to Cloudflare Worker secrets. Do not commit them or send them in chat:

   ```powershell
   npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID --config cloudflare/wrangler.jsonc
   npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --config cloudflare/wrangler.jsonc
   ```

7. Apply the account-identity migration and deploy:

   ```powershell
   npx wrangler d1 migrations apply eshop-catalog --remote --config cloudflare/wrangler.jsonc
   npx wrangler deploy --config cloudflare/wrangler.jsonc
   ```

Google sign-in verifies the ID-token signature and its audience, issuer, expiration, nonce, subject, and verified email before creating or opening a Craft account. Google identities are stored separately from passwords. New Google sign-ups receive a generated Craft username; the account's Google-verified email is used for account recovery.

Existing Craft accounts are not automatically merged based on matching email. The owner signs into the existing account first and uses **Link Google account** in account settings. This prevents an unverified or recycled recovery email from silently taking over an existing account. One Google identity can link to only one Craft account.

On Android, OAuth opens Google's sign-in page in the system browser and returns using the app's `com.eshop.atelier://auth/google` deep link. If the app ID or OAuth host changes, update the Android intent filter and callback URI together.

The app does not request or store Google passwords, Gmail access, or Search Console permissions. Merchants who want Search Console can separately add their shop themselves, publish Google's HTML verification tag from Craft website settings, verify it, and submit the automatically generated sitemap.
