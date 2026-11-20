import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('a fresh install creates every table, each with its own statement', async () => {
  const source = await readFile(new URL('../src/sqlite.js', import.meta.url), 'utf8');
  assert.match(source, /for\(const t of TABLES\)await db\.execute\('CREATE TABLE IF NOT EXISTS/,
    'Each table is created on its own: a joined statement left the last table missing on Android.');
  assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS[^\n]*\.join\(';'\)/);
});
