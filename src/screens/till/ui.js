// Shared markup for every till screen: header, section menu, bottom nav, form fields, buttons,
// status tags, empty states, metrics and the toast.
import { escapeHtml } from '../../till/format.js';
import { navIcon } from '../../nav-icons.js';

export function createTillUi() {
  const primaryNavLink = (path, label, icon, selected) =>
    `<a href="${path}" data-route="${path}" class="pos-tab ${selected ? 'is-active' : ''}"><span class="pos-nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`;
  const primarySection = (path) => path.startsWith('/pos/catalogue') || path === '/pos/inventory' ? 'catalogue'
    : path.startsWith('/pos/orders') || path === '/pos/invoices' ? 'orders'
      : path === '/pos' ? 'sell' : path.startsWith('/pos/overview') ? 'overview' : 'more';
  const sectionMenu = (title, items, current) => `<details class="workspace-menu pos-section-menu">
    <summary aria-label="Open ${escapeHtml(title)} menu" title="Open menu">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
    </summary>
    <a class="workspace-sidebar-scrim" href="${escapeHtml(current)}" data-route="${escapeHtml(current)}" aria-label="Close ${escapeHtml(title)} menu"></a>
    <aside class="workspace-sidebar" aria-label="${escapeHtml(title)} menu">
      <h2>${escapeHtml(title)}</h2>
      <nav class="workspace-sidebar-links" aria-label="${escapeHtml(title)} pages">
        ${items.map(([route, label]) => `<a href="${escapeHtml(route)}" data-route="${escapeHtml(route)}" class="workspace-sidebar-link ${current === route ? 'is-active' : ''}" ${current === route ? 'aria-current="page"' : ''}>${escapeHtml(label)}</a>`).join('')}
      </nav>
      <div class="workspace-sidebar-divider" aria-hidden="true"></div>
      <nav class="workspace-sidebar-links" aria-label="Profile and app links">
        <a href="/account/profile/profile" data-route="/account/profile/profile" class="workspace-sidebar-link">Profile</a>
        <a href="/account/profile/webs" data-route="/account/profile/webs" class="workspace-sidebar-link">Webs</a>
        <a href="/account/profile/accounts" data-route="/account/profile/accounts" class="workspace-sidebar-link">Accounts</a>
        <a href="/account/profile/privacy" data-route="/account/profile/privacy" class="workspace-sidebar-link">Privacy</a>
        <a href="/account/profile/recommended-actions" data-route="/account/profile/recommended-actions" class="workspace-sidebar-link">Recommended actions</a>
        <a href="/account/profile/link-devices" data-route="/account/profile/link-devices" class="workspace-sidebar-link">Link devices</a>
        <a href="/account/profile/updates" data-route="/account/profile/updates" class="workspace-sidebar-link">Updates</a>
      </nav>
      <a class="workspace-sidebar-link workspace-sidebar-logout" href="/" data-route="/" data-home-screen aria-label="Log out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></svg><span>Log out</span></a>
    </aside>
  </details>`;
  const screenTitle = (path) => {
    if (path === '/pos') return 'Sell';
    if (path === '/pos/overview') return 'Overview';
    if (path.startsWith('/pos/catalogue') || path === '/pos/inventory') {
      return path.endsWith('/products') ? 'Products'
        : path.endsWith('/categories') ? 'Categories'
          : path.endsWith('/suppliers') ? 'Suppliers' : 'Inventory';
    }
    if (path.startsWith('/pos/orders') || path === '/pos/invoices') {
      return path.endsWith('/invoices') ? 'Invoices'
        : path.endsWith('/quotations') ? 'Quotations' : 'Orders';
    }
    if (path === '/pos/sales') return 'Sales & receipts';
    if (path === '/pos/customers') return 'Customers';
    if (path.endsWith('/instances')) return 'Instances';
    if (path.endsWith('/settings')) return 'Settings';
    if (path === '/pos/more') return 'More';
    return '';
  };
  const commonHeader = (path, params) => {
    const sectionMenuMarkup = renderSectionNav(path, params);
    const hasSectionNav = Boolean(sectionMenuMarkup);
    const title = screenTitle(path);
    return `
    <main class="container pos-main${path === '/pos' ? ' pos-sell-screen' : ''} ${hasSectionNav ? 'pos-main-with-tabs' : ''}">
      <header class="pos-header">
        <a href="/" data-route="/" data-home-screen class="pos-brand pos-brand-back ${path === '/pos/overview' ? 'pos-brand-overview' : ''}" aria-label="Back to Craft home">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg>
          ${title ? `<span>${escapeHtml(title)}</span>` : ''}
        </a>
        ${sectionMenuMarkup}
      </header>
      <div class="pos-header-divider" aria-hidden="true"></div>
      <nav class="pos-bottom-nav" aria-label="Point of sale">
        ${primaryNavLink('/pos', 'Sell', navIcon('sell'), primarySection(path) === 'sell')}
        ${primaryNavLink('/pos/overview', 'Overview', navIcon('overview'), primarySection(path) === 'overview')}
        ${primaryNavLink('/pos/catalogue/inventory', 'Catalogue', navIcon('products'), primarySection(path) === 'catalogue')}
        ${primaryNavLink('/pos/orders', 'Orders', navIcon('orders'), primarySection(path) === 'orders')}
        ${primaryNavLink('/pos/more', 'More', navIcon('more'), primarySection(path) === 'more')}
      </nav>`;
  };

  const pageEnd = `</main>`;
  const card = (content, extra = '') => `<section class="pos-card ${extra}">${content}</section>`;
  const field = (label, name, value = '', options = {}) => `
    <label class="pos-field">
      <span>${label}</span>
      <input name="${name}" value="${escapeHtml(value)}" ${options.type ? `type="${options.type}"` : 'type="text"'}
        ${options.required ? 'required' : ''} ${options.min !== undefined ? `min="${options.min}"` : ''}
        ${options.step ? `step="${options.step}"` : ''} ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ''}
        ${options.readonly ? 'readonly' : ''}>
    </label>`;
  const select = (label, name, choices, selected) => `
    <label class="pos-field"><span>${label}</span><select name="${name}">
      ${choices.map(([value, title]) => `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHtml(title)}</option>`).join('')}
    </select></label>`;
  const button = (label, action, attrs = '', secondary = false) =>
    `<button type="button" class="btn-${secondary ? 'secondary' : 'primary'}" data-pos-action="${action}" ${attrs}>${label}</button>`;
  const editIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
  const deleteIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>';
  const iconButton = (action, id, label, icon, extraClass = '') =>
    `<button type="button" class="product-list-${action === 'rename-category' ? 'edit' : 'delete'} pos-icon-action ${extraClass}" data-pos-action="${action}" data-id="${id}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon}</button>`;
  const iconLink = (path, label) =>
    `<a href="${path}" data-route="${path}" class="product-list-edit pos-icon-action" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${editIcon}</a>`;
  const statusTag = (text, tone = '') => `<span class="pos-status ${tone}">${escapeHtml(text)}</span>`;
  const empty = (title, detail) => `<div class="pos-empty"><strong>${escapeHtml(title)}</strong> <span>${escapeHtml(detail)}</span></div>`;
  const tabsTitle = (title, detail, action = '') =>
    `<div class="pos-section-heading"><div><h2>${title}</h2><p>${detail}</p></div>${action}</div>`;

  function renderSectionNav(path, params = new URLSearchParams()) {
    if (path === '/pos') {
      return sectionMenu('POS screens', [
        ['/pos', 'Sell'],
        ['/pos/overview', 'Overview'],
        ['/pos/catalogue/inventory', 'Catalogue'],
        ['/pos/orders', 'Orders'],
        ['/pos/more', 'More']
      ], path);
    }
    if (path.startsWith('/pos/overview')) {
      const period = ['today', '7d', '30d', '90d', 'all'].includes(params.get('range')) ? params.get('range') : '30d';
      const requestedTab = params.get('tab') === 'Insights' ? 'Reports' : params.get('tab');
      const tab = ['Summary', 'Revenue', 'Profit', 'Products', 'Stock', 'Payments', 'Reports'].includes(requestedTab)
        ? requestedTab : 'Summary';
      const routeFor = (nextTab) => `/pos/overview?tab=${encodeURIComponent(nextTab)}&range=${encodeURIComponent(period)}`;
      const tabs = ['Summary', 'Revenue', 'Profit', 'Products', 'Stock', 'Payments', 'Reports'];
      return sectionMenu('Overview sections', tabs.map((item) => [routeFor(item), item]), routeFor(tab));
    }
    if (path.startsWith('/pos/catalogue') || path === '/pos/inventory') {
      const current = path === '/pos/inventory' ? '/pos/catalogue/inventory' : path;
      return sectionMenu('Catalogue screens', [
        ['/pos/catalogue/inventory', 'Inventory'],
        ['/pos/catalogue/products', 'Products'],
        ['/pos/catalogue/categories', 'Categories'],
        ['/pos/catalogue/suppliers', 'Suppliers']
      ], current);
    }
    if (path.startsWith('/pos/orders') || path === '/pos/invoices') {
      const current = path === '/pos/invoices' ? '/pos/orders/invoices' : path;
      return sectionMenu('Orders screens', [
        ['/pos/orders', 'Orders'],
        ['/pos/orders/invoices', 'Invoices'],
        ['/pos/orders/quotations', 'Quotations']
      ], current);
    }
    if (path.startsWith('/pos/more') || path === '/pos/sales' || path === '/pos/customers') {
      return sectionMenu('More screens', [
        ['/pos/more', 'More'],
        ['/pos/sales', 'Sales & receipts'],
        ['/pos/customers', 'Customers'],
        ['/pos/more/instances', 'Instances'],
        ['/pos/more/settings', 'Settings']
      ], path);
    }
    return '';
  }

  function metric(label, value, detail) {
    return `<div class="pos-metric"><small>${label}</small><strong>${value}</strong><span>${escapeHtml(detail)}</span></div>`;
  }

  function toast(message, error = false) {
    let element = document.getElementById('pos-toast');
    if (!element) {
      element = document.createElement('div');
      element.id = 'pos-toast';
      element.className = 'pos-toast';
      document.body.appendChild(element);
    }
    element.textContent = message;
    element.classList.toggle('is-error', error);
    element.classList.add('is-visible');
    clearTimeout(element._timer);
    element._timer = setTimeout(() => element.classList.remove('is-visible'), 2600);
  }

  return {
    commonHeader, pageEnd, card, field, select, button, editIcon, deleteIcon, iconButton, iconLink,
    statusTag, empty, tabsTitle, metric, toast
  };
}
