import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { initializeSQLite } from './sqlite.js';
import { createPosApp } from './pos.js';
import { WEBSITE_THEME_CATALOG } from './theme-catalog.js';
import { renderLiquidStorefront } from './liquid-storefront-renderer.js';
import './theme-web-editor.js';
import { WEBSITE_FONTS, WEBSITE_COLOR_THEMES, WEBSITE_COLOR_FILTERS, WEBSITE_DESIGN_THEMES, WEBSITE_DESIGN_PRESETS, WEBSITE_CARD_SHAPES } from './website-appearance-presets.js';
import './business-notifications.js';
window.EshopWebsiteThemeCatalog = WEBSITE_THEME_CATALOG;
window.EshopLiquidStorefront = { render: renderLiquidStorefront };
window.EshopLiquidHtmlThemeRenderer = window.EshopImportedThemeRenderer;
window.EshopAuthBrowser = Browser;
window.EshopWebsiteAppearance = { fonts: WEBSITE_FONTS, colors: WEBSITE_COLOR_THEMES, filters: WEBSITE_COLOR_FILTERS, designs: WEBSITE_DESIGN_THEMES, designPresets: WEBSITE_DESIGN_PRESETS, shapes: WEBSITE_CARD_SHAPES };
// The inline app controller can start on DOMContentLoaded while this module is
// still awaiting native SQLite setup. Publish the startup promise so the app
// waits for the bridge before reading or seeding its database.
window.ShopSQLiteReady = initializeSQLite();
window.ShopPOS = createPosApp();
window.ShopPOSReady = window.ShopSQLiteReady.then(() => window.ShopPOS.init());
if (Capacitor.isNativePlatform()) {
  document.body.classList.add('native-app-shell');
  let handledGoogleCallback = '';
  const handleGoogleAuthUrl = async url => {
    let callback;
    try {
      callback = new URL(url);
    } catch {
      return;
    }
    if (callback.protocol !== 'com.eshop.atelier:' ||
        callback.hostname !== 'auth' ||
        callback.pathname !== '/google' ||
        handledGoogleCallback === callback.href) return;
    handledGoogleCallback = callback.href;
    const params = new URLSearchParams();
    for (const key of ['google_ticket', 'google_error']) {
      const value = callback.searchParams.get(key);
      if (value) params.set(key, value);
    }
    if (!params.size) return;
    await Browser.close().catch(error => {
      console.warn('Could not close the Google sign-in browser.', error);
    });
    window.location.hash = `/app-account?${params}`;
  };
  await App.addListener('backButton', event => {
    window.dispatchEvent(new CustomEvent('shop:back', { detail: event }));
  });
  await App.addListener('appUrlOpen', ({ url }) => {
    void handleGoogleAuthUrl(url);
  });
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) await handleGoogleAuthUrl(launch.url);
  } catch (error) {
    console.error('Could not check whether Craft was launched from Google sign-in.', error);
  }
}
try {
  await window.ShopPOSReady;
} catch (e) {
  console.error('SQLite startup failed', e);
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.textContent = 'The local database or POS engine could not start. Reload or check the browser console.';
  box.style.cssText = 'position:fixed;z-index:9999;inset:0 0 auto;padding:14px;background:#fee2e2;color:#7f1d1d;text-align:center';
  document.body.appendChild(box);
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  await navigator.serviceWorker.register('/sw.js');
}
