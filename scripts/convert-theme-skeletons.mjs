import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { installSkeletonPreviewRuntime } from "./theme-skeleton-preview-runtime.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public", "theme-skeletons");

const PILOT = [
  {
    themeId: "cira-atelier-event-architecture-management",
    sourcePrefix: "cira-atelier-",
    class: "A",
    repeaters: [
      { name: "products", min: 4, max: null, emptyBehavior: "hide" },
      { name: "categories", min: 0, max: null, emptyBehavior: "hide" }
    ],
    singleSlots: {
      ".brand-wordmark": "store.name",
      "#heroTitle": "store.name"
    },
    colorTokenPrefix: "cira"
  },
  {
    themeId: "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
    sourcePrefix: "aura-luxe-",
    class: "B",
    dataBindings: {
      APP_CONFIG: "auraAppConfig",
      CATALOGUE: "auraCatalogue",
      CATEGORIES: "auraCategories",
      BRANDS_LIST: "auraBrands"
    },
    repeaters: [],
    singleSlots: {
      ".brand-logo": "store.name",
      ".brand-wordmark": "store.name"
    },
    colorTokenPrefix: "aura"
  },
  {
    themeId: "kicks-vault-curated-sneaker-footwear-archive",
    sourcePrefix: "kicks-vault-",
    class: "C",
    dataBindings: {
      BRANDS_LIST: "kicksBrands",
      CATEGORIES_LIST: "kicksCategories",
      SHOE_PHOTOS: "kicksPhotos",
      MODEL_BLUEPRINTS: "kicksBlueprints",
      EXTRA_VARIANTS: "kicksExtraVariants"
    },
    repeaters: [],
    singleSlots: {
      ".brand-logo": "store.name",
      ".brand-wordmark": "store.name"
    },
    colorTokenPrefix: "kicks"
  }
];

const COLOR_RE = /#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
const CSS_DECLARATION_RE = /((?:^|[;{])\s*[-\w]+\s*:\s*)([^;{}]*)/g;
const INLINE_DECLARATION_RE = /(\s*[-\w]+\s*:\s*)([^;]+)/g;

function previewData(themeId, key) {
  if (themeId === "aura-luxe-fine-botanical-cosmetics-luxury-beauty") {
    const products = Array.from({ length: 4 }, (_, index) => ({
      id: `skeleton-${index + 1}`,
      name: "",
      brand: "",
      category: "skeleton-category",
      subcategory: "",
      priceKES: 0,
      originalPriceKES: null,
      rating: 0,
      reviewsCount: 0,
      isPopular: true,
      isBestseller: true,
      badge: "",
      image: "",
      volume: "",
      finish: "",
      coverage: "",
      skinType: "",
      description: "",
      benefits: [],
      ingredients: "",
      howToUse: "",
      shades: []
    }));
    const data = {
      auraAppConfig: {
        BRAND_NAME: "",
        STORE_CURRENCY: "KES",
        KES_TO_USD: 1,
        FREE_SHIPPING_THRESHOLD_KES: 0,
        DEFAULT_SHIPPING_FEE_KES: 0,
        SUPPORT_PHONE: "",
        SUPPORT_EMAIL: "",
        DEFAULT_TAX_RATE: 0
      },
      auraCatalogue: products,
      auraCategories: [{ id: "all", name: "", count: 4, description: "" }, { id: "skeleton-category", name: "", count: 4, description: "" }],
      auraBrands: [{ id: "skeleton-brand", name: "", country: "", tagline: "", description: "" }]
    };
    return data[key];
  }
  if (themeId === "kicks-vault-curated-sneaker-footwear-archive") {
    const products = Array.from({ length: 4 }, (_, index) => ({
      id: `skeleton-${index + 1}`,
      brand: "",
      name: "",
      cat: "",
      price: 1,
      orig: null,
      tag: "",
      desc: "",
      stock: 16,
      isNew: false
    }));
    const data = {
      kicksBrands: [""],
      kicksCategories: [""],
      kicksPhotos: ["", "", "", ""],
      kicksBlueprints: products,
      kicksExtraVariants: []
    };
    return data[key];
  }
  return undefined;
}

function declarationEnd(source, start) {
  const stack = [];
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === "\"" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "[" || character === "{" || character === "(") stack.push(character);
    else if (character === "]" || character === "}" || character === ")") stack.pop();
    else if (character === ";" && stack.length === 0) return index;
  }
  throw new Error("Could not locate end of JavaScript data initializer.");
}

