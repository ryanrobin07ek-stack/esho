import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { initializeSQLite } from './sqlite.js';
import { createPosApp } from './pos.js';
import * as ProductTaxonomy from './product-taxonomy.js';
import * as ProductVariants from './product-variants.js';
import { ProductCutout } from './product-cutout.js';
// The app stylesheet, moved verbatim out of index.html in its original order. It must load
// before app-visual-theme.css so the cascade stays the same.
import './styles/base.css';
import './styles/announcement.css';
import './styles/navbar.css';
import './styles/mobile-nav.css';
import './styles/shop-home.css';
import './styles/product-card.css';
import './styles/shop-category.css';
import './styles/shop-product.css';
import './styles/bag-checkout.css';
import './styles/account-studio-1.css';
import './styles/account-studio-2.css';
import './styles/account-studio-3.css';
import './styles/account-studio-4.css';
import './styles/account-studio-5.css';
import './styles/studio-managers.css';
import './styles/dashboard-kpi.css';
import './styles/till-1.css';
import './styles/till-2.css';
import './styles/till-3.css';
import './styles/till-4.css';
import './styles/till-5.css';
import './styles/modals-toasts.css';
import './styles/footer.css';
import './styles/shared-refresh-1.css';
import './styles/shared-refresh-2.css';
import './styles/shared-refresh-3.css';
import './styles/shared-refresh-4.css';
import './styles/shared-refresh-5.css';
import './styles/shared-refresh-6.css';
import './styles/shared-refresh-7.css';
import './styles/app-screens-1.css';
import './styles/app-screens-2.css';
import './styles/app-screens-3.css';
import './app-visual-theme.css';
import './product-variants.css';
import './attribute-pricing.css';
import './editor-cards.css';
import './wizard-category-picker.js';
import { WEBSITE_THEME_CATALOG } from './theme-catalog.js';
import { renderLiquidStorefront } from './liquid-storefront-renderer.js';
import './theme-web-editor.js';
import { WEBSITE_FONTS, WEBSITE_COLOR_THEMES, WEBSITE_COLOR_FILTERS, WEBSITE_DESIGN_THEMES, WEBSITE_DESIGN_PRESETS, WEBSITE_CARD_SHAPES } from './website-appearance-presets.js';
import './business-notifications.js';
import { createAppBackHandler, installBackButton } from './back-button.js';
import { createLitrusHostMessageHandler, isValidLitrusHtml } from './litrus-host.js';
import * as RevenueDefinition from './revenue-definition.js';
import * as ServiceModel from './service-model.js';
import * as AttributePricing from './attribute-pricing.js';
import * as AttributePricingFields from './attribute-pricing-fields.js';
import { withStartupTimeout } from './startup-timeout.js';
window.EshopRevenue = RevenueDefinition;
// A service is a property of the product, never of the shop: the app shell needs the same rule.
window.EshopServiceModel = ServiceModel;
// Charging by attribute is one rule shared by the form, the till and the storefront.
window.EshopAttributePricing = { ...AttributePricing, ...AttributePricingFields };
window.EshopLitrusHost = { createMessageHandler: createLitrusHostMessageHandler, isValidHtml: isValidLitrusHtml };
window.EshopWebsiteThemeCatalog = WEBSITE_THEME_CATALOG;
window.EshopProductTaxonomy = ProductTaxonomy;
window.EshopProductVariants = ProductVariants;
window.EshopLiquidStorefront = { render: renderLiquidStorefront };
window.EshopLiquidHtmlThemeRenderer = window.EshopImportedThemeRenderer;
window.EshopAuthBrowser = Browser;
window.EshopNativeMedia = { Camera, MediaTypeSelection, ProductCutout, Capacitor };
window.EshopWebsiteAppearance = { fonts: WEBSITE_FONTS, colors: WEBSITE_COLOR_THEMES, filters: WEBSITE_COLOR_FILTERS, designs: WEBSITE_DESIGN_THEMES, designPresets: WEBSITE_DESIGN_PRESETS, shapes: WEBSITE_CARD_SHAPES };
const loadPublicThemeModule = path => import(/* @vite-ignore */ new URL(path, window.location.origin).href);
window.EshopThemeRuntime = {
  loadEditableStorefrontTheme: () => loadPublicThemeModule('/editable-storefront-theme.js'),
  loadThemeSkeleton: () => loadPublicThemeModule('/theme-skeleton-client.js')
};
if (Capacitor.isNativePlatform()) {
  const splash = document.getElementById('craft-video-splash');
  const video = splash?.querySelector('video');
  if (splash && video) {
    let appReady = false;
    let videoComplete = false;
    let dismissed = false;
    let fallbackStartedAt = 0;
    let failSafeTimer;
    const failVideo = () => {
      if (fallbackStartedAt) return;
      fallbackStartedAt = performance.now();
      video.hidden = true;
      splash.classList.add('is-video-unavailable');
      finishVideo();
    };
    const dismissWhenReady = () => {
      if (dismissed || !appReady || !videoComplete) return;
      if (fallbackStartedAt) {
        const remaining = 1000 - (performance.now() - fallbackStartedAt);
        if (remaining > 0) {
          window.setTimeout(dismissWhenReady, remaining);
          return;
        }
      }
      dismissed = true;
      clearTimeout(failSafeTimer);
      splash.classList.add('is-hiding');
      window.setTimeout(() => splash.remove(), 500);
    };
    const finishVideo = () => {
      videoComplete = true;
      dismissWhenReady();
    };
    splash.hidden = false;
    window.addEventListener('craft:app-ready', () => {
      appReady = true;
      dismissWhenReady();
    }, { once: true });
    video.addEventListener('ended', finishVideo, { once: true });
    video.addEventListener('error', failVideo, { once: true });
    failSafeTimer = window.setTimeout(() => {
      appReady = true;
      if (videoComplete) dismissWhenReady();
      else failVideo();
    }, 16000);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.hidden = true;
      finishVideo();
    } else {
      video.muted = true;
      video.defaultMuted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.controls = false;
      video.preload = 'auto';
      video.poster = '/craft-splash-poster.jpg';
      const startPlayback = () => {
        if (Number.isFinite(video.duration) && video.duration > 1.25) {
          video.currentTime = Math.min(1.25, video.duration - 0.1);
        }
        const playback = video.play();
        if (playback?.catch) playback.catch(failVideo);
      };
      if (video.error) failVideo();
      else if (video.readyState >= HTMLMediaElement.HAVE_METADATA) startPlayback();
      else video.addEventListener('loadedmetadata', startPlayback, { once: true });
    }
  }
}
// The inline app controller can start on DOMContentLoaded while this module is
// still awaiting native SQLite setup. Publish the startup promise so the app
// waits for the bridge before reading or seeding its database.
window.ShopSQLiteReady = withStartupTimeout(initializeSQLite(), 'Starting the local database');
window.ShopPOS = createPosApp();
window.ShopPOSReady = window.ShopSQLiteReady.then(() => withStartupTimeout(window.ShopPOS.init(), 'Starting the POS engine'));
if (Capacitor.isNativePlatform()) {
  document.body.classList.add('native-app-shell');
  let handledGoogleCallback = '';
  let lastGoogleTicketAt = 0;
  const handleGoogleAuthUrl = async url => {
    let callback;
    try {
      callback = new URL(url);
    } catch {
      return;
    }
    if (callback.protocol !== `${import.meta.env?.VITE_APP_URL_SCHEME || 'com.eshop.atelier'}:` ||
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
    // Google's redirect can reach the app a second time after the first one has already signed the owner in; that
    // repeat arrives as an error. An error right after a ticket was accepted is that repeat, so it is not shown.
    if (params.has('google_ticket')) lastGoogleTicketAt = Date.now();
    else if (Date.now() - lastGoogleTicketAt < 120000) return;
    await Browser.close().catch(error => {
      console.warn('Could not close the Google sign-in browser.', error);
    });
    window.location.hash = `/app-account?${params}`;
  };
  // Do not use top-level await in this module: in the production bundle it
  // stalls module evaluation behind chunks that jeep-sqlite itself needs, and
  // the web app never starts.
  // Registering a backButton listener replaces Android's default (leave the app), so the handler
  // owns the whole behaviour: close the top overlay, go up a screen, exit on a second press from
  // home. installBackButton does nothing on the web build.
  installBackButton({ App, Capacitor, handler: createAppBackHandler({ App }) });
  App.addListener('appUrlOpen', ({ url }) => {
    void handleGoogleAuthUrl(url);
  }).catch(error => console.error('Could not register the app URL listener.', error));
  App.getLaunchUrl()
    .then(launch => (launch?.url ? handleGoogleAuthUrl(launch.url) : undefined))
    .catch(error => {
      console.error('Could not check whether Craft was launched from Google sign-in.', error);
    });
}
window.ShopPOSReady.catch(e => {
  console.error('SQLite startup failed', e);
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.textContent = 'The local database or POS engine could not start. Reload or check the browser console.';
  box.style.cssText = 'position:fixed;z-index:9999;inset:0 0 auto;padding:14px;background:#fee2e2;color:#7f1d1d;text-align:center';
  document.body.appendChild(box);
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(error => {
    console.warn('Service worker registration failed.', error);
  });
}
