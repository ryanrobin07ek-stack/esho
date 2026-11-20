// First-run setup guide for a new shop owner (5 short screens), plus a "Get started" checklist
// on Home. Shown once for a shop with no products; "Show setup guide" on the checklist replays it.
// Saves through the app's own store (SQLiteEngine) and till (window.ShopPOS).
import './onboarding.css';
// The app passes its live store in onHomeShown(); importing main.js here could load a second copy.
let appStore = null;

const STATE_KEY = 'ESHOP_ONBOARDING_V1';
const CHECKLIST_KEY = 'ESHOP_ONBOARDING_CHECKLIST_V1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

const pos = async () => { await (window.ShopPOSReady || Promise.resolve()); return window.ShopPOS; };

const OFFERS = [['products', 'Products'], ['services', 'Services'], ['both', 'Both']];

function stepMarkup(step, data) {
  const dots = `<div class="onb-dots" aria-hidden="true">${[1, 2, 3, 4].map(n => `<i class="${n <= step ? 'on' : ''}"></i>`).join('')}</div>`;
  if (step === 1) return `${dots}<h1>Welcome</h1><p class="onb-lead">Sell in your shop, track your stock, and get your own website. Let's set up in a minute.</p>
    <button type="button" class="onb-primary" data-onb-next>Start</button>`;
  if (step === 2) return `${dots}<h1>Your shop</h1>
    <label class="onb-field">Shop name<input data-onb-name maxlength="120" placeholder="e.g. Mama Mboga" value="${esc(data.name)}"></label>
    <fieldset class="onb-field"><legend>What do you sell?</legend><div class="onb-choices">${OFFERS.map(([value, label]) =>
      `<button type="button" class="onb-choice${data.offer === value ? ' on' : ''}" data-onb-offer="${value}" aria-pressed="${data.offer === value}">${label}</button>`).join('')}</div></fieldset>
    <p class="onb-error" data-onb-error role="alert" hidden></p>
    <button type="button" class="onb-primary" data-onb-next>Next</button>`;
  if (step === 3) return `${dots}<h1>Your first products</h1><p class="onb-lead">Add one now, or skip and add them later.</p>
    <div class="onb-row"><label class="onb-field">Name<input data-onb-pname maxlength="120" placeholder="e.g. Sukuma wiki"></label>
    <label class="onb-field onb-price">Price<input data-onb-pprice type="number" min="0" step="1" inputmode="decimal" placeholder="0"></label></div>
    <button type="button" class="onb-secondary" data-onb-add>Add product</button>
    <ul class="onb-added">${data.added.map(name => `<li>✓ ${esc(name)}</li>`).join('')}</ul>
    <p class="onb-error" data-onb-error role="alert" hidden></p>
    <button type="button" class="onb-primary" data-onb-next>${data.added.length ? 'Next' : 'Skip for now'}</button>`;
  return `${dots}<h1>Getting paid</h1><p class="onb-lead">Your customers can pay the way they already do.</p>
    <ul class="onb-pay"><li><strong>Cash</strong><span>Record it at the till.</span></li><li><strong>M-Pesa</strong><span>Record it at the till when it arrives.</span></li>
    <li><strong>Card and online</strong><span>Connect payments later in Payments.</span></li></ul>
    <button type="button" class="onb-primary" data-onb-next>Finish</button>`;
}

/** The shop's saved name and offer type, from the app's live store (empty until Home has shown). */
export function currentShop() {
  try { const store = appStore?.getStore() || {}; return { name: store.name || '', offer_type: store.offer_type || '' }; } catch { return { name: '', offer_type: '' }; }
}

