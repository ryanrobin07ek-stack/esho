import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { createPosApp } from './pos.js';
import './browser-register.css';

if (new URLSearchParams(window.location.search).has('password')) {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
}

const DATABASE_NAME = 'eshop-browser-register';
const DATABASE_STORE = 'databases';
const DATABASE_KEY = 'pos';
const CONNECTION_KEY = 'ESHOP_BROWSER_POS_CLOUD_V1';
const DEFAULT_WORKER = 'https://eshop-storefront.ryanrobin07-ek.workers.dev';
let cloudConnection = readConnection();
let availableAccountShops = new Map();

function isAllowedEndpoint(value) {
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === 'https:'
      && (endpoint.hostname === 'rrobin.co.ke' || endpoint.hostname.endsWith('.workers.dev'));
  } catch {
    return false;
  }
}

function readConnection() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONNECTION_KEY) || 'null');
    if (saved && typeof saved.endpoint === 'string' && typeof saved.tenant === 'string'
      && typeof saved.token === 'string' && isAllowedEndpoint(saved.endpoint)) return saved;
  } catch (error) {
    console.warn('Saved browser register cloud connection could not be read.', error);
  }
  return { endpoint: DEFAULT_WORKER, tenant: '', token: '' };
}

async function requestCloud(tenantId, method, data = {}) {
  if (!cloudConnection.tenant || tenantId !== cloudConnection.tenant || !cloudConnection.token) {
    throw new Error('Connect this register with the shop owner key first.');
  }
  if (!isAllowedEndpoint(cloudConnection.endpoint)) {
    throw new Error('The saved Cloudflare Worker URL is not allowed. Reconnect using the Craft site.');
  }
  const headers = { Authorization: `Bearer ${cloudConnection.token}` };
  if (cloudConnection.authType === 'account') {
    const sessionResponse = await fetch(`${cloudConnection.endpoint}/api/auth/session`, { headers });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok) {
      throw new Error(session.error || 'Your Craft account session expired. Sign in again.');
    }
  }
  const query = method === 'GET'
    ? `&after=${encodeURIComponent(data.after || 0)}&limit=${encodeURIComponent(data.limit || 200)}`
    : '';
  const response = await fetch(
    `${cloudConnection.endpoint}/api/business/records?tenant=${encodeURIComponent(tenantId)}${query}`,
    {
      method,
      headers: {
        ...headers,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {})
      },
      ...(method === 'POST' ? { body: JSON.stringify(data) } : {})
    }
  );
  const body = await response.text();
  let result;
  try {
    result = JSON.parse(body);
  } catch {
    throw new Error(body || `Cloud sync returned HTTP ${response.status}.`);
  }
  if (!response.ok) throw new Error(result.error || `Cloud sync returned HTTP ${response.status}.`);
  return result;
}

async function requestNearbyPairing(tenantId, method, data = {}) {
  if (!cloudConnection.tenant || tenantId !== cloudConnection.tenant || !cloudConnection.token) {
    throw new Error('Connect this register to the same shop as your phone before pairing.');
  }
  if (!isAllowedEndpoint(cloudConnection.endpoint)) {
    throw new Error('The saved Cloudflare Worker URL is not allowed. Reconnect using the Craft site.');
  }
  const headers = {
    Authorization: `Bearer ${cloudConnection.token}`,
    ...(data.sessionToken ? { 'X-Nearby-Session': data.sessionToken } : {})
  };
  if (cloudConnection.authType === 'account') {
    const sessionResponse = await fetch(`${cloudConnection.endpoint}/api/auth/session`, { headers });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok) throw new Error(session.error || 'Your Craft account session expired. Sign in again.');
  }
  const id = data.id ? `&id=${encodeURIComponent(data.id)}` : '';
  const response = await fetch(
    `${cloudConnection.endpoint}/api/nearby/pairing?tenant=${encodeURIComponent(tenantId)}${id}`,
    {
      method,
      headers: {
        ...headers,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {})
      },
      ...(method === 'POST' ? {
        body: JSON.stringify({ action: data.action, offer: data.offer, answer: data.answer })
      } : {})
    }
  );
  const body = await response.text();
  let result;
  try {
    result = JSON.parse(body);
  } catch {
    throw new Error(body || `Nearby pairing returned HTTP ${response.status}.`);
  }
  if (!response.ok) throw new Error(result.error || `Nearby pairing returned HTTP ${response.status}.`);
  return result;
}

