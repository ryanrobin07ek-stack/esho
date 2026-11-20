// The sale cart. A cart line is keyed by productId|variantId|attributesLabel, so the same product
// with another variant or other priced attributes is its own line.
import {
  chosenAttributeLabel, normalizeChosenAttributes, priceWithAttributes
} from '../attribute-pricing.js';
import { toCents } from './format.js';
import { variantPrice } from './pricing.js';
import { getSettings } from './settings-store.js';

export function createTillCart({ state, updateCartPanel }) {
  const currentCartTotals = async () => {
    const settings = await getSettings();
    const subtotal = state.cart.reduce((sum, item) => sum + toCents(item.unitPrice) * item.quantity, 0);
    const tax = Math.round(subtotal * settings.taxRate / 100);
    return { settings, subtotal, tax, total: subtotal + tax };
  };

  const cartLineKey = (item) => `${item.productId}|${item.variantId || ''}|${item.attributesLabel || ''}`;

  function addProductToCart(product, variant, chosenAttributes = []) {
    const variantId = variant ? String(variant.id) : '';
    const picked = normalizeChosenAttributes(product.pricedAttributes || [], chosenAttributes);
    const attributesLabel = chosenAttributeLabel(picked);
    const existing = state.cart.find((item) => item.productId === product.id
      && String(item.variantId || '') === variantId
      && String(item.attributesLabel || '') === attributesLabel);
    if (existing) {
      existing.quantity = Math.min(99999, existing.quantity + 1);
    } else {
      state.cart.push({
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: priceWithAttributes(variantPrice(product, variant), product.pricedAttributes || [], picked),
        variantId,
        variantLabel: variant ? variant.label : '',
        attributes: picked,
        attributesLabel
      });
    }
    updateCartPanel();
  }

  return { cartLineKey, addProductToCart };
}
