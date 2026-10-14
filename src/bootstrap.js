import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { initializeSQLite } from './sqlite.js';
import { createPosApp } from './pos.js';
import { WEBSITE_THEME_CATALOG } from './theme-catalog.js';
import { WEBSITE_FONTS, WEBSITE_COLOR_THEMES, WEBSITE_COLOR_FILTERS, WEBSITE_DESIGN_THEMES, WEBSITE_DESIGN_PRESETS, WEBSITE_CARD_SHAPES } from './website-appearance-presets.js';
import './business-notifications.js';
window.EshopWebsiteThemeCatalog = WEBSITE_THEME_CATALOG;
window.EshopWebsiteAppearance = { fonts: WEBSITE_FONTS, colors: WEBSITE_COLOR_THEMES, filters: WEBSITE_COLOR_FILTERS, designs: WEBSITE_DESIGN_THEMES, designPresets: WEBSITE_DESIGN_PRESETS, shapes: WEBSITE_CARD_SHAPES };
// The inline app controller can start on DOMContentLoaded while this module is
// still awaiting native SQLite setup. Publish the startup promise so the app
// waits for the bridge before reading or seeding its database.
window.ShopSQLiteReady = initializeSQLite();
window.ShopPOS = createPosApp();
window.ShopPOSReady = window.ShopSQLiteReady.then(() => window.ShopPOS.init());
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

if (Capacitor.isNativePlatform()) {
  document.body.classList.add('native-app-shell');
  await App.addListener('backButton', (event) => {
    window.dispatchEvent(new CustomEvent('shop:back', { detail: event }));
  });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  await navigator.serviceWorker.register('/sw.js');
}
