const FIELD_ALIASES = {
  id: ["id", "productId", "product_id"],
  name: ["name", "title", "productName", "product_name"],
  price: ["price", "priceKES", "price_kes", "sellingPrice", "selling_price", "cost"],
  image: ["image", "imageUrl", "image_url", "imageUri", "image_uri", "images", "thumbnail", "photo"],
  category: ["categoryId", "category_id", "category", "categoryName", "category_name", "subcategory"],
  description: ["description", "desc", "details"]
};
const STATE_NAMES = /^(cart|wishlist|wishList|compare|recentlyViewed|orders|orderHistory|currentProduct|selectedProduct)$/i;
const DEMO_HOSTS = /(?:images\.)?unsplash\.com|pexels\.com|placehold\.co|placehold\.it/i;
const PRODUCT_WORDS = /product|item|catalog|card|collection|shop/i;

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (source.startsWith("//", index)) {
      index = source.indexOf("\n", index);
      if (index < 0) break;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      if (end < 0) throw new Error("Unterminated JavaScript comment.");
      index = end + 2;
      continue;
    }
    const start = index;
    if (character === "'" || character === '"' || character === "`") {
      const quote = character;
      index += 1;
      let value = "";
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\") {
          const next = source[index + 1];
          if (next === undefined) break;
          value += next === "n" ? "\n" : next === "r" ? "\r" : next;
          index += 2;
        } else {
          value += source[index];
          index += 1;
        }
      }
      if (source[index] !== quote) throw new Error("Unterminated JavaScript string.");
      index += 1;
      tokens.push({ type: "string", value, start, end: index });
      continue;
    }
    const number = source.slice(index).match(/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      index += number[0].length;
      tokens.push({ type: "number", value: Number(number[0]), start, end: index });
      continue;
    }
    const identifier = source.slice(index).match(/^[A-Za-z_$][\w$]*/);
    if (identifier) {
      index += identifier[0].length;
      tokens.push({ type: "identifier", value: identifier[0], start, end: index });
      continue;
    }
    index += 1;
    tokens.push({ type: "punctuation", value: character, start, end: index });
  }
  return tokens;
}

function parseLiteral(tokens, start = 0) {
  let cursor = start;
  const peek = value => tokens[cursor]?.value === value;
  const take = value => {
    if (!peek(value)) throw new Error(`Expected ${value}.`);
    return tokens[cursor++];
  };
  const parseValue = () => {
    const token = tokens[cursor++];
    if (!token) throw new Error("Unexpected end of JavaScript literal.");
    if (token.value === "[") {
      const result = [];
      while (!peek("]")) {
        if (peek(",")) {
          cursor += 1;
          continue;
        }
        result.push(parseValue());
        if (peek(",")) cursor += 1;
        else if (!peek("]")) throw new Error("Expected an array separator.");
      }
      take("]");
      return result;
    }
    if (token.value === "{") {
      const result = {};
      while (!peek("}")) {
        if (peek(",")) {
          cursor += 1;
          continue;
        }
        const keyToken = tokens[cursor++];
        if (!keyToken || !["identifier", "string", "number"].includes(keyToken.type)) {
          throw new Error("Unsupported JavaScript object key.");
        }
        const key = String(keyToken.value);
        take(":");
        result[key] = parseValue();
        if (peek(",")) cursor += 1;
        else if (!peek("}")) throw new Error("Expected an object separator.");
      }
      take("}");
      return result;
    }
    if (token.type === "string" || token.type === "number") return token.value;
    if (token.value === "true") return true;
    if (token.value === "false") return false;
    if (token.value === "null") return null;
    throw new Error("Unsupported JavaScript literal value.");
  };
  const value = parseValue();
  return { value, next: cursor };
}

