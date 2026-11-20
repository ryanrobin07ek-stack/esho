// Business instances (timed sessions such as a shift or an event) and their sales totals.
import { rows, run, stmt, transaction } from './db.js';
import { INSTANCE_MODES, fromCents, nowIso } from './format.js';
import { listSales } from './sales.js';

function parseInstance(row) {
  let intervals = [];
  let checkpoints = [];
  try {
    const parsed = JSON.parse(row.intervals_json);
    if (Array.isArray(parsed)) intervals = parsed.filter((item) => item && typeof item.startedAt === 'string'
      && (item.endedAt === null || typeof item.endedAt === 'string'));
  } catch (error) { console.warn('Could not read instance intervals', error); }
  try {
    const parsed = JSON.parse(row.checkpoints_json);
    if (Array.isArray(parsed)) checkpoints = parsed.filter((item) => typeof item === 'string');
  } catch (error) { console.warn('Could not read instance checkpoints', error); }
  return { id: row.id, name: row.name, mode: row.mode, status: row.status, startedAt: row.started_at,
    scheduledEndAt: row.scheduled_end_at, endedAt: row.ended_at, intervals, checkpoints };
}

async function listInstances() {
  const now = nowIso();
  await transaction([
    stmt("UPDATE pos_instances SET status='active' WHERE status='scheduled' AND started_at<=?", [now])
  ]);
  const expired = await rows(`SELECT id,intervals_json,scheduled_end_at FROM pos_instances
    WHERE mode='set-time' AND status='active' AND scheduled_end_at IS NOT NULL AND scheduled_end_at<=?`, [now]);
  if (expired.length) {
    const statements = expired.map((instance) => {
      const intervalRows = JSON.parse(instance.intervals_json || '[]');
      const last = intervalRows[intervalRows.length - 1];
      if (last && !last.endedAt) last.endedAt = instance.scheduled_end_at;
      return stmt("UPDATE pos_instances SET status='completed',ended_at=?,intervals_json=? WHERE id=?",
        [instance.scheduled_end_at, JSON.stringify(intervalRows), instance.id]);
    });
    await transaction(statements);
  }
  return (await rows('SELECT * FROM pos_instances ORDER BY started_at DESC')).map(parseInstance);
}

async function startInstance(data) {
  const mode = INSTANCE_MODES.map(([value]) => value).includes(data.mode) ? data.mode : null;
  if (!mode) throw new Error('Choose a valid instance type.');
  let startedAt = nowIso();
  let scheduledEndAt = null;
  if (mode === 'set-time') {
    const start = data.startAt ? Date.parse(data.startAt) : Date.now();
    const end = data.endAt ? Date.parse(data.endAt) : start + Number(data.durationMinutes) * 60_000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > Date.now() + 24 * 60 * 60_000 || end <= start
      || end - start > 24 * 60 * 60_000) throw new Error('Choose a valid start and end time within a 24-hour period.');
    startedAt = new Date(start).toISOString();
    scheduledEndAt = new Date(end).toISOString();
  }
  const name = String(data.name || '').trim() || `Instance ${(await rows('SELECT COUNT(*) AS count FROM pos_instances'))[0].count + 1}`;
  const id = `instance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const status = Date.parse(startedAt) > Date.now() ? 'scheduled' : 'active';
  await transaction([
    stmt(`INSERT INTO pos_instances (id,name,mode,status,started_at,scheduled_end_at,intervals_json,checkpoints_json)
      SELECT ?,?,?,?,?,?,?, '[]' WHERE NOT EXISTS (
        SELECT 1 FROM pos_instances WHERE status IN ('scheduled','active','paused'))`,
    [id, name, mode, status, startedAt, scheduledEndAt, JSON.stringify([{ startedAt, endedAt: null }])])
  ]);
  if (!(await rows('SELECT id FROM pos_instances WHERE id=?', [id])).length) {
    throw new Error('Finish or pause the current instance before starting another.');
  }
}

async function updateInstance(id, action) {
  const row = (await rows('SELECT * FROM pos_instances WHERE id=?', [id]))[0];
  if (!row) throw new Error('This instance could not be found.');
  const instance = parseInstance(row);
  const now = nowIso();
  let { status, intervals, checkpoints, endedAt } = instance;
  if (action === 'checkpoint') {
    if (status !== 'active') throw new Error('Only an active instance can be checkpointed.');
    checkpoints = [...checkpoints, now];
  } else if (action === 'pause') {
    if (status !== 'active') throw new Error('Only an active instance can be paused.');
    intervals = intervals.map((item, index) => index === intervals.length - 1 && !item.endedAt ? { ...item, endedAt: now } : item);
    status = 'paused';
  } else if (action === 'resume') {
    if (status !== 'paused') throw new Error('Only a paused instance can be resumed.');
    status = 'active';
    intervals = [...intervals, { startedAt: now, endedAt: null }];
  } else if (action === 'stop') {
    if (status === 'completed') throw new Error('This instance is already complete.');
    intervals = intervals.map((item, index) => index === intervals.length - 1 && !item.endedAt ? { ...item, endedAt: now } : item);
    status = 'completed';
    endedAt = now;
  } else throw new Error('Unsupported instance action.');
  await run('UPDATE pos_instances SET status=?,ended_at=?,intervals_json=?,checkpoints_json=? WHERE id=?',
    [status, endedAt, JSON.stringify(intervals), JSON.stringify(checkpoints), id]);
}

function inInstance(instance, timestamp) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return false;
  return instance.intervals.some((interval) => {
    const start = Date.parse(interval.startedAt);
    const end = interval.endedAt ? Date.parse(interval.endedAt) : Date.now();
    return Number.isFinite(start) && time >= start && time <= end;
  });
}

async function instanceTotals(instance, currency) {
  const sales = await listSales();
  const expenses = await rows('SELECT currency,amount_cents,created_at FROM pos_expenses');
  const payments = await rows(`SELECT p.amount_cents,p.method,p.created_at,s.currency FROM pos_sale_payments p
    JOIN pos_sales s ON s.id=p.sale_id WHERE p.status='confirmed'`);
  const selected = currency.toUpperCase();
  const methods = {};
  const daily = {};
  let revenue = 0;
  let count = 0;
  for (const payment of payments) {
    if (payment.currency.toUpperCase() !== selected || !inInstance(instance, payment.created_at)) continue;
    const amount = fromCents(payment.amount_cents);
    revenue += amount;
    count++;
    const method = payment.method || 'Other';
    methods[method] = (methods[method] || 0) + amount;
    const date = new Date(payment.created_at);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    daily[day] = (daily[day] || 0) + amount;
  }
  let expensesTotal = 0;
  expenses.forEach((expense) => {
    if (expense.currency.toUpperCase() === selected && inInstance(instance, expense.created_at)) expensesTotal += fromCents(expense.amount_cents);
  });
  return { revenue, expenses: expensesTotal, count, methods,
    daily: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([day, amount]) => ({ day, amount })) };
}

export { listInstances, startInstance, updateInstance, instanceTotals };
