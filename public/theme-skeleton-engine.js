import { dataForTheme } from "./theme-skeleton-data.js";

const readPath = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);

const activeProducts = data => (Array.isArray(data?.products) ? data.products : [])
  .filter(product => product && product.status !== "archived" &&
    product.published !== false && product.published !== 0);

const categoriesForProducts = data => {
  const products = activeProducts(data);
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  return categories.filter(category => products.some(product =>
    String(product.category_id ?? product.categoryId ?? "") === String(category.id)
    || String(product.category_name ?? product.categoryName ?? "") === String(category.name)));
};

const imageOf = product => {
  const raw = product?.images?.[0] || product?.image || product?.image_uri || product?.imageUrl || "";
  const url = typeof raw === "string" ? raw : raw?.url || raw?.src || "";
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
};

const priceOf = product => Number(product?.price ?? product?.selling_price ?? product?.sellingPrice) || 0;
const currencyOf = data => data?.store?.currency || "KES";

function formatPrice(product, data) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyOf(data),
      maximumFractionDigits: 2
    }).format(priceOf(product));
  } catch {
    return `${currencyOf(data)} ${priceOf(product).toLocaleString()}`;
  }
}

function mapGenericThemeData(schema, data) {
  const fieldMap = schema.fieldMap;
  if (!fieldMap?.fields) return {};
  const fields = fieldMap.fields;
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const products = data.products.map(product => {
    if (product.id == null || String(product.id).trim() === "") {
      throw new Error("Every product must have a stable shop ID before theme filling.");
    }
    const category = categories.find(item =>
      String(item.id) === String(product.category_id ?? product.categoryId))
      || categories.find(item => item.name === (product.category_name || product.categoryName));
    const mapped = {};
    for (const [key, value] of Object.entries(fieldMap.shape || {})) {
      mapped[key] = typeof value === "boolean"
        ? false
        : Array.isArray(value) ? [] : value;
      if (typeof value === "string") mapped[key] = "";
      else if (typeof value === "number") mapped[key] = 0;
      else if (value && typeof value === "object") mapped[key] = {};
    }
    Object.assign(mapped, fieldMap.defaults || {});
    const put = (key, value) => {
      if (key) mapped[key] = value;
    };
    put(fields.id, String(product.id));
    put(fields.name, String(product.name || ""));
    put(fields.price, priceOf(product));
    if (fields.comparePrice) {
      put(fields.comparePrice, Number(product.comparePrice ?? product.compare_at_price) || 0);
    }
    const image = imageOf(product);
    put(fields.image, Array.isArray(fieldMap.shape?.[fields.image])
      ? image ? [image] : []
      : image);
    const categoryField = String(fields.category || "").toLowerCase();
    put(fields.category, categoryField.includes("id")
      ? String(category?.id ?? product.category_id ?? product.categoryId ?? "")
      : String(category?.name ?? product.category_name ?? product.categoryName ?? product.category ?? ""));
    put(fields.categoryId, String(category?.id ?? product.category_id ?? product.categoryId ?? ""));
    put(fields.description, String(product.description || ""));
    for (const key of Object.keys(mapped)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");
      if (normalizedKey === "brand" || normalizedKey === "vendor") {
        mapped[key] = String(product.brand || "");
      } else if (normalizedKey === "sku" || normalizedKey === "productsku") {
        mapped[key] = String(product.sku || "");
      } else if (normalizedKey === "sizes" || normalizedKey === "size") {
        mapped[key] = Array.isArray(product.sizes) ? product.sizes : [];
      } else if (normalizedKey === "colors" || normalizedKey === "color") {
        mapped[key] = Array.isArray(product.colors) ? product.colors : [];
      } else if (normalizedKey === "stock" || normalizedKey === "stockcount" || normalizedKey === "quantity") {
        mapped[key] = Math.max(0, Number(product.stock ?? product.stock_count) || 0);
      } else if (normalizedKey === "material") {
        mapped[key] = String(product.material || "");
      } else if (normalizedKey === "rating") {
        mapped[key] = Number(product.rating) || 0;
      } else if (normalizedKey === "reviewcount" || normalizedKey === "reviewscount") {
        mapped[key] = Number(product.reviews_count ?? product.reviewCount) || 0;
      }
    }
    if (fields.featured && (product.featured != null || product.is_featured != null)) {
      put(fields.featured, Boolean(product.featured ?? product.is_featured));
    }
    if (fields.bestseller && (product.bestseller != null || product.is_bestseller != null)) {
      put(fields.bestseller, Boolean(product.bestseller ?? product.is_bestseller));
    }
    return mapped;
  });
  const mappedCategories = categories.map(category => {
    const categoryProduct = products.find(product =>
      String(product.category_id ?? product.categoryId ?? "") === String(category.id)
      || String(product.category_name ?? product.categoryName ?? "") === String(category.name));
    const rawImage = category.image || category.image_url || category.imageUri || "";
    const categoryImage = typeof rawImage === "string" ? rawImage : rawImage?.url || rawImage?.src || "";
    const normalizedName = String(category.name || "").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return {
      ...category,
      id: String(category.id ?? ""),
      name: String(category.name || ""),
      slug: String(category.slug || normalizedName),
      image: categoryImage || imageOf(categoryProduct)
    };
  });
  const collection = fieldMap.collectionKind === "object"
    ? Object.fromEntries(products.map(product => [String(product[fields.id]), product]))
    : products;
  return { [fieldMap.collectionKey || "products"]: collection, categories: mappedCategories };
}

