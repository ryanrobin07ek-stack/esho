// Product variant pricing: cleans a product's stored variants and gives the price of the chosen one.
// Priced attributes are added on top by priceWithAttributes (src/attribute-pricing.js).

// The till sells the same options the website does. readProductVariantFields() already produces
// this shape, so a product saved on either side is read correctly by the other.
function normalizePosVariants(value) {
  const list = Array.isArray(value) ? value : [];
  if (list.length > 100) throw new Error('A product can have up to 100 option combinations.');
  const seen = new Set();
  return list.map((variant) => {
    const option1Value = String(variant?.option1_value ?? variant?.size ?? '').trim().slice(0, 80);
    const option2Value = String(variant?.option2_value ?? variant?.color ?? '').trim().slice(0, 80);
    const extraValues = [3, 4].map((position) =>
      String(variant?.[`option${position}_value`] ?? '').trim().slice(0, 80));
    const label = [option1Value, option2Value, ...extraValues].filter(Boolean).join(' / ');
    if (!label) throw new Error('Each product option needs a value.');
    if (seen.has(label.toLowerCase())) throw new Error(`${label} is listed twice.`);
    seen.add(label.toLowerCase());
    const rawPrice = variant?.price;
    const price = rawPrice === null || rawPrice === undefined || rawPrice === '' ? null : Number(rawPrice);
    const rawStock = variant?.stock;
    const stock = rawStock === null || rawStock === undefined || rawStock === '' ? 0 : Number(rawStock);
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error(`Enter a valid price for ${label}.`);
    if (!Number.isSafeInteger(stock) || stock < 0) throw new Error(`Enter a whole-number stock quantity for ${label}.`);
    return {
      id: String(variant?.id || JSON.stringify([option1Value, option2Value])),
      option1_name: String(variant?.option1_name || '').slice(0, 80),
      option1_value: option1Value,
      option2_name: String(variant?.option2_name || '').slice(0, 80),
      option2_value: option2Value,
      label,
      price,
      stock
    };
  });
}

/** The price this variant sells for, falling back to the product price when it has none of its own. */
function variantPrice(product, variant) {
  if (!variant) return Number(product?.price) || 0;
  return variant.price === null || variant.price === undefined ? Number(product?.price) || 0 : Number(variant.price);
}

export { normalizePosVariants, variantPrice };
