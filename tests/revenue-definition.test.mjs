import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { buildLocalAnalytics } from '../src/local-analytics.js';
import { isPaidSale, isReversedSale, saleDiscount, saleOutstanding, saleRevenue, sumRevenue } from '../src/revenue-definition.js';

const NOW = Date.parse('2026-06-30T12:00:00.000Z');
const daysAgo = days => new Date(NOW - days * 86400000).toISOString();

// POS rows as ShopPOS.listSales() returns them.
const posSale = (overrides = {}) => ({
  id: 1, receipt_number: 'R-1', subtotal: 100, discount: 0, tax: 0, total: 100, amountPaid: 100, paid: 1,
  payment_status: 'confirmed', created_at: daysAgo(2), items: [], ...overrides
});

test('revenue counts only fully paid, non-reversed sales, at their total after discounts', () => {
  assert.equal(isPaidSale(posSale()), true);
  assert.equal(isPaidSale(posSale({ paid: 0, payment_status: 'pending', amountPaid: 0 })), false, 'credit sales are not revenue yet');
  assert.equal(isPaidSale(posSale({ paid: 1, status: 'refunded' })), false);
  assert.equal(isPaidSale(posSale({ paid: 1, status: 'voided' })), false);
  assert.equal(isReversedSale({ payment_status: 'failed' }), true);
  // Online orders have no paid flag: their payment status decides, like the Worker's payment_status = 'paid'.
  assert.equal(isPaidSale({ payment_status: 'paid', total: 50 }), true);
  assert.equal(isPaidSale({ payment_status: 'pending', total: 50 }), false);
  assert.equal(isPaidSale({ payment_status: 'refunded', status: 'paid', total: 50 }), false, 'a refund removes the order from revenue');
  // Total is after discount and includes tax; the discount is NOT subtracted a second time.
  const discounted = posSale({ subtotal: 200, discount: 50, tax: 24, total: 174 });
  assert.equal(saleRevenue(discounted), 174);
  assert.equal(saleDiscount(discounted), 50);
  assert.equal(saleRevenue(posSale({ paid: 0, payment_status: 'pending' })), 0);
  assert.equal(saleOutstanding(posSale({ paid: 0, payment_status: 'pending', total: 80, amountPaid: 30 })), 50);
  assert.equal(saleOutstanding(posSale({ status: 'voided', paid: 0, total: 80 })), 0);
  assert.equal(saleRevenue({ paid: 1, total_cents: 2550 }), 25.5, 'cents-only rows are converted');
  assert.equal(sumRevenue([posSale(), posSale({ paid: 0 }), { payment_status: 'paid', total: 40 }]), 140);
});

test('the AI context reports revenue by the shared definition, with unpaid, refunded and discounted sales broken out', () => {
  const analytics = buildLocalAnalytics({
    now: NOW,
    settings: { currency: 'KES' },
    sales: [
      posSale({ id: 1, total: 174, subtotal: 200, discount: 50, tax: 24, items: [{ name: 'Soap', quantity: 2, unitPrice: 100, historicalUnitCost: 40 }] }),
      posSale({ id: 2, paid: 0, payment_status: 'pending', total: 80, amountPaid: 30 }),
      posSale({ id: 3, status: 'refunded', total: 60 }),
      posSale({ id: 4, total: 40, created_at: daysAgo(40) }),
      posSale({ id: 5, total: 999, created_at: daysAgo(90) })
    ],
    products: [], expenses: []
  });
  assert.equal(analytics.paid_revenue_last_30_days, 174);
  assert.equal(analytics.paid_sales_last_30_days, 1);
  assert.equal(analytics.paid_revenue_previous_30_days, 40);
  assert.equal(analytics.unpaid_sales_last_30_days, 1);
  assert.equal(analytics.unpaid_value_last_30_days, 50, 'only what is still owed');
  assert.equal(analytics.reversed_sales_last_30_days, 1);
  assert.equal(analytics.reversed_value_last_30_days, 60);
  assert.equal(analytics.discounts_given_last_30_days, 50);
  assert.equal(analytics.estimated_gross_profit_last_30_days, 120);
  assert.match(analytics.revenue_definition, /fully paid/);
  assert.match(analytics.revenue_definition, /not refunded, voided, cancelled or failed/);
});

