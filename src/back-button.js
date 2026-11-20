// Android hardware/gesture back button for the Capacitor app.
//
// Order of preference on every press:
//   1. close the top-most overlay (dialog, modal, drawer, open menu, Craft AI panel);
//   2. on any screen except home, go up one screen;
//   3. on the home screen, warn "Press back again to exit" and only exit on a second press.
//
// Registering a Capacitor "backButton" listener disables Android's default behaviour (which is to
// leave the app), so without step 3 the owner could never exit from home. The decision logic is a
// pure function over injected dependencies so it can be tested without a device.

export const HOME_ROUTE = '/';
export const EXIT_WARNING = 'Press back again to exit';
export const EXIT_WINDOW_MS = 2000;

const OVERLAY_SELECTOR = [
  '[aria-modal="true"]',
  '.modal-overlay.active',
  '.pos-scanner-overlay',
  '.pos-discount-modal',
  '#mobile-nav-drawer.active',
  '.workspace-menu[open]',
  '#craft-ai-panel'
].join(',');
// The element that holds the close controls for an overlay (a backdrop button can sit beside the dialog).
const CONTAINER_SELECTOR = '.modal-overlay, .pos-discount-modal, .pos-scanner-overlay, #mobile-nav-drawer, .workspace-menu, #craft-ai-panel';
const CLOSE_SELECTORS = [
  '[data-back-close]',
  '[data-pos-action="close-discount"]',
  '[data-bt-cancel]',
  '[data-nearby-close]',
  '[data-nearby-scan-close]',
  '[data-product-photo-cancel]',
  '.modal-close-btn',
  'button[id$="-cancel"]',
  '.pos-scanner-close',
  '#mobile-drawer-close',
  '[aria-label="Close"]',
  '[aria-label^="Close "]'
];

const isHidden = (element) => {
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    if (node.hidden || node.getAttribute?.('aria-hidden') === 'true' || node.style?.display === 'none') return true;
  }
  return false;
};

/** The overlay the user sees on top, or null. Later elements win; an explicit z-index wins over order. */
export function findTopOverlay(doc = document) {
  const win = doc.defaultView;
  const zIndex = (element) => {
    const value = Number.parseInt(win?.getComputedStyle?.(element)?.zIndex, 10);
    return Number.isFinite(value) ? value : 0;
  };
  const candidates = [...doc.querySelectorAll(OVERLAY_SELECTOR)].filter((element) => !isHidden(element));
  let top = null;
  let topZ = -Infinity;
  for (const element of candidates) {
    const z = zIndex(element);
    if (z >= topZ) { top = element; topZ = z; }
  }
  return top;
}

/** Closes the top-most overlay. Returns true when one was found (whether or not it needed force). */
export function closeTopOverlay(doc = document) {
  const overlay = findTopOverlay(doc);
  if (!overlay) return false;
  const container = overlay.closest(CONTAINER_SELECTOR) || overlay;
  if (container.matches?.('details')) {
    container.open = false;
    container.removeAttribute('open');
    return true;
  }
  for (const selector of CLOSE_SELECTORS) {
    const control = container.querySelector(selector) || (container.matches?.(selector) ? container : null);
    if (control) {
      control.click();
      return true;
    }
  }
  if (container.id === 'mobile-nav-drawer') {
    container.classList.remove('active');
    return true;
  }
  // Nothing closes it: try Escape, then remove it so the owner is never trapped behind a dialog.
  const Keyboard = doc.defaultView?.KeyboardEvent;
  if (Keyboard) container.dispatchEvent(new Keyboard('keydown', { key: 'Escape', bubbles: true }));
  if (container.isConnected && !isHidden(container)) container.remove();
  return true;
}

