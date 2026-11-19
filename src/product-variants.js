// Product options: the owner's own way of saying a product comes in sizes, colours, pack sizes or
// anything else. Two things changed here:
//
//  1. There used to be exactly two options, hardcoded as "option 1" and "option 2" (size and
//     colour under the covers). A shop selling a shirt in a size, a colour AND a fabric had
//     nowhere to put the third. Options are now a list, up to MAX_OPTIONS.
//  2. A value can carry its own price change. Before, the only way to charge more for Large was to
//     type a price into every combination it appeared in; with four options that is dozens of
//     boxes. Now "Large +200" is said once and every combination containing Large follows.
//
// Combinations still hold the stock, because stock is the one thing that has to be counted per
// actual thing on the shelf. The combination cap is what keeps that honest.
export const MAX_OPTIONS = 4;
export const MAX_VALUES_PER_OPTION = 20;
export const MAX_COMBINATIONS = 100;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

const money = amount => Math.round(Number(amount) * 100) / 100;

function uniqueValues(values) {
  const seen = new Set();
  return values.map(value => String(value ?? '').trim()).filter(value => {
    if (!value || seen.has(value.toLowerCase())) return false;
    seen.add(value.toLowerCase());
    return true;
  }).slice(0, MAX_VALUES_PER_OPTION).map(value => value.slice(0, 80)).filter(Boolean);
}

function parseValues(value, label) {
  const parts = String(value || '').split(',');
  if (parts.some(entry => entry.trim().length > 80)) {
    throw new Error(`${label} values must be 80 characters or fewer.`);
  }
  if (parts.filter(entry => entry.trim()).length > MAX_VALUES_PER_OPTION) {
    throw new Error(`${label} supports up to ${MAX_VALUES_PER_OPTION} values.`);
  }
  return uniqueValues(parts);
}

/** Reads one option's value off a saved variant, old shape or new. */
function variantOptionValue(variant, option) {
  const named = variant[`option${option}_value`];
  if (named !== undefined && named !== null) return String(named);
  if (option === 1 && variant.size !== undefined && variant.size !== null) return String(variant.size);
  if (option === 2 && variant.color !== undefined && variant.color !== null) return String(variant.color);
  return '';
}

/**
 * The options a saved product has, however it was saved: as an `options` list, as option1/option2
 * names with sizes/colors, or only as a set of variants. Keeping all three readable is what lets a
 * product saved last month open without losing anything.
 */
export function readSavedOptions({ options = [], variants = [], sizes = [], colors = [], option1Name = '', option2Name = '' } = {}) {
  const savedVariants = Array.isArray(variants) ? variants : [];
  if (Array.isArray(options) && options.length) {
    return options.slice(0, MAX_OPTIONS).map((option, index) => ({
      name: String(option?.name ?? option?.option_name ?? '').slice(0, 80) || `Option ${index + 1}`,
      values: (Array.isArray(option?.values) ? option.values : []).map(value => ({
        value: String(value?.value ?? value ?? '').slice(0, 80),
        priceDelta: money(Number(value?.priceDelta ?? value?.price_delta) || 0)
      })).filter(value => value.value).slice(0, MAX_VALUES_PER_OPTION)
    })).filter(option => option.values.length);
  }
  const legacy = [];
  for (let option = 1; option <= MAX_OPTIONS; option += 1) {
    const name = option === 1 ? option1Name : option === 2 ? option2Name : '';
    const fromVariants = savedVariants.map(variant => variantOptionValue(variant, option));
    const declared = option === 1 ? sizes : option === 2 ? colors : [];
    const values = uniqueValues((Array.isArray(declared) && declared.length ? declared : fromVariants));
    const variantName = String(savedVariants[0]?.[`option${option}_name`] || '').slice(0, 80);
    if (!values.length) continue;
    legacy.push({
      name: String(name || variantName || (option === 1 ? 'Size' : option === 2 ? 'Color' : `Option ${option}`)).slice(0, 80),
      values: values.map(value => ({ value, priceDelta: 0 }))
    });
  }
  return legacy;
}