function replaceDataDeclaration(script, variable, marker) {
  const declaration = new RegExp(`\\b(?:const|let|var)\\s+${variable}\\s*=\\s*`, "g");
  const match = declaration.exec(script);
  if (!match) return { script, replaced: false };
  const start = match.index + match[0].length;
  const end = declarationEnd(script, start);
  return {
    script: `${script.slice(0, start)}/*__ESHOP_DATA_${marker}__*/${script[start] === "{" ? "{}" : "[]"}${script.slice(end)}`,
    replaced: true
  };
}

function skeletonizeTemplateMarkup(script) {
  return script.replace(/`((?:\\.|[^`])*)`/gs, (template, markup) => {
    const expressions = [];
    const protectedMarkup = markup.replace(/\$\{[^{}]*\}/g, expression => {
      const marker = `__ESHOP_EXPR_${expressions.length}__`;
      expressions.push(expression);
      return marker;
    });
    let skeletonMarkup = protectedMarkup
      .replace(/\s+(src|srcset|alt|title|onerror|href)\s*=\s*("([^"]*)"|'([^']*)')/gi,
        (attribute, name, quotedValue, doubleValue, singleValue) => {
          const value = doubleValue ?? singleValue ?? "";
          if (name.toLowerCase() === "onerror" || name.toLowerCase() === "srcset") return "";
          if (name.toLowerCase() === "src" && !value.includes("__ESHOP_EXPR_")) return "";
          if (["alt", "title"].includes(name.toLowerCase()) && !value.includes("__ESHOP_EXPR_")) return "";
          if (name.toLowerCase() === "href"
            && (!value.startsWith("#") || value.startsWith("tel:") || value.startsWith("mailto:"))
            && !value.includes("__ESHOP_EXPR_")) return "";
          return ` ${name}=${quotedValue}`;
        })
      .replace(/url\(\s*(['"]?)[^)'"]+\1\s*\)/gi, "none")
      .replace(/>([^<>]+)</g, (match, text) => {
        if (!text.trim() || text.includes("__ESHOP_EXPR_")) return match;
        const width = Math.max(8, Math.min(96, Math.round(text.trim().length * 2.7)));
        return `><span class="eshop-skeleton-bar" data-skeleton-text="" style="width:${width}%"></span><`;
      });
    expressions.forEach((expression, index) => {
      skeletonMarkup = skeletonMarkup.replace(`__ESHOP_EXPR_${index}__`, expression);
    });
    return `\`${skeletonMarkup}\``;
  });
}

function makeCiraRepeaters(document) {
  const gallery = document.querySelector("#portfolioGallery");
  const firstCard = gallery?.querySelector(".portfolio-item");
  if (!gallery || !firstCard) throw new Error("Cira portfolio card template was not found.");

  const card = firstCard.cloneNode(true);
  for (const [selector, slot] of [
    [".portfolio-title", "product.name"],
    [".portfolio-meta", "product.price"],
    [".portfolio-summary", "product.description"],
    [".portfolio-open-hint", "product.action"]
  ]) {
    const element = card.querySelector(selector);
    if (element) {
      element.setAttribute("data-slot", slot);
      element.replaceChildren();
    }
  }
  card.querySelector(".portfolio-thumb img")?.setAttribute("data-slot", "product.image");
  const template = document.createElement("template");
  template.dataset.repeat = "products";
  template.dataset.fillTemplate = "";
  template.content.append(card);
  gallery.replaceChildren(template);

  const filterBar = document.querySelector(".filter-bar");
  const sourceButton = filterBar?.querySelector(".filter-btn");
  if (!filterBar || !sourceButton) throw new Error("Cira category filter template was not found.");
  sourceButton.textContent = "All";
  sourceButton.dataset.filter = "all";
  for (const button of [...filterBar.querySelectorAll(".filter-btn")].slice(1)) button.remove();
  const categoryButton = document.createElement("button");
  categoryButton.type = "button";
  categoryButton.className = "filter-btn";
  categoryButton.dataset.slot = "category.name";
  const categoryTemplate = document.createElement("template");
  categoryTemplate.dataset.repeat = "categories";
  categoryTemplate.dataset.fillTemplate = "";
  categoryTemplate.content.append(categoryButton);
  filterBar.append(categoryTemplate);
}

