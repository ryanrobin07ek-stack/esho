// More > Instances screen: start, run and summarise business instances.
import { INSTANCE_MODES, escapeHtml, money } from '../../till/format.js';

export function createInstancesScreen({
  state, tabsTitle, card, statusTag, field, select, button, metric
}) {
  function renderInstances(params) {
    const selected = state.instances.find((item) => item.id === params.get('id'));
    const active = state.instances.find((item) => item.status !== 'completed');
    return `<section class="pos-content">
      ${tabsTitle('Business instances', 'Group store revenue by a shift or timed work period.',
        `<a href="/pos" data-route="/pos" class="btn-secondary" aria-label="Back to checkout">&larr;</a>`)}
      ${active ? renderActiveInstance(active) : renderStartInstance()}
      ${selected ? renderInstanceSummary(selected) : ''}
      ${!selected ? card(`<h3>Saved instances</h3>${state.instances.filter((item) => item.status === 'completed').map((item) =>
        `<div class="pos-category-row"><strong>${escapeHtml(item.name)}</strong><span>${new Date(item.started_at).toLocaleString()}</span>
          ${statusTag(item.mode)}<a class="btn-secondary" href="/pos/instances?id=${encodeURIComponent(item.id)}" data-route="/pos/instances?id=${encodeURIComponent(item.id)}">Review</a></div>`).join('') || '<p class="pos-help">Completed instances will appear here.</p>'}`) : ''}
    </section>`;
  }

  function renderStartInstance() {
    return card(`<h3>Start an instance</h3><form class="pos-form" data-pos-form="instance">
      ${field('Name · optional', 'name', '', { placeholder: `Instance ${state.instances.length + 1}` })}
      ${select('Type', 'mode', INSTANCE_MODES.map(([value, title]) => [value, title]), 'normal')}
      ${field('Duration · minutes (set-time only)', 'durationMinutes', '60', { type: 'number', min: '1', max: '1440' })}
      ${field('Start time · optional', 'startAt', '', { type: 'datetime-local' })}
      ${field('End time · optional', 'endAt', '', { type: 'datetime-local' })}
      <button class="btn-primary" type="submit">Start instance</button>
    </form>`);
  }

  function renderActiveInstance(instance) {
    const end = instance.scheduled_end_at ? new Date(instance.scheduled_end_at).toLocaleString() : '';
    return card(`<div class="pos-section-heading"><div><h3>${escapeHtml(instance.name)}</h3>
      <p>${statusTag(instance.status)} · ${escapeHtml(instance.mode)} · Started ${new Date(instance.started_at).toLocaleString()}</p></div>
      <strong class="pos-clock" data-instance-start="${escapeHtml(instance.started_at)}">${instance.status === 'paused' ? 'Paused' : elapsed(instance.started_at)}</strong></div>
      ${end ? `<p class="pos-help">Scheduled stop: ${end}</p>` : ''}
      <div class="pos-form-actions">
      ${instance.mode === 'counted' && instance.status === 'active' ? button('Checkpoint', 'instance-checkpoint', `data-id="${escapeHtml(instance.id)}"`) : ''}
      ${instance.mode === 'counted' ? button(instance.status === 'paused' ? 'Resume' : 'Pause', instance.status === 'paused' ? 'instance-resume' : 'instance-pause', `data-id="${escapeHtml(instance.id)}"`, true) : ''}
      ${instance.status !== 'scheduled' ? button('Stop & save', 'instance-stop', `data-id="${escapeHtml(instance.id)}"`) : ''}</div>`);
  }

  function renderInstanceSummary(instance) {
    const summary = state.instanceSummaries.get(instance.id) || { revenue: 0, expenses: 0, count: 0, methods: {}, daily: [] };
    return card(`<div class="pos-section-heading"><div><h3>${escapeHtml(instance.name)}</h3>
      <p>${new Date(instance.started_at).toLocaleString()} — ${instance.ended_at ? new Date(instance.ended_at).toLocaleString() : 'In progress'}</p></div>
      <a href="/pos/instances" data-route="/pos/instances" class="btn-secondary">All instances</a></div>
      <div class="pos-metrics">${metric('Revenue', money(summary.revenue, state.settings.currency), `${summary.count} payments`)}
        ${metric('Expenses', money(summary.expenses, state.settings.currency), 'During this period')}
        ${metric('Net', money(summary.revenue - summary.expenses, state.settings.currency), 'Revenue less expenses')}</div>
      <h4>Payments by method</h4>${Object.entries(summary.methods).map(([method, amount]) => `<div class="pos-total-line"><span>${escapeHtml(method)}</span><b>${money(amount, state.settings.currency)}</b></div>`).join('') || '<p class="pos-help">No payments recorded in this instance.</p>'}
      <h4>Checkpoints</h4>${instance.checkpoints.length ? instance.checkpoints.map((date) => `<p class="pos-help">${new Date(date).toLocaleString()}</p>`).join('') : '<p class="pos-help">No checkpoints yet.</p>'}`);
  }

  function elapsed(startedAt) {
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  return { renderInstances };
}