export function createProductVariantFields(saved = {}) {
  const options = readSavedOptions(saved);
  const savedVariants = Array.isArray(saved.variants) ? saved.variants : [];
  return `<section class="product-variant-fields product-variants" data-product-variants data-product-variant-fields
      data-initial-options="${escapeHtml(JSON.stringify(options))}"
      data-initial-variants="${escapeHtml(JSON.stringify(savedVariants))}">
    <h3>Product options <span>(optional)</span></h3>
    <p>Use any option that fits the product, such as size, colour, pack size, flavour or material.
      Give a value its own price change and every combination with it follows. Leave this empty for a
      product with no options.</p>
    <div data-variant-options></div>
    <button type="button" class="btn-secondary" data-variant-add-option>Add an option</button>
    <p data-variant-status role="status" aria-live="polite"></p>
    <div data-variant-rows></div>
  </section>`;
}

export function bindProductVariantFields(widget) {
  if (!widget) throw new Error('Product option fields are required.');
  const optionsHost = widget.querySelector('[data-variant-options]');
  const addOption = widget.querySelector('[data-variant-add-option]');
  const status = widget.querySelector('[data-variant-status]');
  const rows = widget.querySelector('[data-variant-rows]');
  if (!optionsHost || !addOption || !status || !rows) {
    throw new Error('The product option editor is missing required controls.');
  }
  const document = widget.ownerDocument;

  let options = [];
  let savedVariants = [];
  try {
    options = JSON.parse(widget.dataset.initialOptions || '[]');
    savedVariants = JSON.parse(widget.dataset.initialVariants || '[]');
  } catch {
    throw new Error('Saved product options could not be read.');
  }
  if (!Array.isArray(options) || !Array.isArray(savedVariants)) {
    throw new Error('Saved product options must be a list.');
  }

  const variantKey = values => JSON.stringify(values);
  const savedByKey = new Map(savedVariants.map(variant => {
    const values = [];
    for (let option = 1; option <= MAX_OPTIONS; option += 1) values.push(variantOptionValue(variant, option));
    while (values.length > 2 && values[values.length - 1] === '') values.pop();
    return [variantKey(values), variant];
  }));

  const updateStockControl = hasVariants => {
    const stockInput = widget.closest('form')?.querySelector('[name="stock"]');
    if (!stockInput) return;
    stockInput.disabled = hasVariants;
    const stockLabel = stockInput.closest('label');
    if (stockLabel && stockLabel.firstChild) {
      stockLabel.firstChild.textContent = hasVariants ? 'Stock is set per variant ' : 'Stock ';
    }
  };

  // Read the boxes back into state before anything that re-renders, so typing is never lost.
  const capture = () => {
    options = [...optionsHost.querySelectorAll('[data-variant-option]')].map(block => ({
      name: block.querySelector('[data-variant-option-name]')?.value.trim().slice(0, 80) || '',
      valuesText: block.querySelector('[data-variant-option-values]')?.value || '',
      prices: new Map([...block.querySelectorAll('[data-variant-value-price]')]
        .map(input => [input.dataset.variantValuePrice, input.value]))
    })).map(block => {
      const values = parseValues(block.valuesText, block.name || 'Option');
      return {
        name: block.name,
        values: values.map(value => ({
          value,
          priceDelta: money(Number(block.prices.get(value) ?? 0) || 0)
        }))
      };
    });
  };

  const valuePricesMarkup = option => (option.values.length ? `<div class="product-variant-value-prices">
        <span>Price change per value (optional)</span>
        ${option.values.map(value => `<label><span>${escapeHtml(value.value)}</span>
          <input type="number" step="0.01" data-variant-value-price="${escapeHtml(value.value)}"
            value="${escapeHtml(String(value.priceDelta || 0))}" inputmode="decimal"></label>`).join('')}
      </div>` : '');

  // The name and values boxes are only built when an option is added or removed. Rebuilding them
  // on every update replaced the box under the owner's finger: finish typing a name, tap the
  // values box, and it vanished and the keyboard closed. Updates now only redraw the price rows.
  const renderOptionBlocks = () => {
    const blocks = [...optionsHost.querySelectorAll('[data-variant-option]')];
    if (blocks.length === options.length) {
      blocks.forEach((block, index) => {
        block.querySelector('.product-variant-value-prices')?.remove();
        const markup = valuePricesMarkup(options[index]);
        if (markup) block.querySelector('.form-grid')?.insertAdjacentHTML('afterend', markup);
      });
      addOption.disabled = options.length >= MAX_OPTIONS;
      return;
    }
    optionsHost.innerHTML = options.map((option, index) => `<div class="product-variant-option" data-variant-option="${index}">
      <div class="form-grid">
        <label>Option ${index + 1} name<input type="text" data-variant-option-name maxlength="80"
          value="${escapeHtml(option.name)}" placeholder="e.g. Pack size"></label>
        <label>Option ${index + 1} values<input type="text" data-variant-option-values maxlength="1000"
          value="${escapeHtml(option.values.map(value => value.value).join(', '))}" placeholder="e.g. 250 g, 500 g"></label>
      </div>
      ${valuePricesMarkup(option)}
      <button type="button" class="btn-secondary" data-variant-remove-option>Remove this option</button>
    </div>`).join('');
    addOption.disabled = options.length >= MAX_OPTIONS;
  };

  const render = () => {
    renderOptionBlocks();
    rows.replaceChildren();
    const usable = options.filter(option => option.name && option.values.length);
    for (const option of options) {
      if (option.name && !option.values.length) {
        status.textContent = `Enter values for ${option.name} or remove the option.`;
        updateStockControl(false);
        return;
      }
      if (option.values.length && !option.name) {
        status.textContent = 'Name every option before adding its values.';
        updateStockControl(false);
        return;
      }
    }
    if (!usable.length) {
      status.textContent = 'Add an option name and its values to create product variants.';
      updateStockControl(false);
      return;
    }

    let combinations = [[]];
    for (const option of usable) {
      combinations = combinations.flatMap(prefix => option.values.map(value => [...prefix, value.value]));
    }
    if (combinations.length > MAX_COMBINATIONS) {
      status.textContent = `${combinations.length} combinations is more than the ${MAX_COMBINATIONS} allowed. Remove an option or some values.`;
      updateStockControl(false);
      return;
    }

    const deltaFor = values => money(values.reduce((total, value, index) =>
      total + (usable[index].values.find(option => option.value === value)?.priceDelta || 0), 0));
    const basePrice = Number(widget.closest('form')?.querySelector('[name="price"]')?.value) || 0;

    for (const values of combinations) {
      const padded = values.slice();
      while (padded.length < 2) padded.push('');
      const current = savedByKey.get(variantKey(padded)) || {};
      const row = document.createElement('div');
      row.className = 'product-variant-row';
      row.dataset.variantRow = '';
      values.forEach((value, index) => { row.dataset[`option${index + 1}Value`] = value; });
      // The first two keep their old names so a saved product still matches.
      row.dataset.size = values[0] ?? '';
      row.dataset.color = values[1] ?? '';
      const delta = deltaFor(values);
      const suggested = current.price ?? (delta ? money(basePrice + delta) : '');
      const labels = values.map((value, index) => `${usable[index].name}: ${value}`);
      row.innerHTML = `<strong>${escapeHtml(labels.join(' · '))}</strong>
        <label>Price<input type="number" min="0" step="0.01" data-variant-price
          value="${escapeHtml(suggested === '' ? '' : String(suggested))}"
          placeholder="${escapeHtml(basePrice ? String(money(basePrice + delta)) : 'Price')}"></label>
        <label>Stock<input type="number" min="0" step="1" data-variant-stock value="${escapeHtml(current.stock ?? 0)}"></label>`;
      rows.append(row);
    }

    status.textContent = `${combinations.length} product variant${combinations.length === 1 ? '' : 's'}; price and stock can be set for each.`;
    updateStockControl(true);
  };

  const safeRender = () => {
    try {
      render();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Product options could not be updated.';
    }
  };

  addOption.addEventListener('click', () => {
    try {
      capture();
    } catch {
      // Keep whatever is already in state: a half-typed value list must not block adding an option.
    }
    if (options.length >= MAX_OPTIONS) return;
    options.push({ name: '', values: [] });
    safeRender();
  });

  optionsHost.addEventListener('click', event => {
    const target = typeof event.target?.closest === 'function' ? event.target : null;
    if (!target?.closest('[data-variant-remove-option]')) return;
    const block = target.closest('[data-variant-option]');
    try {
      capture();
    } catch {
      // As above: removing an option must always work.
    }
    options.splice(Number(block.dataset.variantOption), 1);
    safeRender();
  });

  // The price boxes used to appear only on "change", which a text box fires when it loses focus.
  // An owner typing "S, M, L" and looking for where to put prices saw nothing at all. Now they
  // appear once typing pauses, and the cursor is put back where it was.
  let typingTimer;
  optionsHost.addEventListener('input', event => {
    const target = typeof event.target?.matches === 'function' ? event.target : null;
    // Only the values box: re-drawing while the name is typed would drop the keyboard for nothing.
    if (!target?.matches('[data-variant-option-values]')) return;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      if (document.activeElement !== target) return;
      const index = Number(target.closest('[data-variant-option]')?.dataset.variantOption);
      const selector = target.matches('[data-variant-option-values]')
        ? '[data-variant-option-values]'
        : '[data-variant-option-name]';
      const caret = target.selectionStart;
      try {
        capture();
        render();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Product options could not be updated.';
        return;
      }
      const again = optionsHost.querySelectorAll('[data-variant-option]')[index]?.querySelector(selector);
      if (again) {
        again.focus();
        try { again.setSelectionRange(caret, caret); } catch { /* not every input type supports it */ }
      }
    }, 600);
  });

  optionsHost.addEventListener('change', () => {
    try {
      capture();
      render();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Product options could not be updated.';
    }
  });

  // A product with no options still shows one empty block, so the owner sees where to type instead
  // of having to discover the "Add an option" button first.
  if (!options.length) options = [{ name: '', values: [] }];
  safeRender();
}

