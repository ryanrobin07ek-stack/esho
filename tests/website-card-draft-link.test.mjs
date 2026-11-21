import assert from 'node:assert/strict';
import test from 'node:test';
import { readAppSource } from './helpers/app-source.mjs';

test('the new-website draft card shows no web address link and no live-site button', async () => {
  const app = await readAppSource();
  assert.match(app, /website\.id === WEBSITE_BUILDER_DRAFT_TENANT_ID\s*\n\s*\/\/[^\n]*\n\s*\? `<p class="profile-website-domain">\$\{AppUtils\.escapeHTML\(website\.hostname\)\}<\/p>`/,
    'The draft address is plain text: it used to link to "https://Draft — not created yet".');
  assert.match(app, /\$\{website\.id === WEBSITE_BUILDER_DRAFT_TENANT_ID \? "" : `<a class="profile-website-live"/);
});

test('the draft card hides Domains, Stats and Delete web, which have nothing to act on yet', async () => {
  const app = await readAppSource();
  assert.match(app, /\$\{website\.id === WEBSITE_BUILDER_DRAFT_TENANT_ID \? "" \/\*[^*]*\*\/ : `\s*<a class="btn-secondary" href="\/account\/profile\/webs\/\$\{encodeURIComponent\(website\.id\)\}\/domains"/);
});
