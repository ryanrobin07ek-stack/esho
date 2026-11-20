let taxonomyPromise;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

function normalizeCategoryText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

const taxonomySearchCache = new WeakMap();

// Normalized text is space separated, so a whole-word test is a padded substring test.
const containsWord = (value, query) => ` ${value} `.includes(` ${query} `);

export function searchProductTaxonomyCategories(categories, query, limit = 30) {
  const normalizedQuery = normalizeCategoryText(query);
  if (!normalizedQuery || !Array.isArray(categories) || !Number.isSafeInteger(limit) || limit < 1) return [];
  const queryParts = normalizedQuery.split(/\s+/);
  let entries = taxonomySearchCache.get(categories);
  if (!entries) {
    entries = categories.map(category => ({
      category,
      name: normalizeCategoryText(category.name),
      path: String(category.fullName || '').split('>').map(normalizeCategoryText)
    }));
    taxonomySearchCache.set(categories, entries);
  }
  return entries.map(entry => {
    const { category, name, path } = entry;
    const searchable = [name, ...path];
    if (!queryParts.every(part => searchable.some(value => value.includes(part)))) return null;
    // A whole word beats a word that merely contains the query: searching "phones" must offer
    // Mobile Phones before Mellophones, and "shoes" must not land on Hoes.
    const score = name === normalizedQuery ? 1000
      : name.startsWith(normalizedQuery) ? 900
        : path.some(value => value === normalizedQuery) ? 850
          : containsWord(name, normalizedQuery) ? 800
            : name.includes(normalizedQuery) ? 750
              : path.some(value => value.startsWith(normalizedQuery)) ? 650
                : path.some(value => containsWord(value, normalizedQuery)) ? 600
                  : 500;
    return { category, score };
  }).filter(Boolean)
    .sort((left, right) => right.score - left.score
      || left.category.fullName.split('>').length - right.category.fullName.split('>').length
      || left.category.name.length - right.category.name.length
      || left.category.fullName.localeCompare(right.category.fullName))
    .slice(0, limit)
    .map(result => result.category);
}

export function matchProductTaxonomyCategory(categories, categoryName) {
  const normalizedName = normalizeCategoryText(categoryName);
  if (!normalizedName || !Array.isArray(categories)) return null;
  // Both scans normalised all 14,606 names on every call. Opening a product form did that twice
  // before it drew anything, which is most of where the form's delay came from.
  const names = normalizedNames(categories);
  const paths = normalizedFullNames(categories);
  const exactIndex = paths.indexOf(normalizedName);
  if (exactIndex >= 0) return categories[exactIndex];
  return categories.filter((category, index) => names[index] === normalizedName)
    .sort((left, right) => left.fullName.split('>').length - right.fullName.split('>').length
      || left.fullName.localeCompare(right.fullName))[0] || null;
}

// Shop owners name their categories the way they speak: "used shoes", "mens leather jackets".
// An exact match finds none of those, and the search needs every word to appear, so "used" alone
// used to leave the product with no attributes at all. English puts the head noun last, so drop
// the describing words from the front until what is left names a real standard category.
export function findClosestProductTaxonomyCategory(categories, categoryName) {
  const exact = matchProductTaxonomyCategory(categories, categoryName);
  if (exact) return exact;
  const normalized = normalizeCategoryText(categoryName);
  if (!normalized || !Array.isArray(categories)) return null;
  const words = normalized.split(/\s+/).filter(Boolean);
  for (let start = 0; start < words.length; start += 1) {
    const match = bestNameMatch(categories, words.slice(start).join(' '));
    if (match) return match;
  }
  return null;
}

/**
 * One pass over the categories, scoring on the name only, keeping nothing.
 *
 * This deliberately does NOT use searchProductTaxonomyCategories: that builds and keeps a normalised
 * index of all 14,606 categories, which is the right trade when the owner is typing in the search
 * box but pure waste when all we need is to match a name a product was saved with. Building it on
 * every product form was enough extra memory to get the app killed on a phone with little free RAM.
 */
