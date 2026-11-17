function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function uniqueValues(values) {
  const seen = new Set();
  return values.map(value => String(value ?? '').trim()).filter(value => {
    if (!value || seen.has(value.toLowerCase())) return false;
    seen.add(value.toLowerCase());
    return true;
  }).slice(0, 20).map(value => value.slice(0, 80)).filter(Boolean);
}

function parseValues(value, label) {
  const values = uniqueValues(String(value || '').split(','));
  if (String(value || '').split(',').some(entry => entry.trim().length > 80)) {
    throw new Error(`${label} values must be 80 characters or fewer.`);
  }
  if (String(value || '').split(',').filter(entry => entry.trim()).length > 20) {
    throw new Error(`${label} supports up to 20 values.`);
  }
  return values;
}

function variantOptionValue(variant, option) {
  const namedValue = variant[`option${option}_value`];
  if (namedValue !== undefined && namedValue !== null) return String(namedValue);
  return String(variant[option === 1 ? 'size' : 'color'] ?? '');
}

export function createProductVariantFields({
  sizes = [],
  colors = [],
  variants = [],
  option1Name = '',
  option2Name = ''
} = {}) {
  const savedVariants = Array.isArray(variants) ? variants : [];
  const initialOption1Values = uniqueValues(
    sizes.length ? sizes : savedVariants.map(variant => variantOptionValue(variant, 1)),
    'Option 1'
  );
  const initialOption2Values = uniqueValues(
    colors.length ? colors : savedVariants.map(variant => variantOptionValue(variant, 2)),
    'Option 2'
  );
  const initialOption1Name = String(option1Name || (initialOption1Values.length ? 'Size' : '')).slice(0, 80);
  const initialOption2Name = String(option2Name || (initialOption2Values.length ? 'Color' : '')).slice(0, 80);
  return `<section class="product-variant-fields" data-product-variants data-product-variant-fields
      data-initial-option1-name="${escapeHtml(initialOption1Name)}"
      data-initial-option2-name="${escapeHtml(initialOption2Name)}"
      data-initial-sizes="${escapeHtml(initialOption1Values.join(', '))}"
      data-initial-colors="${escapeHtml(initialOption2Values.join(', '))}"
      data-initial-variants="${escapeHtml(JSON.stringify(savedVariants))}">
    <h3>Product options <span>(optional)</span></h3>
    <p>Use any option that fits the product, such as pack size, flavor, roast, scent, or material. Leave both blank for a product with no variants.</p>
    <div class="form-grid">
      <label>Option 1 name<input type="text" data-variant-option-name="1" maxlength="80" placeholder="e.g. Pack size"></label>
      <label>Option 1 values<input type="text" data-variant-option-values="1" maxlength="1000" placeholder="e.g. 250 g, 500 g"></label>
      <label>Option 2 name<input type="text" data-variant-option-name="2" maxlength="80" placeholder="e.g. Flavor"></label>
      <label>Option 2 values<input type="text" data-variant-option-values="2" maxlength="1000" placeholder="e.g. Plain, Vanilla"></label>
    </div>
    <p data-variant-status role="status" aria-live="polite"></p>
    <div data-variant-rows></div>
  </section>`;
}