function setSlot(element, slot, value, { mode, product, data }) {
  const content = value == null ? "" : String(value);
  const attribute = element.getAttribute("data-slot-attr");
  if (attribute) {
    if (content) element.setAttribute(attribute, `${element.getAttribute("data-slot-prefix") || ""}${content}`);
    else element.removeAttribute(attribute);
    return;
  }
  if (slot.endsWith(".image")) {
    const image = product ? imageOf(product) : content;
    if (element.tagName === "IMG") {
      if (image) {
        element.setAttribute("src", image);
      } else {
        element.removeAttribute("src");
        element.style.backgroundImage = "linear-gradient(135deg, var(--theme-placeholder-start, #d9d9d9), var(--theme-placeholder-end, #f0f0f0))";
        element.classList.add("eshop-placeholder-media");
      }
      element.removeAttribute("alt");
    } else {
      element.style.backgroundImage = image
        ? `url("${image.replace(/["\\]/g, "")}")`
        : "linear-gradient(135deg, var(--theme-placeholder-start, #d9d9d9), var(--theme-placeholder-end, #f0f0f0))";
      element.classList.add("eshop-placeholder-media");
    }
    return;
  }
  if (slot.endsWith(".price") && product) {
    element.textContent = formatPrice(product, data);
    return;
  }
  element.textContent = content;
  element.removeAttribute("data-skeleton-text");
}

function applySlots(root, data, options, product = null) {
  for (const element of root.querySelectorAll("[data-slot]")) {
    const slot = element.getAttribute("data-slot");
    const context = product ? { product, store: data.store || {}, category: product.category || {} } : data;
    let value = readPath(context, slot);
    if (slot === "store.name") value = data.store?.name;
    if (slot === "store.phone") value = data.store?.phone;
    if (slot === "store.email") value = data.store?.email;
    if (slot === "store.address") value = data.store?.location_address || data.store?.address;
    if (slot === "product.image" && product) value = imageOf(product);
    if (slot === "product.price" && product) value = priceOf(product);
    if (slot === "product.name" && product) value = product.name;
    if (slot === "product.description" && product) value = product.description;
    if (slot === "product.category" && product) {
      value = product.category?.name || product.category_name || product.categoryName || "";
    }
    if (slot === "category.name" && product?.category) value = product.category.name;
    if (value == null || value === "") {
      if (options.mode === "editor") {
        element.textContent = "";
        element.setAttribute("data-skeleton-text", "");
      } else if (slot.endsWith(".image")) {
        setSlot(element, slot, "", { ...options, product, data });
      } else {
        element.replaceChildren();
        element.hidden = true;
      }
      continue;
    }
    setSlot(element, slot, value, { ...options, product, data });
  }
}

