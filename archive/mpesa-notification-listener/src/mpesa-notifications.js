import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeMpesaNotifications = registerPlugin('MpesaNotifications');
let listenerHandle;
let fakeAlertListenerHandle;
let currentCallback;
let transactions = [];
let fakeSenderAlerts = [];
let enabled = false;
let connected = false;
let refreshTimer;
const transactionListeners = new Set();

const snapshot = (error = '') => ({
  available: Capacitor.isNativePlatform(),
  enabled,
  connected,
  transactions: [...transactions],
  fakeSenderAlerts: [...fakeSenderAlerts],
  error
});

async function refresh() {
  if (!Capacitor.isNativePlatform()) return snapshot();
  const [status, saved, alerts] = await Promise.all([
    NativeMpesaNotifications.getStatus(),
    NativeMpesaNotifications.getTransactions(),
    NativeMpesaNotifications.getFakeSenderAlerts()
  ]);
  enabled = Boolean(status.enabled);
  connected = Boolean(status.connected);
  transactions = Array.isArray(saved.transactions) ? saved.transactions : [];
  fakeSenderAlerts = Array.isArray(alerts.alerts) ? alerts.alerts : [];
  return snapshot();
}

async function refreshAndNotify() {
  try {
    currentCallback?.(await refresh());
  } catch (error) {
    console.error('Could not load saved M-Pesa notifications.', error);
    currentCallback?.(snapshot(error?.message || 'Could not load saved transactions.'));
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentCallback) void refreshAndNotify();
});

export const MpesaNotifications = {
  async start(onChange) {
    currentCallback = onChange;
    if (!Capacitor.isNativePlatform()) {
      onChange(snapshot());
      return;
    }

    if (!listenerHandle) {
      listenerHandle = await NativeMpesaNotifications.addListener('transactionReceived', transaction => {
        const index = transactions.findIndex(item => item.transactionCode === transaction.transactionCode);
        if (index >= 0) transactions[index] = transaction;
        else transactions.unshift(transaction);
        transactions = transactions.slice(0, 500);
        transactionListeners.forEach(listener => listener(transaction));
        currentCallback?.(snapshot());
      });
    }
    if (!fakeAlertListenerHandle) {
      fakeAlertListenerHandle = await NativeMpesaNotifications.addListener('fakeSenderAlert', alert => {
        const index = fakeSenderAlerts.findIndex(item =>
          item.transactionCode === alert.transactionCode && item.sender === alert.sender
        );
        if (index >= 0) fakeSenderAlerts[index] = alert;
        else fakeSenderAlerts.unshift(alert);
        fakeSenderAlerts = fakeSenderAlerts.slice(0, 200);
        currentCallback?.(snapshot());
      });
    }
    if (!refreshTimer) {
      refreshTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible' && currentCallback) void refreshAndNotify();
      }, 5000);
    }
    await refreshAndNotify();
  },

  async stop() {
    currentCallback = undefined;
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
    if (listenerHandle) {
      await listenerHandle.remove();
      listenerHandle = undefined;
    }
    if (fakeAlertListenerHandle) {
      await fakeAlertListenerHandle.remove();
      fakeAlertListenerHandle = undefined;
    }
  },

  addTransactionListener(listener) {
    if (typeof listener !== 'function') throw new TypeError('A transaction listener is required.');
    transactionListeners.add(listener);
    return () => transactionListeners.delete(listener);
  },

  async openSettings() {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Notification Access is available in the Android app.');
    }
    await NativeMpesaNotifications.openSettings();
  },

  async getOwnIdentifiers() {
    if (!Capacitor.isNativePlatform()) return { numbers: [], names: [] };
    const identifiers = await NativeMpesaNotifications.getOwnIdentifiers();
    return {
      numbers: Array.isArray(identifiers.numbers) ? identifiers.numbers : [],
      names: Array.isArray(identifiers.names) ? identifiers.names : []
    };
  },

  async setOwnIdentifiers(numbers, names) {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Your M-Pesa identifiers can only be saved in the Android app.');
    }
    await NativeMpesaNotifications.setOwnIdentifiers({
      numbers: String(numbers || ''),
      names: String(names || '')
    });
  },

  async refresh() {
    return refresh();
  }
};