test('products without tracked stock are never reported as out of stock', () => {
  const analytics = buildLocalAnalytics({
    now: NOW, sales: [], expenses: [],
    products: [
      { name: 'Haircut', price: 500, stock: null, categoryName: 'Services', active: true },
      { name: 'Shampoo', price: 300, stock: 0, categoryName: 'Retail', active: true, lowStockThreshold: 3 },
      { name: 'Gel', price: 200, stock: 2, categoryName: 'Retail', active: true, lowStockThreshold: 3 },
      { name: 'Old item', price: 1, stock: 0, active: false }
    ]
  });
  assert.equal(analytics.out_of_stock_products, 1, 'only the tracked product at zero');
  assert.equal(analytics.low_stock_products, 1);
  assert.equal(analytics.untracked_stock_products, 1);
  assert.equal(analytics.product_count, 3);
  assert.equal(analytics.inventory_units, 2);
  assert.deepEqual(analytics.inventory_products.map(product => product.name), ['Shampoo', 'Gel'], 'services never appear in the stock list');
  assert.equal(analytics.service_business, undefined, 'a plain product shop has no service section');
});

test('a service shop gets its services and appointment activity in the AI context', () => {
  const analytics = buildLocalAnalytics({
    now: NOW, sales: [], expenses: [], products: [{ name: 'Haircut', price: 500, stock: null, active: true }],
    offerType: 'services',
    services: [{ name: 'Haircut', price: 500, duration_minutes: 45 }, { name: '', price: 1 }],
    appointments: [
      { status: 'pending', created_at: daysAgo(1), starts_at: daysAgo(-3), service_price_cents: 50000, deposit_cents: 10000, payment_status: 'not_required' },
      { status: 'confirmed', created_at: daysAgo(3), starts_at: daysAgo(-2), service_price_cents: 50000, deposit_cents: 10000, payment_status: 'paid' },
      { status: 'completed', created_at: daysAgo(5), starts_at: daysAgo(4), service_price_cents: 80000, deposit_cents: 20000, payment_status: 'paid' },
      { status: 'cancelled', created_at: daysAgo(6), starts_at: daysAgo(5), service_price_cents: 50000, deposit_cents: 10000, payment_status: 'paid', deposit_refund_due: 1 },
      { status: 'no_show', created_at: daysAgo(8), starts_at: daysAgo(7), service_price_cents: 50000, deposit_cents: 0, payment_status: 'not_required' },
      { status: 'completed', created_at: daysAgo(70), starts_at: daysAgo(69), service_price_cents: 99900, deposit_cents: 0, payment_status: 'not_required' }
    ]
  });
  const service = analytics.service_business;
  assert.equal(service.offer_type, 'services');
  assert.deepEqual(service.services, [{ name: 'Haircut', price: 500, duration_minutes: 45 }]);
  assert.match(service.stock_note, /no stock/);
  assert.deepEqual(service.appointments.requests_last_30_days,
    { requested: 1, confirmed: 1, completed: 1, cancelled: 1, no_show: 1, rejected: 0 });
  assert.equal(service.appointments.upcoming_confirmed, 1);
  assert.equal(service.appointments.completed_value_last_30_days, 800, 'old appointments fall outside the 30 days');
  assert.equal(service.appointments.deposits_paid_last_30_days, 400);
  assert.equal(service.appointments.deposit_refunds_due, 1);
  assert.equal(analytics.paid_revenue_last_30_days, 0, 'appointments are reported beside revenue, never inside it');
  assert.match(analytics.revenue_definition, /Appointments are not sales/);

  const offline = buildLocalAnalytics({ now: NOW, sales: [], expenses: [], products: [], offerType: 'services', appointments: null });
  assert.equal(offline.service_business.appointments.unavailable, true, 'an unreachable storefront is stated, not hidden');
});

