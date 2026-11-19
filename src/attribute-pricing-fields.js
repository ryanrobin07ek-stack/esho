// The owner's editor for charging by attribute. It deliberately does not list every value of every
// attribute: Shoes carries 17 attributes and Color alone has hundreds of values, so rendering them
// all would be unusable on a phone. The owner adds only the choices they actually sell.
//
// The candidate attributes come from the taxonomy picker already on the form, so the two cannot
// drift apart: if a product is a shoe, the priced attributes are the shoe's attributes.
import {
  MAX_PRICED_ATTRIBUTES,
  MAX_PRICED_VALUES,
  normalizePricedAttributes
} from './attribute-pricing.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export function createAttributePricingFields({ pricedAttributes = [] } = {}) {
  const saved = Array.isArray(pricedAttributes) ? pricedAttributes : [];
  return `<section class="attribute-pricing-fields" data-attribute-pricing
      data-initial-priced-attributes="${escapeHtml(JSON.stringify(saved))}">
    <h3>Charge by attribute <span>(optional)</span></h3>
    <p>Charge more or less for a choice, such as Leather instead of Canvas. The price on the website
      and at the till changes as the choice is made. These choices do not hold stock; use Product
      options for anything you count.</p>
    <div data-attribute-pricing-rows></div>
    <button type="button" class="btn-secondary" data-attribute-pricing-add>Add a priced attribute</button>
    <p data-attribute-pricing-status role="status" aria-live="polite"></p>
  </section>`;
}

/**
 * @param widget the section created above.
 * @param getAttributes returns the attributes the product could charge for, as
 *   [{ attributeId, attributeName, values: [{ valueId, value }] }]. Called on every render so a
 *   change of category immediately offers that category's attributes.
 */