function tokenizeColors(document, prefix) {
  const tokens = new Map();
  const tokenFor = color => {
    const key = color.replace(/\s+/g, "").toLowerCase();
    if (!tokens.has(key)) tokens.set(key, `--theme-${prefix}-color-${String(tokens.size + 1).padStart(2, "0")}`);
    return `var(${tokens.get(key)})`;
  };
  for (const style of document.querySelectorAll("style")) {
    style.textContent = style.textContent.replace(CSS_DECLARATION_RE, (match, declaration, value) =>
      declaration + value.replace(COLOR_RE, tokenFor));
    style.textContent = style.textContent.replace(/url\(\s*(['"]?)[^)'"]+\1\s*\)/gi, "none");
  }
  for (const element of document.querySelectorAll("[style]")) {
    const style = element.getAttribute("style");
    element.setAttribute("style", style.replace(INLINE_DECLARATION_RE, (match, declaration, value) =>
      declaration + value.replace(COLOR_RE, tokenFor)));
    element.setAttribute("style", element.getAttribute("style").replace(/url\(\s*(['"]?)[^)'"]+\1\s*\)/gi, "none"));
  }
  for (const element of document.querySelectorAll("[fill], [stroke], [color]")) {
    for (const attribute of ["fill", "stroke", "color"]) {
      if (element.hasAttribute(attribute)) {
        element.setAttribute(attribute, element.getAttribute(attribute).replace(COLOR_RE, tokenFor));
      }
    }
  }
  if (tokens.size) {
    const registry = document.createElement("style");
    registry.dataset.themeTokens = "";
    registry.textContent = `:root{${[...tokens.entries()].map(([value, variable]) => `${variable}:${value};`).join("")}}`;
    document.head.append(registry);
  }
  return Object.fromEntries([...tokens.entries()].map(([value, variable]) => [variable, value]));
}

function fontTokens(source) {
  const googleFontLinks = [...source.matchAll(/fonts\.googleapis\.com\/css2\?family=([^"'&]+)/gi)]
    .map(match => decodeURIComponent(match[1].replace(/\+/g, " ")))
    .flatMap(families => families.split("&"))
    .map(family => family.split(":")[0].replace(/:ital.*/, "").trim());
  const cssFonts = [...source.matchAll(/font-family\s*:\s*([^;}]+)/gi)]
    .map(match => match[1].trim().replace(/['"]/g, "").split(",")[0].trim());
  const fonts = [...new Set([...googleFontLinks, ...cssFonts].filter(font => font && !font.startsWith("var(")))];
  return { body: fonts[0] || "system-ui", display: fonts[1] || fonts[0] || "system-ui" };
}

function isInsideSlot(node) {
  return Boolean(node.parentElement?.closest("[data-slot], [data-fill-template]"));
}

function addSkeletonBars(document) {
  const roots = [document.body, ...document.querySelectorAll("template")].map(element =>
    element.content || element);
  for (const root of roots) {
    const walker = document.createTreeWalker(root, document.defaultView.NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      if (!node.textContent.trim() || node.parentElement.closest("script, style, template, noscript")
        || isInsideSlot(node)) continue;
      const width = Math.max(8, Math.min(96, Math.round(node.textContent.trim().length * 2.7)));
      const bar = document.createElement("span");
      bar.className = "eshop-skeleton-bar";
      bar.dataset.skeletonText = "";
      bar.style.width = `${width}%`;
      node.replaceWith(bar);
    }
  }
}

function scrubDemoMarkup(document) {
  const contactLinkSlots = [];
  const title = document.querySelector("title");
  if (title) {
    title.textContent = "";
    title.dataset.slot = "store.name";
  }
  for (const meta of [...document.querySelectorAll("meta")]) {
    const key = meta.getAttribute("name") || meta.getAttribute("property");
    if (["charset", "viewport"].includes(meta.getAttribute("name")) || meta.hasAttribute("charset")) continue;
    if (!key) {
      meta.remove();
      continue;
    }
    const normalized = key.toLowerCase();
    if (normalized.endsWith(":image") || normalized === "twitter:image") {
      meta.remove();
      continue;
    }
    meta.setAttribute("content", "");
    meta.dataset.slot = normalized.includes("description") ? "store.description" : "store.name";
    meta.dataset.slotAttr = "content";
  }

  for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')]) script.remove();
  const jsonLd = document.createElement("script");
  jsonLd.type = "application/ld+json";
  jsonLd.dataset.eshopJsonld = "";
  document.head.append(jsonLd);

  for (const link of [...document.querySelectorAll('link[rel="preload"], link[rel="modulepreload"]')]) {
    if (link.getAttribute("as") === "image" || /image/i.test(link.getAttribute("type") || "")) link.remove();
  }
  const templateContent = [...document.querySelectorAll("template")].flatMap(template =>
    [...template.content.querySelectorAll("*")]);
  const allElements = [...document.querySelectorAll("*"), ...templateContent];
  for (const image of allElements.filter(element => element.tagName === "IMG")) {
    image.removeAttribute("src");
    image.removeAttribute("srcset");
    image.removeAttribute("alt");
    image.removeAttribute("title");
    image.dataset.skeletonMedia = "";
    image.classList.add("eshop-placeholder-media");
  }
  for (const source of allElements.filter(element => element.tagName === "SOURCE")) source.removeAttribute("srcset");
  for (const anchor of allElements.filter(element => element.tagName === "A" && element.hasAttribute("href"))) {
    const href = anchor.getAttribute("href");
    if (/^tel:/i.test(href)) {
      contactLinkSlots.push([anchor, "store.phone", "tel:"]);
      anchor.removeAttribute("href");
    } else if (/^mailto:/i.test(href)) {
      contactLinkSlots.push([anchor, "store.email", "mailto:"]);
      anchor.removeAttribute("href");
    } else if (!href.startsWith("#")) {
      anchor.removeAttribute("href");
    }
  }
  for (const form of allElements.filter(element => element.tagName === "FORM")) form.removeAttribute("action");
  for (const element of allElements.filter(element =>
    ["alt", "title", "aria-label", "placeholder"].some(attribute => element.hasAttribute(attribute)))) {
    for (const attribute of ["alt", "title", "aria-label", "placeholder"]) element.removeAttribute(attribute);
  }
  for (const element of allElements.filter(element => ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))) {
    element.removeAttribute("value");
    element.removeAttribute("placeholder");
    if (element.tagName === "TEXTAREA") element.textContent = "";
    if (element.tagName === "SELECT") {
      const first = element.querySelector("option");
      element.replaceChildren();
      if (first) {
        first.textContent = "";
        first.removeAttribute("value");
        element.append(first);
      }
    }
  }
  for (const element of allElements) {
    for (const attribute of [...element.attributes]) {
      if (/^data-(?:title|meta|image|description|service|category|price|product-id)$/i.test(attribute.name)) {
        attribute.value = "";
      }
    }
  }
  for (const svgText of allElements.filter(element =>
    ["TEXT", "TITLE", "DESC"].includes(element.tagName) && element.closest("svg"))) svgText.remove();
  addSkeletonBars(document);
  for (const [anchor, slot, prefix] of contactLinkSlots) {
    anchor.dataset.slot = slot;
    anchor.dataset.slotAttr = "href";
    anchor.dataset.slotPrefix = prefix;
  }
  for (const style of document.querySelectorAll("style")) {
    style.textContent = style.textContent.replace(/url\(\s*(['"]?)[^)'"]+\1\s*\)/gi, "none");
  }
  for (const element of allElements.filter(element => element.hasAttribute("style"))) {
    element.setAttribute("style", element.getAttribute("style").replace(/url\(\s*(['"]?)[^)'"]+\1\s*\)/gi, "none"));
  }
  const skeletonStyle = document.createElement("style");
  skeletonStyle.dataset.eshopSkeletonStyles = "";
  skeletonStyle.textContent = `
    .eshop-skeleton-bar{display:inline-block;max-width:100%;height:.72em;min-width:2.5em;border-radius:999px;background:#d1d5db;vertical-align:middle}
    .eshop-placeholder-media{background:linear-gradient(135deg,var(--theme-placeholder-start,#d1d5db),var(--theme-placeholder-end,#f3f4f6));object-fit:cover}
    [data-skeleton-text][hidden]{display:none!important}
  `;
  document.head.append(skeletonStyle);
}

function baseSchema(config, colors) {
  return {
    version: 2,
    themeId: config.themeId,
    classification: config.class,
    tokens: {
      colors,
      fonts: { body: "system-ui", display: "system-ui" }
    },
    dataBindings: config.dataBindings || {},
    repeaters: config.repeaters,
    singleSlots: config.singleSlots || {},
    stripRules: {
      removeImageSources: true,
      replaceVisibleTextWithSkeletonBars: true,
      removeDemoJsonLd: true,
      replaceKnownJavascriptData: Object.keys(config.dataBindings || {})
    },
    emptyState: {
      editor: "show-demo-style-bars-and-palette-gradient-media",
      live: "hide-empty-repeaters-and-empty-optional-slots"
    },
    jsonLd: true
  };
}

export async function convertThemeSkeleton(themeId, options = {}) {
  const config = PILOT.find(theme => theme.themeId === themeId);
  if (!config) throw new Error(`Theme is not in the pilot: ${themeId}`);
  const root = options.root || ROOT;
  const liveWebsites = path.join(root, "live-websites");
  const folder = (await import("node:fs/promises")).readdir;
  const entries = await folder(liveWebsites, { withFileTypes: true });
  const directory = entries.find(entry => entry.isDirectory() && entry.name.startsWith(config.sourcePrefix));
  if (!directory) throw new Error(`Source directory not found for ${themeId}`);
  const sourcePath = path.join(liveWebsites, directory.name, "index.html");
  const source = await readFile(sourcePath, "utf8");
  const dom = new JSDOM(source);
  const { document } = dom.window;
  const replacements = new Set();

  for (const script of document.querySelectorAll("script:not([src]):not([type='application/ld+json'])")) {
    let content = script.textContent;
    for (const [variable, key] of Object.entries(config.dataBindings || {})) {
      const result = replaceDataDeclaration(content, variable, key);
      content = result.script;
      if (result.replaced) replacements.add(variable);
    }
    if (themeId === "kicks-vault-curated-sneaker-footwear-archive") {
      content = content.replace(/id:\s*nextId\+\+,\s*name:\s*model\.name/, "id: model.id || nextId++, name: model.name")
        .replace(/isNew:\s*idx\s*%\s*4\s*===\s*0/, "isNew: Boolean(model.isNew)")
        .replace(/isSale:\s*model\.orig\s*!==\s*null/, "isSale: Boolean(model.orig)")
        .replace(/const stockBySize = \{\s*39:[\s\S]*?\n\s*\};\s*\n\s*const totalStock = Object\.values\(stockBySize\)\.reduce\(\(a, b\) => a \+ b, 0\);/,
          `const availableStock = Math.max(0, Number(model.stock) || 0);
        const stockBySize = Object.fromEntries(baseSizes.map((size, index) => [
          size, Math.floor(availableStock / baseSizes.length) + (index < availableStock % baseSizes.length ? 1 : 0)
        ]));
        const totalStock = availableStock;`)
        .replace(/console\.log\(`Initialized Kicks Vault catalogue with \$\{PRODUCTS\.length\} distinct footwear items\.`\);/,
          "console.log(`Initialized theme catalogue with ${PRODUCTS.length} items.`);");
    }
    if (themeId === "cira-atelier-event-architecture-management") {
      content = content
        .replace("var cards = document.querySelectorAll('.js-portfolio-card');", "")
        .replace("cards.forEach(function (card) {", "document.querySelectorAll('.js-portfolio-card').forEach(function (card) {");
      const delegatedLightboxBlock = /document\.querySelectorAll\('\.js-portfolio-card'\)\.forEach\(function \(card\) \{[\s\S]*?\n          \}\);\n\n          if \(privacyBtn\)/;
      const lightboxIndex = content.indexOf("function initLightboxModal()");
      if (lightboxIndex < 0) throw new Error("Cira lightbox initializer was not found.");
      const beforeLightbox = content.slice(0, lightboxIndex);
      const lightboxSource = content.slice(lightboxIndex);
      const lightboxWasDelegated = delegatedLightboxBlock.test(lightboxSource);
      const delegatedLightbox = lightboxSource.replace(delegatedLightboxBlock, `var portfolioGallery = document.getElementById('portfolioGallery');
          if (portfolioGallery) {
            function openCard(card) {
              openStudyModal({
                title: card.getAttribute('data-title'),
                meta: card.getAttribute('data-meta'),
                description: card.getAttribute('data-description'),
                image: card.getAttribute('data-image'),
                service: card.getAttribute('data-service'),
              });
            }
            portfolioGallery.addEventListener('click', function (event) {
              var card = event.target.closest('.js-portfolio-card');
              if (card) openCard(card);
            });
            portfolioGallery.addEventListener('keydown', function (event) {
              var card = event.target.closest('.js-portfolio-card');
              if (card && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                openCard(card);
              }
            });
          }

          if (privacyBtn)`);
      if (!lightboxWasDelegated) throw new Error("Cira portfolio modal handlers were not found for delegation.");
      content = beforeLightbox + delegatedLightbox;
    }
    if (themeId === "aura-luxe-fine-botanical-cosmetics-luxury-beauty") {
      content = content
        .replace(/href=(["'])tel:[^"']*\1/gi, 'href="tel:${APP_CONFIG.SUPPORT_PHONE}"')
        .replace(/href=(["'])mailto:[^"']*\1/gi, 'href="mailto:${APP_CONFIG.SUPPORT_EMAIL}"');
    }
    content = skeletonizeTemplateMarkup(content);
    for (const key of Object.values(config.dataBindings || {})) {
      const seed = previewData(themeId, key);
      if (seed === undefined) continue;
      const emptyArray = `/*__ESHOP_DATA_${key}__*/[]`;
      const emptyObject = `/*__ESHOP_DATA_${key}__*/{}`;
      content = content.replace(emptyArray, `/*__ESHOP_DATA_${key}__*/${JSON.stringify(seed)}`);
      content = content.replace(emptyObject, `/*__ESHOP_DATA_${key}__*/${JSON.stringify(seed)}`);
    }
    script.textContent = content;
  }
  for (const variable of Object.keys(config.dataBindings || {})) {
    if (!replacements.has(variable)) throw new Error(`Missing JavaScript data declaration: ${variable}`);
  }

  if (themeId === "cira-atelier-event-architecture-management") makeCiraRepeaters(document);
  const colors = tokenizeColors(document, config.colorTokenPrefix);
  for (const [selector, slot] of Object.entries(config.singleSlots || {})) {
    for (const element of document.querySelectorAll(selector)) {
      element.setAttribute("data-slot", slot);
      if (!element.hasAttribute("data-slot-attr")) element.replaceChildren();
    }
  }
  scrubDemoMarkup(document);
  installSkeletonPreviewRuntime(document);

  const schema = baseSchema(config, colors);
  schema.tokens.fonts = fontTokens(source);
  const generated = `<!doctype html>\n${document.documentElement.outerHTML}`;
  dom.window.close();
  return { html: generated, schema, sourcePath };
}

export async function convertPilot(options = {}) {
  const output = options.output || OUTPUT;
  const generated = [];
  for (const config of PILOT) {
    console.log(`Converting ${config.themeId}`);
    const result = await convertThemeSkeleton(config.themeId, options);
    const directory = path.join(output, config.themeId);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), result.html, "utf8");
    await writeFile(path.join(directory, "schema-v2.json"), `${JSON.stringify(result.schema, null, 2)}\n`, "utf8");
    generated.push({ themeId: config.themeId, html: path.join(directory, "index.html"), schema: path.join(directory, "schema-v2.json") });
  }
  return generated;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const generated = await convertPilot();
  for (const item of generated) console.log(`Converted ${item.themeId}`);
}
