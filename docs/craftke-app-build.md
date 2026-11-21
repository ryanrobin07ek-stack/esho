# Building the app for craft.ke

The app takes its domain from one setting, `VITE_DOMAIN_ROOT` (see `src/app/domain.js`).
When it is unset the build serves `rrobin.co.ke`, exactly as before.

## Web app

PowerShell:

```powershell
$env:VITE_DOMAIN_ROOT = 'craft.ke'
npm run build
```

bash:

```bash
VITE_DOMAIN_ROOT=craft.ke npm run build
```

Output goes to `www/`. Check it: `craft.ke` should appear in `www/assets/*.js`, and `rrobin.co.ke` only as the fallback default inside the domain validator.

## Android APK

```powershell
$env:VITE_DOMAIN_ROOT = 'craft.ke'
$env:CAPACITOR_APP_HOSTNAME = 'craft.ke'
npm run cap:sync   # runs the build, then cap sync
cd android
.\gradlew.bat assembleDebug
```

`CAPACITOR_APP_HOSTNAME` sets the hostname the app's WebView serves from (`capacitor.config.ts`). The APK is written to `android/app/build/outputs/apk/debug/`.

Do not commit the `www/` output of a craft.ke build to the rrobin.co.ke branch.

## Not covered by this setting

- `public/official-site/` (the marketing site) still names `rrobin.co.ke`; it is handled separately.
- `android/`: no mention of `rrobin` was found by `git grep -n -i rrobin -- android`, but the app id (`com.eshop.atelier`), app name (`Craft` in `strings.xml`) and icons are shared with the rrobin.co.ke app. Change them in `capacitor.config.ts` / `android/` if craft.ke needs a separate install.
- `cloudflare/` (Worker, routes, custom hostnames, `customers.<root>` CNAME target on the Worker side) and the DNS and zone for `craft.ke`.
- `scripts/link-main-shop-owner.mjs` defaults to `https://rrobin.co.ke`; set `CLOUDFLARE_WORKER_URL` when running it for craft.ke.
- `src/browser-register.js` also trusts the hard-coded `*.workers.dev` Worker URL and `DEFAULT_WORKER`.
- Tests and `archive/` keep the old domain in their fixtures.