export function bindProductVariantFields(widget) {
  if (!widget) throw new Error('Product option fields are required.');
  const nameInputs = [1, 2].map(option => widget.querySelector(`[data-variant-option-name="${option}"]`));
  const valueInputs = [1, 2].map(option => widget.querySelector(`[data-variant-option-values="${option}"]`));
  const status = widget.querySelector('[data-variant-status]');
  const rows = widget.querySelector('[data-variant-rows]');
  if (nameInputs.some(input => !input) || valueInputs.some(input => !input) || !status || !rows) {
    throw new Error('The product option editor is missing required controls.');
  }

  nameInputs[0].value = widget.dataset.initialOption1Name || '';
  nameInputs[1].value = widget.dataset.initialOption2Name || '';
  valueInputs[0].value = widget.dataset.initialSizes || '';
  valueInputs[1].value = widget.dataset.initialColors || '';
  let savedVariants = [];
  try {
    savedVariants = JSON.parse(widget.dataset.initialVariants || '[]');
  } catch {
    throw new Error('Saved product options could not be read.');
  }
  if (!Array.isArray(savedVariants)) throw new Error('Saved product options must be a list.');

  const currentVariants = new Map(savedVariants.map(variant => [
    JSON.stringify([variantOptionValue(variant, 1), variantOptionValue(variant, 2)]),
    variant
  ]));

  const updateStockControl = hasVariants => {
    const stockInput = widget.closest('form')?.querySelector('[name="stock"]');
    if (!stockInput) return;
    stockInput.disabled = hasVariants;
    const stockLabel = stockInput.closest('label');
    if (stockLabel) {
      stockLabel.firstChild.textContent = hasVariants ? 'Stock is set per variant ' : 'Stock ';
    }
  };

  const render = () => {
    const optionNames = nameInputs.map(input => input.value.trim().slice(0, 80));
    const optionValues = valueInputs.map((input, index) => parseValues(input.value, `Option ${index + 1}`));
    rows.replaceChildren();

    for (let index = 0; index < 2; index += 1) {
      if (optionNames[index] && !optionValues[index].length) {
        status.textContent = `Enter values for ${optionNames[index]} or clear its name.`;
        updateStockControl(false);
        return;
      }
      if (optionValues[index].length && !optionNames[index]) {
        throw new Error(`Name option ${index + 1} before adding its values.`);
      }
    }

    if (!optionValues[0].length && !optionValues[1].length) {
      status.textContent = 'Add option names and values to create product variants.';
      updateStockControl(false);
      return;
    }

    const combinations = (optionValues[0].length ? optionValues[0] : ['']).flatMap(value1 =>
      (optionValues[1].length ? optionValues[1] : ['']).map(value2 => [value1, value2])
    );
    if (combinations.length > 100) throw new Error('A product can have up to 100 option combinations.');

    for (const [value1, value2] of combinations) {
      const current = currentVariants.get(JSON.stringify([value1, value2])) || {};
      const row = widget.ownerDocument.createElement('div');
      row.className = 'product-variant-row';
      row.dataset.variantRow = '';
      row.dataset.size = value1;
      row.dataset.color = value2;
      row.dataset.option1Value = value1;
      row.dataset.option2Value = value2;
      const labels = [
        value1 && `${optionNames[0]}: ${value1}`,
        value2 && `${optionNames[1]}: ${value2}`
      ].filter(Boolean);
      row.innerHTML = `<strong>${escapeHtml(labels.join(' · '))}</strong>
        <label>Price<input type="number" min="0" step="0.01" data-variant-price value="${escapeHtml(current.price ?? '')}"></label>
        <label>Stock<input type="number" min="0" step="1" data-variant-stock value="${escapeHtml(current.stock ?? 0)}"></label>`;
      rows.append(row);
    }

    status.textContent = `${combinations.length} product variant${combinations.length === 1 ? '' : 's'}; price and stock can be set for each.`;
    updateStockControl(combinations.length > 0);
  };

  [...nameInputs, ...valueInputs].forEach(input => input.addEventListener('change', () => {
    try {
      render();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Product options could not be updated.';
    }
  }));
  render();
}

export function readProductVariantFields(widget) {
  if (!widget) throw new Error('Product option fields are required.');
  const names = [1, 2].map(option => widget.querySelector(`[data-variant-option-name="${option}"]`)?.value.trim().slice(0, 80) || '');
  const values = [1, 2].map((option, index) => parseValues(
    widget.querySelector(`[data-variant-option-values="${option}"]`)?.value || '',
    `Option ${index + 1}`
  ));
  for (let index = 0; index < 2; index += 1) {
    if (Boolean(names[index]) !== Boolean(values[index].length)) {
      throw new Error(`Provide both a name and values for option ${index + 1}, or leave both blank.`);
    }
  }

  const variantRows = Array.from(widget.querySelectorAll('[data-variant-row]'));
  if (!values[0].length && !values[1].length) {
    if (variantRows.length) throw new Error('Clear product option rows before saving without variants.');
    return { sizes: [], colors: [], variants: [] };
  }
  const expected = (values[0].length ? values[0] : ['']).flatMap(value1 =>
    (values[1].length ? values[1] : ['']).map(value2 => [value1, value2])
  );
  if (expected.length > 100) throw new Error('A product can have up to 100 option combinations.');
  if (variantRows.length !== expected.length) throw new Error('Update product options before saving.');

  const variants = variantRows.map(row => {
    const option1Value = row.dataset.option1Value ?? row.dataset.size ?? '';
    const option2Value = row.dataset.option2Value ?? row.dataset.color ?? '';
    const priceValue = row.querySelector('[data-variant-price]')?.value;
    const stockValue = row.querySelector('[data-variant-stock]')?.value;
    const price = priceValue === '' || priceValue === undefined ? null : Number(priceValue);
    const stock = stockValue === '' || stockValue === undefined ? 0 : Number(stockValue);
    if (!expected.some(([value1, value2]) => value1 === option1Value && value2 === option2Value)) {
      throw new Error('Update product options before saving.');
    }
    const label = [option1Value, option2Value].filter(Boolean).join(' / ');
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      throw new Error(`Enter a valid price for ${label}.`);
    }
    if (!Number.isSafeInteger(stock) || stock < 0) {
      throw new Error(`Enter a whole-number stock quantity for ${label}.`);
    }
    return {
      id: JSON.stringify([option1Value, option2Value]),
      option1_name: names[0],
      option1_value: option1Value,
      option2_name: names[1],
      option2_value: option2Value,
      size: option1Value,
      color: option2Value,
      price,
      stock
    };
  });
  const result = {
    option1_name: names[0],
    option2_name: names[1],
    sizes: values[0],
    colors: values[1],
    variants
  };
  const totalStock = variants.reduce((total, variant) => total + variant.stock, 0);
  if (!Number.isSafeInteger(totalStock)) throw new Error('Total variant stock is too large.');
  result.stock = totalStock;
  return result;
}
