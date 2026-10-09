import type { CapacitorConfig } from '@capacitor/cli';
const liveReloadUrl = process.env.CAPACITOR_LIVE_RELOAD_URL;
const appHostname = 'rrobin.co.ke';
const config: CapacitorConfig = {
  appId: 'com.eshop.atelier',
  appName: 'E-Shop',
  webDir: 'www',
  server: liveReloadUrl
    ? { url: liveReloadUrl, cleartext: liveReloadUrl.startsWith('http://'), androidScheme: 'https' }
    : { androidScheme: 'https', hostname: appHostname },
};
export default config;