function setCloudStatus(message, error = false) {
  const status = document.getElementById('browser-cloud-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.error = error ? 'true' : 'false';
}

async function updateSyncBanner() {
  const banner = document.querySelector('.browser-sync-banner');
  const state = document.getElementById('browser-sync-state');
  const detail = document.getElementById('browser-sync-detail');
  const action = document.getElementById('browser-sync-action');
  const disconnect = document.getElementById('browser-disconnect-action');
  const useShop = document.getElementById('browser-use-shop-action');
  if (!banner || !state || !detail || !action || !disconnect || !useShop) return;
  const connected = Boolean(cloudConnection.token && cloudConnection.tenant);
  disconnect.hidden = !connected;
  useShop.hidden = !connected;
  if (!connected) {
    banner.dataset.error = 'false';
    state.textContent = 'This browser is not connected to a shop.';
    detail.textContent = 'Connect this register, then enable cloud backup in its POS Settings.';
    action.textContent = 'Connect this register';
    action.hidden = false;
    action.onclick = () => {
      document.getElementById('browser-register-connect').open = true;
      document.getElementById('browser-register-connect').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return;
  }

  let status;
  try {
    status = await window.ShopPOS?.getCloudSyncStatus?.();
  } catch (error) {
    banner.dataset.error = 'true';
    state.textContent = `Could not read this browser’s sync status: ${error.message || error}`;
    detail.textContent = 'Your local register data has not been changed.';
    action.hidden = true;
    return;
  }
  banner.dataset.error = status?.error ? 'true' : 'false';
  if (status?.error) {
    state.textContent = `Cloud sync error for ${cloudConnection.tenant}: ${status.error}`;
    detail.textContent = `${status.pending} local change(s) are waiting to upload. Fix this connection or retry sync.`;
  } else if (!status?.enabled) {
    state.textContent = `Connected to ${cloudConnection.tenant}, but cloud backup is OFF on this browser.`;
    detail.textContent = 'Phone settings do not turn on backup for this separate browser register.';
  } else if (status.tenant !== cloudConnection.tenant) {
    state.textContent = `This browser is connected to ${cloudConnection.tenant}, but its backup is still set to ${status.tenant}.`;
    detail.textContent = 'Switch this browser to the connected shop to download its products. Other devices and their local data will not be changed.';
  } else {
    state.textContent = `Cloud backup is ON for ${cloudConnection.tenant}.`;
    detail.textContent = `${status.pending} local change(s) waiting to upload${status.lastSync ? ` · last successful check ${new Date(status.lastSync).toLocaleString()}` : ' · no successful sync check yet'}.`;
  }
  action.hidden = false;
  action.textContent = status?.enabled
    ? status.tenant !== cloudConnection.tenant ? `Switch backup to ${cloudConnection.tenant}` : 'Sync now'
    : 'Open sync settings';
  action.onclick = async () => {
    if (!status?.enabled) {
      window.location.hash = '#/pos/more/settings';
      return;
    }
    action.disabled = true;
    action.textContent = 'Syncing…';
    try {
      if (status?.enabled && status.tenant !== cloudConnection.tenant) {
        await window.ShopPOS.switchCloudSyncTenant(cloudConnection.tenant);
      } else {
        await window.ShopPOS.syncCloudNow();
      }
    } catch {
      // The sync status is saved and displayed by the POS sync handler.
    } finally {
      action.disabled = false;
      await updateSyncBanner();
    }
  };
  useShop.textContent = status?.enabled && status.tenant === cloudConnection.tenant
    ? 'Replace browser POS from this shop'
    : 'Use this shop’s POS';
  useShop.onclick = async () => {
    try {
      const latestStatus = await window.ShopPOS.getCloudSyncStatus();
      const pending = Number(latestStatus.pending) || 0;
      const pendingWarning = pending
        ? `\n\n${pending} unsynced local change(s) will be erased.`
        : '';
      const message = `Replace all POS records currently stored in this browser with records from “${cloudConnection.tenant}” and enable cloud sync for this shop? This replaces local products, stock, receipts, expenses, suppliers, orders, settings, and unsynced changes.${pendingWarning} It does not change the shop’s cloud records or the phone’s local data.`;
      if (!window.confirm(message)) return;
      useShop.disabled = true;
      useShop.textContent = 'Loading this shop’s POS…';
      setBrowserDataStatus(`Downloading ${cloudConnection.tenant} POS records. Do not close this page…`);
      const result = await window.ShopPOS.replaceWithCloudShop(cloudConnection.tenant);
      setBrowserDataStatus(`This browser now uses ${cloudConnection.tenant}. Imported ${result.imported} shop record(s); cloud sync is on.`);
      await updateSyncBanner();
    } catch (error) {
      setBrowserDataStatus(error instanceof Error ? error.message : 'Could not load this shop’s POS.', true);
    } finally {
      useShop.disabled = false;
      await updateSyncBanner();
    }
  };
}

function installCloudBridge() {
  window.EshopInventoryBridge = {
    activeWebsiteId: () => cloudConnection.tenant || '',
    websites: () => cloudConnection.tenant
      ? [{ tenant_id: cloudConnection.tenant, name: cloudConnection.tenant === 'main' ? 'Main shop' : cloudConnection.tenant }]
      : [],
    syncPosRecords: requestCloud,
    nearbyPairing: requestNearbyPairing,
    onPosSyncStatusChanged: () => void updateSyncBanner()
  };
}

function setAccountShops(tenants, selectedTenant = '') {
  availableAccountShops = new Map(tenants.map((shop) => [shop.id, shop]));
  const select = document.querySelector('#browser-cloud-form select[name="tenant"]');
  if (!select) return;
  const options = tenants.map((shop) => {
    const option = document.createElement('option');
    option.value = shop.id;
    option.textContent = shop.name || shop.id;
    return option;
  });
  select.replaceChildren(...options);
  select.value = tenants.some((shop) => shop.id === selectedTenant)
    ? selectedTenant
    : tenants[0]?.id || '';
}

function setupCloudConnection() {
  const form = document.getElementById('browser-cloud-form');
  const details = document.getElementById('browser-register-connect');
  if (!form || !details) return;
  const savedTenantOption = document.createElement('option');
  savedTenantOption.value = cloudConnection.tenant || 'main';
  savedTenantOption.textContent = cloudConnection.tenant === 'main' ? 'Main shop' : cloudConnection.tenant || 'Main shop';
  form.elements.tenant.replaceChildren(savedTenantOption);
  form.elements.tenant.value = savedTenantOption.value;
  details.open = !cloudConnection.token;
  if (cloudConnection.token) {
    if (cloudConnection.authType === 'account') {
      void fetch(`${cloudConnection.endpoint}/api/auth/session`, {
        headers: { Authorization: `Bearer ${cloudConnection.token}` }
      }).then(async (response) => {
        const session = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(session.error || 'Sign in again to refresh this account’s shop access.');
        const shops = Array.isArray(session.tenants) ? session.tenants : [];
        setAccountShops(shops, cloudConnection.tenant);
        if (shops.length > 1) {
          setCloudStatus(`Connected to ${cloudConnection.tenant}. This account can access ${shops.map((shop) => shop.name || shop.id).join(' and ')}. Choose the shop for this register, then click Verify and connect.`);
        } else {
          setCloudStatus(`Connected to ${cloudConnection.tenant}. Tap “Use this shop’s POS” above to replace this browser’s local POS with the shop’s records and turn on sync.`);
        }
      }).catch((error) => {
        setCloudStatus(error.message || 'Could not refresh this account’s shop access.', true);
      });
    } else {
      setCloudStatus(`Connected to ${cloudConnection.tenant}. Tap “Use this shop’s POS” above to replace this browser’s local POS with the shop’s records and turn on sync.`);
    }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    setCloudStatus('Checking shop owner access…');
    try {
      const endpoint = new URL(DEFAULT_WORKER, window.location.origin);
      let tenant = form.elements.tenant.value.trim();
      const manualToken = form.elements.token.value.trim();
      let token = manualToken;
      let authType = manualToken ? 'owner' : '';
      let accountShops = [];
      const username = form.elements.username.value.trim();
      const password = form.elements.password.value;
      if (!token && username && password) {
        const login = await fetch(`${endpoint.origin}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const loginResult = await login.json();
        if (!login.ok) throw new Error(loginResult.error || `Account sign-in failed (HTTP ${login.status}).`);
        const tenants = Array.isArray(loginResult.tenants) ? loginResult.tenants : [];
        accountShops = tenants;
        setAccountShops(tenants, tenant);
        tenant = form.elements.tenant.value;
        if (!availableAccountShops.size) {
          throw new Error('This Craft account has no linked shops. Use the private shop owner key instead.');
        }
        token = loginResult.session_token;
        authType = 'account';
        if (!token) throw new Error('Craft sign-in did not provide a secure session. Try signing in again.');
      }
      if (manualToken) tenant = form.elements.manualTenant.value.trim();
      if (!token && !username && !password) {
        token = cloudConnection.token;
        authType = cloudConnection.authType || 'owner';
      }
      if (!/^[a-z0-9-]{1,80}$/.test(tenant)) throw new Error('Enter the shop ID, for example main.');
      if (!token) throw new Error('Sign in with your Craft account or enter the private shop owner key.');
      const candidate = { endpoint: endpoint.origin, tenant, token, authType };
      const previous = cloudConnection;
      cloudConnection = candidate;
      try {
        await requestCloud(tenant, 'GET', { after: 0, limit: 1 });
      } catch (error) {
        cloudConnection = previous;
        if (authType === 'account' && accountShops.some((shop) => shop.id === tenant)) {
          throw new Error(`Sign-in worked, but this account cannot access ${accountShops.find((shop) => shop.id === tenant)?.name || tenant} for POS sync. Use that shop's private owner key, or sign in with the account that owns it.`);
        }
        throw error;
      }
      if (form.elements.remember.checked) localStorage.setItem(CONNECTION_KEY, JSON.stringify(candidate));
      else localStorage.removeItem(CONNECTION_KEY);
      installCloudBridge();
      form.elements.token.value = '';
      form.elements.password.value = '';
      details.open = false;
      setCloudStatus(`Connected to ${tenant}. Tap “Use this shop’s POS” above to load its records into this browser and enable sync.`);
      await window.ShopPOS.refresh();
      await updateSyncBanner();
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : 'Could not connect this register.', true);
    } finally {
      button.disabled = false;
    }
  });
}

