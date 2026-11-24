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

## Android APK (verified 2026-11-24)

The craft.ke app installs beside the original app, so it has its own application id, `ke.craft.app`. The repository keeps `com.eshop.atelier` in two files, so the id is swapped for the build only and restored straight after.

Requirements: Android SDK (`ANDROID_HOME`), **JDK 21** (the default `JAVA_HOME` may be 17 and Android Studio's bundled JDK may be 25; neither works), and TypeScript in `node_modules` (Capacitor reads `capacitor.config.ts`; `npm install --no-save typescript` if it is missing).

```bash
# 1. Build the web app for craft.ke into www/ (uses .env.craftke)
npm run build:craftke

# 2. Swap the id in the two files (restore them afterwards)
sed -i 's/applicationId "com.eshop.atelier"/applicationId "ke.craft.app"/' android/app/build.gradle
sed -i "s/appId: 'com.eshop.atelier'/appId: 'ke.craft.app'/" capacitor.config.ts

# 3. Sync and build (the WebView host must be craft.ke)
export JAVA_HOME="C:Program FilesMicrosoftjdk-21.0.12.101-hotspot"
CAPACITOR_APP_HOSTNAME=craft.ke npx cap sync android
cd android && ./gradlew.bat assembleDebug

# 4. Restore android/app/build.gradle and capacitor.config.ts, then discard the www/ build
git checkout -- android/app/build.gradle capacitor.config.ts www && git clean -fdq -- www
```

The APKs are in `android/app/build/outputs/apk/debug/` (`app-arm64-v8a-debug.apk` for most phones, `app-universal-debug.apk` for any). Check the id with `aapt dump badging <apk>`: it must say `ke.craft.app`. These are debug builds; a signed release build (your keystore) is needed for the Play Store.

Install over adb: `adb install -r --user 0 CraftKe-arm64.apk`. On Xiaomi phones plain `adb install` can target a second user ("Island") and fail with INSTALL_FAILED_USER_RESTRICTED, so pass `--user 0`.

Notes:
- `www/` is tracked in git but generated. After any build, restore it (`git checkout -- www && git clean -fdq -- www`) and never commit a craft.ke build of it to the rrobin line.
- Both apps use the sign-in return link `com.eshop.atelier://auth/google`. With both installed on one phone, Google sign-in could return to either one.
- Deploy the Worker with `npm run cf:craftke:deploy` (it builds first). Always the craft.ke account profile.

## Not covered by this setting

- `public/official-site/` (the marketing site) still names `rrobin.co.ke`; it is handled separately.
- `android/`: no mention of `rrobin` was found by `git grep -n -i rrobin -- android`, but the app id (`com.eshop.atelier`), app name (`Craft` in `strings.xml`) and icons are shared with the rrobin.co.ke app. Change them in `capacitor.config.ts` / `android/` if craft.ke needs a separate install.
- `cloudflare/` (Worker, routes, custom hostnames, `customers.<root>` CNAME target on the Worker side) and the DNS and zone for `craft.ke`.
- `scripts/link-main-shop-owner.mjs` defaults to `https://rrobin.co.ke`; set `CLOUDFLARE_WORKER_URL` when running it for craft.ke.
- `src/browser-register.js` also trusts the hard-coded `*.workers.dev` Worker URL and `DEFAULT_WORKER`.
- Tests and `archive/` keep the old domain in their fixtures.
