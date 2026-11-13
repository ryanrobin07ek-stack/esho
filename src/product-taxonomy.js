let taxonomyPromise;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

export function createProductTaxonomyFields({
  categoryId = '',
  categoryName = '',
  customCategory = '',
  attributes = []
} = {}) {
  return `<section class="product-taxonomy-picker" data-product-taxonomy
    data-initial-category-id="${escapeHtml(categoryId)}"
    data-initial-category-name="${escapeHtml(categoryName)}"
    data-initial-custom-category="${escapeHtml(customCategory)}"
    data-initial-attributes="${escapeHtml(JSON.stringify(attributes))}">
    <h3>Choose product category <span>(optional)</span></h3>
    <label>Search categories<input type="search" data-taxonomy-search autocomplete="off" maxlength="160" placeholder="Search, e.g. sneakers" disabled></label>
    <input type="hidden" name="taxonomyCategoryId" data-taxonomy-category-id value="${escapeHtml(categoryId)}">
    <input type="hidden" name="taxonomyCategoryName" data-taxonomy-category-name value="${escapeHtml(categoryName)}">
    <input type="hidden" name="taxonomyCustomCategory" data-taxonomy-custom-category value="${escapeHtml(customCategory)}">
    <div data-taxonomy-results role="listbox" aria-label="Matching product categories"></div>
    <div data-taxonomy-custom-offer></div>
    <div data-taxonomy-selected aria-live="polite"></div>
    <div data-taxonomy-attributes></div>
    <p data-taxonomy-status role="status" aria-live="polite">Loading product categories…</p>
  </section>`;
}

export async function loadProductTaxonomy() {
  if (!taxonomyPromise) {
    taxonomyPromise = (async () => {
      if (typeof DecompressionStream !== 'function') {
        throw new Error('This device cannot open the compressed product category file.');
      }
      const url = new URL('/data/shopify-product-taxonomy.json.gz', document.baseURI);
      const response = await fetch(url);
      let taxonomy;
      if (response.status === 404) {
        const packagedUrl = new URL('/data/shopify-product-taxonomy.json', document.baseURI);
        const packagedResponse = await fetch(packagedUrl);
        if (!packagedResponse.ok) {
          throw new Error(`Could not load product categories (${packagedResponse.status || 'no response'}).`);
        }
        taxonomy = await packagedResponse.json();
      } else {
        if (!response.ok || !response.body) {
          throw new Error(`Could not load product categories (${response.status || 'no response'}).`);
        }
        const decompressed = response.body.pipeThrough(new DecompressionStream('gzip'));
        taxonomy = await new Response(decompressed).json();
      }
      if (!taxonomy || !Array.isArray(taxonomy.categories) || !Array.isArray(taxonomy.attributes)) {
        throw new Error('The product category data has an invalid format.');
      }
      return taxonomy;
    })();
  }
  return taxonomyPromise;
}

function renderAttributeFields(container, category, attributesById, initialAttributes) {
  const initialById = new Map((Array.isArray(initialAttributes) ? initialAttributes : [])
    .map(attribute => [String(attribute.attributeId), attribute]));
  container.innerHTML = category.attributes.map(attributeId => {
    const attribute = attributesById.get(attributeId);
    if (!attribute) throw new Error(`Missing product attribute ${attributeId}.`);
    const initial = initialById.get(attributeId);
    const selectedValue = initial?.valueId || '';
    const field = attribute.values.length
      ? `<select data-taxonomy-attribute="${escapeHtml(attribute.id)}"
          data-taxonomy-attribute-name="${escapeHtml(attribute.name)}">
          <option value="">Not set</option>
          ${attribute.values.map(value => `<option value="${escapeHtml(value.id)}"
            data-value-name="${escapeHtml(value.name)}"
            ${value.id === selectedValue || (!selectedValue && value.name === initial?.value) ? 'selected' : ''}>
            ${escapeHtml(value.name)}
          </option>`).join('')}
        </select>`
      : `<input data-taxonomy-attribute="${escapeHtml(attribute.id)}"
          data-taxonomy-attribute-name="${escapeHtml(attribute.name)}"
          value="${escapeHtml(initial?.value || '')}">`;
    return `<label>${escapeHtml(attribute.name)}${field}</label>`;
  }).join('');
}