// Normalising 14,606 names on every call cost 62 ms each time, every time, because it kept nothing.
// The names alone are a fraction of the full search index (which also splits every path), so they
// are worth keeping: the cost is paid once and the match drops to a plain string comparison.
const normalizedNameCache = new WeakMap();
const normalizedFullNameCache = new WeakMap();

const cachedBy = (cache, categories, read) => {
  let values = cache.get(categories);
  if (!values) {
    values = categories.map(read);
    cache.set(categories, values);
  }
  return values;
};

function normalizedNames(categories) {
  return cachedBy(normalizedNameCache, categories, category => normalizeCategoryText(category.name));
}

function normalizedFullNames(categories) {
  return cachedBy(normalizedFullNameCache, categories, category => normalizeCategoryText(category.fullName));
}

function bestNameMatch(categories, phrase) {
  const query = normalizeCategoryText(phrase);
  if (!query) return null;
  const names = normalizedNames(categories);
  let best = null;
  let bestScore = 0;
  let bestDepth = Infinity;
  for (let index = 0; index < categories.length; index += 1) {
    const category = categories[index];
    const name = names[index];
    const score = name === query ? 1000
      : name.startsWith(query) ? 900
        : containsWord(name, query) ? 800
          : name.includes(query) ? 750
            : 0;
    if (!score) continue;
    const depth = String(category.fullName || '').split('>').length;
    if (score > bestScore || (score === bestScore && depth < bestDepth)) {
      best = category;
      bestScore = score;
      bestDepth = depth;
    }
  }
  return best;
}

export function createProductTaxonomyFields({
  categoryId = '',
  categoryName = '',
  customCategory = '',
  attributes = [],
  storeCategories = [],
  // '' means the host form already has its own category select: the picker then renders one that is
  // never submitted, so two selects can no longer collide under the same name and block every save.
  storeCategoryFieldName = 'categoryId',
  storeCategoryValue = ''
} = {}) {
  const categoryOptions = storeCategories.map(category =>
    `<option value="${escapeHtml(category.value)}" ${String(category.value) === String(storeCategoryValue) ? 'selected' : ''}>${escapeHtml(category.name)}</option>`
  ).join('');
  return `<section class="product-taxonomy-picker" data-product-taxonomy
    data-initial-category-id="${escapeHtml(categoryId)}"
    data-initial-category-name="${escapeHtml(categoryName)}"
    data-initial-custom-category="${escapeHtml(customCategory)}"
    data-initial-attributes="${escapeHtml(JSON.stringify(attributes))}">
    ${storeCategoryFieldName ? '<span class="product-category-heading">Category</span>' : ''}
    <div class="product-category-pill">
      ${storeCategoryFieldName ? `<label><select aria-label="Category" name="${escapeHtml(storeCategoryFieldName)}" data-store-category-select>
        <option value="">Choose a category</option>${categoryOptions}
      </select></label>` : ''}
      <button type="button" data-taxonomy-add-open>Add</button>
      ${storeCategoryFieldName ? '<button type="button" data-taxonomy-type-open>Attributes</button>' : ''}
    </div>
    <div class="product-taxonomy-add-panel" data-taxonomy-add-panel hidden>
      <strong data-taxonomy-type-title hidden>What type of product is this?</strong>
      <label><input type="search" data-taxonomy-search aria-label="Search all categories"
        autocomplete="off" maxlength="160" placeholder="Search, e.g. shoes"></label>
      <div class="product-taxonomy-add-actions">
        <button type="button" data-taxonomy-add-manually>Enter manually</button>
        <button type="button" data-taxonomy-add-close>Close</button>
      </div>
    </div>
    <input type="hidden" name="taxonomyCategoryId" data-taxonomy-category-id value="${escapeHtml(categoryId)}">
    <input type="hidden" name="taxonomyCategoryName" data-taxonomy-category-name value="${escapeHtml(categoryName)}">
    <input type="hidden" name="taxonomyCustomCategory" data-taxonomy-custom-category value="${escapeHtml(customCategory)}">
    <div data-taxonomy-results role="listbox" aria-label="Matching product categories"></div>
    <div data-taxonomy-custom-offer></div>
    <div data-taxonomy-selected aria-live="polite"></div>
    <div data-taxonomy-attributes></div>
    <p data-taxonomy-status role="status" aria-live="polite">Choose a category or add your own. Standard matches load when needed.</p>
    <button class="btn-secondary" type="button" data-taxonomy-retry hidden>Retry loading categories</button>
  </section>`;
}

