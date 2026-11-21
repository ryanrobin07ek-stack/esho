import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// greetingName() is pure; load it from the screen module without the app it imports.
async function loadGreetingName() {
  const source = await readFile(new URL('../src/screens/home/home.js', import.meta.url), 'utf8');
  const start = source.indexOf('const GENERATED_USERNAME');
  const end = source.indexOf('export const homeScreen');
  const code = source.slice(start, end).replace('export function greetingName', 'function greetingName');
  return vm.runInNewContext(`${code}; greetingName`);
}

test('Home greets the shop by name, never by a generated guest username', async () => {
  const greetingName = await loadGreetingName();
  assert.equal(greetingName({ shopName: 'Sel', username: 'g-rrobinhq-18c339da', signedIn: true }), 'Sel');
  assert.equal(greetingName({ shopName: '', username: 'g-rrobinhq-18c339da', signedIn: true }), 'there');
  assert.equal(greetingName({ shopName: 'Craft', username: 'g-rrobinhq-18c339da', signedIn: true }), 'there',
    'The placeholder name of a new install is not the shop name.');
  assert.equal(greetingName({ shopName: '', username: 'wanjiku', signedIn: true }), 'wanjiku');
  assert.equal(greetingName({ shopName: '', username: 'wanjiku', signedIn: false }), 'there');
});
