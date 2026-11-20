// More screen.

export function createMoreScreen({ tabsTitle, card }) {
  function renderMore() {
    return `<section class="pos-content">${tabsTitle('More', 'Business tools and settings.')}
      ${card('<a class="pos-more-link" href="/pos/more/instances" data-route="/pos/more/instances"><strong>Business instances</strong></a>', 'pos-more-card')}
      ${card('<a class="pos-more-link" href="/pos/sales" data-route="/pos/sales"><strong>Sales &amp; receipts</strong></a>', 'pos-more-card')}
      ${card('<a class="pos-more-link" href="/pos/more/settings" data-route="/pos/more/settings"><strong>Settings</strong></a>', 'pos-more-card')}
    </section>`;
  }

  return { renderMore };
}
