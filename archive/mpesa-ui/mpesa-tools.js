const STORAGE_KEY = 'CRAFT_MPESA_TOOLS_V1';
const EMPTY_STATE = Object.freeze({
  annotations: {},
  budgets: [],
  goals: [],
  debts: [],
  merchantNames: {},
  reconciliation: {}
});
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Airtime', 'Bills', 'Rent', 'School', 'Business', 'Personal', 'Other'];
const OUTGOING = new Set(['sent', 'paid', 'withdrawn']);

function readState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...EMPTY_STATE };
  try {
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_STATE,
      ...parsed,
      annotations: parsed.annotations && typeof parsed.annotations === 'object' ? parsed.annotations : {},
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
      merchantNames: parsed.merchantNames && typeof parsed.merchantNames === 'object' ? parsed.merchantNames : {},
      reconciliation: parsed.reconciliation && typeof parsed.reconciliation === 'object' ? parsed.reconciliation : {}
    };
  } catch (error) {
    console.error('Could not read locally saved M-Pesa tools data.', error);
    return { ...EMPTY_STATE, storageError: 'Saved M-Pesa tool data could not be read. Clear app storage only if you accept losing these local records.' };
  }
}

function writeState(state) {
  if (state.storageError) throw new Error(state.storageError);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function amountOf(transaction) {
  const amount = Number(transaction.amount);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function timestampOf(transaction) {
  const raw = transaction.timestamp ?? transaction.occurredAtMs ?? transaction.created_at;
  const timestamp = raw == null ? NaN : new Date(raw).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function transactionName(transaction, state) {
  const name = String(transaction.counterparty || transaction.name || transaction.institutionName || 'Unknown').trim();
  return state.merchantNames[name.toLowerCase()] || name;
}

function referenceOf(transaction) {
  return String(transaction.transactionCode || '').trim().toUpperCase();
}

function displayAmount(value) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(value);
}

function periodStart(period) {
  const now = new Date();
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (period === 'week') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return 0;
}

function annotationForm(transaction, state) {
  const reference = referenceOf(transaction);
  if (!reference) return '';
  const annotation = state.annotations[reference] || {};
  return `<details class="mpesa-tool-annotation"><summary>Note, tag or category</summary>
    <form data-mpesa-tool-form="annotation" data-reference="${escapeHtml(reference)}">
      <label>Note <input name="note" maxlength="240" value="${escapeHtml(annotation.note || '')}" placeholder="Optional note"></label>
      <label>Tag <input name="tag" maxlength="40" value="${escapeHtml(annotation.tag || '')}" placeholder="e.g. rent, business"></label>
      <label>Category <select name="category">${['', ...EXPENSE_CATEGORIES].map(category => `<option value="${escapeHtml(category)}" ${annotation.category === category ? 'selected' : ''}>${escapeHtml(category || 'Uncategorized')}</option>`).join('')}</select></label>
      <label>Use <select name="purpose"><option value="">Unclassified</option><option value="business" ${annotation.purpose === 'business' ? 'selected' : ''}>Business</option><option value="personal" ${annotation.purpose === 'personal' ? 'selected' : ''}>Personal</option></select></label>
      <button type="submit">Save details</button><span data-mpesa-tool-status role="status"></span>
    </form></details>`;
}

function transactionRows(transactions, state, { annotate = false, reconciled = false } = {}) {
  if (!transactions.length) return '<p class="mpesa-recent-empty">No matching saved transactions yet.</p>';
  return `<div class="mpesa-transaction-list">${transactions.map(transaction => {
    const reference = referenceOf(transaction);
    const annotation = state.annotations[reference] || {};
    const name = escapeHtml(transactionName(transaction, state));
    const direction = escapeHtml(transaction.direction || 'unknown');
    const code = escapeHtml(reference || 'No reference');
    const time = timestampOf(transaction) ? escapeHtml(new Date(timestampOf(transaction)).toLocaleString()) : 'Time unavailable';
    const amount = escapeHtml(displayAmount(amountOf(transaction)));
    const channel = escapeHtml(transaction.channel || 'other');
    const status = reconciled
      ? `<label class="mpesa-tool-inline">Match/order note <input data-mpesa-reconcile="${escapeHtml(reference)}" value="${escapeHtml(state.reconciliation[reference] || '')}" maxlength="100" placeholder="Invoice or order"></label>`
      : '';
    return `<article class="mpesa-transaction-row">
      <strong class="mpesa-transaction-name">${name}</strong><span class="mpesa-transaction-amount">${amount}</span>
      <time class="mpesa-transaction-time">${direction} · ${channel} · ${time} · ${code}</time>
      ${annotation.note ? `<span class="mpesa-tool-note">${escapeHtml(annotation.note)}${annotation.tag ? ` · #${escapeHtml(annotation.tag)}` : ''}${annotation.category ? ` · ${escapeHtml(annotation.category)}` : ''}</span>` : ''}
      ${status}${annotate ? annotationForm(transaction, state) : ''}
    </article>`;
  }).join('')}</div>`;
}

function panel(title, content, description = '') {
  return `<section class="mpesa-tool-panel"><h3>${escapeHtml(title)}</h3>${description ? `<p>${escapeHtml(description)}</p>` : ''}${content}</section>`;
}

function formField(label, name, type = 'text', attrs = '') {
  return `<label>${escapeHtml(label)} <input name="${escapeHtml(name)}" type="${type}" ${attrs}></label>`;
}

function renderList(title, rows, empty) {
  if (!rows.length) return `<p class="mpesa-recent-empty">${escapeHtml(empty)}</p>`;
  return `<div class="mpesa-tool-records">${rows.join('')}</div>`;
}

function grouped(transactions, state, keyFor) {
  const groups = new Map();
  for (const transaction of transactions) {
    const key = keyFor(transaction) || 'Other';
    const current = groups.get(key) || { name: key, count: 0, incoming: 0, outgoing: 0, last: 0 };
    current.count += 1;
    if (transaction.direction === 'received') current.incoming += amountOf(transaction);
    if (OUTGOING.has(transaction.direction)) current.outgoing += amountOf(transaction);
    current.last = Math.max(current.last, timestampOf(transaction));
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.incoming + b.outgoing - a.incoming - a.outgoing)
    .map(item => `<article class="mpesa-tool-record"><strong>${escapeHtml(item.name)}</strong><span>${item.count} tx · In ${escapeHtml(displayAmount(item.incoming))} · Out ${escapeHtml(displayAmount(item.outgoing))}</span><small>Last activity: ${item.last ? escapeHtml(new Date(item.last).toLocaleDateString()) : 'Unknown'}</small></article>`);
}

function renderBudgetTool(state, transactions) {
  const rows = state.budgets.map(budget => {
    const now = new Date();
    const start = budget.period === 'Week'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime()
      : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const spent = transactions.filter(tx => OUTGOING.has(tx.direction) &&
      timestampOf(tx) >= start &&
      String(state.annotations[referenceOf(tx)]?.category || tx.channel || 'Other').toLowerCase() === budget.category.toLowerCase())
      .reduce((sum, tx) => sum + amountOf(tx), 0);
    const percent = budget.amount > 0 ? Math.min(100, Math.round(spent / budget.amount * 100)) : 0;
    return `<article class="mpesa-tool-record"><strong>${escapeHtml(budget.category)} · ${escapeHtml(budget.period)}</strong><span>${escapeHtml(displayAmount(spent))} of ${escapeHtml(displayAmount(budget.amount))} (${percent}%)</span><progress max="100" value="${percent}"></progress><button type="button" data-mpesa-tool-remove="budgets" data-id="${escapeHtml(budget.id)}">Remove</button></article>`;
  });
  return panel('Set a spending budget', `<form data-mpesa-tool-form="budget"><label>Category <select name="category" required>${EXPENSE_CATEGORIES.map(value => `<option>${value}</option>`).join('')}</select></label>${formField('Limit (KES)', 'amount', 'number', 'min="1" step="0.01" required')}<label>Period <select name="period"><option>Month</option><option>Week</option></select></label><button type="submit">Save budget</button><span data-mpesa-tool-status role="status"></span></form>`) + panel('Your budgets', renderList('budgets', rows, 'No budgets set yet.'));
}

function renderGoalTool(state) {
  const rows = state.goals.map(goal => {
    const percent = goal.target > 0 ? Math.min(100, Math.round(goal.saved / goal.target * 100)) : 0;
    return `<article class="mpesa-tool-record"><strong>${escapeHtml(goal.name)}</strong><span>${escapeHtml(displayAmount(goal.saved))} saved of ${escapeHtml(displayAmount(goal.target))} (${percent}%)</span><progress max="100" value="${percent}"></progress><form data-mpesa-tool-form="goal-contribution" data-id="${escapeHtml(goal.id)}">${formField('Add contribution (KES)', 'amount', 'number', 'min="0.01" step="0.01" required')}<button type="submit">Add</button></form><button type="button" data-mpesa-tool-remove="goals" data-id="${escapeHtml(goal.id)}">Remove goal</button></article>`;
  });
  return panel('Create a savings goal', `<form data-mpesa-tool-form="goal">${formField('Goal name', 'name', 'text', 'maxlength="80" required')}${formField('Target (KES)', 'target', 'number', 'min="1" step="0.01" required')}<button type="submit">Save goal</button><span data-mpesa-tool-status role="status"></span></form>`) + panel('Your goals', renderList('goals', rows, 'No savings goals yet. Contributions are entered manually.'));
}

function renderDebtTool(state) {
  const rows = state.debts.map(debt => `<article class="mpesa-tool-record"><strong>${escapeHtml(debt.name)} · ${escapeHtml(debt.type === 'owed' ? 'Owed to you' : 'You owe')}</strong><span>${escapeHtml(displayAmount(debt.amount))}${debt.note ? ` · ${escapeHtml(debt.note)}` : ''}</span><button type="button" data-mpesa-tool-remove="debts" data-id="${escapeHtml(debt.id)}">Remove</button></article>`);
  return panel('Record a debt', `<form data-mpesa-tool-form="debt">${formField('Person', 'name', 'text', 'maxlength="80" required')}${formField('Amount (KES)', 'amount', 'number', 'min="0.01" step="0.01" required')}<label>Type <select name="type"><option value="owed">Owed to you</option><option value="you-owe">You owe</option></select></label>${formField('Note', 'note', 'text', 'maxlength="120"')}<button type="submit">Save debt</button><span data-mpesa-tool-status role="status"></span></form>`) + panel('Tracked debts', renderList('debts', rows, 'No debts recorded.'));
}

function featureRows(id, transactions, state) {
  const nonInternal = transactions.filter(tx => tx.isOwnTransfer !== true);
  const outgoing = nonInternal.filter(tx => OUTGOING.has(tx.direction));
  const incoming = nonInternal.filter(tx => tx.direction === 'received');
  switch (id) {
    case 'balance-flow': {
      const start = periodStart(state.period);
      const periodTransactions = nonInternal.filter(tx => timestampOf(tx) >= start);
      const periodIncoming = periodTransactions.filter(tx => tx.direction === 'received');
      const periodOutgoing = periodTransactions.filter(tx => OUTGOING.has(tx.direction));
      const totalIn = periodIncoming.reduce((sum, tx) => sum + amountOf(tx), 0);
      const totalOut = periodOutgoing.reduce((sum, tx) => sum + amountOf(tx), 0);
      return panel('Money movement', `<form data-mpesa-tool-period><label>Period <select name="period">${[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All saved']].map(([value, label]) => `<option value="${value}" ${state.period === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button type="submit">Apply</button></form><p>Received: <strong>${escapeHtml(displayAmount(totalIn))}</strong></p><p>Spent: <strong>${escapeHtml(displayAmount(totalOut))}</strong></p><p>Net: <strong>${escapeHtml(displayAmount(totalIn - totalOut))}</strong></p><p>Based on ${periodTransactions.length} saved transaction records; not a live account balance.</p>`) + panel('Saved activity', transactionRows(periodTransactions, state));
    }
    case 'spending':
    case 'trends':
      return panel(id === 'spending' ? 'Spending by category' : 'Activity by day', renderList(id, grouped(outgoing, state, tx => id === 'spending' ? state.annotations[referenceOf(tx)]?.category || tx.channel : timestampOf(tx) ? new Date(timestampOf(tx)).toLocaleDateString() : 'Unknown date'), 'No outgoing transactions to summarize.'));
    case 'top-people':
    case 'contacts':
    case 'customers':
      return panel(id === 'top-people' ? 'Top people and merchants' : id === 'customers' ? 'Customer payment history' : 'Contacts', renderList(id, grouped(nonInternal, state, tx => transactionName(tx, state)), 'No counterparties found in saved M-Pesa activity.'));
    case 'all':
    case 'notes':
      return panel(id === 'all' ? 'All saved transactions' : 'Notes, tags and categories', transactionRows(nonInternal, state, { annotate: true }));
    case 'search':
      return panel('Search saved transactions', `<form data-mpesa-tool-search>${formField('Search name, amount, code or note', 'q', 'search', 'value="' + escapeHtml(state.query || '') + '"')}<label>Direction <select name="direction"><option value="">All directions</option>${['received', 'sent', 'paid', 'withdrawn'].map(value => `<option value="${value}" ${state.direction === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Channel <select name="channel"><option value="">All channels</option>${['send_money', 'pochi', 'till', 'paybill', 'bank', 'other'].map(value => `<option value="${value}" ${state.channel === value ? 'selected' : ''}>${value.replace('_', ' ')}</option>`).join('')}</select></label><button type="submit">Search</button></form>`) + panel('Results', transactionRows(nonInternal.filter(tx => {
        const q = String(state.query || '').toLowerCase();
        return (!q || [tx.counterparty, tx.name, tx.transactionCode, tx.channel, tx.amount, state.annotations[referenceOf(tx)]?.note, state.annotations[referenceOf(tx)]?.tag].some(value => String(value || '').toLowerCase().includes(q)))
          && (!state.direction || tx.direction === state.direction)
          && (!state.channel || tx.channel === state.channel);
      }), state, { annotate: true }));
    case 'reversals':
      return panel('Reversal-related transactions', transactionRows(nonInternal.filter(tx => /revers|reversed|refund/i.test(`${tx.direction} ${tx.counterparty} ${tx.name} ${tx.description || ''}`)), state, { annotate: true }));
    case 'duplicates': {
      const seen = new Set();
      const duplicates = nonInternal.filter(tx => {
        const key = `${tx.direction}|${tx.amount}|${String(tx.counterparty || tx.name || '').toLowerCase()}|${Math.floor(timestampOf(tx) / 60000)}`;
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      });
      return panel('Possible duplicates', transactionRows(duplicates, state, { annotate: true }), 'Similar amount, counterparty and minute; check the original M-Pesa history before acting.');
    }
    case 'merchants': {
      const names = [...new Set(nonInternal.map(tx => String(tx.counterparty || tx.name || '').trim()).filter(Boolean))].sort();
      const directory = names.map(name => `<article class="mpesa-tool-record"><strong>${escapeHtml(state.merchantNames[name.toLowerCase()] || name)}</strong><small>Original transaction name: ${escapeHtml(name)}</small><form data-mpesa-tool-form="merchant" data-name="${escapeHtml(name)}"><label>Display name <input name="alias" maxlength="80" value="${escapeHtml(state.merchantNames[name.toLowerCase()] || name)}" required></label><button type="submit">Save name</button><span data-mpesa-tool-status role="status"></span></form></article>`);
      return panel('Merchant directory', renderList(id, directory, 'Merchant names appear here when activity is recorded.'));
    }
    case 'recurring': {
      const groups = new Map();
      for (const tx of outgoing) {
        const name = transactionName(tx, state);
        const found = groups.get(name) || [];
        found.push(tx);
        groups.set(name, found);
      }
      const recurring = [...groups.entries()].filter(([, items]) => items.length >= 2).map(([name, items]) => `<article class="mpesa-tool-record"><strong>${escapeHtml(name)}</strong><span>${items.length} outgoing payments · ${escapeHtml(displayAmount(items.reduce((sum, tx) => sum + amountOf(tx), 0)))}</span><small>Pattern estimate only; no future payment is scheduled.</small></article>`);
      return panel('Possible recurring payments', renderList(id, recurring, 'No repeated payees found yet.'));
    }
    case 'debts':
      return renderDebtTool(state);
    case 'budgets':
      return renderBudgetTool(state, nonInternal);
    case 'savings':
      return renderGoalTool(state);
    case 'loans':
      return panel('Loan-related activity', transactionRows(nonInternal.filter(tx => /fuliza|m-shwari|kcb|loan|repay/i.test(`${tx.counterparty} ${tx.name} ${tx.channel} ${tx.description || ''}`)), state, { annotate: true }), 'Loan balances are not present in payment records; add a note to identify repayments.');
    case 'fees':
    case 'transfer-costs':
      return panel(id === 'fees' ? 'Recorded charges and fees' : 'Send and withdrawal costs', transactionRows(outgoing.filter(tx => /fee|charge|withdraw/i.test(`${tx.counterparty} ${tx.name} ${tx.direction} ${tx.description || ''}`)), state, { annotate: true }), 'Only transaction records that explicitly contain a fee or withdrawal are included.');
    case 'airtime':
      return panel('Airtime and data purchases', transactionRows(outgoing.filter(tx => /airtime|bundle|data/i.test(`${tx.counterparty} ${tx.name} ${tx.description || ''}`)), state, { annotate: true }));
    case 'sales':
      return panel('Business receipts', renderList(id, grouped(incoming.filter(tx => ['till', 'pochi'].includes(tx.channel)), state, tx => transactionName(tx, state)), 'No incoming Till or Pochi transactions found.'));
    case 'reconciliation':
      return panel('Match incoming payments to orders', transactionRows(incoming.map(tx => ({ ...tx, counterparty: `${tx.counterparty || tx.name || 'Customer'}${state.reconciliation[referenceOf(tx)] ? ` · Matched: ${state.reconciliation[referenceOf(tx)]}` : ' · Unmatched'}` })), state, { reconciled: true }));
    case 'fraud':
      return panel('Activity to review', transactionRows(nonInternal.filter(tx => amountOf(tx) >= 50000 || !referenceOf(tx) || tx.direction === 'other'), state, { annotate: true }), 'Heuristic flags only; this does not prove fraud.');
    case 'fake-sms':
      return panel('Verify payment claims', '<p>Craft cannot verify payment messages. Confirm each transaction in the official M-Pesa app before handing over goods or recording a sale.</p>');
    case 'app-lock':
      return panel('Protecting M-Pesa data', '<p>Use your Android screen lock. Craft does not currently provide a separate in-app lock.</p>');
    case 'business-personal':
      return panel('Classify transactions', transactionRows(nonInternal, state, { annotate: true }));
    case 'export':
      return panel('Export transaction statement', `<p>Creates a CSV from M-Pesa transaction records available in Craft.</p><button type="button" data-mpesa-tool-export>Download CSV</button><span data-mpesa-tool-status role="status"></span>`) + panel('Included transactions', transactionRows(nonInternal, state));
    default:
      return panel('Saved M-Pesa activity', transactionRows(nonInternal, state, { annotate: true }));
  }
}

export function renderMpesaToolScreen(featureId, transactions = [], query = '', direction = '', channel = '', period = 'all') {
  const state = readState();
  state.query = query;
  state.direction = direction;
  state.channel = channel;
  state.period = period || 'all';
  const content = featureRows(featureId, Array.isArray(transactions) ? transactions : [], state);
  return `${state.storageError ? `<p class="mpesa-tool-error" role="alert">${escapeHtml(state.storageError)}</p>` : ''}<div class="mpesa-tools">${content}</div>`;
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function bindMpesaToolEvents(onChange, onSearch, onPeriod, transactions = []) {
  document.querySelectorAll('[data-mpesa-tool-search]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    onSearch(
      String(data.get('q') || '').trim(),
      String(data.get('direction') || ''),
      String(data.get('channel') || '')
    );
  }));
  document.querySelectorAll('[data-mpesa-tool-period]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    onPeriod(String(new FormData(form).get('period') || 'all'));
  }));
  document.querySelectorAll('[data-mpesa-tool-form]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const status = form.querySelector('[data-mpesa-tool-status]');
    try {
      const state = readState();
      const data = formObject(form);
      const type = form.dataset.mpesaToolForm;
      if (type === 'annotation') {
        const reference = form.dataset.reference;
        if (!reference) throw new Error('Transaction reference is missing.');
        state.annotations[reference] = {
          ...state.annotations[reference],
          note: String(data.note || '').trim(),
          tag: String(data.tag || '').trim(),
          category: String(data.category || ''),
          purpose: String(data.purpose || '')
        };
      } else if (type === 'budget') {
        state.budgets.push({ id: newId(), category: String(data.category), amount: Number(data.amount), period: String(data.period) });
      } else if (type === 'goal') {
        state.goals.push({ id: newId(), name: String(data.name).trim(), target: Number(data.target), saved: 0 });
      } else if (type === 'goal-contribution') {
        const goal = state.goals.find(item => item.id === form.dataset.id);
        if (!goal) throw new Error('Savings goal was not found.');
        goal.saved += Number(data.amount);
      } else if (type === 'debt') {
        state.debts.push({ id: newId(), name: String(data.name).trim(), amount: Number(data.amount), type: String(data.type), note: String(data.note || '').trim() });
      } else if (type === 'merchant') {
        const name = String(form.dataset.name || '').trim();
        const alias = String(data.alias || '').trim();
        if (!name || !alias) throw new Error('Enter a display name.');
        state.merchantNames[name.toLowerCase()] = alias;
      } else {
        throw new Error('This M-Pesa form is not supported.');
      }
      writeState(state);
      onChange();
    } catch (error) {
      console.error('Could not save M-Pesa tool data.', error);
      if (status) status.textContent = error.message || 'Could not save this item.';
    }
  }));
  document.querySelectorAll('[data-mpesa-reconcile]').forEach(input => input.addEventListener('change', () => {
    const state = readState();
    state.reconciliation[input.dataset.mpesaReconcile] = input.value.trim();
    writeState(state);
  }));
  document.querySelectorAll('[data-mpesa-tool-remove]').forEach(button => button.addEventListener('click', () => {
    const state = readState();
    const collection = button.dataset.mpesaToolRemove;
    if (!['budgets', 'goals', 'debts'].includes(collection)) return;
    state[collection] = state[collection].filter(item => item.id !== button.dataset.id);
    writeState(state);
    onChange();
  }));
  document.querySelectorAll('[data-mpesa-tool-export]').forEach(button => button.addEventListener('click', () => {
    const status = button.parentElement.querySelector('[data-mpesa-tool-status]');
    try {
      const headers = ['reference', 'timestamp', 'direction', 'channel', 'counterparty', 'amount_kes', 'note', 'tag', 'category', 'purpose'];
      const state = readState();
      const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const rows = transactions.map(tx => {
        const annotation = state.annotations[referenceOf(tx)] || {};
        return [referenceOf(tx), new Date(timestampOf(tx)).toISOString(), tx.direction, tx.channel, tx.counterparty || tx.name, amountOf(tx), annotation.note, annotation.tag, annotation.category, annotation.purpose].map(quote).join(',');
      });
      const blob = new Blob([[headers.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'mpesa-transactions.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      if (status) status.textContent = `${rows.length} transactions exported.`;
    } catch (error) {
      console.error('Could not export M-Pesa transactions.', error);
      if (status) status.textContent = error.message || 'Could not export transactions.';
    }
  }));
}