export function normalizeRoute(route) {
  const [path] = String(route ?? '').split(/[?#]/, 1);
  const withSlash = path ? (path.startsWith('/') ? path : `/${path}`) : HOME_ROUTE;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') || HOME_ROUTE : withSlash;
}

export const isHomeRoute = (route) => normalizeRoute(route) === HOME_ROUTE;

const CRAFT_ROUTE = '/account/web';
const MAIN_STORE_ROUTE = '/account/main-shop';
const WEBSITES_ROUTE = '/account/web/studio/websites/list';

/**
 * "Up one screen", by a fixed map of the app's sections. Browser history is not used: the web
 * builder's preview adds its own history entries, so history.back() flipped preview pages instead
 * of leaving the builder, and back felt dead.
 */
export function parentRoute(route) {
  const path = normalizeRoute(route);
  const query = String(route ?? '');
  if (path === HOME_ROUTE) return HOME_ROUTE;
  if (path.startsWith('/pos/')) return '/pos';
  if (path.startsWith(`${MAIN_STORE_ROUTE}/`)) return MAIN_STORE_ROUTE;
  if (path === '/account/web/site') {
    return /[?&]new=1(?:&|$)/.test(query) ? '/account/web/studio/websites/webmaker' : WEBSITES_ROUTE;
  }
  if (path === '/account/web/studio/websites/webmaker' || path === '/account/web/studio/websites/add') return WEBSITES_ROUTE;
  if (path.startsWith('/account/web/') || path === '/store' || path.startsWith('/store/')) return CRAFT_ROUTE;
  if (path.startsWith('/category/') && /[?&]studio=1(?:&|$)/.test(query)) return '/account/categories';
  return HOME_ROUTE;
}

/**
 * @param {object} deps
 * @param {() => boolean} deps.closeTopOverlay   closes the top overlay; true if there was one
 * @param {() => string} deps.getRoute           current app route, e.g. "/pos/overview?x=1"
 * @param {(route: string) => void} deps.navigate
 * @param {() => void} deps.goBack               history.back()
 * @param {() => void} deps.exitApp
 * @param {(message: string) => void} deps.notify  shows a toast
 * @param {() => number} [deps.now]
 * @returns {(event?: {canGoBack?: boolean}) => 'closed-overlay'|'went-back'|'navigated-up'|'warned'|'exited'}
 */
export function createBackHandler({ closeTopOverlay: closeOverlay, getRoute, navigate, goBack, exitApp, notify, now = Date.now, exitWindowMs = EXIT_WINDOW_MS }) {
  let lastExitWarningAt = -Infinity;
  return function handleBack(event = {}) {
    if (closeOverlay()) {
      lastExitWarningAt = -Infinity;
      return 'closed-overlay';
    }
    const route = getRoute();
    if (!isHomeRoute(route)) {
      lastExitWarningAt = -Infinity;
      navigate(parentRoute(route));
      return 'navigated-up';
    }
    const time = now();
    if (time - lastExitWarningAt <= exitWindowMs) {
      lastExitWarningAt = -Infinity;
      exitApp();
      return 'exited';
    }
    lastExitWarningAt = time;
    notify(EXIT_WARNING);
    return 'warned';
  };
}

/**
 * Registers the handler with @capacitor/app. Does nothing (returns null) on the web build, where the
 * browser's own back button already works and there is nothing to exit.
 */
export function installBackButton({ App, Capacitor, handler, onError = console.error }) {
  if (!Capacitor?.isNativePlatform?.() || typeof App?.addListener !== 'function') return null;
  const registration = App.addListener('backButton', (event) => {
    try {
      handler(event);
    } catch (error) {
      onError('The back button handler failed.', error);
    }
  });
  Promise.resolve(registration).catch((error) => onError('Could not register the back button listener.', error));
  return registration;
}

/** Wires the real app: the hash router in index.html, the toast helper and Capacitor's exitApp. */
export function createAppBackHandler({ App, win = window, doc = document }) {
  return createBackHandler({
    closeTopOverlay: () => closeTopOverlay(doc),
    getRoute: () => win.AppController?.currentRoute?.() ?? (win.location.hash.replace(/^#/, '') || HOME_ROUTE),
    navigate: (route) => {
      if (win.AppController?.navigate) win.AppController.navigate(route);
      else win.location.hash = `#${route}`;
    },
    goBack: () => win.history.back(),
    exitApp: () => { void App.exitApp(); },
    notify: (message) => win.AppUtils?.showToast?.(message)
  });
}
