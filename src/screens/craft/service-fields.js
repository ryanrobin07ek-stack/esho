// "Product or service, and how long it takes" for the new-website wizard's product form.
// Same rule as the Craft store-products form: a service is a property of the item (it has a
// duration_minutes on the 15-240 grid of src/service-model.js) and counts no stock.
import { SQLiteEngine, webServiceDurationOptions } from '../../app/main.js';

const model = () => window.EshopServiceModel;

/** Markup for the two fields. A shop that sells only services starts new items as services. */
export function serviceFieldsHTML(offerType = SQLiteEngine.getStore()?.offer_type) {
  const startAsService = model()?.normalizeOfferType(offerType) === "services";
  return `<div class="studio-form-grid">
          <label>Item type<select name="item_type" data-service-item-type><option value="product"${startAsService ? "" : " selected"}>Product</option><option value="service"${startAsService ? " selected" : ""}>Service</option></select></label>
          <label data-service-duration${startAsService ? "" : " hidden"}>Duration<select name="duration_minutes">${webServiceDurationOptions()}</select></label>
        </div>`;
}

/**
 * Wires the fields inside form. stockField is the label holding the stock input: it is hidden for a
 * service, and its input stops being required (a hidden required box would block the save).
 */
export function bindServiceFields(form, stockField) {
  const typeField = form.querySelector("[data-service-item-type]");
  const durationField = form.querySelector("[data-service-duration]");
  const durationSelect = durationField?.querySelector("select");
  const stockInput = stockField?.querySelector("input");
  const isServiceChosen = () => typeField?.value === "service";
  const apply = () => {
    const service = isServiceChosen();
    if (durationField) durationField.hidden = !service;
    if (stockField) stockField.hidden = service;
    if (stockInput) stockInput.required = !service;
  };
  typeField?.addEventListener("change", apply);
  apply();
  return {
    apply,
    isService: isServiceChosen,
    /** Puts a saved product's type and duration back into the form. */
    load(product) {
      const minutes = model()?.serviceDuration(product) || 0;
      if (typeField) typeField.value = minutes ? "service" : "product";
      if (durationSelect && minutes) durationSelect.value = String(minutes);
      apply();
    },
    /** The minutes to save: a snapped duration for a service, null for a good. */
    read() {
      if (!isServiceChosen()) return null;
      return model()?.normalizeServiceDuration(durationSelect?.value) || model()?.DEFAULT_SERVICE_MINUTES || 60;
    }
  };
}