// The bundle hands the taxonomy over as a base64 string on a global. Decoding it to bytes once and
// dropping the string frees that copy, and keeping the bytes is what lets the taxonomy be released
// and decoded again later: deleting the string outright would leave nothing to decode from, so the
// first product form opened after the web builder would have no categories at all.
let compressedBytes;

function compressedTaxonomyBytes() {
  if (compressedBytes) return compressedBytes;
  const encoded = globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__;
  if (typeof encoded !== 'string' || !encoded) {
    throw new Error('The offline product category data is missing from this app build.');
  }
  const binary = atob(encoded);
  compressedBytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  try {
    delete globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__;
  } catch {
    globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__ = '';
  }
  return compressedBytes;
}

export async function loadProductTaxonomy() {
  if (!taxonomyPromise) {
    const pending = (async () => {
      if (typeof DecompressionStream !== 'function') {
        throw new Error('This device cannot open the compressed product category file.');
      }
      const bytes = compressedTaxonomyBytes();
      const decompressed = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const taxonomy = await new Response(decompressed).json();
      if (!taxonomy || !Array.isArray(taxonomy.categories) || !Array.isArray(taxonomy.attributes)) {
        throw new Error('The product category data has an invalid format.');
      }
      return taxonomy;
    })();
    taxonomyPromise = pending.catch(error => {
      taxonomyPromise = undefined;
      throw error;
    });
  }
  return taxonomyPromise;
}

/**
 * Drops the decoded taxonomy so the ~40 MB of live objects behind it can be collected. Called before
 * opening the web builder, which needs none of it and is where the app ran out of memory. The next
 * product form decodes it again from the bundled file; nothing is lost but the decode time.
 *
 * The search index is a WeakMap keyed by the categories array, so it goes with it.
 */