test('Business Lens and the AI context report the same revenue for the same sales', async () => {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  globalThis.window = {
    AppUtils: { escapeHTML: value => String(value) },
    AppController: { getActiveTenant: () => ({ id: 'shop' }), formatMainShopMoney: (value, currency = 'KES') => `${currency} ${Number(value).toFixed(2)}` }
  };
  try {
    await import('../src/business-lens.js?revenue-parity');
    const recent = new Date(Date.now() - 2 * 86400000).toISOString();
    const rawSales = [
      posSale({ id: 1, receipt_number: 'R-1', total: 174, subtotal: 200, discount: 50, tax: 24 }),
      posSale({ id: 2, receipt_number: 'R-2', paid: 0, payment_status: 'pending', total: 80, amountPaid: 30 }),
      posSale({ id: 3, receipt_number: 'R-3', status: 'refunded', total: 60, paid: 1 }),
      posSale({ id: 4, receipt_number: 'R-4', total: 26 })
    ];
    const ai = buildLocalAnalytics({ now: Date.now(), sales: rawSales.map(sale => ({ ...sale, created_at: recent })), products: [], expenses: [] });

    // The same sales, shaped as getMainShopSnapshot() shapes them for Business Lens.
    const lensSales = rawSales.map(sale => {
      const refunded = ['refunded', 'voided'].includes(String(sale.status || '').toLowerCase());
      return {
        channel: 'POS', id: String(sale.id), reference: sale.receipt_number, date: recent, currency: 'KES',
        status: refunded ? sale.status : sale.payment_status, total: sale.total,
        collected: refunded ? 0 : Math.max(0, Number(sale.amountPaid) || (sale.paid ? sale.total : 0)),
        subtotal: sale.subtotal, discount: sale.discount, tax: sale.tax, paymentMethod: 'cash', lineItems: [], itemCount: 0
      };
    });
    const html = globalThis.window.BusinessLens.render({
      currency: 'KES', categories: [], products: [], sales: lensSales, expenses: [], instances: []
    }, '/account/main-shop', { visits: [], events: [], newsletter: [], points: [], settings: { currency: 'KES', taxRate: 0 } });
    const lensRevenue = Number(/Revenue<\/span><strong>KES\s*([\d.,]+)<\/strong>/.exec(html)?.[1]?.replace(/,/g, ''));
    const lensPaidOrders = Number(/Paid orders<\/span><strong>(\d+)<\/strong>/.exec(html)?.[1]);
    assert.equal(ai.paid_revenue_last_30_days, 200, 'AI: 174 + 26; the credit sale and the refund are excluded');
    assert.equal(lensRevenue, ai.paid_revenue_last_30_days, 'Business Lens shows the number the AI quotes.');
    assert.equal(lensPaidOrders, ai.paid_sales_last_30_days);
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalStorage;
  }
});