function setupBrowserNavigation() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('#app a[data-route]');
    if (!link) return;
    const route = link.dataset.route;
    if (!route?.startsWith('/pos')) return;
    event.preventDefault();
    const nextHash = `#${route}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
    else void window.ShopPOS?.refresh();
  });
}

function setBrowserDataStatus(message, error = false) {
  const status = document.getElementById('browser-data-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.error = error ? 'true' : 'false';
  status.hidden = !message;
}

function setupBrowserDataActions() {
  const disconnect = document.getElementById('browser-disconnect-action');
  const reset = document.getElementById('browser-reset-action');
  disconnect?.addEventListener('click', async () => {
    try {
      const syncStatus = await window.ShopPOS.getCloudSyncStatus();
      const pending = Number(syncStatus.pending) || 0;
      const pendingWarning = pending
        ? `\n\n${pending} local change(s) are waiting to upload and will stay on this browser, but will no longer sync.`
        : '';
      if (!window.confirm(`Disconnect this browser from ${cloudConnection.tenant}? Local POS records will remain on this browser.${pendingWarning}`)) return;
      disconnect.disabled = true;
      await window.ShopPOS.disconnectCloudSync();
      localStorage.removeItem(CONNECTION_KEY);
      cloudConnection = { endpoint: DEFAULT_WORKER, tenant: '', token: '' };
      installCloudBridge();
      setBrowserDataStatus('Disconnected from the shop. POS data remains saved in this browser.');
      await updateSyncBanner();
    } catch (error) {
      setBrowserDataStatus(error instanceof Error ? error.message : 'Could not disconnect this browser.', true);
    } finally {
      disconnect.disabled = false;
    }
  });

  reset?.addEventListener('click', async () => {
    try {
      const syncStatus = await window.ShopPOS.getCloudSyncStatus();
      const pending = Number(syncStatus.pending) || 0;
      const pendingWarning = pending
        ? `\n\n${pending} unsynced change(s) will be permanently lost.`
        : '';
      const tenantWarning = cloudConnection.tenant
        ? ` Cloud data for ${cloudConnection.tenant} will NOT be deleted.`
        : '';
      if (!window.confirm(`Permanently erase all POS records stored in this browser, disconnect nearby sync, and remove this browser’s saved shop connection? Products, stock, receipts, customers, settings, and unsynced changes will be erased.${pendingWarning}${tenantWarning} Other devices are not changed.`)) return;
      reset.disabled = true;
      await window.ShopPOS.stopNearbySync();
      await window.ShopPOS.disconnectCloudSync();
      await window.ShopSQLite.clearSavedData();
      localStorage.removeItem(CONNECTION_KEY);
      window.location.reload();
    } catch (error) {
      reset.disabled = false;
      setBrowserDataStatus(error instanceof Error ? error.message : 'Could not reset browser POS data.', true);
    }
  });
}

function openDatabaseStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DATABASE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open browser storage.'));
  });
}

function readSavedDatabase(store) {
  return new Promise((resolve, reject) => {
    const request = store.transaction(DATABASE_STORE).objectStore(DATABASE_STORE).get(DATABASE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Could not read saved register data.'));
  });
}

function saveDatabase(store, bytes) {
  return new Promise((resolve, reject) => {
    const transaction = store.transaction(DATABASE_STORE, 'readwrite');
    transaction.objectStore(DATABASE_STORE).put(bytes, DATABASE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not save register data.'));
    transaction.onabort = () => reject(transaction.error || new Error('Register data save was interrupted.'));
  });
}

function clearSavedDatabase(store) {
  return new Promise((resolve, reject) => {
    const transaction = store.transaction(DATABASE_STORE, 'readwrite');
    transaction.objectStore(DATABASE_STORE).delete(DATABASE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not erase saved register data.'));
    transaction.onabort = () => reject(transaction.error || new Error('Register data reset was interrupted.'));
  });
}

async function startRegister() {
  const store = await openDatabaseStore();
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await readSavedDatabase(store);
  const db = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();
  let queue = Promise.resolve();
  let storageCleared = false;
  const enqueue = (operation) => {
    const result = queue.then(operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
  const persist = () => storageCleared ? Promise.resolve() : saveDatabase(store, db.export());
  const query = (statement, values = []) => {
    const prepared = db.prepare(statement);
    try {
      if (values.length) prepared.bind(values);
      const rows = [];
      while (prepared.step()) rows.push(prepared.getAsObject());
      return { values: rows };
    } finally {
      prepared.free();
    }
  };

  window.ShopSQLite = {
    query: (statement, values = []) => enqueue(() => query(statement, values)),
    run: (statement, values = []) => enqueue(async () => {
      db.run(statement, values);
      const changes = db.getRowsModified();
      const lastId = query('SELECT last_insert_rowid() AS id').values[0]?.id || 0;
      await persist();
      return { changes: { changes, lastId } };
    }),
    execute: (statement) => enqueue(async () => {
      db.exec(statement);
      await persist();
    }),
    executeSet: (statements, useTransaction = true) => enqueue(async () => {
      if (useTransaction) db.run('BEGIN');
      try {
        for (const item of statements) db.run(item.statement, item.values || []);
        if (useTransaction) db.run('COMMIT');
      } catch (error) {
        if (useTransaction) db.run('ROLLBACK');
        throw error;
      }
      await persist();
      return { changes: { changes: db.getRowsModified() } };
    }),
    async flush() {
      await queue;
      await persist();
    },
    clearSavedData() {
      return enqueue(async () => {
        await clearSavedDatabase(store);
        storageCleared = true;
        db.close();
      });
    }
  };
  window.ShopSQLiteReady = Promise.resolve();
  installCloudBridge();
  setupCloudConnection();
  setupBrowserNavigation();
  if (!window.location.hash) window.location.hash = '#/pos';
  window.ShopPOS = createPosApp();
  window.ShopPOSReady = window.ShopPOS.init();
  await window.ShopPOSReady;
  await window.ShopPOS.refresh();
  setupBrowserDataActions();
  await updateSyncBanner();
  window.setInterval(() => void updateSyncBanner(), 10000);
  window.addEventListener('pagehide', () => void window.ShopSQLite.flush());
}

startRegister().catch((error) => {
  console.error('Browser register could not start.', error);
  const app = document.getElementById('app');
  if (app) {
    const main = document.createElement('main');
    main.className = 'browser-register-error';
    const heading = document.createElement('h1');
    heading.textContent = 'Register could not start';
    const detail = document.createElement('p');
    detail.textContent = String(error.message || error);
    const guidance = document.createElement('p');
    guidance.textContent = 'Reload this page. If the issue continues, check that browser storage is enabled.';
    main.append(heading, detail, guidance);
    app.replaceChildren(main);
  }
});
