// Till input and change events: search, filters, cart quantities, live form updates.

export function createInputActions({
  state, renderProductTiles, cartLineKey, updateCartPanel, renderKeepingForm
}) {
  function handleInput(event) {
    const searchInput = event.target.closest('.pos-filter-row input[name="search"]');
    if (searchInput) {
      state.search = searchInput.value.trim().toLocaleLowerCase();
      const productGrid = document.getElementById('pos-product-grid');
      if (productGrid) productGrid.innerHTML = renderProductTiles();
    }
    const categorySelect = event.target.closest('.pos-filter-row select[name="category"]');
    if (categorySelect) {
      state.category = categorySelect.value;
      const productGrid = document.getElementById('pos-product-grid');
      if (productGrid) productGrid.innerHTML = renderProductTiles();
    }
    const quantity = event.type === 'change' ? event.target.closest('[data-pos-quantity]') : null;
    if (quantity) {
      const item = state.cart.find((row) => cartLineKey(row) === quantity.dataset.posQuantity);
      const next = Number(quantity.value);
      if (item && Number.isSafeInteger(next) && next > 0 && next <= 99999) {
        item.quantity = next;
        updateCartPanel();
      }
    }
    const serviceToggle = event.target.closest?.('select[name="isService"]');
    if (serviceToggle) {
      const productForm = serviceToggle.closest('form');
      const durationBox = productForm?.querySelector('[data-service-duration]');
      const stockBox = productForm?.querySelector('[data-product-stock-field]');
      const variantsBox = productForm?.querySelector('[data-product-variants-field]');
      const asService = serviceToggle.value === '1';
      if (durationBox) durationBox.hidden = !asService;
      if (stockBox) stockBox.hidden = asService;
      // Time is not sold in sizes.
      if (variantsBox) variantsBox.hidden = asService;
      if (asService && productForm.elements.stock) productForm.elements.stock.value = '';
    }
    const supplierFilterSelect = event.type === 'change' ? event.target.closest?.('[data-pos-supplier-filter]') : null;
    if (supplierFilterSelect) {
      window.location.hash = `#/pos/catalogue/products${supplierFilterSelect.value ? `?supplier=${encodeURIComponent(supplierFilterSelect.value)}` : ''}`;
    }
    const invoiceQuantity = event.type === 'change' ? event.target.closest('[data-invoice-qty]') : null;
    if (invoiceQuantity) {
      const item = state.invoiceItems[Number(invoiceQuantity.dataset.invoiceQty)];
      const next = Number(invoiceQuantity.value);
      if (item && Number.isSafeInteger(next) && next > 0 && next <= 99999) {
        item.quantity = next;
        renderKeepingForm('invoice');
      }
    }
    const invoicePrice = event.type === 'change' ? event.target.closest('[data-invoice-price]') : null;
    if (invoicePrice) {
      const item = state.invoiceItems[Number(invoicePrice.dataset.invoicePrice)];
      const next = Number(invoicePrice.value);
      if (item && Number.isFinite(next) && next >= 0) {
        item.unitPrice = next;
        renderKeepingForm('invoice');
      }
    }
  }

  return { handleInput };
}