test('the Craft AI helper sends the shared analytics, including services, with each question', async () => {
  const assistant = await readFile(new URL('../src/craft-ai.js', import.meta.url), 'utf8');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', url: 'https://app.example.test/' });
  try {
    dom.window.CraftAiScreenDirectory = [];
    dom.window.CraftBuildLocalAnalytics = buildLocalAnalytics;
    dom.window.eval(assistant
      .replace('import { CRAFT_AI_SCREEN_DIRECTORY } from "./craft-ai-screens.js";', 'const CRAFT_AI_SCREEN_DIRECTORY = window.CraftAiScreenDirectory;')
      .replace('import { buildLocalAnalytics } from "./local-analytics.js";', 'const buildLocalAnalytics = window.CraftBuildLocalAnalytics;'));
    dom.window.ShopPOS = {
      listSales: async () => [posSale({ created_at: new Date(Date.now() - 86400000).toISOString() })],
      listProducts: async () => [{ name: 'Haircut', price: 500, stock: null, active: true }],
      listExpenses: async () => [],
      getSettings: async () => ({ currency: 'KES' })
    };
    let appointmentCalls = 0;
    dom.window.EshopInventoryBridge = {
      listServiceAppointments: async tenant => {
        appointmentCalls += 1;
        assert.equal(tenant, 'salon');
        return { appointments: [{ status: 'pending', created_at: new Date().toISOString(), starts_at: new Date(Date.now() + 86400000).toISOString() }] };
      }
    };
    const context = { path: '/account/main-shop', tenantId: 'salon', offerType: 'services', listServices: () => [{ name: 'Haircut', price: 500, duration_minutes: 45 }] };
    const analytics = await dom.window.CraftAI.readLocalAnalytics('/account/main-shop', context);
    assert.equal(analytics.paid_revenue_last_30_days, 100);
    assert.equal(analytics.out_of_stock_products, 0, 'the haircut is not out of stock');
    assert.equal(analytics.service_business.appointments.requests_last_30_days.requested, 1);
    assert.equal(appointmentCalls, 1);
    assert.ok(await dom.window.CraftAI.readLocalAnalytics('/', context), 'the home screen gets the same context');
    assert.equal(await dom.window.CraftAI.readLocalAnalytics('/account/profile', { ...context, path: '/account/profile' }) !== null, true);

    dom.window.EshopInventoryBridge.listServiceAppointments = async () => { throw new Error('offline'); };
    const offline = await dom.window.CraftAI.readLocalAnalytics('/account/main-shop', context);
    assert.equal(offline.service_business.appointments.unavailable, true, 'a failed appointment load never blocks the answer');
    assert.equal(await dom.window.CraftAI.readLocalAnalytics('/categories', context), null);
  } finally {
    dom.window.close();
  }
});

test('appointment figures use the date the service happened and the server totals, and admit truncation', () => {
  const appointments = [
    // Booked 42 days ago, performed 3 days ago: counts as completed value this period, not as a new request.
    { status: 'completed', created_at: daysAgo(42), starts_at: daysAgo(3), service_price_cents: 120000, deposit_cents: 0, payment_status: 'not_required' },
    // Booked recently for a time later today.
    { status: 'completed', created_at: daysAgo(1), starts_at: daysAgo(0.1), service_price_cents: 30000, deposit_cents: 0, payment_status: 'not_required' },
    // Performed 40 days ago: outside the window whatever its booking date.
    { status: 'completed', created_at: daysAgo(41), starts_at: daysAgo(40), service_price_cents: 70000, deposit_cents: 0, payment_status: 'not_required' }
  ];
  const analytics = buildLocalAnalytics({
    now: NOW, sales: [], expenses: [], products: [], offerType: 'services', appointments,
    appointmentMeta: { counts: { pending: 4, upcoming_confirmed: 17, refunds_due: 2 }, truncated: true }
  });
  const summary = analytics.service_business.appointments;
  assert.equal(summary.completed_value_last_30_days, 1500);
  assert.equal(summary.requests_last_30_days.completed, 1, 'requests are counted by when they were received');
  assert.equal(summary.upcoming_confirmed, 17, 'shop-wide server totals win over the loaded page');
  assert.equal(summary.deposit_refunds_due, 2);
  assert.equal(summary.pending_requests_now, 4);
  assert.equal(summary.data_truncated, true);
  assert.match(summary.truncated_note, /lower than the real totals/);

  const complete = buildLocalAnalytics({ now: NOW, sales: [], expenses: [], products: [], offerType: 'services', appointments, appointmentMeta: { truncated: false } });
  assert.equal(complete.service_business.appointments.data_truncated, undefined);
});

