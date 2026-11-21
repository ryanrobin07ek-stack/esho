import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const mixer = () => readFile(new URL('../public/litrus-mixer/index.html', import.meta.url), 'utf8');

test('the FAQ section appears only when the owner wrote questions', async () => {
  const html = await mixer();
  assert.match(html, /faqInner\.append\(faqHeading,faqList\);faqSection\.append\(faqInner\);if\(faqItems\.length\)wrap\.append\(faqSection\);/);
  assert.doesNotMatch(html, /faqSection\)\);\s*const newsletter=/, 'the section is never appended unconditionally');
});

test('the category strip can be swiped and does not repeat the categories', async () => {
  const html = await mixer();
  assert.match(html, /\.cgw \.cat-marquee-wrap\{ overflow-x: auto;/);
  assert.doesNotMatch(html, /\.cgw \.cat-marquee\{[^}]*animation:/, 'no automatic slide: with animations off only 3 categories were reachable');
  assert.doesNotMatch(html, /\[0,1,2,3\]\.flatMap\(\(\)=>C\)/, 'a shop with one category showed it four times');
});

test('"Spin" no longer turns things through 360 degrees forever, and reduced motion is respected', async () => {
  const html = await mixer();
  assert.match(html, /\.cont-spin\{ animation: lpk-sway /);
  assert.match(html, /\.cont-spin-3d\{ animation: lpk-tilt /);
  assert.doesNotMatch(html, /\.cont-spin(?:-3d)?\{ animation: spin/);
  assert.match(html, /prefers-reduced-motion: reduce\)\{ \[class\*="cont-"\]\{ animation: none !important; \} \}/);
});
