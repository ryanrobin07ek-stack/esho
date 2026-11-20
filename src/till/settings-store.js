// Reads and saves till settings (tax, currency, goals, insight preferences) in pos_settings.
import { rows, run, stmt, transaction } from './db.js';
import { toCents } from './format.js';

async function getSettings() {
  const settings = Object.fromEntries((await rows('SELECT key, value FROM pos_settings')).map((row) => [row.key, row.value]));
  let insightPreferences = { dismissed: [], snoozed: {} };
  if (settings.insight_preferences) {
    try {
      const saved = JSON.parse(settings.insight_preferences);
      if (!saved || typeof saved !== 'object' || !Array.isArray(saved.dismissed)
        || !saved.snoozed || typeof saved.snoozed !== 'object' || Array.isArray(saved.snoozed)) {
        throw new Error('Saved POS insight preferences have an invalid format.');
      }
      insightPreferences = {
        dismissed: saved.dismissed.filter((item) => typeof item === 'string'),
        snoozed: Object.fromEntries(Object.entries(saved.snoozed)
          .filter(([key, value]) => typeof key === 'string' && Number.isFinite(value)))
      };
    } catch (error) {
      throw new Error(`Could not read saved POS insight preferences: ${error instanceof Error ? error.message : 'invalid data'}`);
    }
  }
  const monthlyRevenueGoal = settings.monthly_revenue_goal_cents == null
    ? null : Number(settings.monthly_revenue_goal_cents);
  if (monthlyRevenueGoal !== null && (!Number.isSafeInteger(monthlyRevenueGoal) || monthlyRevenueGoal <= 0)) {
    throw new Error('The saved monthly revenue goal is invalid. Update it in Overview insights.');
  }
  const currency = /^[A-Z]{3}$/.test(settings.currency || '') ? settings.currency : 'KES';
  const monthlyRevenueGoalCurrency = settings.monthly_revenue_goal_currency
    || (monthlyRevenueGoal === null ? null : currency);
  if (monthlyRevenueGoalCurrency !== null && !/^[A-Z]{3}$/.test(monthlyRevenueGoalCurrency)) {
    throw new Error('The saved monthly revenue goal currency is invalid. Update it in Overview insights.');
  }
  return {
    taxRate: Number.isFinite(Number(settings.tax_rate)) ? Number(settings.tax_rate) : 0,
    currency,
    monthlyRevenueGoal,
    monthlyRevenueGoalCurrency,
    insightPreferences,
    cloudSyncTenantId: String(settings.cloud_sync_tenant_id || ''),
    cloudSyncEnabled: settings.cloud_sync_enabled === '1',
    cloudSyncError: String(settings.cloud_sync_error || '')
  };
}

async function saveMonthlyRevenueGoal(amount, currency) {
  const cents = toCents(amount);
  const code = String(currency || '').toUpperCase();
  if (!Number.isSafeInteger(cents) || cents <= 0 || !/^[A-Z]{3}$/.test(code)) {
    throw new Error('Enter a positive monthly revenue goal in the store currency.');
  }
  await transaction([
    stmt('INSERT OR REPLACE INTO pos_settings (key, value) VALUES (?, ?)', ['monthly_revenue_goal_cents', String(cents)]),
    stmt('INSERT OR REPLACE INTO pos_settings (key, value) VALUES (?, ?)', ['monthly_revenue_goal_currency', code])
  ]);
}

async function saveInsightPreferences(preferences) {
  if (!preferences || !Array.isArray(preferences.dismissed) || !preferences.snoozed
    || typeof preferences.snoozed !== 'object' || Array.isArray(preferences.snoozed)) {
    throw new Error('Insight preferences could not be saved because their format is invalid.');
  }
  await run('INSERT OR REPLACE INTO pos_settings (key, value) VALUES (?, ?)',
    ['insight_preferences', JSON.stringify(preferences)]);
}

async function saveSettings(taxRate, currency) {
  const rate = Number(taxRate);
  const code = String(currency || '').trim().toUpperCase();
  if (!Number.isFinite(rate) || rate < 0 || rate > 100 || !/^[A-Z]{3}$/.test(code)) {
    throw new Error('Tax must be from 0% to 100%, and currency must be a 3-letter code.');
  }

  await transaction([
    stmt('INSERT OR REPLACE INTO pos_settings (key, value) VALUES (?, ?)', ['tax_rate', String(rate)]),
    stmt('INSERT OR REPLACE INTO pos_settings (key, value) VALUES (?, ?)', ['currency', code])
  ]);
}

export { getSettings, saveMonthlyRevenueGoal, saveInsightPreferences, saveSettings };