export function readProductVariantFields(widget) {
  if (!widget) throw new Error('Product option fields are required.');
  const blocks = [...widget.querySelectorAll('[data-variant-option]')];
  const options = blocks.map((block, index) => {
    const name = block.querySelector('[data-variant-option-name]')?.value.trim().slice(0, 80) || '';
    const values = parseValues(block.querySelector('[data-variant-option-values]')?.value || '', name || `Option ${index + 1}`);
    if (Boolean(name) !== Boolean(values.length)) {
      throw new Error(`Provide both a name and values for option ${index + 1}, or remove it.`);
    }
    const priceByValue = new Map([...block.querySelectorAll('[data-variant-value-price]')]
      .map(input => [input.dataset.variantValuePrice, input.value]));
    return {
      name,
      values: values.map(value => {
        const raw = priceByValue.get(value);
        const priceDelta = raw === '' || raw === undefined ? 0 : Number(raw);
        if (!Number.isFinite(priceDelta)) throw new Error(`Enter a valid price change for ${name}: ${value}.`);
        return { value, priceDelta: money(priceDelta) };
      })
    };
  }).filter(option => option.name && option.values.length);

  const variantRows = [...widget.querySelectorAll('[data-variant-row]')];
  if (!options.length) {
    if (variantRows.length) throw new Error('Clear product option rows before saving without options.');
    return { sizes: [], colors: [], options: [], variants: [] };
  }

  let expected = [[]];
  for (const option of options) {
    expected = expected.flatMap(prefix => option.values.map(value => [...prefix, value.value]));
  }
  if (expected.length > MAX_COMBINATIONS) throw new Error(`A product can have up to ${MAX_COMBINATIONS} option combinations.`);
  if (variantRows.length !== expected.length) throw new Error('Update product options before saving.');

  const variants = variantRows.map(row => {
    const values = options.map((_, index) => row.dataset[`option${index + 1}Value`] ?? '');
    const label = values.filter(Boolean).join(' / ');
    if (!expected.some(candidate => candidate.every((value, index) => value === values[index]))) {
      throw new Error('Update product options before saving.');
    }
    const priceValue = row.querySelector('[data-variant-price]')?.value;
    const stockValue = row.querySelector('[data-variant-stock]')?.value;
    const price = priceValue === '' || priceValue === undefined ? null : Number(priceValue);
    const stock = stockValue === '' || stockValue === undefined ? 0 : Number(stockValue);
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error(`Enter a valid price for ${label}.`);
    if (!Number.isSafeInteger(stock) || stock < 0) throw new Error(`Enter a whole-number stock quantity for ${label}.`);
    const padded = values.slice();
    while (padded.length < 2) padded.push('');
    const variant = { id: JSON.stringify(padded), price, stock };
    options.forEach((option, index) => {
      variant[`option${index + 1}_name`] = option.name;
      variant[`option${index + 1}_value`] = values[index];
    });
    // The first two also keep their old names, so storefronts and tills built on them still match.
    variant.size = values[0] ?? '';
    variant.color = values[1] ?? '';
    return variant;
  });

  const result = {
    options,
    option1_name: options[0]?.name || '',
    option2_name: options[1]?.name || '',
    sizes: options[0]?.values.map(value => value.value) || [],
    colors: options[1]?.values.map(value => value.value) || [],
    variants
  };
  const totalStock = variants.reduce((total, variant) => total + variant.stock, 0);
  if (!Number.isSafeInteger(totalStock)) throw new Error('Total variant stock is too large.');
  result.stock = totalStock;
  return result;
}
