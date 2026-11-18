import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import {
  closeTopOverlay, createAppBackHandler, createBackHandler, EXIT_WARNING, installBackButton, parentRoute
} from '../src/back-button.js';

function harness({ route = '/', overlays = [], start = 1000 } = {}) {
  const log = [];
  let clock = start;
  const state = { route, overlays: [...overlays] };
  const handler = createBackHandler({
    closeTopOverlay: () => { if (!state.overlays.length) return false; log.push(`close:${state.overlays.pop()}`); return true; },
    getRoute: () => state.route,
    navigate: (to) => { log.push(`navigate:${to}`); state.route = to; },
    goBack: () => log.push('history.back'),
    exitApp: () => log.push('exit'),
    notify: (message) => log.push(`toast:${message}`),
    now: () => clock
  });
  return { handler, log, state, tick: (ms) => { clock += ms; } };
}

test('back closes the top-most overlay before navigating anywhere', () => {
  const { handler, log, state } = harness({ route: '/pos/overview', overlays: ['modal', 'drawer'] });
  assert.equal(handler({ canGoBack: true }), 'closed-overlay');
  assert.equal(handler({ canGoBack: true }), 'closed-overlay');
  assert.deepEqual(log, ['close:drawer', 'close:modal']);
  assert.equal(state.route, '/pos/overview', 'The screen underneath is untouched.');
  assert.equal(handler({ canGoBack: true }), 'went-back');
  assert.equal(log.at(-1), 'history.back');
});

test('back goes up one screen when there is no history to step through', () => {
  const account = harness({ route: '/account/web/studio/store/products?x=1' });
  assert.equal(account.handler({ canGoBack: false }), 'navigated-up');
  assert.deepEqual(account.log, ['navigate:/account']);
  const pos = harness({ route: '/pos/catalogue/inventory' });
  pos.handler({});
  assert.deepEqual(pos.log, ['navigate:/pos']);
  const store = harness({ route: '/store/orders' });
  store.handler({});
  assert.deepEqual(store.log, ['navigate:/']);
  assert.equal(parentRoute('/category/shoes?studio=1'), '/account/categories');
  assert.equal(parentRoute('/account'), '/');
});

test('home needs two presses to exit, and the second press must be quick', () => {
  const { handler, log, tick } = harness({ route: '/' });
  assert.equal(handler({ canGoBack: true }), 'warned', 'Home never steps through history.');
  assert.deepEqual(log, [`toast:${EXIT_WARNING}`]);
  tick(500);
  assert.equal(handler({ canGoBack: true }), 'exited');
  assert.equal(log.at(-1), 'exit');

  const slow = harness({ route: '/' });
  slow.handler({});
  slow.tick(5000);
  assert.equal(slow.handler({}), 'warned', 'A slow second press warns again instead of exiting.');
  assert.equal(slow.log.filter((entry) => entry === 'exit').length, 0);
});

test('closing an overlay or leaving home cancels a pending exit warning', () => {
  const { handler, log, state, tick } = harness({ route: '/' });
  handler({});
  state.overlays.push('dialog');
  tick(100);
  assert.equal(handler({}), 'closed-overlay');
  tick(100);
  assert.equal(handler({}), 'warned', 'The earlier warning no longer counts.');
  assert.equal(log.includes('exit'), false);
});

test('installBackButton registers only on the native app and never on the web build', async () => {
  const added = [];
  const App = { addListener: (name, callback) => { added.push([name, callback]); return Promise.resolve({ remove() {} }); } };
  assert.equal(installBackButton({ App, Capacitor: { isNativePlatform: () => false }, handler: () => {} }), null);
  assert.equal(added.length, 0, 'No listener on the web build.');
  assert.equal(installBackButton({ App, Capacitor: undefined, handler: () => {} }), null);

  const received = [];
  installBackButton({ App, Capacitor: { isNativePlatform: () => true }, handler: (event) => received.push(event) });
  assert.equal(added[0][0], 'backButton');
  added[0][1]({ canGoBack: true });
  assert.deepEqual(received, [{ canGoBack: true }]);

  const errors = [];
  installBackButton({
    App, Capacitor: { isNativePlatform: () => true }, onError: (...args) => errors.push(args[0]),
    handler: () => { throw new Error('boom'); }
  });
  added[1][1]({});
  assert.deepEqual(errors, ['The back button handler failed.'], 'A handler error never breaks the listener.');
});