export function releaseProductTaxonomy() {
  taxonomyPromise = undefined;
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

export function bindProductTaxonomyFields(root = document, taxonomyPromiseOverride, { onCategoryCreate } = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const widgets = [
    ...(root.matches?.('[data-product-taxonomy]') ? [root] : []),
    ...root.querySelectorAll('[data-product-taxonomy]')
  ];
  if (!widgets.length) return;

  for (const widget of widgets) {
    if (widget.dataset.taxonomyInitialized) continue;
    widget.dataset.taxonomyInitialized = 'idle';
    const search = widget.querySelector('[data-taxonomy-search]');
    const categoryInput = widget.querySelector('[data-taxonomy-category-id]');
    const categoryNameInput = widget.querySelector('[data-taxonomy-category-name]');
    const customCategoryInput = widget.querySelector('[data-taxonomy-custom-category]');
    const results = widget.querySelector('[data-taxonomy-results]');
    const customOffer = widget.querySelector('[data-taxonomy-custom-offer]');
    const selected = widget.querySelector('[data-taxonomy-selected]');
    const attributeFields = widget.querySelector('[data-taxonomy-attributes]');
    const status = widget.querySelector('[data-taxonomy-status]');
    const retry = widget.querySelector('[data-taxonomy-retry]');
    const storeCategorySelect = widget.closest('form')?.querySelector('[data-store-category-select]');
    const addPanel = widget.querySelector('[data-taxonomy-add-panel]');
    const addOpen = widget.querySelector('[data-taxonomy-add-open]');
    const addClose = widget.querySelector('[data-taxonomy-add-close]');
    const addManually = widget.querySelector('[data-taxonomy-add-manually]');
    // "Attributes": when the shop's own category ("Women") is not a product type, the owner may say
    // what the product is ("Shoes") to get its attributes, and the shop category stays as it is.
    const typeOpen = widget.querySelector('[data-taxonomy-type-open]');
    const typeTitle = widget.querySelector('[data-taxonomy-type-title]');
    let pickMode = 'add';
    if (!search || !categoryInput || !categoryNameInput || !customCategoryInput || !results || !customOffer || !selected || !attributeFields || !status) {
      throw new Error('The product category picker is missing required controls.');
    }
    const stockField = widget.closest('form')?.querySelector('[name="stock"]')?.closest('label');
    if (stockField && attributeFields.parentElement === widget) {
      // The section is inserted outside the widget, so a form that re-renders leaves the old one
      // behind and the owner sees "Attributes" twice. Clear any previous one first.
      widget.closest("form")?.querySelectorAll(".product-taxonomy-attributes").forEach(old => old.remove());
      const section = widget.ownerDocument.createElement('section');
      section.className = 'product-taxonomy-attributes';
      const heading = widget.ownerDocument.createElement('h3');
      heading.textContent = 'Attributes';
      section.append(heading, attributeFields);
      stockField.insertAdjacentElement('afterend', section);
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

    // Anything that depends on which attributes a category offers — the attribute pricing editor —
    // is told the moment they change, instead of being re-rendered on a guess.
    const announceChange = () => {
      const view = widget.ownerDocument?.defaultView;
      if (typeof view?.CustomEvent !== 'function') return;
      widget.dispatchEvent(new view.CustomEvent('product-taxonomy-change', { bubbles: true }));
    };

    const renderMatches = () => {
      if (!taxonomy) return;
      const query = search.value.trim().toLocaleLowerCase();
      results.innerHTML = '';
      customOffer.innerHTML = '';
      if (query.length < 2) {
        status.textContent = 'Type at least two letters to search categories.';
        return;
      }
      const matches = searchProductTaxonomyCategories(taxonomy.categories, query, 30);
      if (matches.length) {
        status.textContent = `${matches.length === 30 ? 'Top 30 matches.' : `${matches.length} matches.`} Choose the closest match, or add your own.`;
        results.innerHTML = matches.map(category => `<button type="button" role="option"
        data-taxonomy-result="${escapeHtml(category.id)}"><strong>${escapeHtml(category.name)}</strong><small>${escapeHtml(category.fullName)}</small></button>`).join('');
      } else {
        status.textContent = 'No close match. You can add your own category.';
      }
      if (pickMode === 'type') return;
      customOffer.innerHTML = `<button type="button" data-taxonomy-add-custom>Add “${escapeHtml(search.value.trim())}” as my category</button>`;
    };

    const openPanel = mode => {
      if (!addPanel) return;
      pickMode = mode;
      if (typeTitle) typeTitle.hidden = mode !== 'type';
      if (addManually) addManually.hidden = mode === 'type';
      search.placeholder = mode === 'type' ? 'For example shoes, dresses or phones' : 'Search, e.g. shoes';
      search.setAttribute('aria-label', mode === 'type' ? 'What type of product is this?' : 'Search all categories');
      search.value = '';
      results.innerHTML = '';
      customOffer.innerHTML = '';
      addPanel.hidden = false;
      if (!taxonomy) loadData();
      search.focus();
    };

    // Keeps the shop's own category name and takes the attributes of the product type picked.
    const selectType = (category, customCategory = customCategoryInput.value) => {
      categoryInput.value = category.id;
      categoryNameInput.value = category.fullName;
      customCategoryInput.value = customCategory;
      search.value = '';
      results.innerHTML = '';
      customOffer.innerHTML = '';
      if (addPanel) addPanel.hidden = true;
      // The shop category is already in the Category field, so the chip only names the type.
      selected.innerHTML = `<span>Type: ${escapeHtml(category.name)}</span><button type="button" data-taxonomy-clear aria-label="Clear the product type">Clear</button>`;
      attributeFields.innerHTML = '';
      renderAttributeFields(attributeFields, category, attributesById, initialAttributes);
      initialAttributes = [];
      status.textContent = 'Set any applicable attributes; they are optional.';
      announceChange();
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
      announceChange();
    };

    const selectCustomCategory = (value, { guess = true } = {}) => {
      const customCategory = String(value || '').trim().slice(0, 160);
      if (!customCategory) return;
      const matchedCategory = matchProductTaxonomyCategory(taxonomy?.categories, customCategory);
      if (matchedCategory) {
        selectCategory(matchedCategory);
        return;
      }
      // Keep the owner's own name for the shop, and borrow the closest standard category's
      // attributes so the product page still shows size, colour and the rest. A category picked from
      // the shop's own list ("Women") is not guessed at: the owner says the type with Attributes.
      const closest = guess ? findClosestProductTaxonomyCategory(taxonomy?.categories, customCategory) : null;
      categoryInput.value = closest?.id || '';
      categoryNameInput.value = closest?.fullName || '';
      customCategoryInput.value = customCategory;
      search.value = '';
      results.innerHTML = '';
      customOffer.innerHTML = '';
      // A shop category picked from the Category field needs no chip repeating its own name.
      selected.innerHTML = !guess && typeOpen ? '' : `<span>Custom: ${escapeHtml(customCategory)}</span>${closest
        ? `<small>Attributes from ${escapeHtml(closest.fullName)}</small>`
        : ''}<button type="button" data-taxonomy-clear>Clear</button>`;
      attributeFields.innerHTML = '';
      if (closest) renderAttributeFields(attributeFields, closest, attributesById, initialAttributes);
      initialAttributes = [];
      status.textContent = closest
        ? `Using the standard attributes for ${closest.name}. Tap Attributes to pick a different type.`
        : typeOpen ? 'Optional: tap Attributes and say what type of product this is.' : 'This custom category will be saved with the product.';
      announceChange();
    };

    const saveStoreCategory = async (name, category) => {
      if (!storeCategorySelect || typeof onCategoryCreate !== 'function') return;
      const existing = [...storeCategorySelect.options].find(option =>
        normalizeCategoryText(option.textContent) === normalizeCategoryText(name));
      const saved = existing
        ? { value: existing.value, name: existing.textContent }
        : await onCategoryCreate(name, category);
      if (!saved || saved.value == null) throw new Error(`The category "${name}" could not be added.`);
      let option = [...storeCategorySelect.options].find(item => String(item.value) === String(saved.value));
      if (!option) {
        option = widget.ownerDocument.createElement('option');
        option.value = String(saved.value);
        option.textContent = saved.name || name;
        storeCategorySelect.append(option);
      }
      storeCategorySelect.value = String(saved.value);
      return saved;
    };

    const addTaxonomyCategory = async category => {
      try {
        selectCategory(category);
        if (addPanel) addPanel.hidden = true;
        await saveStoreCategory(category.name, category);
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'The category could not be saved.';
      }
    };

    const loadData = () => {
      if (widget.dataset.taxonomyInitialized === 'loading' || widget.dataset.taxonomyInitialized === 'true') return;
      widget.dataset.taxonomyInitialized = 'loading';
      if (retry) retry.hidden = true;
      status.textContent = 'Loading standard category matches. You can still add your own category.';
      void (taxonomyPromiseOverride || loadProductTaxonomy()).then(data => {
        taxonomy = data;
        categoriesById = new Map(data.categories.map(category => [category.id, category]));
        attributesById = new Map(data.attributes.map(attribute => [attribute.id, attribute]));
        widget.dataset.taxonomyInitialized = 'true';
        const initialCategoryId = widget.dataset.initialCategoryId || '';
        if (initialCategoryId) {
          const category = categoriesById.get(initialCategoryId);
          if (!category) throw new Error(`Saved product category ${initialCategoryId} is no longer available.`);
          // A shop category with a chosen type ("Women", type Shoes) reopens as both.
          if (widget.dataset.initialCustomCategory) selectType(category, widget.dataset.initialCustomCategory);
          else selectCategory(category);
        } else if (widget.dataset.initialCustomCategory) {
          selectCustomCategory(widget.dataset.initialCustomCategory);
        } else if (storeCategorySelect?.selectedOptions[0]?.value) {
          selectCustomCategory(storeCategorySelect.selectedOptions[0].textContent, { guess: false });
        } else {
          status.textContent = 'Search by category name to choose a standard category.';
        }
        if (addPanel && !addPanel.hidden && search.value.trim()) renderMatches();
      }).catch(error => {
        widget.dataset.taxonomyInitialized = 'error';
        status.textContent = error instanceof Error ? error.message : 'Product categories could not be loaded.';
        if (retry) retry.hidden = false;
        console.error('Product taxonomy could not be initialized.', error);
      });
    };

    search.addEventListener('input', renderMatches);
    addOpen?.addEventListener('click', () => openPanel('add'));
    typeOpen?.addEventListener('click', () => openPanel('type'));
    addClose?.addEventListener('click', () => {
      if (addPanel) addPanel.hidden = true;
    });
    addManually?.addEventListener('click', async () => {
      const name = search.value.trim().slice(0, 120);
      if (!name) {
        status.textContent = 'Type a category name first.';
        search.focus();
        return;
      }
      try {
        const matchedCategory = matchProductTaxonomyCategory(taxonomy?.categories, name);
        if (matchedCategory) selectCategory(matchedCategory);
        else selectCustomCategory(name);
        if (addPanel) addPanel.hidden = true;
        await saveStoreCategory(name, matchedCategory);
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'The category could not be saved.';
      }
    });
    storeCategorySelect?.addEventListener('change', () => {
      if (!taxonomy) {
        loadData();
        return;
      }
      const label = String(storeCategorySelect.selectedOptions[0]?.textContent || '').trim();
      if (!label) {
        selectCategory(null);
        return;
      }
      selectCustomCategory(label, { guess: false });
    });
    results.addEventListener('click', event => {
      const button = event.target.closest('[data-taxonomy-result]');
      if (!button) return;
      const category = categoriesById.get(button.dataset.taxonomyResult);
      if (!category) return;
      if (pickMode === 'type') selectType(category);
      else void addTaxonomyCategory(category);
    });
    customOffer.addEventListener('click', event => {
      if (!event.target.closest('[data-taxonomy-add-custom]')) return;
      const name = search.value.trim().slice(0, 120);
      try {
        selectCustomCategory(name);
        if (addPanel) addPanel.hidden = true;
        void saveStoreCategory(name, matchProductTaxonomyCategory(taxonomy?.categories, name)).catch(error => {
          status.textContent = error instanceof Error ? error.message : 'The category could not be saved.';
        });
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'The category could not be selected.';
      }
    });
    selected.addEventListener('click', event => {
      if (!event.target.closest('[data-taxonomy-clear]')) return;
      // Clearing a chosen type goes back to the shop category alone, not to no category at all.
      const shopCategory = typeOpen && storeCategorySelect?.value ? customCategoryInput.value : '';
      if (shopCategory) {
        categoryInput.value = '';
        categoryNameInput.value = '';
        selectCustomCategory(shopCategory, { guess: false });
        return;
      }
      selectCategory(null);
      search.value = '';
      search.focus();
    });
    retry?.addEventListener('click', () => {
      if (widget.dataset.taxonomyInitialized === 'loading') return;
      loadData();
    });
    if (widget.dataset.initialCategoryId || widget.dataset.initialCustomCategory || storeCategorySelect?.value) loadData();
  }
}

/**
 * The attributes the chosen category offers, read from the fields the picker has already rendered.
 * The attribute pricing editor asks for these so the two can never drift apart: if the product is a
 * shoe, the attributes it can charge for are the shoe's attributes. An attribute with no fixed value
 * list (a free-text one) is left out, because there is nothing to put a price against.
 */
export function readAvailableTaxonomyAttributes(form) {
  if (!form) return [];
  return [...form.querySelectorAll('select[data-taxonomy-attribute]')].map(field => ({
    attributeId: field.dataset.taxonomyAttribute || '',
    attributeName: field.dataset.taxonomyAttributeName || '',
    values: [...field.options]
      .filter(option => option.value)
      .map(option => ({ valueId: option.value, value: (option.dataset.valueName || option.textContent).trim() }))
  })).filter(attribute => attribute.attributeName && attribute.values.length);
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