export function bindProductTaxonomyFields(root = document, taxonomyPromiseOverride) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const widgets = [
    ...(root.matches?.('[data-product-taxonomy]') ? [root] : []),
    ...root.querySelectorAll('[data-product-taxonomy]')
  ];
  if (!widgets.length) return;
  const dataPromise = taxonomyPromiseOverride || loadProductTaxonomy();

  for (const widget of widgets) {
    if (widget.dataset.taxonomyInitialized) continue;
    widget.dataset.taxonomyInitialized = 'loading';
    const search = widget.querySelector('[data-taxonomy-search]');
    const categoryInput = widget.querySelector('[data-taxonomy-category-id]');
    const categoryNameInput = widget.querySelector('[data-taxonomy-category-name]');
    const customCategoryInput = widget.querySelector('[data-taxonomy-custom-category]');
    const results = widget.querySelector('[data-taxonomy-results]');
    const customOffer = widget.querySelector('[data-taxonomy-custom-offer]');
    const selected = widget.querySelector('[data-taxonomy-selected]');
    const attributeFields = widget.querySelector('[data-taxonomy-attributes]');
    const status = widget.querySelector('[data-taxonomy-status]');
    if (!search || !categoryInput || !categoryNameInput || !customCategoryInput || !results || !customOffer || !selected || !attributeFields || !status) {
      throw new Error('The product category picker is missing required controls.');
    }

    let taxonomy;
    let categoriesById;
    let attributesById;
    let initialAttributes = [];
    try {
      initialAttributes = JSON.parse(widget.dataset.initialAttributes || '[]');
    } catch (error) {
      throw new Error('Saved product attributes could not be read.', { cause: error });
    }

    const renderMatches = () => {
      if (!taxonomy) return;
      const query = search.value.trim().toLocaleLowerCase();
      results.innerHTML = '';
      customOffer.innerHTML = '';
      if (query.length < 2) {
        status.textContent = 'Type at least two letters to search categories.';
        return;
      }
      const matches = taxonomy.categories.filter(category =>
        category.name.toLocaleLowerCase().includes(query)
        || category.fullName.toLocaleLowerCase().includes(query)
      ).slice(0, 30);
      if (matches.length) {
        status.textContent = `${matches.length === 30 ? 'Showing the first 30 matches.' : `${matches.length} matches.`} Choose the full category path.`;
        results.innerHTML = matches.map(category => `<button type="button" role="option"
        data-taxonomy-result="${escapeHtml(category.id)}">${escapeHtml(category.fullName)}</button>`).join('');
      } else {
        status.textContent = 'No standard category matches. You can add this as a custom category.';
      }
      customOffer.innerHTML = `<button type="button" data-taxonomy-add-custom>Add as custom: ${escapeHtml(search.value.trim())}</button>`;
    };

    const selectCategory = category => {
      categoryInput.value = category?.id || '';
      categoryNameInput.value = category?.fullName || '';
      customCategoryInput.value = '';
      search.value = category?.fullName || '';
      results.innerHTML = '';
      customOffer.innerHTML = '';
      selected.innerHTML = category
        ? `<span>${escapeHtml(category.fullName)}</span><button type="button" data-taxonomy-clear>Clear</button>`
        : '';
      attributeFields.innerHTML = '';
      if (category) renderAttributeFields(attributeFields, category, attributesById, initialAttributes);
      initialAttributes = [];
      status.textContent = category ? 'Set any applicable attributes; they are optional.' : 'Search by category name to choose a standard category.';
    };

    const selectCustomCategory = value => {
      const customCategory = String(value || '').trim().slice(0, 160);
      if (!customCategory) return;
      categoryInput.value = '';
      categoryNameInput.value = '';
      customCategoryInput.value = customCategory;
      search.value = '';
      results.innerHTML = '';
      customOffer.innerHTML = '';
      selected.innerHTML = `<span>Custom: ${escapeHtml(customCategory)}</span><button type="button" data-taxonomy-clear>Clear</button>`;
      attributeFields.innerHTML = '';
      initialAttributes = [];
      status.textContent = 'This custom category will be saved with the product.';
    };

    search.addEventListener('input', renderMatches);
    results.addEventListener('click', event => {
      const button = event.target.closest('[data-taxonomy-result]');
      if (!button) return;
      const category = categoriesById.get(button.dataset.taxonomyResult);
      if (category) selectCategory(category);
    });
    customOffer.addEventListener('click', event => {
      if (!event.target.closest('[data-taxonomy-add-custom]')) return;
      selectCustomCategory(search.value);
    });
    selected.addEventListener('click', event => {
      if (!event.target.closest('[data-taxonomy-clear]')) return;
      selectCategory(null);
      search.value = '';
      search.focus();
    });

    void dataPromise.then(data => {
      taxonomy = data;
      categoriesById = new Map(data.categories.map(category => [category.id, category]));
      attributesById = new Map(data.attributes.map(attribute => [attribute.id, attribute]));
      search.disabled = false;
      widget.dataset.taxonomyInitialized = 'true';
      const initialCategoryId = widget.dataset.initialCategoryId || '';
      if (initialCategoryId) {
        const category = categoriesById.get(initialCategoryId);
        if (!category) throw new Error(`Saved product category ${initialCategoryId} is no longer available.`);
        selectCategory(category);
      } else if (widget.dataset.initialCustomCategory) {
        selectCustomCategory(widget.dataset.initialCustomCategory);
      } else {
        status.textContent = 'Search by category name to choose a standard category.';
      }
    }).catch(error => {
      widget.dataset.taxonomyInitialized = 'error';
      status.textContent = error instanceof Error ? error.message : 'Product categories could not be loaded.';
      console.error('Product taxonomy could not be initialized.', error);
    });
  }
}