export async function startOnboarding({ prefill = false } = {}) {
  if (document.querySelector('.onb-overlay')) return;
  // A new shop starts empty (the app's placeholder name is not the owner's); a replay shows what is saved.
  const shop = prefill ? currentShop() : { name: '', offer_type: '' };
  const data = { step: 1, name: shop.name || '', offer: ['products', 'services', 'both'].includes(shop.offer_type) ? shop.offer_type : 'products', added: [] };
  const overlay = document.createElement('div');
  overlay.className = 'onb-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Set up your shop');
  document.body.append(overlay);
  const close = state => { write(STATE_KEY, state); overlay.remove(); renderChecklist(); };
  const draw = () => {
    // The hidden Back button is what Android's back button presses (src/back-button.js clicks [data-back-close]).
    overlay.innerHTML = `<div class="onb-card"><button type="button" hidden data-back-close data-onb-back>Back</button><button type="button" class="onb-skip" data-onb-skip>Skip</button>${stepMarkup(data.step, data)}</div>`;
    overlay.querySelector('input, .onb-primary')?.focus();
  };
  const fail = text => { const e = overlay.querySelector('[data-onb-error]'); if (e) { e.textContent = text; e.hidden = false; } };

  overlay.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.matches('[data-onb-skip]')) return close('skipped');
    if (target.matches('[data-onb-back]')) { if (data.step > 1) { data.step -= 1; return draw(); } return close('skipped'); }
    if (target.matches('[data-onb-offer]')) { data.offer = target.dataset.onbOffer; data.name = overlay.querySelector('[data-onb-name]')?.value || data.name; return draw(); }
    if (target.matches('[data-onb-add]')) {
      const name = overlay.querySelector('[data-onb-pname]').value.trim();
      const price = Number(overlay.querySelector('[data-onb-pprice]').value);
      if (!name || !Number.isFinite(price) || price < 0) return fail('Enter a product name and a price.');
      try {
        const till = await pos();
        let category = (await till.listCategories()).find(item => item.name.toLowerCase() === 'general');
        if (!category) { await till.addCategory('General'); category = (await till.listCategories()).find(item => item.name.toLowerCase() === 'general'); }
        await till.saveProduct({ name, price, categoryId: category.id, ...(data.offer === 'services' ? { isService: true } : {}) });
        data.added.push(name);
        return draw();
      } catch (error) { return fail(error?.message || 'The product could not be saved.'); }
    }
    if (!target.matches('[data-onb-next]')) return;
    if (data.step === 2) {
      data.name = overlay.querySelector('[data-onb-name]').value.trim();
      if (!data.name) return fail('Enter your shop name.');
      try {
        if (!appStore) throw new Error('The shop details could not be saved yet. Try again in a moment.');
        appStore.updateStore({ name: data.name, title: data.name, offer_type: data.offer });
      }
      catch (error) { return fail(error?.message || 'Your shop details could not be saved.'); }
    }
    if (data.step === 4) return close('done');
    data.step += 1;
    draw();
  });
  draw();
}

async function checklistItems() {
  const ticked = read(CHECKLIST_KEY) || {};
  let sales = 0, products = 0;
  try { const till = await pos(); sales = (await till.listSales()).length; products = (await till.listProducts()).length; } catch { /* till not ready */ }
  const draft = read('ESHOP_NEW_WEBSITE_DRAFT_V1');
  return [
    { id: 'sale', label: 'Make your first sale', route: '/pos', done: sales > 0 },
    { id: 'products', label: 'Add more products', route: '/account/main-shop', done: products > 3 },
    { id: 'website', label: 'Create your website', route: '/account/web/studio/websites/list', done: Boolean(draft?.shop_name) },
    { id: 'payments', label: 'Set up payments', route: '/account/payments', done: Boolean(ticked.payments) }
  ];
}

export async function renderChecklist() {
  if (!document.querySelector('.home-screen-main') || read(CHECKLIST_KEY)?.dismissed) return;
  const items = await checklistItems();
  // Home may have been redrawn while the till answered, so find it again now.
  const host = document.querySelector('.home-screen-main');
  if (!host) return;
  host.querySelector('.onb-checklist')?.remove();
  const card = document.createElement('section');
  card.className = 'onb-checklist';
  card.setAttribute('aria-label', 'Get started');
  card.innerHTML = `<header><h2>Get started</h2><span>${items.filter(i => i.done).length} of ${items.length}</span>
    <button type="button" class="onb-close" data-onb-dismiss aria-label="Hide Get started">×</button></header>
    <ul>${items.map(item => `<li class="${item.done ? 'done' : ''}"><a href="${item.route}" data-route="${item.route}" data-onb-item="${item.id}">
      <span class="onb-tick" aria-hidden="true">${item.done ? '✓' : ''}</span>${esc(item.label)}</a></li>`).join('')}</ul>
    <button type="button" class="onb-link" data-onb-replay>Show setup guide</button>`;
  host.prepend(card);
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-onb-dismiss], [data-onb-replay], [data-onb-item]');
  if (!target) return;
  const state = read(CHECKLIST_KEY) || {};
  if (target.matches('[data-onb-dismiss]')) { write(CHECKLIST_KEY, { ...state, dismissed: true }); target.closest('.onb-checklist')?.remove(); }
  else if (target.matches('[data-onb-replay]')) startOnboarding({ prefill: true });
  else if (target.dataset.onbItem === 'payments') write(CHECKLIST_KEY, { ...state, payments: true });
});

// Home is drawn by the router; add the checklist whenever it appears, and start the guide once
// for a shop that has no products yet (an existing shop is marked done without being asked).
export async function onHomeShown(context = {}) {
  if (context.SQLiteEngine) appStore = context.SQLiteEngine;
  if (!document.querySelector('.home-screen-main')) return;
  await renderChecklist();
  // On start-up Home is drawn again once the till is ready, without this hook; put the card back.
  const ensure = () => { if (document.querySelector('.home-screen-main') && !document.querySelector('.onb-checklist')) renderChecklist(); };
  [1500, 4000, 9000].forEach(delay => setTimeout(ensure, delay));
  if (read(STATE_KEY)) return;
  try {
    const till = await pos();
    if ((await till.listProducts()).length) { write(STATE_KEY, 'existing'); return; }
  } catch { return; }
  startOnboarding();
}
