import assert from 'node:assert/strict';
import test from 'node:test';
import { withStartupTimeout } from '../src/startup-timeout.js';

test('a startup step that never settles is turned into an error instead of a blank page', async () => {
  await assert.rejects(withStartupTimeout(new Promise(() => {}), 'Starting the local database', 20),
    /Starting the local database did not finish within 0 seconds/);
});

test('a step that finishes in time resolves with its value and leaves no timer running', async () => {
  assert.equal(await withStartupTimeout(Promise.resolve('ready'), 'x', 5000), 'ready');
  await assert.rejects(withStartupTimeout(Promise.reject(new Error('boom')), 'x', 5000), /boom/);
});