test('the AI helper pages through appointments from the last 30 days and reports a cut-off list', async () => {
  const assistant = await readFile(new URL('../src/craft-ai.js', import.meta.url), 'utf8');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', url: 'https://app.example.test/' });
  try {
    dom.window.CraftAiScreenDirectory = [];
    dom.window.CraftBuildLocalAnalytics = buildLocalAnalytics;
    dom.window.eval(assistant
      .replace('import { CRAFT_AI_SCREEN_DIRECTORY } from "./craft-ai-screens.js";', 'const CRAFT_AI_SCREEN_DIRECTORY = window.CraftAiScreenDirectory;')
      .replace('import { buildLocalAnalytics } from "./local-analytics.js";', 'const buildLocalAnalytics = window.CraftBuildLocalAnalytics;'));
    dom.window.ShopPOS = { listSales: async () => [], listProducts: async () => [], listExpenses: async () => [], getSettings: async () => ({}) };
    const calls = [];
    const row = index => ({ status: 'completed', created_at: new Date().toISOString(), starts_at: new Date(Date.now() - 3600000 - index).toISOString(), service_price_cents: 10000 });
    let alwaysMore = true;
    dom.window.EshopInventoryBridge = {
      listServiceAppointments: async (tenant, filters) => {
        calls.push({ tenant, ...filters });
        const page = filters.offset / filters.limit;
        const lastPage = alwaysMore ? Infinity : 1;
        return {
          appointments: Array.from({ length: 3 }, (_, index) => row(page * 3 + index)),
          counts: { pending: 2, upcoming_confirmed: 9, refunds_due: 1 },
          has_more: page < lastPage
        };
      }
    };
    const context = { path: '/account/main-shop', tenantId: 'salon', offerType: 'services', listServices: () => [] };

    const cutOff = await dom.window.CraftAI.readLocalAnalytics('/account/main-shop', context);
    assert.equal(calls.length, 5, 'stops after the page cap');
    assert.ok(Math.abs(Date.parse(calls[0].from) - (Date.now() - 30 * 86400000)) < 60000, 'asks for the last 30 days onwards');
    assert.equal(calls[0].limit, 200);
    assert.deepEqual(calls.map(call => call.offset), [0, 200, 400, 600, 800]);
    assert.equal(cutOff.service_business.appointments.data_truncated, true);
    assert.equal(cutOff.service_business.appointments.upcoming_confirmed, 9);
    assert.equal(cutOff.service_business.appointments.completed_value_last_30_days, 1500);

    calls.length = 0;
    alwaysMore = false;
    const complete = await dom.window.CraftAI.readLocalAnalytics('/account/main-shop', context);
    assert.equal(calls.length, 2, 'follows has_more until the last page');
    assert.equal(complete.service_business.appointments.data_truncated, undefined);
    assert.equal(complete.service_business.appointments.completed_value_last_30_days, 600);
  } finally {
    dom.window.close();
  }
});

test('the Craft AI services list follows the shop type, not the product hold flag', async () => {
  const app = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const start = app.indexOf('        listServices: () => (SQLiteEngine.getStore().offer_type === "services"');
  assert.ok(start > 0, 'listServices should be defined from the shop offer type.');
  const end = app.indexOf('\n      });', start);
  const source = app.slice(start, end).trim().replace(/^listServices: /, '');
  const build = new Function('SQLiteEngine', `return (${source});`);
  const products = [
    { name: 'Haircut', price: 500, duration_minutes: 45, status: 'published', booking_enabled: 0 },
    { name: 'Old service', price: 100, status: 'archived' },
    { name: 'Hidden', price: 100, active: 0 },
    { name: 'Hold shoe', price: 900, status: 'published', booking_enabled: 1 }
  ];
  const engine = offerType => ({
    getStore: () => ({ offer_type: offerType }),
    select: (_table, predicate) => products.filter(predicate)
  });
  assert.deepEqual(build(engine('services'))().map(item => item.name), ['Haircut', 'Hold shoe'],
    'every live product in a services shop is a service, hold-enabled or not');
  assert.deepEqual(build(engine('products'))(), [], 'hold-enabled physical products are not services');
});
