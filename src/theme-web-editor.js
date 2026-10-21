// Theme Web Editor
// A phone-canvas editor that replaces the old web editor for packaged themes.
//
// - Default view: the theme's storefront inside a phone canvas.
// - Bottom nav: the same sections the theme's own Studio top nav offers
//   (Products, Sections, Hero Editor, Themes, ...), minus "Dashboard".
//   The list is read live from the theme's studio.html, so every theme gets
//   its own map without hard-coding it here.
// - Tapping a section opens that Studio screen inside the same phone canvas
//   (the Studio's own header + tab strip are hidden; our nav replaces them).
// - "View store" returns to the storefront, reloaded so edits show up.

import { WEBSITE_THEME_CATALOG } from './theme-catalog.js';

const HIDDEN_TAB_IDS = new Set(['dashboard']);
const TAB_WAIT_MS = 10000;

const STYLE_ID = 'eshop-web-editor-style';
const EDITOR_CSS = `
.ewe-root{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:#0f1115;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111}
.ewe-phone{position:relative;display:flex;flex-direction:column;width:100%;height:100%;background:#fff;overflow:hidden}
@media (min-width:768px){.ewe-phone{width:390px;height:min(844px,calc(100vh - 32px));border-radius:36px;box-shadow:0 0 0 10px #1c1f26,0 24px 80px #000a}}
.ewe-top{flex:none;display:flex;align-items:center;gap:10px;padding:max(8px,env(safe-area-inset-top)) 12px 8px;background:#fff;border-bottom:1px solid #e5e7eb}
.ewe-back{flex:none;width:34px;height:34px;border:0;border-radius:50%;background:#f3f4f6;font-size:18px;line-height:1;cursor:pointer}
.ewe-title{flex:1;min-width:0;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ewe-mode{flex:none;font-size:11px;font-weight:600;color:#6b7280}
.ewe-canvas{position:relative;flex:1;min-height:0;background:#f3f4f6}
.ewe-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
.ewe-frame[hidden]{display:none}
.ewe-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#fff;font-size:13px;color:#6b7280;z-index:2}
.ewe-loading[hidden]{display:none}
.ewe-nav{flex:none;display:flex;gap:6px;overflow-x:auto;padding:8px 10px max(8px,env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e5e7eb;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.ewe-nav::-webkit-scrollbar{display:none}
.ewe-tab{flex:none;border:1px solid #e5e7eb;border-radius:999px;background:#fff;padding:8px 14px;font-size:12.5px;font-weight:600;color:#374151;cursor:pointer;white-space:nowrap}
.ewe-tab.is-active{background:#111;border-color:#111;color:#fff}
.ewe-tab.is-store{border-color:#111}
.ewe-hint{flex:none;padding:8px 14px;font-size:12px;color:#6b7280}
`;

const FRAME_CSS = {
  // Hide the Studio's own header and tab strip; the editor nav replaces them.
  studio: `.studio-header,.studio-nav-tabs,#studio-tab-bar{display:none!important}
html,body{overscroll-behavior:contain}`,
  // The storefront must not link out of the editor into /studio.html.
  store: `.floating-studio-gear,.studio-gear-link,.footer-gear-link{display:none!important}`
};

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = EDITOR_CSS;
  document.head.appendChild(style);
}

function injectFrameCss(frame, kind) {
  try {
    const doc = frame.contentDocument;
    if (!doc || !doc.head || doc.getElementById('ewe-frame-css')) return;
    const style = doc.createElement('style');
    style.id = 'ewe-frame-css';
    style.textContent = FRAME_CSS[kind];
    doc.head.appendChild(style);
  } catch { /* cross-origin frame: leave untouched */ }
}

const cleanLabel = text => String(text || '')
  .replace(/^[^\p{L}\p{N}]+/u, '')
  .replace(/\s+/g, ' ')
  .trim();

// Studios render their tab strip as <a href="/studio/ID"> links, except FreshBox
// which uses <button onclick="window.switchTab('ID')">. Support both.
const TAB_SELECTOR = '.studio-nav-tabs .studio-tab-btn, #studio-tab-bar .studio-tab-btn';