function fillRepeaters(document, schema, data, options) {
  const products = activeProducts(data);
  const categories = categoriesForProducts(data);
  for (const repeater of schema.repeaters || []) {
    const templates = [...document.querySelectorAll(`template[data-repeat="${repeater.name}"]`)];
    for (const template of templates) {
      const container = template.parentElement;
      const records = repeater.name === "products" ? products : repeater.name === "categories" ? categories : [];
      const maximum = Number.isFinite(repeater.max) ? Math.max(0, repeater.max) : records.length;
      const limited = records.slice(0, maximum);
      const minimum = options.mode === "editor" ? Math.max(0, Number(repeater.min) || 0) : 0;
      const count = Math.max(limited.length, minimum);
      const fragments = document.createDocumentFragment();
      for (let index = 0; index < count; index += 1) {
        const record = limited[index] || null;
        const clone = template.content.cloneNode(true);
        const wrapper = document.createElement("div");
        wrapper.append(clone);
        if (record) {
          const category = repeater.name === "products"
            ? data.categories.find(item => String(item.id) === String(record.category_id ?? record.categoryId))
              || data.categories.find(item => item.name === (record.category_name || record.categoryName))
            : record;
          const productRecord = { ...record, category };
          applySlots(wrapper, data, options, productRecord);
          const article = wrapper.firstElementChild;
          if (article && repeater.name === "products" && record.id != null) {
            article.setAttribute("data-product-id", String(record.id));
          }
          if (article && repeater.name === "products") {
            const categoryName = category?.slug || category?.name || record.category_name || record.categoryName || "";
            const categorySlug = String(categoryName).normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
            article.setAttribute("data-category", categorySlug);
            article.setAttribute("data-title", String(record.name || ""));
            article.setAttribute("data-description", String(record.description || ""));
            article.setAttribute("data-meta", formatPrice(record, data));
            article.setAttribute("data-image", imageOf(record));
            for (const action of wrapper.querySelectorAll("[data-action]")) {
              action.setAttribute("data-id", String(record.id));
            }
            for (const link of wrapper.querySelectorAll("[href]")) {
              if (link.matches("[data-action], [data-nav-id]")) {
                link.setAttribute("data-nav-id", String(record.id));
              }
            }
          } else if (article && repeater.name === "categories") {
            const slug = String(record.slug || record.name || "").normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
            article.setAttribute("data-filter", slug);
            article.setAttribute("data-tab", String(record.name || ""));
            const list = template.parentElement;
            const link = article.matches("a[href]") ? article : article.querySelector("a[href]");
            if (link && list?.hasAttribute("data-eshop-category-list")) {
              link.setAttribute("href", list.getAttribute("data-eshop-shop-route") || "#shop");
              link.setAttribute("data-filter", slug);
              link.setAttribute("data-eshop-category-link", "");
            }
          }
          if (repeater.name === "categories") {
            for (const item of wrapper.querySelectorAll("[data-slot='category.name']")) {
              const slug = String(record.slug || record.name || "").normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
              item.setAttribute("data-filter", slug);
              item.setAttribute("data-tab", String(record.name || ""));
            }
          }
        } else if (options.mode === "editor") {
          for (const slot of wrapper.querySelectorAll("[data-slot]")) {
            if (slot.getAttribute("data-slot").endsWith(".image")) {
              setSlot(slot, slot.getAttribute("data-slot"), "", { ...options, data });
            } else {
              slot.textContent = "";
              slot.setAttribute("data-skeleton-text", "");
            }
          }
        }
        fragments.append(...wrapper.childNodes);
      }
      template.replaceWith(fragments);
      if (container && records.length === 0 && options.mode === "live") {
        if (repeater.emptyBehavior === "hide") container.hidden = true;
        else if (repeater.emptyBehavior === "message") {
          const message = document.createElement("p");
          message.className = "eshop-empty-catalog";
          message.setAttribute("role", "status");
          message.textContent = "No products available yet.";
          container.append(message);
        }
      }
    }
  }
}

