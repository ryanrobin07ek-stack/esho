const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const optionList = values => Array.isArray(values) ? values : [];
const uniqueOptions = (value, label) => {
  const values = [];
  const seen = new Set();
  for (const raw of String(value || '').split(/[,\n;]/)) {
    const option = raw.trim().slice(0, 80);
    if (!option) continue;
    const key = option.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(option);
  }
  if (values.length > 20) throw new Error(`${label} can have up to 20 options.`);
  return values;
};

const variantKey = (size, color) => JSON.stringify([size, color]);

export function createProductVariantFields({ sizes = [], colors = [], variants = [] } = {}) {
  const saved = optionList(variants);
  const initialSizes = optionList(sizes).length
    ? optionList(sizes)
    : [...new Set(saved.map(variant => variant.size).filter(Boolean))];
  const initialColors = optionList(colors).length
    ? optionList(colors)
    : [...new Set(saved.map(variant => variant.color).filter(Boolean))];
  return `<section class="product-variants" data-product-variants
    data-initial-sizes="${escapeHtml(initialSizes.join(', '))}"
    data-initial-colors="${escapeHtml(initialColors.join(', '))}"
    data-initial-variants="${escapeHtml(JSON.stringify(saved))}">
    <h3>Size and color options <span>(optional)</span></h3>
    <p>Each combination has its own stock. Leave its price blank to use the main product price.</p>
    <label>Sizes<input type="text" data-variant-sizes maxlength="800" placeholder="XS, S, M, L"></label>
    <label>Colors<input type="text" data-variant-colors maxlength="800" placeholder="Black, Blue, Red"></label>
    <div data-variant-rows></div>
    <p data-variant-status role="status" aria-live="polite"></p>
  </section>`;
}

export function bindProductVariantFields(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const widgets = [
    ...(root.matches?.('[data-product-variants]') ? [root] : []),
    ...root.querySelectorAll('[data-product-variants]')
  ];
  for (const widget of widgets) {
    if (widget.dataset.variantsInitialized) continue;
    const sizesInput = widget.querySelector('[data-variant-sizes]');
    const colorsInput = widget.querySelector('[data-variant-colors]');
    const rows = widget.querySelector('[data-variant-rows]');
    const status = widget.querySelector('[data-variant-status]');
    if (!sizesInput || !colorsInput || !rows || !status) {
      throw new Error('The product variants section is missing required controls.');
    }

    sizesInput.value = widget.dataset.initialSizes || '';
    colorsInput.value = widget.dataset.initialColors || '';
    let savedVariants = [];
    try {
      savedVariants = JSON.parse(widget.dataset.initialVariants || '[]');
    } catch (error) {
      throw new Error('Saved product variants could not be read.', { cause: error });
    }

    const currentVariants = () => [...rows.querySelectorAll('[data-variant-row]')].map(row => ({
      size: row.dataset.size || '',
      color: row.dataset.color || '',
      price: row.querySelector('[data-variant-price]')?.value || '',
      stock: row.querySelector('[data-variant-stock]')?.value || '0'
    }));
    const updateStockControl = () => {
      const stockInput = widget.closest('form')?.querySelector('[name="stock"]');
      if (!stockInput) return;
      const hasOptions = Boolean(sizesInput.value.trim() || colorsInput.value.trim());
      const label = stockInput.closest('.form-field')?.querySelector('.form-label')
        || stockInput.closest('label')?.firstChild;
      if (label && label.nodeType === 3) {
        if (!stockInput.dataset.variantOriginalLabel) stockInput.dataset.variantOriginalLabel = label.textContent.trim();
        label.textContent = hasOptions ? 'Stock is set per variant ' : `${stockInput.dataset.variantOriginalLabel} `;
      } else if (label) {
        if (!stockInput.dataset.variantOriginalLabel) stockInput.dataset.variantOriginalLabel = label.textContent.trim();
        label.textContent = hasOptions ? 'Stock is set per variant' : stockInput.dataset.variantOriginalLabel;
      }
      stockInput.disabled = hasOptions;
    };
    const render = () => {
      const current = new Map(savedVariants.map(variant => [variantKey(variant.size || '', variant.color || ''), variant]));
      currentVariants().forEach(variant => current.set(variantKey(variant.size, variant.color), variant));
      const sizes = uniqueOptions(sizesInput.value, 'Sizes');
      const colors = uniqueOptions(colorsInput.value, 'Colors');
      const sizeValues = sizes.length ? sizes : [''];
      const colorValues = colors.length ? colors : [''];
      if (!sizes.length && !colors.length) {
        rows.replaceChildren();
        status.textContent = 'Add sizes or colors to track separate variant prices and stock.';
        updateStockControl();
        return;
      }
      const combinations = sizeValues.flatMap(size => colorValues.map(color => ({ size, color })));
      if (combinations.length > 100) throw new Error('A product can have up to 100 size/color combinations.');
      rows.innerHTML = combinations.map(({ size, color }) => {
        const key = variantKey(size, color);
        const saved = current.get(key) || {};
        const label = [size, color].filter(Boolean).join(' / ');
        return `<div class="product-variant-row" data-variant-row data-size="${escapeHtml(size)}" data-color="${escapeHtml(color)}">
          <strong>${escapeHtml(label)}</strong>
          <label>Price override<input type="number" min="0" step="0.01" data-variant-price value="${escapeHtml(saved.price ?? '')}" placeholder="Use main price"></label>
          <label>Stock quantity<input type="number" min="0" step="1" data-variant-stock value="${escapeHtml(saved.stock ?? 0)}" required></label>
        </div>`;
      }).join('');
      status.textContent = `${combinations.length} variant${combinations.length === 1 ? '' : 's'}; stock is tracked separately for each.`;
      updateStockControl();
    };

    for (const input of [sizesInput, colorsInput]) {
      input.addEventListener('change', () => {
        try {
          render();
        } catch (error) {
          status.textContent = error.message;
        }
      });
    }
    widget.dataset.variantsInitialized = 'true';
    try {
      render();
    } catch (error) {
      status.textContent = error.message;
    }
  }
}

