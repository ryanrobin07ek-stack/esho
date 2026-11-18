// One definition of what a service is, shared by the POS, the owner app, the Litrus builder and the
// published storefront. Before this module each layer decided on its own, and the shop as a whole was
// either "products" or "services", so a salon that also sells cosmetics could not be described at all.
//
// The rule: a SERVICE is a property of the PRODUCT (it has a duration), never of the shop.
// A shop's offer_type only says what it leads with; it never decides what a single item is.
//
// Stock follows from that: a service has nothing to count, so its stock stays null and the till must
// not deduct, warn or refuse. pos_products.stock_count already allows NULL, so nothing new is needed
// to store it.

export const SERVICE_MIN_MINUTES = 15;
export const SERVICE_MAX_MINUTES = 240;
export const SERVICE_STEP_MINUTES = 15;
export const DEFAULT_SERVICE_MINUTES = 60;

/** products = goods only, services = bookable time only, both = a shop that sells each side by side. */
export const OFFER_TYPES = Object.freeze(['products', 'services', 'both']);

const rawDuration = product => Number(
  product?.duration_minutes ?? product?.durationMinutes ?? product?.service_duration_minutes ?? 0
);

/** 'products' | 'services' | 'both'. Anything unknown (or missing) stays 'products'. */
export function normalizeOfferType(value) {
  const offer = String(value ?? '').trim().toLowerCase();
  return OFFER_TYPES.includes(offer) ? offer : 'products';
}

/** Snaps a duration onto the 15-240 minute grid. Returns 0 when there is no usable duration. */
export function normalizeServiceDuration(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  const snapped = Math.round(minutes / SERVICE_STEP_MINUTES) * SERVICE_STEP_MINUTES;
  return Math.min(SERVICE_MAX_MINUTES, Math.max(SERVICE_MIN_MINUTES, snapped));
}

/** The duration this product is sold in, or 0 when it is an ordinary good. */
export function serviceDuration(product) {
  return normalizeServiceDuration(rawDuration(product));
}

/**
 * True when this single item is a service. A duration is what makes it one; the explicit flags are
 * accepted so rows written by older code (or by the builder) are still read correctly.
 */
export function isService(product) {
  if (!product || typeof product !== 'object') return false;
  if (product.kind === 'service' || product.type === 'service') return true;
  if (product.is_service === 1 || product.is_service === true) return true;
  return serviceDuration(product) > 0;
}

/**
 * A product whose stock is a number is tracked. Services never are, and neither is a made-to-order
 * good whose stock was left empty. Matches tracksStock() in local-analytics.js for ordinary goods.
 */
export function tracksStock(product) {
  if (!product || typeof product !== 'object') return false;
  if (isService(product)) return false;
  const stock = product.stock ?? product.stock_count ?? product.stockCount;
  return stock !== null && stock !== undefined && stock !== '' && Number.isFinite(Number(stock));
}

/** Services are never out of stock, and an untracked good is always sellable. */
export function isOutOfStock(product) {
  if (!tracksStock(product)) return false;
  return Number(product.stock ?? product.stock_count ?? product.stockCount) <= 0;
}

/** Selling a service, or an untracked good, must never move an inventory number. */
export function deductsStock(product) {
  return tracksStock(product);
}

export function sellsServices(offerType) {
  const offer = normalizeOfferType(offerType);
  return offer === 'services' || offer === 'both';
}

export function sellsProducts(offerType) {
  const offer = normalizeOfferType(offerType);
  return offer === 'products' || offer === 'both';
}

/** What the customer's button on a card should do. Decided per item, never per shop. */
export function primaryAction(product) {
  return isService(product) ? 'book' : 'add_to_bag';
}

/** The label for that button, so every surface says the same word. */
export function primaryActionLabel(product) {
  return isService(product) ? 'Book' : 'Add to bag';
}

/**
 * What a shop's offer_type should be once its catalogue is known. A shop that has both kinds is
 * 'both' whatever it was set to, so an owner who adds a haircut to a clothes shop is not asked to
 * choose, and nothing in the catalogue becomes unsellable.
 */
export function offerTypeForCatalogue(products, current) {
  const list = Array.isArray(products) ? products : [];
  const hasService = list.some(isService);
  const hasProduct = list.some(product => !isService(product));
  if (hasService && hasProduct) return 'both';
  if (hasService) return 'services';
  if (hasProduct) return 'products';
  return normalizeOfferType(current);
}