function applyDocumentSlots(document, schema, data, options) {
  for (const [selector, slot] of Object.entries(schema.singleSlots || {})) {
    for (const element of document.querySelectorAll(selector)) element.setAttribute("data-slot", slot);
  }
  applySlots(document, data, options);
  for (const element of document.querySelectorAll("[data-skeleton-text]")) {
    if (options.mode === "editor") {
      element.classList.add("eshop-skeleton-bar");
    } else {
      element.hidden = true;
      element.setAttribute("aria-hidden", "true");
    }
  }
}

function replaceMarkedData(html, key, value) {
  const marker = `/*__ESHOP_DATA_${key}__*/`;
  const replacement = JSON.stringify(value).replace(/</g, "\\u003c");
  let output = html;
  let offset = 0;
  while (true) {
    const markerIndex = output.indexOf(marker, offset);
    if (markerIndex < 0) return output;
    let start = markerIndex + marker.length;
    while (/\s/.test(output[start] || "")) start += 1;
    const opening = output[start];
    if (opening !== "[" && opening !== "{") {
      throw new Error(`Invalid initializer after theme data marker: ${key}`);
    }
    const stack = [];
    let quote = "";
    let escaped = false;
    let end = start;
    for (; end < output.length; end += 1) {
      const character = output[end];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
        continue;
      }
      if (character === "\"" || character === "'") {
        quote = character;
        continue;
      }
      if (character === "[" || character === "{") stack.push(character);
      else if (character === "]" || character === "}") {
        stack.pop();
        if (!stack.length) {
          end += 1;
          break;
        }
      }
    }
    if (stack.length) throw new Error(`Unterminated theme data initializer: ${key}`);
    output = `${output.slice(0, markerIndex)}${replacement}${output.slice(end)}`;
    offset = markerIndex + replacement.length;
  }
}

export function fillThemeSkeleton(html, schema, shopData, options = {}) {
  const Parser = options.DOMParser || globalThis.DOMParser;
  if (!Parser) throw new Error("fillThemeSkeleton requires a DOMParser.");
  const data = {
    ...shopData,
    products: activeProducts(shopData),
    categories: categoriesForProducts(shopData)
  };
  const nativeData = schema.fieldMap
    ? mapGenericThemeData(schema, data)
    : dataForTheme(schema.themeId, data);
  let filledHtml = String(html);
  for (const [key, value] of Object.entries(nativeData)) {
    filledHtml = replaceMarkedData(filledHtml, key, value);
  }
  const document = new Parser().parseFromString(filledHtml, "text/html");
  const mode = options.mode === "editor" ? "editor" : "live";
  applyDocumentSlots(document, schema, data, { mode });
  fillRepeaters(document, schema, data, { mode });
  if (document.querySelector("[data-eshop-category-link]")) {
    const categoryNavigation = document.createElement("script");
    categoryNavigation.setAttribute("data-eshop-category-navigation", "");
    categoryNavigation.textContent = `(function(){var active='';function apply(){document.querySelectorAll('[data-product-id][data-category]').forEach(function(card){card.hidden=!!active&&card.getAttribute('data-category')!==active;});}document.addEventListener('click',function(event){var target=event.target&&event.target.closest&&event.target.closest('[data-eshop-category-link],[data-filter],[data-cat],[data-tab]');if(!target)return;var value=target.getAttribute('data-filter')||target.getAttribute('data-cat')||target.getAttribute('data-tab')||'';active=/^(all|any|everything)$/i.test(value)?'':value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');window.setTimeout(apply,0);},true);})();`;
    document.head.append(categoryNavigation);
  }
  if (schema.jsonLd) {
    const jsonLd = document.querySelector("[data-eshop-jsonld]");
    if (jsonLd) {
      jsonLd.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: data.store?.name || ""
      });
    }
  }
  const productPayload = document.createElement("script");
  productPayload.type = "application/json";
  productPayload.setAttribute("data-eshop-filled-products", "");
  productPayload.textContent = JSON.stringify(data.products.map(product => ({ id: String(product.id) })));
  document.head.append(productPayload);
  document.documentElement.removeAttribute("data-eshop-skeleton-preview");
  document.querySelector("[data-eshop-skeleton-scrubber]")?.remove();
  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}

if (typeof window !== "undefined") {
  window.fillThemeSkeleton = fillThemeSkeleton;
}
