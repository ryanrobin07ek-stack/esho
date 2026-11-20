// "Add category" on the new-website products step: a pill that opens a search field, where
// product-taxonomy suggestions appear as the owner types. Picking one, or pressing Enter on
// their own wording, submits the existing #website-wizard-category-form, so the draft logic
// that saves the category stays where it was.
import './wizard-category-picker.css';
import { loadProductTaxonomy, searchProductTaxonomyCategories } from './product-taxonomy.js';

const FORM_ID = 'website-wizard-category-form';
const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 150;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const parentPath = fullName => String(fullName || '').split('>').map(part => part.trim())
  .filter(Boolean).slice(0, -1).join(' › ');

/** Suggestion buttons for a query. Offers the owner's own wording first unless a match is exact. */
export function suggestionsMarkup(results, query) {
  const typed = String(query || '').trim();
  if (!typed) return '';
  const exact = results.some(category => category.name.toLocaleLowerCase() === typed.toLocaleLowerCase());
  const custom = exact ? '' : `<button type="button" class="wizard-category-suggestion is-custom" role="option" data-category-suggestion="${escapeHtml(typed)}"><strong>Add “${escapeHtml(typed)}”</strong><span>Use your own category name</span></button>`;
  return custom + results.map(category => {
    const path = parentPath(category.fullName);
    return `<button type="button" class="wizard-category-suggestion" role="option" data-category-suggestion="${escapeHtml(category.name)}"><strong>${escapeHtml(category.name)}</strong>${path ? `<span>${escapeHtml(path)}</span>` : ''}</button>`;
  }).join('');
}

function openPicker(form, trigger) {
  const opening = form.hidden;
  form.hidden = !opening;
  trigger?.setAttribute('aria-expanded', String(opening));
  if (!opening) return;
  form.elements.id.value = '';
  form.elements.name.value = '';
  form.querySelector('button[type="submit"]').textContent = 'Add category';
  form.querySelector('[data-category-suggestions]').innerHTML = '';
  form.elements.name.focus();
}

let searchTimer;
let searchToken = 0;

async function showSuggestions(input) {
  const list = input.form?.querySelector('[data-category-suggestions]');
  if (!list) return;
  const query = input.value.trim();
  const token = ++searchToken;
  if (!query) {
    list.innerHTML = '';
    return;
  }
  let results = [];
  try {
    const taxonomy = await loadProductTaxonomy();
    results = searchProductTaxonomyCategories(taxonomy.categories, query, SUGGESTION_LIMIT);
  } catch (error) {
    // Without the bundled taxonomy the owner can still add their own wording.
    console.warn('Category suggestions are unavailable.', error);
  }
  if (token === searchToken && input.value.trim() === query) list.innerHTML = suggestionsMarkup(results, query);
}

/** Wires the picker once, by delegation, so it survives every re-render of the wizard. */
export function bindWizardCategoryPicker(root = document) {
  if (root.__wizardCategoryPickerBound) return;
  root.__wizardCategoryPickerBound = true;
  root.addEventListener('click', event => {
    const trigger = event.target.closest('[data-wizard-add-category]');
    if (trigger) {
      const form = root.getElementById(FORM_ID);
      if (form) openPicker(form, trigger);
      return;
    }
    const suggestion = event.target.closest('[data-category-suggestion]');
    const form = suggestion?.closest(`#${FORM_ID}`);
    if (!form) return;
    form.elements.name.value = suggestion.dataset.categorySuggestion;
    form.querySelector('[data-category-suggestions]').innerHTML = '';
    form.requestSubmit();
  });
  root.addEventListener('input', event => {
    const input = event.target.closest(`#${FORM_ID} [data-category-search]`);
    if (!input) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { void showSuggestions(input); }, DEBOUNCE_MS);
  });
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const input = event.target.closest(`#${FORM_ID} [data-category-search]`);
    if (input) input.form.querySelector('[data-category-suggestions]').innerHTML = '';
  });
}

if (typeof document !== 'undefined') bindWizardCategoryPicker(document);
