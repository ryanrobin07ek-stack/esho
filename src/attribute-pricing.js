// One definition of what it means to charge for an attribute, shared by the owner app, the till,
// the published storefront and the Worker. Before this, an attribute was descriptive text only:
// an owner could say a shoe was leather but could not charge more for the leather one.
//
// The rule: a PRICED ATTRIBUTE adjusts the price and owns no stock.
//
// Stock stays with variants (Size/Colour), which are a bounded grid the till can count. Attributes
// are not: Shoes alone carries 17 of them with long value lists, so pricing every combination
// would be millions of rows nobody could ever count. A shoe has four mediums; "Leather +500" is
// not a separate thing on the shelf.

export const MAX_PRICED_ATTRIBUTES = 5;
export const MAX_PRICED_VALUES = 20;
// Far above any real adjustment, low enough that a typo cannot overflow a total.
export const MAX_PRICE_DELTA = 10_000_000;

const text = (value, limit) => String(value ?? '').trim().slice(0, limit);
const money = amount => Math.round(Number(amount) * 100) / 100;

/**
 * Validates what the owner set up. Throws with the owner's own wording so the message can be shown
 * in the form, rather than silently dropping a price they meant to charge.
 */
export function normalizePricedAttributes(value) {
  const list = Array.isArray(value) ? value : [];
  if (list.length > MAX_PRICED_ATTRIBUTES) {
    throw new Error(`A product can charge for up to ${MAX_PRICED_ATTRIBUTES} attributes.`);
  }
  const seenAttributes = new Set();
  const normalized = [];
  for (const entry of list) {
    const attributeId = text(entry?.attributeId ?? entry?.attribute_id, 180);
    const attributeName = text(entry?.attributeName ?? entry?.attribute_name, 80);
    if (!attributeId && !attributeName) continue;
    if (!attributeName) throw new Error('Each priced attribute needs a name.');
    const key = (attributeId || attributeName).toLowerCase();
    if (seenAttributes.has(key)) throw new Error(`${attributeName} is listed twice.`);
    seenAttributes.add(key);
    const rawValues = Array.isArray(entry?.values) ? entry.values : [];
    if (rawValues.length > MAX_PRICED_VALUES) {
      throw new Error(`${attributeName} can offer up to ${MAX_PRICED_VALUES} choices.`);
    }
    const seenValues = new Set();
    const values = [];
    for (const option of rawValues) {
      const label = text(option?.value ?? option?.label, 80);
      if (!label) continue;
      if (seenValues.has(label.toLowerCase())) {
        throw new Error(`${attributeName} lists ${label} twice.`);
      }
      seenValues.add(label.toLowerCase());
      const rawDelta = option?.priceDelta ?? option?.price_delta;
      const delta = rawDelta === null || rawDelta === undefined || rawDelta === '' ? 0 : Number(rawDelta);
      if (!Number.isFinite(delta) || Math.abs(delta) > MAX_PRICE_DELTA) {
        throw new Error(`Enter a valid price change for ${attributeName}: ${label}.`);
      }
      values.push({
        valueId: text(option?.valueId ?? option?.value_id, 180),
        value: label,
        priceDelta: money(delta)
      });
    }
    if (!values.length) continue;
    normalized.push({ attributeId, attributeName, values });
  }
  return normalized;
}

/** The choices a shopper or cashier actually made, keeping only ones the product still offers. */
export function normalizeChosenAttributes(pricedAttributes, chosen) {
  const offered = normalizePricedAttributes(pricedAttributes);
  const picks = Array.isArray(chosen) ? chosen : [];
  const result = [];
  for (const attribute of offered) {
    const pick = picks.find(item => {
      const id = text(item?.attributeId ?? item?.attribute_id, 180);
      const name = text(item?.attributeName ?? item?.attribute_name, 80);
      return (id && id === attribute.attributeId) || (!id && name === attribute.attributeName);
    });
    const label = text(pick?.value, 80);
    if (!label) continue;
    const match = attribute.values.find(option => option.value.toLowerCase() === label.toLowerCase());
    // A choice the product no longer offers is dropped rather than charged for.
    if (!match) continue;
    result.push({
      attributeId: attribute.attributeId,
      attributeName: attribute.attributeName,
      valueId: match.valueId,
      value: match.value,
      priceDelta: match.priceDelta
    });
  }
  return result;
}

/** What the chosen attributes add to (or take off) the price. */
export function attributePriceDelta(pricedAttributes, chosen) {
  return money(normalizeChosenAttributes(pricedAttributes, chosen)
    .reduce((total, pick) => total + pick.priceDelta, 0));
}

/**
 * The price to charge: the variant's price, or the product's, plus the chosen adjustments. Never
 * below zero, so a mistaken discount cannot make the shop pay the customer.
 */
export function priceWithAttributes(basePrice, pricedAttributes, chosen) {
  const base = Number(basePrice);
  const start = Number.isFinite(base) ? base : 0;
  return Math.max(0, money(start + attributePriceDelta(pricedAttributes, chosen)));
}

/** "Leather / Red" — one wording for receipts, order lines and the cart. */
export function chosenAttributeLabel(chosen) {
  return (Array.isArray(chosen) ? chosen : [])
    .map(pick => text(pick?.value, 80))
    .filter(Boolean)
    .join(' / ');
}

/** True when this product charges for any attribute, so a surface knows to ask before selling. */
export function hasPricedAttributes(product) {
  const list = product?.priced_attributes ?? product?.pricedAttributes;
  return Array.isArray(list) && list.length > 0;
}