export function bindAttributePricingFields(widget, getAttributes) {
  if (!widget) throw new Error('Attribute pricing fields are required.');
  if (widget.dataset.attributePricingBound === 'true') return;
  widget.dataset.attributePricingBound = 'true';
  const rowsHost = widget.querySelector('[data-attribute-pricing-rows]');
  const addButton = widget.querySelector('[data-attribute-pricing-add]');
  const status = widget.querySelector('[data-attribute-pricing-status]');
  if (!rowsHost || !addButton || !status) {
    throw new Error('The attribute pricing editor is missing required controls.');
  }
  const document = widget.ownerDocument;
  const available = () => {
    try {
      const list = typeof getAttributes === 'function' ? getAttributes() : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  let state = [];
  try {
    state = normalizePricedAttributes(JSON.parse(widget.dataset.initialPricedAttributes || '[]'));
  } catch {
    // A saved product with unreadable pricing still opens; the owner simply starts again.
    state = [];
  }

  const optionList = (choices, selected) => choices.map(choice =>
    `<option value="${escapeHtml(choice)}" ${choice === selected ? 'selected' : ''}>${escapeHtml(choice)}</option>`
  ).join('');

  const render = () => {
    const attributes = available();
    if (!attributes.length && !state.length) {
      rowsHost.innerHTML = '';
      addButton.disabled = true;
      status.textContent = 'Choose a category above first, then its attributes can be priced.';
      return;
    }
    addButton.disabled = state.length >= MAX_PRICED_ATTRIBUTES;
    const names = attributes.map(attribute => attribute.attributeName);
    rowsHost.innerHTML = state.map((entry, index) => {
      const match = attributes.find(attribute => attribute.attributeName === entry.attributeName);
      const valueChoices = match ? match.values.map(value => value.value) : [];
      const offered = valueChoices.length ? valueChoices : entry.values.map(value => value.value);
      return `<div class="attribute-pricing-row" data-priced-attribute="${index}"
          data-priced-attribute-id="${escapeHtml(entry.attributeId)}">
        <label><span>Attribute</span><select data-priced-attribute-name>
          ${optionList(names.length ? names : [entry.attributeName], entry.attributeName)}
        </select></label>
        <div data-priced-values>
          ${entry.values.map((value, valueIndex) => `<div class="attribute-pricing-value" data-priced-value="${valueIndex}">
            <label><span>Choice</span><select data-priced-value-name>
              ${optionList(offered.length ? offered : [value.value], value.value)}
            </select></label>
            <label><span>Price change</span><input type="number" step="0.01" data-priced-value-delta
              value="${escapeHtml(String(value.priceDelta))}" inputmode="decimal"></label>
            <button type="button" class="btn-secondary" data-priced-value-remove>Remove choice</button>
          </div>`).join('')}
        </div>
        <div class="attribute-pricing-row-actions">
          <button type="button" class="btn-secondary" data-priced-value-add
            ${entry.values.length >= MAX_PRICED_VALUES ? 'disabled' : ''}>Add a choice</button>
          <button type="button" class="btn-secondary" data-priced-attribute-remove>Remove attribute</button>
        </div>
      </div>`;
    }).join('');
    status.textContent = state.length
      ? 'The price changes by these amounts when the choice is made.'
      : 'No attribute is priced. The product sells at its own price.';
  };

  // Read the boxes back into state before any change that re-renders, so typed prices survive.
  const capture = () => {
    state = [...rowsHost.querySelectorAll('[data-priced-attribute]')].map(row => {
      const attributeName = row.querySelector('[data-priced-attribute-name]')?.value || '';
      const match = available().find(attribute => attribute.attributeName === attributeName);
      return {
        attributeId: match?.attributeId || '',
        attributeName,
        values: [...row.querySelectorAll('[data-priced-value]')].map(valueRow => {
          const value = valueRow.querySelector('[data-priced-value-name]')?.value || '';
          return {
            valueId: match?.values.find(option => option.value === value)?.valueId || '',
            value,
            priceDelta: valueRow.querySelector('[data-priced-value-delta]')?.value ?? 0
          };
        })
      };
    });
  };

  addButton.addEventListener('click', () => {
    capture();
    const attributes = available();
    const used = new Set(state.map(entry => entry.attributeName));
    const next = attributes.find(attribute => !used.has(attribute.attributeName));
    if (!next) {
      status.textContent = 'Every attribute of this category is already priced.';
      return;
    }
    state.push({
      attributeId: next.attributeId,
      attributeName: next.attributeName,
      values: next.values.slice(0, 1).map(value => ({ valueId: value.valueId, value: value.value, priceDelta: 0 }))
    });
    render();
  });

  rowsHost.addEventListener('click', event => {
    // Duck-typed on purpose: this module is also imported straight into Node by the tests, where
    // there is no global Element to compare against.
    const target = typeof event.target?.closest === 'function' ? event.target : null;
    if (!target) return;
    const row = target.closest('[data-priced-attribute]');
    if (!row) return;
    const index = Number(row.dataset.pricedAttribute);
    if (target.closest('[data-priced-attribute-remove]')) {
      capture();
      state.splice(index, 1);
      render();
      return;
    }
    if (target.closest('[data-priced-value-remove]')) {
      capture();
      const valueIndex = Number(target.closest('[data-priced-value]').dataset.pricedValue);
      state[index].values.splice(valueIndex, 1);
      // An attribute with no choices is not priced at all.
      if (!state[index].values.length) state.splice(index, 1);
      render();
      return;
    }
    if (target.closest('[data-priced-value-add]')) {
      capture();
      const entry = state[index];
      const match = available().find(attribute => attribute.attributeName === entry.attributeName);
      const used = new Set(entry.values.map(value => value.value));
      const next = (match?.values || []).find(value => !used.has(value.value));
      if (!next) {
        status.textContent = `Every choice of ${entry.attributeName} is already listed.`;
        return;
      }
      entry.values.push({ valueId: next.valueId, value: next.value, priceDelta: 0 });
      render();
    }
  });

  rowsHost.addEventListener('change', event => {
    const target = typeof event.target?.closest === 'function' ? event.target : null;
    if (!target) return;
    // Switching the attribute changes which choices apply, so the row is rebuilt.
    if (target.closest('[data-priced-attribute-name]')) {
      capture();
      const row = target.closest('[data-priced-attribute]');
      const index = Number(row.dataset.pricedAttribute);
      const entry = state[index];
      const match = available().find(attribute => attribute.attributeName === entry.attributeName);
      entry.values = (match?.values || []).slice(0, 1)
        .map(value => ({ valueId: value.valueId, value: value.value, priceDelta: 0 }));
      render();
    }
  });

  widget.refreshAttributePricing = render;
  render();
}

export function readAttributePricingFields(widget) {
  if (!widget) return [];
  const rows = [...widget.querySelectorAll('[data-priced-attribute]')];
  if (!rows.length) {
    // An untouched editor must not wipe what was saved before it had a category to work with.
    if (widget.dataset.attributePricingBound !== 'true') {
      try {
        return normalizePricedAttributes(JSON.parse(widget.dataset.initialPricedAttributes || '[]'));
      } catch {
        return [];
      }
    }
    return [];
  }
  return normalizePricedAttributes(rows.map(row => ({
    attributeId: row.dataset.pricedAttributeId || '',
    attributeName: row.querySelector('[data-priced-attribute-name]')?.value || '',
    values: [...row.querySelectorAll('[data-priced-value]')].map(valueRow => ({
      value: valueRow.querySelector('[data-priced-value-name]')?.value || '',
      priceDelta: valueRow.querySelector('[data-priced-value-delta]')?.value ?? 0
    }))
  })));
}
