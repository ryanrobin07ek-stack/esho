import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPersistedSQLiteData } from '../src/sqlite-snapshot.js';

test('SQLite snapshots retain website records when active catalog has no products', () => {
  assert.equal(hasPersistedSQLiteData({
    tables: {
      products: [],
      tenant_catalogs: [{ tenant_id: 'empty-site', products: [], categories: [] }]
    }
  }), true);
});

test('SQLite snapshots without any persisted rows are treated as empty', () => {
  assert.equal(hasPersistedSQLiteData({ tables: { products: [], tenant_catalogs: [], website_themes: [] } }), false);
  assert.equal(hasPersistedSQLiteData(null), false);
});
