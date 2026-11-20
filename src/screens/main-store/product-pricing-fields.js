// Options and attribute prices for Main Store's two product editors: the Store screen's product form
// (saves to POS, Web or both) and the product modal (Web only).
//
// The new-website wizard already had both editors; Main Store had neither, so a product made or
// edited there could not have sizes, could not charge more for Large, and an edit could not keep a
// third option or a per-value price change. These use the same components and save the same shape
// as the wizard, so the till, the website and the Worker read the result unchanged:
//   Web:  options, option1_name, option2_name, sizes, colors, variants, priced_attributes
//   POS:  variants, pricedAttributes
import {
  bindAttributePricingFields,
  createAttributePricingFields,
  readAttributePricingFields
} from '../../attribute-pricing-fields.js';
import { readAvailableTaxonomyAttributes } from '../../product-taxonomy.js';
import {
  bindProductVariantFields,
  createProductVariantFields,
  readProductVariantFields
} from '../../product-variants.js';

const list = value => (Array.isArray(value) ? value : []);

/**
 * What a product already has, in the editor's input shape. A Main Store product can carry a Web
 * copy, a POS copy or both; the Web copy is preferred because only it keeps each value's price
 * change, and the POS copy fills in what the Web copy does not have.
 */
export function savedProductPricing(product) {
  if (!product) return {};
  const web = product.webProduct || null;
  const pos = product.posProduct || null;
  // A product from the product modal is the Web record itself.
  const own = web || pos ? null : product;
  const webLike = web || own;
  const webHasOptions = list(webLike?.options).length || list(webLike?.variants).length;
  const source = webHasOptions ? webLike : null;
  const variants = source ? list(source.variants) : list(pos?.variants);
  const pricedFromWeb = list(webLike?.priced_attributes);
  return {
    options: source ? list(source.options) : [],
    option1Name: source?.option1_name || variants[0]?.option1_name || '',
    option2Name: source?.option2_name || variants[0]?.option2_name || '',
    // Declared sizes/colours only describe the variants; without variants they are stale.
    sizes: source && variants.length ? list(source.sizes) : [],
    colors: source && variants.length ? list(source.colors) : [],
    variants,
    pricedAttributes: pricedFromWeb.length ? pricedFromWeb : list(pos?.pricedAttributes)
  };
}

const boundForms = new WeakSet();

/**
 * Draws and binds both editors into the form's `[data-product-pricing-variants]` and
 * `[data-product-pricing-attributes]` hosts, from what `product` already has (nothing for a new
 * product). Called again for the next product: the hosts are redrawn and the category listener is
 * only added to a form once.
 */
export function mountProductPricing(form, product = null) {
  const variantsHost = form?.querySelector('[data-product-pricing-variants]');
  const pricingHost = form?.querySelector('[data-product-pricing-attributes]');
  if (!variantsHost || !pricingHost) throw new Error('The product form is missing its options and attribute price areas.');
  const saved = savedProductPricing(product);
  variantsHost.innerHTML = createProductVariantFields({
    options: list(saved.options),
    option1Name: saved.option1Name || '',
    option2Name: saved.option2Name || '',
    sizes: list(saved.sizes),
    colors: list(saved.colors),
    variants: list(saved.variants)
  });
  // Bind the section itself, never the host: the saved options live on the section.
  const variantFields = variantsHost.firstElementChild;
  bindProductVariantFields(variantFields);
  pricingHost.innerHTML = createAttributePricingFields({ pricedAttributes: list(saved.pricedAttributes) });
  bindAttributePricingFields(
    pricingHost.querySelector('[data-attribute-pricing]'),
    () => readAvailableTaxonomyAttributes(form)
  );
  if (!boundForms.has(form)) {
    boundForms.add(form);
    // Picking a category changes which attributes exist, so the pricing editor follows at once.
    form.addEventListener('product-taxonomy-change', () => {
      form.querySelector('[data-product-pricing-attributes] [data-attribute-pricing]')?.refreshAttributePricing?.();
    });
  }
}

/**
 * Reads both editors: the option fields readProductVariantFields() returns (with `stock`, the
 * variants' total, when there are options) plus `priced_attributes`. When the options are not ready
 * to save it throws, or, given `onError`, reports the message there and returns null.
 */
export function readProductPricingFields(form, onError) {
  try {
    const variants = readProductVariantFields(form.querySelector('[data-product-pricing-variants] [data-product-variants]'));
    return {
      ...variants,
      priced_attributes: readAttributePricingFields(form.querySelector('[data-product-pricing-attributes] [data-attribute-pricing]'))
    };
  } catch (error) {
    if (typeof onError !== 'function') throw error;
    onError(error instanceof Error ? error.message : 'Check the product options and try again.');
    return null;
  }
}

/** The Web product fields, without stock (the caller owns stock). */
export function webPricingValues(pricing) {
  return {
    options: list(pricing.options),
    option1_name: pricing.option1_name || '',
    option2_name: pricing.option2_name || '',
    sizes: list(pricing.sizes),
    colors: list(pricing.colors),
    variants: list(pricing.variants),
    priced_attributes: list(pricing.priced_attributes)
  };
}

/** The POS product fields, as the till's own product form saves them. */
export function posPricingValues(pricing) {
  return {
    variants: list(pricing.variants),
    pricedAttributes: list(pricing.priced_attributes)
  };
}
