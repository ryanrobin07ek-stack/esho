import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../public/litrus-mixer/index.html', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../src/screens/builder/builder.js', import.meta.url), 'utf8');
const storefront = readFileSync(new URL('../public/craft-storefront-cloudflare.js', import.meta.url), 'utf8');

test('the footer builds social links only from the saved URLs and never draws a dead placeholder', () => {
  assert.ok(!html.includes('aria-label="Social profile"'), 'the dead "Social profile" icon must be gone');
  assert.match(html, /function litrusSocialList\(\)/, 'social links come from one helper');
  assert.match(html, /SHOP\.socials=\{instagram:/, 'the saved URLs are stored on SHOP when the app sends the catalogue');
  assert.match(html, /box\.innerHTML=H\[k\];litrusFixSocials\(box\);/, 'every alternate footer style is cleaned of fake social links');
  assert.match(html, /\[\[?'instagram','Instagram'/, 'Instagram is a known network');
  // Only real web addresses are ever used as a link target.
  assert.match(html, /\/\^https\?:\[\/\]\[\/\]\/i\.test\(s\[r\[0\]\]/, 'only http and https URLs are accepted');
});

test('the footer no longer carries slogans from the sneaker template', () => {
  for (const stale of ['Move your way', 'Made for every step', 'Thoughtful everyday style, made to move with you.', 'Everyday comfort. Thoughtfully chosen.']) {
    const footerLine = html.split('\n').find(line => line.includes('class="sole-footer-main'));
    assert.ok(footerLine, 'the main footer line exists');
    assert.ok(!footerLine.includes(stale), `"${stale}" must not appear in the main footer`);
  }
});

test('the app hands the saved social URLs to the Litrus editor', () => {
  for (const key of ['instagram_url', 'facebook_url', 'tiktok_url', 'youtube_url', 'x_url']) {
    assert.ok(builder.includes(`${key}: store.${key} || ""`), `${key} is sent to Litrus`);
  }
});

test('storefront notification controls show only the button that fits, and nothing on browsers without push', () => {
  assert.match(storefront, /const showState = on => \{ enable\.hidden = on; disable\.hidden = !on; \};/);
  assert.match(storefront, /!\("Notification" in window\)\) return;/);
});
