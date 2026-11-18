import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createLitrusHostMessageHandler, isValidLitrusHtml, SHOP_CHANGED_MESSAGE } from '../src/litrus-host.js';

const ORIGIN = 'https://app.test';
const goodHtml = '<!doctype html><html><head><meta name="eshop-filled-theme" content="litrus-mixer"></head></html>';

function host({ openedFor = 'shop-a', draft = false } = {}) {
  const frame = { id: 'frame' };
  const state = { active: openedFor };
  const log = { saved: [], posted: [], toasts: [], searches: [], published: 0, finished: 0, catalogs: 0, themes: 0 };
  const handler = createLitrusHostMessageHandler({
    tenantId: openedFor,
    isDraftEditor: draft,
    getActiveTenantId: () => state.active,
    getFrameWindow: () => frame,
    origin: ORIGIN,
    sendTheme: () => { log.themes += 1; },
    sendCatalog: () => { log.catalogs += 1; },
    saveDesign: async (payload) => { log.saved.push({ tenant: state.active, payload }); },
    searchImages: async (request) => { log.searches.push(request); return { images: [{ ok: true }] }; },
    reply: (_window, message) => log.posted.push(message),
    setMode: () => {},
    toast: (message, type) => log.toasts.push([message, type]),
    finishDraft: () => { log.finished += 1; },
    openPublish: () => { log.published += 1; },
    onError: () => {}
  });
  const send = (data, overrides = {}) => handler({ origin: ORIGIN, source: frame, data, ...overrides });
  return { state, log, send, frame };
}

test('the editor host ignores messages from other origins or windows', async () => {
  const { send, log } = host();
  await send({ type: 'craft-litrus-ready' }, { origin: 'https://evil.test' });
  await send({ type: 'craft-litrus-ready' }, { source: {} });
  assert.equal(log.catalogs, 0);
  assert.equal(log.themes, 0);
});

test('ready sends the theme and the catalog of the shop the editor opened for', async () => {
  const { send, log } = host();
  await send({ type: 'craft-litrus-ready' });
  assert.deepEqual([log.themes, log.catalogs], [1, 1]);
});

test('once another shop is active the editor can no longer read or write shop data', async () => {
  const { send, log, state } = host({ openedFor: 'shop-a' });
  state.active = 'shop-b';

  await send({ type: 'craft-litrus-ready' });
  assert.equal(log.catalogs, 0, 'shop-b catalog is never sent into the shop-a editor');
  assert.deepEqual(log.toasts.at(-1), [SHOP_CHANGED_MESSAGE, 'danger']);

  await send({ type: 'craft-litrus-draft', requestId: '1-1', html: goodHtml });
  assert.equal(log.saved.length, 0, 'an autosave from the shop-a editor is not written into shop-b');
  assert.equal(log.posted.at(-1).type, 'craft-litrus-draft-saved');
  assert.equal(log.posted.at(-1).error, SHOP_CHANGED_MESSAGE);

  await send({ type: 'craft-litrus-publish', html: goodHtml });
  assert.equal(log.saved.length, 0);
  assert.equal(log.published, 0, 'the publish dialog is not opened for the wrong shop');

  await send({ type: 'craft-litrus-image-request', requestId: 'img1', images: [{ name: 'x' }] });
  assert.equal(log.searches.length, 0, 'images are not searched in the wrong shop');
  assert.equal(log.posted.at(-1).error, SHOP_CHANGED_MESSAGE);
});

test('saves and image searches run against the shop the editor opened for', async () => {
  const { send, log } = host({ openedFor: 'shop-a' });
  await send({ type: 'craft-litrus-draft', requestId: '2-9', html: goodHtml });
  assert.equal(log.saved.length, 1);
  assert.equal(log.saved[0].tenant, 'shop-a');
  assert.equal(log.posted.at(-1).error, '');

  await send({ type: 'craft-litrus-image-request', requestId: 'img-2', images: [{ name: 'x' }] });
  assert.deepEqual(log.searches[0], { tenantId: 'shop-a', isDraft: false, images: [{ name: 'x' }] });
  assert.equal(log.posted.at(-1).type, 'craft-litrus-image-response');

  await send({ type: 'craft-litrus-publish', html: goodHtml });
  assert.equal(log.saved.length, 2);
  assert.equal(log.published, 1);
});

test('a new-website draft saves to the draft shop and continues setup instead of publishing', async () => {
  const { send, log } = host({ openedFor: '__new_website_draft__', draft: true });
  await send({ type: 'craft-litrus-publish', html: goodHtml });
  assert.equal(log.saved.length, 1);
  assert.equal(log.finished, 1);
  assert.equal(log.published, 0);
  await send({ type: 'craft-litrus-image-request', requestId: 'img-3', images: [] });
  assert.deepEqual(log.searches[0], { tenantId: 'main', isDraft: true, images: [] });
});

test('incomplete storefronts and malformed requests are rejected without saving', async () => {
  const { send, log } = host();
  await send({ type: 'craft-litrus-publish', html: '<html></html>' });
  assert.equal(log.saved.length, 0);
  assert.match(log.toasts.at(-1)[0], /incomplete storefront/);
  await send({ type: 'craft-litrus-draft', requestId: 'bad', html: goodHtml });
  assert.match(log.posted.at(-1).error, /incomplete shop draft/);
  await send({ type: 'craft-litrus-image-request', requestId: 'bad id!', images: [] });
  assert.equal(log.posted.at(-1).error, 'Invalid Craft image request.');
  assert.equal(isValidLitrusHtml(goodHtml), true);
  assert.equal(isValidLitrusHtml(goodHtml.replace('litrus-mixer', 'other')), false);
});

test('a failed save is reported to the editor and never opens the publish dialog', async () => {
  const frame = {};
  const posted = [];
  const toasts = [];
  let published = 0;
  const handler = createLitrusHostMessageHandler({
    tenantId: 'shop-a', isDraftEditor: false, getActiveTenantId: () => 'shop-a', getFrameWindow: () => frame, origin: ORIGIN,
    sendTheme() {}, sendCatalog() {}, saveDesign: async () => { throw new Error('disk full'); }, searchImages: async () => ({}),
    reply: (_window, message) => posted.push(message), setMode() {}, toast: (message) => toasts.push(message),
    finishDraft() {}, openPublish: () => { published += 1; }, onError: () => {}
  });
  await handler({ origin: ORIGIN, source: frame, data: { type: 'craft-litrus-draft', requestId: '3-3', html: goodHtml } });
  assert.equal(posted.at(-1).error, 'disk full');
  await handler({ origin: ORIGIN, source: frame, data: { type: 'craft-litrus-publish', html: goodHtml } });
  assert.deepEqual(toasts, ['disk full']);
  assert.equal(published, 0);
});

test('the builder Store button opens the store details of the shop being edited', async () => {
  const app = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(app, /id="builder-litrus-store-details" href="\/account\/web\/store\?tenant=\$\{encodeURIComponent\(tenant\.id\)\}"/);
  assert.match(app, /path === "\/account\/web\/store"\) && params\.has\("tenant"\)/,
    'The store route activates the shop named in the link before rendering.');
  assert.match(app, /draftEditor \? "" : `<a id="builder-litrus-store-details"/,
    'A shop that has not been created yet has no Store details to edit.');
});