function tabIdOf(element) {
  const href = element.getAttribute('href') || '';
  if (href.includes('/studio/')) return href.split('/studio/')[1].split(/[?#]/)[0];
  const onclick = element.getAttribute('onclick') || '';
  return onclick.match(/switchTab\(\s*['"]([^'"]+)['"]/)?.[1] || '';
}

function readTabs(frame) {
  try {
    const elements = frame.contentDocument?.querySelectorAll(TAB_SELECTOR) || [];
    const seen = new Set();
    const tabs = [];
    for (const element of elements) {
      const id = tabIdOf(element);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      tabs.push({ id, label: cleanLabel(element.textContent) || id });
    }
    return tabs.filter(tab => !HIDDEN_TAB_IDS.has(tab.id));
  } catch {
    return [];
  }
}

function clickTab(frame, id) {
  const elements = frame.contentDocument?.querySelectorAll(TAB_SELECTOR) || [];
  for (const element of elements) {
    if (tabIdOf(element) === id) { element.click(); return true; }
  }
  return false;
}

function waitForTabs(frame) {
  return new Promise(resolve => {
    const started = Date.now();
    const poll = () => {
      const tabs = readTabs(frame);
      if (tabs.length) return resolve(tabs);
      if (Date.now() - started > TAB_WAIT_MS) return resolve([]);
      setTimeout(poll, 150);
    };
    poll();
  });
}

function whenLoaded(frame) {
  return new Promise(resolve => {
    if (frame.contentDocument?.readyState === 'complete' && frame.contentWindow?.location.href !== 'about:blank') return resolve();
    frame.addEventListener('load', () => resolve(), { once: true });
  });
}

export function findTheme(themeOrId) {
  if (themeOrId && typeof themeOrId === 'object') return themeOrId;
  return WEBSITE_THEME_CATALOG.find(theme => theme.id === themeOrId) || null;
}

export function openThemeWebEditor(themeOrId, { onClose } = {}) {
  const theme = findTheme(themeOrId);
  if (!theme) throw new Error(`Unknown theme "${themeOrId}".`);
  ensureStyle();

  const root = document.createElement('div');
  root.className = 'ewe-root';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', `${theme.name} web editor`);
  root.innerHTML = `
    <div class="ewe-phone">
      <div class="ewe-top">
        <button class="ewe-back" type="button" aria-label="Close editor">&#8592;</button>
        <div class="ewe-title"></div>
        <div class="ewe-mode">Store preview</div>
      </div>
      <div class="ewe-canvas">
        <div class="ewe-loading">Loading your store&hellip;</div>
        <iframe class="ewe-frame" data-kind="store" title="Store preview"></iframe>
        <iframe class="ewe-frame" data-kind="studio" title="Editor screen" hidden></iframe>
      </div>
      <nav class="ewe-nav" aria-label="Editor sections"></nav>
    </div>`;
  document.body.appendChild(root);

  const $ = selector => root.querySelector(selector);
  const storeFrame = $('[data-kind="store"]');
  const studioFrame = $('[data-kind="studio"]');
  const nav = $('.ewe-nav');
  const loading = $('.ewe-loading');
  const mode = $('.ewe-mode');
  $('.ewe-title').textContent = theme.name;

  let activeId = 'store';
  let storeDirty = false;
  let tabs = [];

  const setActive = id => {
    activeId = id;
    nav.querySelectorAll('.ewe-tab').forEach(button =>
      button.classList.toggle('is-active', button.dataset.id === id));
    nav.querySelector('.is-active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  };

  async function showStore() {
    studioFrame.hidden = true;
    storeFrame.hidden = false;
    mode.textContent = 'Store preview';
    setActive('store');
    if (storeDirty) {
      storeDirty = false;
      loading.hidden = false;
      storeFrame.contentWindow.location.reload();
      await whenLoaded(storeFrame);
      injectFrameCss(storeFrame, 'store');
      loading.hidden = true;
    }
  }

  async function showTab(tab) {
    storeFrame.hidden = true;
    studioFrame.hidden = false;
    mode.textContent = tab.label;
    storeDirty = true;
    setActive(tab.id);
    injectFrameCss(studioFrame, 'studio');
    clickTab(studioFrame, tab.id);
  }

  function renderNav() {
    nav.textContent = '';
    const make = (id, label, className, handler) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ewe-tab ${className}`.trim();
      button.dataset.id = id;
      button.textContent = label;
      button.addEventListener('click', handler);
      nav.appendChild(button);
    };
    make('store', 'View store', 'is-store', showStore);
    for (const tab of tabs) make(tab.id, tab.label, '', () => showTab(tab));
    setActive(activeId);
  }

  function close() {
    root.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  }
  const onKey = event => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('.ewe-back').addEventListener('click', close);

  renderNav();

  // Storefront is the default screen.
  storeFrame.src = theme.preview_url;
  whenLoaded(storeFrame).then(() => {
    injectFrameCss(storeFrame, 'store');
    loading.hidden = true;
  });

  // Load the Studio in the background; it only becomes visible when a tab is tapped.
  studioFrame.src = theme.studio_url;
  whenLoaded(studioFrame).then(async () => {
    injectFrameCss(studioFrame, 'studio');
    tabs = await waitForTabs(studioFrame);
    if (!tabs.length) {
      const hint = document.createElement('div');
      hint.className = 'ewe-hint';
      hint.textContent = 'Editor sections could not load for this theme.';
      nav.appendChild(hint);
    }
    renderNav();
  });

  return { close, showStore, root };
}

if (typeof window !== 'undefined') {
  window.EshopWebEditor = { open: openThemeWebEditor, close: () => document.querySelector('.ewe-root')?.remove() };
}