export function readProductVariantFields(form) {
  const widget = form.querySelector('[data-product-variants]');
  if (!widget) return { sizes: [], colors: [], variants: [], stock: undefined };
  const sizesInput = widget.querySelector('[data-variant-sizes]');
  const colorsInput = widget.querySelector('[data-variant-colors]');
  const rows = widget.querySelector('[data-variant-rows]');
  if (!sizesInput || !colorsInput || !rows) throw new Error('Product variants could not be read.');
  const sizes = uniqueOptions(sizesInput.value, 'Sizes');
  const colors = uniqueOptions(colorsInput.value, 'Colors');
  const expected = sizes.length || colors.length
    ? (sizes.length ? sizes : ['']).flatMap(size => (colors.length ? colors : ['']).map(color => variantKey(size, color)))
    : [];
  if (expected.length > 100) throw new Error('A product can have up to 100 size/color combinations.');
  const variants = [...rows.querySelectorAll('[data-variant-row]')].map(row => {
    const priceValue = row.querySelector('[data-variant-price]')?.value.trim() || '';
    const stockValue = row.querySelector('[data-variant-stock]')?.value.trim() || '';
    const stock = Number(stockValue);
    const price = priceValue ? Number(priceValue) : null;
    if (!Number.isSafeInteger(stock) || stock < 0) {
      throw new Error(`Enter a whole-number stock quantity for ${[row.dataset.size, row.dataset.color].filter(Boolean).join(' / ')}.`);
    }
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      throw new Error(`Enter a valid price for ${[row.dataset.size, row.dataset.color].filter(Boolean).join(' / ')}.`);
    }
    return {
      id: variantKey(row.dataset.size || '', row.dataset.color || ''),
      size: row.dataset.size || '',
      color: row.dataset.color || '',
      price,
      stock
    };
  });
  if ((sizes.length || colors.length) && !variants.length) {
    throw new Error('Add at least one size or color option, then check its stock quantity.');
  }
  if (variants.length !== expected.length ||
      variants.some((variant, index) => variant.id !== expected[index])) {
    throw new Error('Review the size and color combinations before saving this product.');
  }
  const stock = variants.reduce((total, variant) => total + variant.stock, 0);
  if (!Number.isSafeInteger(stock)) throw new Error('Total variant stock is too large.');
  const result = {
    sizes,
    colors,
    variants
  };
  if (variants.length) result.stock = stock;
  return result;
}