function dom(html) {
  const window = new JSDOM(`<!doctype html><body>${html}</body>`, { url: 'https://app.test/' }).window;
  return window.document;
}

test('closeTopOverlay clicks the close control of the top-most real overlay', () => {
  const document = dom(`
    <div class="modal-overlay active" id="a"><div class="modal-card" role="dialog" aria-modal="true">
      <button class="modal-close-btn" id="a-close">x</button></div></div>
    <div class="pos-discount-modal"><button data-pos-action="close-discount" id="discount-backdrop"></button>
      <section role="dialog" aria-modal="true"><button data-pos-action="close-discount" id="discount-cancel">Cancel</button></section></div>`);
  const clicks = [];
  document.addEventListener('click', (event) => clicks.push(event.target.id));
  assert.equal(closeTopOverlay(document), true);
  assert.equal(clicks.length, 1);
  assert.ok(['discount-backdrop', 'discount-cancel'].includes(clicks[0]), 'The later (top) overlay is closed first.');
  document.querySelector('.pos-discount-modal').remove();
  assert.equal(closeTopOverlay(document), true);
  assert.equal(clicks[1], 'a-close');
  document.querySelector('#a').remove();
  assert.equal(closeTopOverlay(document), false);
});

test('closeTopOverlay ignores inactive or hidden overlays and closes drawers, menus and the AI panel', () => {
  const document = dom(`
    <div class="modal-overlay" id="idle"><button class="modal-close-btn">x</button></div>
    <div id="craft-ai-panel" hidden><button aria-label="Close Craft AI">x</button></div>
    <div id="mobile-nav-drawer" class="mobile-drawer-overlay"></div>`);
  assert.equal(closeTopOverlay(document), false, 'Nothing is open.');

  document.querySelector('#mobile-nav-drawer').classList.add('active');
  assert.equal(closeTopOverlay(document), true);
  assert.equal(document.querySelector('#mobile-nav-drawer').classList.contains('active'), false);

  document.body.insertAdjacentHTML('beforeend', '<details class="workspace-menu" open><summary>Menu</summary></details>');
  assert.equal(closeTopOverlay(document), true);
  assert.equal(document.querySelector('details').open, false);

  let closed = false;
  const panel = document.querySelector('#craft-ai-panel');
  panel.hidden = false;
  panel.querySelector('button').addEventListener('click', () => { closed = true; panel.hidden = true; });
  assert.equal(closeTopOverlay(document), true);
  assert.equal(closed, true);
});

test('an overlay with no close control is removed rather than trapping the owner', () => {
  const document = dom('<div class="pos-scanner-overlay"><section role="dialog" aria-modal="true">no buttons</section></div>');
  assert.equal(closeTopOverlay(document), true);
  assert.equal(document.querySelector('.pos-scanner-overlay'), null);
});

test('createAppBackHandler drives the real router, toast and exit', () => {
  const win = new JSDOM('<!doctype html><body></body>', { url: 'https://app.test/#/account/profile' }).window;
  const calls = [];
  win.AppController = { currentRoute: () => (win.location.hash.replace(/^#/, '') || '/'), navigate: (route) => { calls.push(`navigate:${route}`); win.location.hash = `#${route}`; } };
  win.AppUtils = { showToast: (message) => calls.push(`toast:${message}`) };
  const handler = createAppBackHandler({ App: { exitApp: async () => calls.push('exit') }, win, doc: win.document });
  assert.equal(handler({ canGoBack: false }), 'navigated-up');
  win.location.hash = '#/';
  handler({});
  handler({});
  assert.deepEqual(calls, ['navigate:/account', `toast:${EXIT_WARNING}`, 'exit']);
});
