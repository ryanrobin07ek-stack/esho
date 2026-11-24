import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../public/craft-storefront-cloudflare.js', import.meta.url), 'utf8');

// Runs the real storefront script against a shop's published settings and returns the WhatsApp button, if any.
function runStorefront(store) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://shop.craft.ke/', runScripts: 'outside-only', pretendToBeVisual: true });
  const window = dom.window;
  window.__ESHOP_CLOUDFLARE_STOREFRONT__ = true;
  window.__ESHOP_THEME_CATALOG__ = { store, products: [] };
  window.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  try { window.eval(script); } catch (error) { assert.fail(`the storefront script must start cleanly: ${error.message}`); }
  const button = window.document.getElementById('craft-whatsapp-button');
  const result = button && { href: button.getAttribute('href'), label: button.getAttribute('aria-label'), html: button.innerHTML, style: button.getAttribute('style'), target: button.getAttribute('target'), rel: button.getAttribute('rel') };
  window.close();
  return result;
}

test('a shop with the WhatsApp switch on and a wa.me link gets a green WhatsApp button at the bottom right', () => {
  const button = runStorefront({ name: 'Mama Duka', whatsapp_enabled: 1, whatsapp_url: 'https://wa.me/254700111222' });
  assert.ok(button, 'the button is drawn');
  assert.match(button.href, /^https:\/\/wa\.me\/254700111222\?text=Hello%20Mama%20Duka/);
  assert.equal(button.label, 'Chat with us on WhatsApp');
  assert.match(button.html, /<svg[^>]*viewBox="0 0 24 24"/, 'it carries the WhatsApp logo');
  assert.match(button.style, /position:\s*fixed/);
  assert.match(button.style, /right:/);
  assert.match(button.style, /bottom:/);
  assert.match(button.style, /#25D366|rgb\(37,\s*211,\s*102\)/i, 'the WhatsApp green');
  assert.equal(button.target, '_blank');
  assert.match(button.rel, /noopener/);
});

test('no button appears unless the switch is on and a usable number exists', () => {
  assert.equal(runStorefront({ name: 'A' }), null, 'a shop that never set WhatsApp shows nothing');
  assert.equal(runStorefront({ name: 'A', whatsapp_enabled: 0, whatsapp_url: 'https://wa.me/254700111222' }), null, 'a saved link does not show while the switch is off');
  assert.equal(runStorefront({ name: 'A', whatsapp_enabled: 1, whatsapp_url: '' }), null, 'the switch alone, with no number, shows nothing');
  assert.equal(runStorefront({ name: 'A', whatsapp_enabled: 1, whatsapp_url: 'https://example.com/chat' }), null, 'a link that is not a WhatsApp number is ignored');
});

test('the number can come from a typed number, or a phone that already has its country code', () => {
  assert.match(runStorefront({ whatsapp_enabled: true, whatsapp_url: '+254 700 111 222' }).href, /wa\.me\/254700111222/);
  assert.match(runStorefront({ whatsapp_enabled: '1', whatsapp_url: 'https://api.whatsapp.com/send?phone=254711000111' }).href, /wa\.me\/254711000111/);
  assert.match(runStorefront({ whatsapp_enabled: 1, phone: '+254 722 333 444' }).href, /wa\.me\/254722333444/);
  assert.equal(runStorefront({ whatsapp_enabled: 1, phone: '0722333444' }), null, 'a local number without a country code is not guessed at');
});
