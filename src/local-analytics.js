// Aggregate shop metrics the owner's device sends to the Craft AI helper ("local_analytics").
// Pure: it only reads the arrays it is given, so it can be tested without a browser.
//
// Revenue follows src/revenue-definition.js exactly (the same rule Business Lens uses), and the
// context also carries what a service business needs (services, appointments) and what a stock
// business can mislead on (products whose stock is not tracked are not "out of stock").

import { REVENUE_DEFINITION, isPaidSale, isReversedSale, saleDiscount, saleOutstanding, saleRevenue } from './revenue-definition.js';

const DAY = 24 * 60 * 60 * 1000;
const money = value => Number(Number(value || 0).toFixed(2));

export function localTime(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A product whose stock is a number is tracked. null/undefined means "not tracked" (services, made-to-order). */
export function tracksStock(product) {
  return product && product.stock !== null && product.stock !== undefined && product.stock !== '' &&
    Number.isFinite(Number(product.stock));
}

/**
 * Appointment figures for the AI. Dating rules:
 *  - requests_last_30_days counts requests RECEIVED in the window (created_at), by their current status;
 *  - completed_value_last_30_days counts services that actually HAPPENED in the window (starts_at, up to now),
 *    so a service booked six weeks ago but done this week is included;
 *  - upcoming_confirmed, pending and deposit_refunds_due are shop-wide totals taken from the server's counts
 *    when it supplies them (the list itself is paged), else computed from the rows.
 * `meta.truncated` means more appointments exist than were loaded, so row-based figures are lower bounds.
 */
function summariseAppointments(appointments, now, meta = {}) {
  const currentStart = now - 30 * DAY;
  const serverCounts = meta && typeof meta.counts === 'object' && meta.counts ? meta.counts : null;
  const serverNumber = key => (serverCounts && Number.isFinite(Number(serverCounts[key])) ? Number(serverCounts[key]) : null);
  const counts = { requested: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0, rejected: 0 };
  let upcomingConfirmed = 0;
  let completedValue = 0;
  let depositsPaid = 0;
  let depositRefundsDue = 0;
  for (const appointment of appointments) {
    const createdAt = localTime(appointment.created_at);
    const startsAt = localTime(appointment.starts_at);
    const status = String(appointment.status || '').toLowerCase();
    if (appointment.deposit_refund_due && !appointment.deposit_refunded_at) depositRefundsDue += 1;
    if (status === 'confirmed' && startsAt !== null && startsAt >= now) upcomingConfirmed += 1;
    if (status === 'completed' && startsAt !== null && startsAt >= currentStart && startsAt <= now) {
      completedValue += Number(appointment.service_price_cents || 0) / 100;
    }
    if (createdAt === null || createdAt < currentStart) continue;
    if (status === 'pending' || status === 'confirming') counts.requested += 1;
    else if (status in counts) counts[status] += 1;
    if (String(appointment.payment_status || '').toLowerCase() === 'paid') {
      depositsPaid += Number(appointment.deposit_cents || 0) / 100;
    }
  }
  const summary = {
    source: 'live storefront',
    requests_last_30_days: counts,
    upcoming_confirmed: serverNumber('upcoming_confirmed') ?? upcomingConfirmed,
    completed_value_last_30_days: money(completedValue),
    deposits_paid_last_30_days: money(depositsPaid),
    deposit_refunds_due: serverNumber('refunds_due') ?? depositRefundsDue
  };
  const pendingTotal = serverNumber('pending');
  if (pendingTotal !== null) summary.pending_requests_now = pendingTotal;
  if (meta && meta.truncated) {
    summary.data_truncated = true;
    summary.truncated_note = 'Only the most recent appointments were loaded; the request, completed and deposit figures may be lower than the real totals.';
  }
  return summary;
}

/**
 * @param {object} input
 * @param {Array} input.sales        POS sales from ShopPOS.listSales()
 * @param {Array} input.products     POS products from ShopPOS.listProducts()
 * @param {Array} input.expenses     from ShopPOS.listExpenses()
 * @param {object} [input.settings]  ShopPOS settings (currency)
 * @param {number} [input.now]
 * @param {'services'|'products'} [input.offerType]   what the active website sells
 * @param {Array} [input.services]   bookable website products {name, price, duration_minutes}
 * @param {Array|null} [input.appointments]  appointment requests, or null when they could not be loaded
 * @param {{counts?: object, truncated?: boolean}|null} [input.appointmentMeta]  server totals and whether the list was cut short
 */
export function buildLocalAnalytics({
  sales, products, expenses, settings = {}, now = Date.now(), offerType = 'products', services = [], appointments = null, appointmentMeta = null
}) {
  const currentStart = now - 30 * DAY;
  const previousStart = now - 60 * DAY;
  const current = { paid: 0, revenue: 0, grossProfit: 0, costedLines: 0, expenses: 0, reversed: 0, reversedValue: 0, unpaid: 0, unpaidValue: 0, discounts: 0 };
  const previous = { paid: 0, revenue: 0, grossProfit: 0, costedLines: 0, expenses: 0 };
  const productUnits = new Map();
  const expenseCategories = new Map();

  for (const sale of sales) {
    const createdAt = localTime(sale.created_at);
    if (createdAt === null || createdAt < previousStart) continue;
    const inCurrentPeriod = createdAt >= currentStart;
    const bucket = inCurrentPeriod ? current : previous;
    if (isReversedSale(sale)) {
      if (inCurrentPeriod) {
        current.reversed += 1;
        current.reversedValue += Number(sale.total) || Number(sale.total_cents || 0) / 100;
      }
      continue;
    }
    if (!isPaidSale(sale)) {
      if (inCurrentPeriod) {
        current.unpaid += 1;
        current.unpaidValue += saleOutstanding(sale);
      }
      continue;
    }
    bucket.paid += 1;
    bucket.revenue += saleRevenue(sale);
    if (inCurrentPeriod) current.discounts += saleDiscount(sale);
    for (const item of Array.isArray(sale.items) ? sale.items : []) {
      const name = String(item.name || '').trim().slice(0, 120);
      const units = Number(item.quantity) || 0;
      if (units <= 0) continue;
      if (inCurrentPeriod && name) productUnits.set(name, (productUnits.get(name) || 0) + units);
      const cost = Number(item.historicalUnitCost);
      if (Number.isFinite(cost) && cost >= 0) {
        bucket.grossProfit += Number(item.unitPrice || 0) * units - cost * units;
        bucket.costedLines += 1;
      }
    }
  }

  for (const expense of expenses) {
    const createdAt = localTime(expense.date || expense.created_at || expense.createdAt);
    if (createdAt === null || createdAt < previousStart) continue;
    const amount = Number(expense.amount) || Number(expense.amount_cents || 0) / 100;
    if (createdAt >= currentStart) {
      current.expenses += amount;
      const category = String(expense.category || 'Other').trim().slice(0, 100) || 'Other';
      expenseCategories.set(category, (expenseCategories.get(category) || 0) + amount);
    } else previous.expenses += amount;
  }

  const activeProducts = products.filter(product => product.active !== false);
  const tracked = activeProducts.filter(tracksStock);
  const analytics = {
    currency: /^[A-Z]{3}$/.test(settings?.currency || '') ? settings.currency : 'KES',
    revenue_definition: REVENUE_DEFINITION,
    paid_sales_last_30_days: current.paid,
    paid_sales_previous_30_days: previous.paid,
    paid_revenue_last_30_days: money(current.revenue),
    paid_revenue_previous_30_days: money(previous.revenue),
    unpaid_sales_last_30_days: current.unpaid,
    unpaid_value_last_30_days: money(current.unpaidValue),
    reversed_sales_last_30_days: current.reversed,
    reversed_value_last_30_days: money(current.reversedValue),
    discounts_given_last_30_days: money(current.discounts),
    expenses_last_30_days: money(current.expenses),
    expenses_previous_30_days: money(previous.expenses),
    // Only products with a tracked stock number can be low or out of stock.
    low_stock_products: tracked.filter(product => Number(product.stock) > 0 &&
      Number(product.stock) <= Number(product.lowStockThreshold ?? 3)).length,
    out_of_stock_products: tracked.filter(product => Number(product.stock) <= 0).length,
    product_count: activeProducts.length,
    untracked_stock_products: activeProducts.length - tracked.length,
    inactive_product_count: products.length - activeProducts.length,
    inventory_units: tracked.reduce((total, product) => total + Math.max(0, Number(product.stock) || 0), 0),
    estimated_gross_profit_last_30_days: money(current.grossProfit),
    estimated_gross_profit_previous_30_days: money(previous.grossProfit),
    gross_profit_costed_line_items_last_30_days: current.costedLines,
    gross_profit_costed_line_items_previous_30_days: previous.costedLines,
    top_products: [...productUnits.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([name, units]) => ({ name, units })),
    inventory_products: tracked
      .map(product => ({
        name: String(product.name || '').trim().slice(0, 120),
        category: String(product.categoryName || 'Uncategorized').trim().slice(0, 100),
        stock: Math.max(0, Number(product.stock) || 0),
        price: Math.max(0, Number(product.price) || 0),
        low_stock_threshold: Math.max(0, Number(product.lowStockThreshold ?? 3) || 0)
      }))
      .filter(product => product.name)
      .sort((left, right) => left.stock - right.stock)
      .slice(0, 30),
    expense_categories_last_30_days: [...expenseCategories.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([category, amount]) => ({ category, amount: money(amount) }))
  };

  if (offerType === 'services' || services.length || (Array.isArray(appointments) && appointments.length)) {
    analytics.service_business = {
      offer_type: offerType === 'services' ? 'services' : 'products and services',
      services: services.slice(0, 30).map(service => ({
        name: String(service.name || '').trim().slice(0, 120),
        price: Math.max(0, Number(service.price) || 0),
        duration_minutes: Number(service.duration_minutes) || 60
      })).filter(service => service.name),
      stock_note: 'Services have no stock; never describe them as out of stock.',
      appointments: Array.isArray(appointments)
        ? summariseAppointments(appointments, now, appointmentMeta || {})
        : { unavailable: true, reason: 'Appointment requests could not be loaded from the live storefront.' }
    };
  }
  return analytics;
}
