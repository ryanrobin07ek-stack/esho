// Revenue and profit charts for the Overview screen.
import { escapeHtml, money } from '../../till/format.js';

export function createOverviewCharts() {
  function chartAxisMoney(value, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency, currencyDisplay: 'narrowSymbol',
        notation: 'compact', maximumFractionDigits: 1
      }).format(value);
    } catch {
      return money(value, currency);
    }
  }

  function chartAxisGrid(minimum, maximum, left, right, top, bottom, currency) {
    return Array.from({ length: 5 }, (_, index) => {
      const value = maximum - (maximum - minimum) * index / 4;
      const y = top + (bottom - top) * index / 4;
      return `<line class="pos-revenue-chart-grid" x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}"></line>
        <text class="pos-revenue-chart-axis-label" x="${left - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${escapeHtml(chartAxisMoney(value, currency))}</text>`;
    }).join('');
  }

  function renderRevenueChart(series, currency) {
    if (!series.length) return '<p class="pos-help">No sales recorded in this period.</p>';
    const height = 280;
    const width = Math.max(340, 96 + Math.max(1, series.length - 1) * 62);
    const left = 78;
    const right = width - 18;
    const top = 22;
    const bottom = 218;
    const max = Math.max(...series.map(([, amount]) => amount), 1);
    const points = series.map(([date, amount], index) => ({
      date,
      amount,
      x: series.length === 1 ? (left + right) / 2 : left + index * (right - left) / (series.length - 1),
      y: bottom - amount / max * (bottom - top)
    }));
    const line = points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${points[points.length - 1].x.toFixed(1)},${bottom} L${points[0].x.toFixed(1)},${bottom} Z`;
    const labels = points.map(({ x, date }, index) =>
      `<line class="pos-revenue-chart-tick" x1="${x.toFixed(1)}" y1="${bottom}" x2="${x.toFixed(1)}" y2="${bottom + 4}"></line>
        <text class="pos-revenue-chart-axis-label" x="${x.toFixed(1)}" y="252" text-anchor="${index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}">${escapeHtml(date.slice(2))}</text>`
    ).join('');
    return `<div class="pos-revenue-chart">
      <div class="pos-revenue-chart-total"><span>Net sales · before tax</span><strong>${money(series.reduce((sum, [, amount]) => sum + amount, 0), currency)}</strong></div>
      <div class="pos-revenue-chart-scroll" role="region" aria-label="Revenue chart history; scroll horizontally to see all dates" tabindex="0">
      <svg viewBox="0 0 ${width} ${height}" style="--pos-chart-min-width:${width}px" role="img" aria-label="Net sales before tax over time with value and date axes">
        ${chartAxisGrid(0, max, left, right, top, bottom, currency)}
        <line class="pos-revenue-chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"></line>
        <line class="pos-revenue-chart-axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"></line>
        <path class="pos-revenue-chart-area" d="${area}"></path>
        <path class="pos-revenue-chart-line" d="${line}"></path>
        ${points.map(({ x, y }) => `<circle class="pos-revenue-chart-point" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"></circle>`).join('')}
        ${labels}
      </svg>
      </div>
    </div>`;
  }

  function renderProfitChart(series, currency) {
    if (!series.length) return '<p class="pos-help">No recorded sales or expenses in this period to chart.</p>';
    const height = 280;
    const width = Math.max(340, 96 + Math.max(1, series.length - 1) * 62);
    const left = 78;
    const right = width - 18;
    const top = 22;
    const bottom = 218;
    const values = series.map(([, amount]) => amount);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const spread = max - min || 1;
    const yFor = (amount) => bottom - (amount - min) / spread * (bottom - top);
    const points = series.map(([date, amount], index) => ({
      date,
      amount,
      x: series.length === 1 ? (left + right) / 2 : left + index * (right - left) / (series.length - 1),
      y: yFor(amount)
    }));
    const line = points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const labels = points.map(({ x, date }, index) =>
      `<line class="pos-revenue-chart-tick" x1="${x.toFixed(1)}" y1="${bottom}" x2="${x.toFixed(1)}" y2="${bottom + 4}"></line>
        <text class="pos-revenue-chart-axis-label" x="${x.toFixed(1)}" y="252" text-anchor="${index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}">${escapeHtml(date.slice(2))}</text>`
    ).join('');
    return `<div class="pos-revenue-chart">
      <div class="pos-revenue-chart-total"><span>Recorded operating profit</span><strong>${money(values.reduce((sum, amount) => sum + amount, 0), currency)}</strong></div>
      <div class="pos-revenue-chart-scroll" role="region" aria-label="Profit chart history; scroll horizontally to see all dates" tabindex="0">
      <svg viewBox="0 0 ${width} ${height}" style="--pos-chart-min-width:${width}px" role="img" aria-label="Recorded operating profit over time with value and date axes">
        ${chartAxisGrid(min, max, left, right, top, bottom, currency)}
        <line class="pos-revenue-chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"></line>
        <line class="pos-revenue-chart-axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"></line>
        <line class="pos-profit-chart-zero" x1="${left}" y1="${yFor(0).toFixed(1)}" x2="${right}" y2="${yFor(0).toFixed(1)}"></line>
        <path class="pos-revenue-chart-line" d="${line}"></path>
        ${points.map(({ x, y }) => `<circle class="pos-revenue-chart-point" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"></circle>`).join('')}
        ${labels}
      </svg>
      </div>
    </div>`;
  }

  return { renderRevenueChart, renderProfitChart };
}