function productRecords(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function fieldKeys(record) {
  const keys = Object.keys(record || {});
  const fields = Object.fromEntries(Object.entries(FIELD_ALIASES).map(([field, aliases]) => [
    field,
    keys.find(key => aliases.some(alias => alias.toLowerCase() === key.toLowerCase())) || field
  ]));
  fields.categoryId = keys.find(key => ["categoryId", "category_id"].includes(key)) || "categoryId";
  return fields;
}

function scoreCollection(value) {
  const records = productRecords(value);
  if (records.length < 2) return -1;
  const valid = records.filter(record => record && typeof record === "object" && !Array.isArray(record));
  if (valid.length !== records.length) return -1;
  const fields = fieldKeys(valid[0]);
  const hasIdentity = fields.id !== "id" || Object.hasOwn(valid[0], "id");
  const hasName = fields.name !== "name" || Object.hasOwn(valid[0], "name");
  const hasPrice = fields.price !== "price" || Object.hasOwn(valid[0], "price");
  if (!hasIdentity || !hasName || !hasPrice) return -1;
  const consistency = valid.filter(record => {
    const mapped = fieldKeys(record);
    return mapped.id === fields.id && mapped.name === fields.name && mapped.price === fields.price;
  }).length;
  return records.length * 100 + consistency;
}

function detectCollections(source) {
  const candidates = [];
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  for (const script of scripts) {
    const body = script[1];
    const tokens = tokenize(body);
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index].value !== "[" && tokens[index].value !== "{") continue;
      const localStart = tokens[index].start;
      const prefix = body.slice(Math.max(0, localStart - 200), localStart);
      if (!/(?:\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=|(?:["'][A-Za-z_$][\w$]*["']|[A-Za-z_$][\w$]*)\s*:)\s*$/.test(prefix)) continue;
      try {
        const parsed = parseLiteral(tokens, index);
        const score = scoreCollection(parsed.value);
        if (score < 0) continue;
        const localEnd = tokens[parsed.next - 1].end;
        const start = script.index + script[0].indexOf(body) + localStart;
        const end = script.index + script[0].indexOf(body) + localEnd;
        const binding = prefix.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/);
        candidates.push({
          start, end, value: parsed.value, score,
          key: binding?.[1] || "products",
          kind: Array.isArray(parsed.value) ? "array" : "object"
        });
      } catch {
        continue;
      }
    }
  }
  candidates.sort((left, right) => right.score - left.score || (right.end - right.start) - (left.end - left.start));
  return candidates[0] || null;
}

function clearState(source) {
  const resets = [];
  const propertyPattern = /(["']?)(cart|wishlist|wishList|compare|recentlyViewed|orders|orderHistory|currentProduct|selectedProduct)\1\s*:\s*/gi;
  let output = "";
  let cursor = 0;
  let match;
  while ((match = propertyPattern.exec(source))) {
    const valueStart = propertyPattern.lastIndex;
    let valueEnd = valueStart;
    let depth = 0;
    let quote = "";
    let escaped = false;
    for (; valueEnd < source.length; valueEnd += 1) {
      const character = source[valueEnd];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
      } else if (character === "'" || character === '"' || character === "`") quote = character;
      else if (character === "[" || character === "{" || character === "(") depth += 1;
      else if (character === "]" || character === "}" || character === ")") {
        if (depth === 0) break;
        depth -= 1;
      } else if (character === "," && depth === 0) break;
    }
    const rawValue = source.slice(valueStart, valueEnd).trim();
    if (!rawValue) continue;
    const replacement = /^(?:new\s+Set)\s*\(/.test(rawValue) ? "new Set()"
      : /product/i.test(match[2]) ? "null"
        : rawValue.startsWith("{") ? "{}" : "[]";
    output += source.slice(cursor, valueStart) + replacement;
    cursor = valueEnd;
    propertyPattern.lastIndex = valueEnd;
    resets.push(match[2]);
  }
  output += source.slice(cursor);
  return { html: output, stateReset: [...new Set(resets)] };
}

function neutralizeFakePayment(source) {
  const pattern = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
  let output = "";
  let cursor = 0;
  let match;
  const reset = [];
  while ((match = pattern.exec(source))) {
    let depth = 1;
    let index = pattern.lastIndex;
    let quote = "";
    let escaped = false;
    for (; index < source.length && depth; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
      } else if (character === "'" || character === '"' || character === "`") quote = character;
      else if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
    }
    if (depth || !/(pay|payment|checkout)/i.test(match[1])) continue;
    const bodyEnd = index;
    const body = source.slice(pattern.lastIndex, bodyEnd - 1);
    if (!/(payment[-_ ]success|paid successfully|simulate.*success|success.*payment)/i.test(body)) continue;
    output += source.slice(cursor, match.index) + `function ${match[1]}() { return; }`;
    cursor = bodyEnd;
    pattern.lastIndex = bodyEnd;
    reset.push(match[1]);
  }
  return { html: output + source.slice(cursor), stateReset: reset };
}

function neutralizePaymentCallbacks(source) {
  const pattern = /([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;
  let output = "";
  let cursor = 0;
  let match;
  const reset = [];
  while ((match = pattern.exec(source))) {
    let depth = 1;
    let index = pattern.lastIndex;
    let quote = "";
    let escaped = false;
    for (; index < source.length && depth; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
      } else if (character === "'" || character === '"' || character === "`") quote = character;
      else if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
    }
    if (depth) continue;
    const bodyEnd = index;
    const body = source.slice(pattern.lastIndex, bodyEnd - 1);
    if (!/(payment|paystack|checkout|status)/i.test(match[1]) &&
        !/(payment[-_ ]success|paid successfully|simulate.*success|success.*payment)/i.test(body)) continue;
    output += source.slice(cursor, match.index) + `${match[1]}: () => { return; }`;
    cursor = bodyEnd;
    pattern.lastIndex = bodyEnd;
    reset.push(match[1]);
  }
  return { html: output + source.slice(cursor), stateReset: reset };
}

function setSlot(element, slot, attribute) {
  if (!element) return;
  element.setAttribute("data-slot", slot);
  if (attribute) element.setAttribute("data-slot-attr", attribute);
}

function markProductCard(card) {
  const name = card.querySelector("h1,h2,h3,h4,h5,h6,[class*='title'],[class*='name']");
  const price = card.querySelector("[class*='price'],[data-price]");
  const image = card.querySelector("img,svg,[style*='background-image']");
  const category = card.querySelector("[class*='category'],[class*='brand']");
  const description = card.querySelector("p");
  if (!name || !price || !image) return false;
  setSlot(name, "product.name");
  setSlot(price, "product.price");
  setSlot(image, "product.image", image.tagName === "IMG" ? "src" : "");
  if (image.tagName === "SVG") image.replaceChildren();
  if (category) setSlot(category, "product.category");
  if (description && description !== name) setSlot(description, "product.description");
  card.removeAttribute("data-product-id");
  card.removeAttribute("data-eshop-product-card");
  for (const element of card.querySelectorAll("[data-id],[data-nav-id],[data-product-id]")) {
    element.removeAttribute("data-id");
    element.removeAttribute("data-nav-id");
    element.removeAttribute("data-product-id");
  }
  return true;
}

function elementSignature(element) {
  return `${element.localName}|${[...element.classList].sort().join(".")}`;
}

function markRepeaters(document) {
  const repeaters = [];
  const stripTerms = new Set();
  const validationTerms = new Set();
  let productCardCount = 0;
  const groupsByParent = new Map();
  for (const element of document.querySelectorAll("article,li,[class*='product-card'],[class*='product-item'],[data-eshop-product-card]")) {
    if (!PRODUCT_WORDS.test(element.className || "") &&
        !element.hasAttribute("data-product-id") &&
        !element.querySelector("[data-product-id]")) continue;
    const parent = element.parentElement;
    if (!parent) continue;
    if (!groupsByParent.has(parent)) groupsByParent.set(parent, new Map());
    const groups = groupsByParent.get(parent);
    const key = elementSignature(element);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(element);
  }
  const parents = new Set();
  for (const groups of groupsByParent.values()) for (const group of groups.values()) {
    if ((group.length < 2 && !group.every(card =>
      card.hasAttribute("data-product-id") || card.hasAttribute("data-eshop-product-card"))) ||
        !group.every(card => card.parentElement === group[0].parentElement)) continue;
    if (!group.every(card => card.querySelector("img,svg,[style*='background-image']") &&
        card.querySelector("[class*='price'],[data-price]") &&
        card.querySelector("h1,h2,h3,h4,h5,h6,[class*='title'],[class*='name']"))) continue;
    for (const card of group) {
      productCardCount += 1;
      const name = card.querySelector("h1,h2,h3,h4,h5,h6,[class*='title'],[class*='name']")?.textContent?.trim();
      if (name) {
        stripTerms.add(name);
        validationTerms.add(name);
      }
      const brand = card.querySelector("[class*='brand'],[class*='vendor']")?.textContent?.trim();
      if (brand) stripTerms.add(brand);
      for (const image of card.querySelectorAll("img[src],source[srcset],[data-image]")) {
        const source = image.getAttribute("src") || image.getAttribute("srcset") || image.getAttribute("data-image") || "";
        for (const match of source.matchAll(/https?:\/\/[^"'\\\s),]+/gi)) {
          if (DEMO_HOSTS.test(match[0])) {
            stripTerms.add(match[0]);
            validationTerms.add(match[0]);
          }
        }
      }
      for (const match of card.textContent.matchAll(/\b[A-Z][A-Z0-9_-]{4,}\b/g)) {
        stripTerms.add(match[0]);
        validationTerms.add(match[0]);
      }
    }
    const first = group[0];
    if (!markProductCard(first)) continue;
    const template = document.createElement("template");
    template.setAttribute("data-repeat", "products");
    template.content.append(first.cloneNode(true));
    const parent = first.parentElement;
    for (const card of group) card.remove();
    parent.insertBefore(template, parent.firstChild);
    parents.add(parent);
  }
  if (parents.size) repeaters.push({ name: "products", min: 0, emptyBehavior: "message" });

  const chipGroups = new Map();
  let hasCategoryRepeater = false;
  for (const list of document.querySelectorAll("[data-eshop-category-list]")) {
    const children = [...list.children];
    const first = children.find(child => child.matches("a") || child.querySelector("a[href]"));
    const link = first?.matches("a") ? first : first?.querySelector("a[href]");
    if (!first || !link) continue;
    for (const child of children) {
      const childLink = child.matches("a") ? child : child.querySelector("a[href]");
      if (childLink?.textContent.trim()) stripTerms.add(childLink.textContent.trim());
    }
    setSlot(link, "category.name");
    const template = document.createElement("template");
    template.setAttribute("data-repeat", "categories");
    template.content.append(first.cloneNode(true));
    for (const child of children) child.remove();
    list.append(template);
    hasCategoryRepeater = true;
  }

  for (const element of document.querySelectorAll("button,a,[role='button']")) {
    const filterValue = element.getAttribute("data-filter") || element.getAttribute("data-tab") ||
      element.getAttribute("data-cat") || element.getAttribute("data-category") || "";
    if (!filterValue || /^(all|any|everything)$/i.test(filterValue)) continue;
    if (!/(category|filter|tab)/i.test(`${element.className || ""} ${element.parentElement?.className || ""}`) &&
        !element.hasAttribute("data-filter") && !element.hasAttribute("data-tab") &&
        !element.hasAttribute("data-category")) continue;
    const parent = element.parentElement;
    if (!parent) continue;
    if (!chipGroups.has(parent)) chipGroups.set(parent, new Map());
    const groups = chipGroups.get(parent);
    const key = elementSignature(element);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(element);
  }
  for (const groups of chipGroups.values()) for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    for (const chip of group) {
      const name = chip.textContent.trim();
      if (name && !/^(all|any|everything)$/i.test(name)) stripTerms.add(name);
    }
    first.setAttribute("data-slot", "category.name");
    for (const attribute of ["data-filter", "data-tab", "data-cat", "data-category"]) {
      first.removeAttribute(attribute);
    }
    const template = document.createElement("template");
    template.setAttribute("data-repeat", "categories");
    template.content.append(first.cloneNode(true));
    const parent = first.parentElement;
    for (const chip of group) chip.remove();
    parent.append(template);
    hasCategoryRepeater = true;
  }
  if (hasCategoryRepeater) repeaters.push({ name: "categories", min: 0, emptyBehavior: "hide" });
  return { repeaters, stripTerms: [...stripTerms], validationTerms: [...validationTerms], productCardCount };
}

function stripDemoAssets(html, demoTerms) {
  let output = html.replace(/https?:\/\/(?:images\.)?(?:unsplash\.com|pexels\.com|placehold\.co|placehold\.it)\/[^"'\\\s)<>]*/gi, "");
  for (const term of demoTerms.filter(Boolean).sort((a, b) => b.length - a.length)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(escaped, "gi"), "");
  }
  return output;
}

function containsDemoTerm(html, term) {
  if (!term) return false;
  if (term.length >= 4) return html.toLowerCase().includes(term.toLowerCase());
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}(?=$|[^A-Za-z0-9_-])`, "i").test(html);
}

function extractDemoTerms(collection, rawHtml) {
  const stripTerms = new Set();
  const validationTerms = new Set();
  for (const match of rawHtml.matchAll(/https?:\/\/[^"'\\\s)<>]+/gi)) {
    const url = match[0].replace(/[.,;]+$/, "");
    if (DEMO_HOSTS.test(url)) {
      stripTerms.add(url);
      validationTerms.add(url);
    }
  }
  for (const record of productRecords(collection?.value)) {
    if (!record || typeof record !== "object") continue;
    for (const [key, value] of Object.entries(record)) {
      if (typeof value !== "string" || !value.trim()) continue;
      if (/^(name|title|brand|sku|category|subcategory|description|desc|image|imageUrl|image_url|photo|thumbnail)$/i.test(key) ||
          /https?:\/\//i.test(value)) stripTerms.add(value.trim());
      if (/^(name|title|productName|product_name|sku)$/i.test(key) || /https?:\/\//i.test(value)) {
        validationTerms.add(value.trim());
      }
    }
  }
  return { stripTerms: [...stripTerms], validationTerms: [...validationTerms] };
}

function mapFieldShape(record, fields) {
  const shape = { ...(record || {}) };
  for (const [field, key] of Object.entries(fields)) {
    if (!Object.hasOwn(shape, key)) {
      shape[key] = field === "price" ? 0 : field === "image" ? "" : "";
    }
  }
  return shape;
}

export function importStandaloneTheme(rawHtml, { themeId = "imported-theme", DOMParser = globalThis.DOMParser } = {}) {
  if (typeof rawHtml !== "string" || !rawHtml.trim()) throw new Error("A standalone theme HTML document is required.");
  if (!DOMParser) throw new Error("Theme import requires DOMParser.");
  const collection = detectCollections(rawHtml);
  const sampleProducts = productRecords(collection?.value);
  const fields = collection
    ? fieldKeys(sampleProducts[0])
    : { id: "id", name: "name", price: "price", image: "image", category: "category", description: "description", categoryId: "categoryId" };
  const productDataMarker = "products";
  const fieldMap = {
    collectionKey: productDataMarker,
    collectionName: collection?.key || "",
    collectionKind: collection?.kind || "array",
    fields,
    shape: mapFieldShape(sampleProducts[0], fields),
    required: ["id", "name", "price", "image", "category", "description"]
  };
  let html = collection
    ? `${rawHtml.slice(0, collection.start)}/*__ESHOP_DATA_${productDataMarker}__*/${collection.kind === "array" ? "[]" : "{}"}${rawHtml.slice(collection.end)}`
    : rawHtml;
  const { stripTerms: collectedStripTerms, validationTerms: collectedValidationTerms } =
    extractDemoTerms(collection, rawHtml);
  const stripTerms = new Set(collectedStripTerms);
  const validationTerms = new Set(collectedValidationTerms);
  if (collection) {
    const safeCollectionName = collection.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`\\|\\|\\s*(?:${safeCollectionName}\\s*\\[\\s*0\\s*\\]|Object\\.values\\(\\s*${safeCollectionName}\\s*\\)\\s*\\[\\s*0\\s*\\])`, "g"),
      "|| null");
    html = html.replace(new RegExp(`(\\b[A-Za-z_$][\\w$]*\\s*=\\s*${safeCollectionName}\\s*\\[[^\\]]+\\])\\s*\\|\\|\\s*\\{[^{}]*\\}`, "g"),
      "$1 || null");
    for (const record of sampleProducts) {
      const id = String(record?.id ?? "");
      if (id.length < 2) continue;
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(`(['"])${escaped}\\1`, "g"), '""');
    }
  }
  const stateResult = clearState(html);
  html = stateResult.html;
  const paymentResult = neutralizeFakePayment(html);
  html = paymentResult.html;
  const paymentCallbackResult = neutralizePaymentCallbacks(html);
  html = paymentCallbackResult.html;
  const document = new DOMParser().parseFromString(html, "text/html");
  const sampleIds = new Set(sampleProducts.map(record => String(record?.id ?? "")));
  for (const element of document.querySelectorAll("[data-product-id],[data-id],[data-nav-id]")) {
    const value = element.getAttribute("data-product-id") || element.getAttribute("data-id") ||
      element.getAttribute("data-nav-id");
    if (element.hasAttribute("data-product-id") &&
        element.querySelector("img,svg,[style*='background-image']") &&
        element.querySelector("[class*='price'],[data-price]") &&
        element.querySelector("h1,h2,h3,h4,h5,h6,[class*='title'],[class*='name']")) {
      element.setAttribute("data-eshop-product-card", "");
    }
    if (element.hasAttribute("data-product-id") || sampleIds.has(String(value))) {
      element.removeAttribute("data-product-id");
      if (sampleIds.has(String(value))) {
        element.removeAttribute("data-id");
        element.removeAttribute("data-nav-id");
      }
    }
    if (element.getAttribute("data-id") === "" || element.getAttribute("data-nav-id") === "") {
      element.removeAttribute("data-id");
      element.removeAttribute("data-nav-id");
    }
  }
  const domDetection = markRepeaters(document);
  for (const term of domDetection.stripTerms) stripTerms.add(term);
  for (const term of domDetection.validationTerms) validationTerms.add(term);
  html = `<!doctype html>\n${document.documentElement.outerHTML}`;
  const allStripTerms = [...stripTerms];
  html = stripDemoAssets(html, allStripTerms);

  const validationTermsList = [...validationTerms];
  const unresolved = validationTermsList.filter(term => containsDemoTerm(html, term));
  const requiredFieldsFound = fields.id && fields.name && fields.price;
  const hasProductSource = Boolean(collection || domDetection.productCardCount);
  const status = unresolved.length === 0 && requiredFieldsFound && hasProductSource ? "passed" : "needs-review";
  return {
    html,
    manifest: {
      themeId,
      version: 1,
      status,
      ...(status === "needs-review" ? { reason: unresolved.length
        ? "One or more sample catalog values remain after import."
        : !hasProductSource
          ? "No JavaScript product collection or repeated product cards were detected."
          : "Required product fields could not be mapped." } : {}),
      fieldMap,
      repeaters: domDetection.repeaters,
      stateReset: [...new Set([...stateResult.stateReset, ...paymentResult.stateReset, ...paymentCallbackResult.stateReset])],
      demoTerms: validationTermsList,
      stripTerms: allStripTerms,
      productCount: sampleProducts.length || domDetection.productCardCount
    }
  };
}

export function validateFilledTheme(html, manifest, shopData, { DOMParser = globalThis.DOMParser } = {}) {
  const errors = [];
  const products = (Array.isArray(shopData?.products) ? shopData.products : [])
    .filter(product => product && product.status !== "archived" && product.published !== false && product.published !== 0);
  const ids = new Set(products.map(product => String(product.id ?? "")));
  const shopDataText = JSON.stringify(shopData || {}).toLowerCase();
  if (!manifest?.fieldMap) errors.push("Theme manifest has no product field map.");
  for (const term of manifest?.demoTerms || []) {
    if (containsDemoTerm(html, term) && !shopDataText.includes(term.toLowerCase())) {
      errors.push(`Sample theme value remains: ${term}`);
    }
  }
  if (!DOMParser) errors.push("Theme validation requires DOMParser.");
  else {
    const document = new DOMParser().parseFromString(html, "text/html");
    const filledData = document.querySelector("script[data-eshop-filled-products]");
    let filledProducts = [];
    try {
      filledProducts = JSON.parse(filledData?.textContent || "[]");
    } catch {
      errors.push("Filled product data is invalid JSON.");
    }
    if (filledProducts.length !== products.length) {
      errors.push(`Filled product count ${filledProducts.length} does not match shop count ${products.length}.`);
    }
    for (const product of filledProducts) {
      if (!ids.has(String(product.id))) errors.push(`Filled product id is not in the shop: ${product.id}`);
    }
    for (const element of document.querySelectorAll("[data-product-id]")) {
      const id = element.getAttribute("data-product-id");
      if (!ids.has(String(id))) errors.push(`Rendered product id is not in the shop: ${id}`);
    }
  }
  if (html.includes("__ESHOP_DATA_")) errors.push("A product data marker was not filled.");
  return { ok: errors.length === 0, errors };
}

if (typeof window !== "undefined") {
  window.EshopThemeImporter = { import: importStandaloneTheme, validate: validateFilledTheme };
}
