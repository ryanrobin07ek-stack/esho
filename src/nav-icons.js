// One icon set for every bottom menu (POS, Main Store, Craft), so the same picture always means the
// same thing. The menus used text symbols (⌂ ▦ ◉ ▤ ⋮) that meant different things in each section.
const PATHS = {
  sell: '<path d="M12 5v14M5 12h14"/>',
  overview: '<path d="M4 20V11M10 20V5M16 20v-6M3 20h18"/>',
  products: '<path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z"/><path d="M3 7.5v9L12 21l9-4.5v-9M12 12v9"/>',
  orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  sales: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  customers: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-3.2 2.7-5 5.5-5s5.1 1.8 5.5 5"/><path d="M16 5.5a3 3 0 0 1 0 5.6M18 15c1.7.6 2.7 2.4 3 5"/>',
  websites: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18"/>',
  payments: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  more: '<circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>'
};

/** Inline SVG for a menu icon; unknown names fall back to "more". */
export function navIcon(name) {
  const fill = name === 'more' ? 'currentColor' : 'none';
  return `<svg class="nav-icon-svg" viewBox="0 0 24 24" width="22" height="22" fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.more}</svg>`;
}