export function readProductTaxonomyFields(form) {
  const widget = form.querySelector('[data-product-taxonomy]');
  const categoryId = form.querySelector('[data-taxonomy-category-id]')?.value
    || (widget?.dataset.taxonomyInitialized !== 'true' ? widget?.dataset.initialCategoryId : '')
    || '';
  const categoryName = form.querySelector('[data-taxonomy-category-name]')?.value
    || (widget?.dataset.taxonomyInitialized !== 'true' ? widget?.dataset.initialCategoryName : '')
    || '';
  const customCategory = form.querySelector('[data-taxonomy-custom-category]')?.value
    || (widget?.dataset.taxonomyInitialized !== 'true' ? widget?.dataset.initialCustomCategory : '')
    || '';
  if (widget?.dataset.taxonomyInitialized !== 'true') {
    let attributes = [];
    try {
      attributes = JSON.parse(widget?.dataset.initialAttributes || '[]');
    } catch (error) {
      throw new Error('Saved product attributes could not be read.', { cause: error });
    }
    return { taxonomyCategoryId: categoryId, taxonomyCategoryName: categoryName, taxonomyCustomCategory: customCategory, taxonomyAttributes: attributes };
  }
  const attributes = [...form.querySelectorAll('[data-taxonomy-attribute]')].flatMap(field => {
    const value = field.value.trim();
    if (!value) return [];
    const selectedOption = field.tagName === 'SELECT' ? field.selectedOptions[0] : null;
    return [{
      attributeId: field.dataset.taxonomyAttribute,
      attributeName: field.dataset.taxonomyAttributeName,
      valueId: selectedOption?.value || null,
      value: selectedOption?.dataset.valueName || value
    }];
  });
  return { taxonomyCategoryId: categoryId, taxonomyCategoryName: categoryName, taxonomyCustomCategory: customCategory, taxonomyAttributes: attributes };
}
