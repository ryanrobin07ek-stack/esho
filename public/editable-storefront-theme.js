const currencyLocales = {
  KES: "en-KE",
  NGN: "en-NG",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "en-IE",
  ZAR: "en-ZA",
  UGX: "en-UG",
  TZS: "sw-TZ",
  GHS: "en-GH"
};

const googleFontFamilies = {
  "Plus Jakarta Sans": "Plus Jakarta Sans:wght@400;500;600;700;800",
  "Bricolage Grotesque": "Bricolage Grotesque:wght@400;500;600;700;800",
  Inter: "Inter:wght@400;500;600;700",
  "Playfair Display": "Playfair Display:wght@400;500;600;700",
  Manrope: "Manrope:wght@400;500;600;700;800",
  Anton: "Anton",
  Caveat: "Caveat:wght@400;500;600;700",
  Oswald: "Oswald:wght@400;500;600;700",
  "JetBrains Mono": "JetBrains Mono:wght@400;500;600;700"
};

const productImages = product => {
  const images = Array.isArray(product.images) ? product.images : [];
  const image = product.imageUri || product.image_uri || product.image_url || product.image || product.media || "";
  return (images.length ? images : image ? [image] : [])
    .filter(value => typeof value === "string" && value);
};

const slugify = value => String(value || "").trim().toLocaleLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";

function safeJSON(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function shopCatalog(catalog) {
  const sourceCategories = Array.isArray(catalog.categories) ? catalog.categories : [];
  const categories = sourceCategories
    .filter(category => category && category.status !== "archived" &&
      category.published !== false && category.published !== 0)
    .map((category, index) => ({
      id: String(category.id ?? `category-${index + 1}`),
      name: String(category.name || ""),
      slug: slugify(category.slug || category.name),
      parentId: category.parentId ?? category.parent_id ?? null,
      image: String(category.image || category.image_uri || category.image_url || category.media || "")
    }));
  const categoryIds = new Set(categories.map(category => category.id));
  const products = (Array.isArray(catalog.products) ? catalog.products : [])
    .filter(product => product && product.status !== "archived" &&
      product.published !== false && product.published !== 0)
    .map((product, index) => {
      const rawCategory = product.categoryIds?.[0] ?? product.categoryId ?? product.category_id;
      const rawSubcategory = product.categoryIds?.[1] ?? product.subcategoryId ?? product.subcategory_id;
      const categoryId = rawCategory == null ? "" : String(rawCategory);
      const subcategoryId = rawSubcategory == null ? "" : String(rawSubcategory);
      const validCategoryId = categoryIds.has(categoryId) ? categoryId : "";
      const validSubcategoryId = categoryIds.has(subcategoryId) ? subcategoryId : "";
      const imageList = productImages(product);
      return {
        id: String(product.id ?? `product-${index + 1}`),
        name: String(product.name || ""),
        slug: slugify(product.slug || product.name),
        price: Number(product.price ?? product.selling_price ?? product.sellingPrice) || 0,
        description: String(product.description || ""),
        brand: String(product.brand || ""),
        categoryId: validCategoryId,
        subcategoryId: validSubcategoryId,
        images: imageList,
        sku: String(product.sku || "")
      };
    });
  return { categories, products };
}

function makeSlugsUnique(records) {
  const counts = new Map();
  records.forEach(record => counts.set(record.slug, (counts.get(record.slug) || 0) + 1));
  const candidates = records.map(record => ({
    record,
    base: record.slug,
    slug: counts.get(record.slug) > 1
      ? `${record.slug}-${slugify(record.id)}`
      : record.slug,
    generated: counts.get(record.slug) > 1
  })).sort((left, right) =>
    Number(left.generated) - Number(right.generated) ||
    (left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0) ||
    (String(left.record.id) < String(right.record.id) ? -1 :
      String(left.record.id) > String(right.record.id) ? 1 : 0)
  );
  const used = new Set();
  candidates.forEach(item => {
    let candidate = item.slug;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${item.slug}-${suffix}`;
      suffix += 1;
    }
    item.record.slug = candidate;
    used.add(candidate);
  });
}

export function craftStudioAppearance(savedStudio) {
  const theme = savedStudio?.published?.theme;
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) return null;
  const colors = theme.colors && typeof theme.colors === "object" && !Array.isArray(theme.colors)
    ? theme.colors
    : {};
  const fonts = theme.fonts && typeof theme.fonts === "object" && !Array.isArray(theme.fonts)
    ? theme.fonts
    : {};
  const radius = Number(theme.radius);
  return {
    published: {
      theme: {
        colors: { ...colors },
        fonts: { ...fonts },
        ...(Number.isFinite(radius) ? { radius } : {})
      }
    }
  };
}

export function fillEditableStorefrontTheme(source, catalog = {}, assetUrl, savedStudio = null) {
  if (typeof source !== "string" || typeof assetUrl !== "string") {
    throw new Error("The selected storefront theme could not be prepared.");
  }
  const dataPattern = /const DATA\s*=\s*\{[\s\S]*?categories:\s*\[\s*\][\s\S]*?products:\s*\[\s*\][\s\S]*?\};/;
  const currencyPattern = /currency:\s*\{\s*code:\s*'[^']*',[^\r\n]*\r?\n\s*locale:\s*'[^']*',[^\r\n]*\r?\n\s*symbol:\s*'[^']*'\s*\}/;
  if (!dataPattern.test(source) || !currencyPattern.test(source)) {
    throw new Error("The selected storefront theme has an unsupported catalog format.");
  }
  const studioPublished = savedStudio?.published;
  const currency = String(catalog.store?.currency ||
    studioPublished?.settings?.currency?.code || "NGN").toUpperCase();
  const locale = currencyLocales[currency] || "en";
  let symbol = currency;
  try {
    symbol = new Intl.NumberFormat(locale, { style: "currency", currency })
      .formatToParts(0).find(part => part.type === "currency")?.value || currency;
  } catch {
    throw new Error(`The shop currency "${currency}" is not supported by this theme.`);
  }
  const storefrontCatalog = studioPublished && (
    Array.isArray(studioPublished.products) || Array.isArray(studioPublished.categories)
  ) ? {
    ...catalog,
    products: Array.isArray(studioPublished.products) ? studioPublished.products : catalog.products,
    categories: Array.isArray(studioPublished.categories) ? studioPublished.categories : catalog.categories
  } : catalog;
  const data = shopCatalog(storefrontCatalog);
  makeSlugsUnique(data.categories);
  makeSlugsUnique(data.products);
  const currencyConfig = `currency: { code: ${safeJSON(currency)}, locale: ${safeJSON(locale)}, symbol: ${safeJSON(symbol)} }`;
  const baseHref = new URL(".", assetUrl).href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const studioCss = craftStudioThemeCss(savedStudio);
  const studioFonts = craftStudioGoogleFonts(savedStudio);
  const studioData = studioPublished ? safeJSON(studioPublished) : "";
  let output = source
    .replace(dataPattern, `const DATA = ${safeJSON(data)};`)
    .replace(currencyPattern, currencyConfig);
  output = output.replace(/<head\b[^>]*>/i, match =>
    `${match}<base href="${baseHref}"><meta name="eshop-filled-theme" content="craft-main-storefront">` +
      (studioFonts ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${studioFonts}">` : "") +
      (studioCss ? `<style id="eshop-craft-studio-theme">${studioCss}</style>` : "") +
      (studioData ? `<script type="application/json" id="eshop-studio-data">${studioData}</script>` : ""));
  return output;
}

export function craftStudioGoogleFonts(savedStudio) {
  const fonts = savedStudio?.published?.theme?.fonts;
  if (!fonts || typeof fonts !== "object") return "";
  const families = [...new Set(["head", "body"].map(role => {
    const stack = typeof fonts[role] === "string" ? fonts[role] : "";
    const family = stack.match(/^"([^"]+)"/)?.[1];
    return family && googleFontFamilies[family] ? googleFontFamilies[family] : "";
  }).filter(Boolean))];
  if (!families.length) return "";
  const params = new URLSearchParams();
  families.forEach(family => params.append("family", family));
  params.set("display", "swap");
  return `https://fonts.googleapis.com/css2?${params.toString()}`;
}

export function craftStudioThemeCss(savedStudio) {
  const theme = savedStudio?.published?.theme;
  if (!theme || typeof theme !== "object") return "";

  const colors = theme.colors && typeof theme.colors === "object" ? theme.colors : {};
  const color = key => /^#[0-9a-f]{6}$/i.test(colors[key] || "") ? colors[key] : "";
  const font = value => typeof value === "string" && /^[\w\s"',-]+$/u.test(value.trim())
    ? value.trim()
    : "";
  const radius = Number.isFinite(Number(theme.radius))
    ? Math.max(0, Math.min(28, Number(theme.radius)))
    : null;
  const declarations = [
    color("wine") && `--sky:${color("wine")}`,
    color("wineDeep") && `--sky-dark:${color("wineDeep")}`,
    color("sand") && `--sky-light:${color("sand")}`,
    color("sandPale") && `--sky-lighter:${color("sandPale")}`,
    color("text") && `--ink:${color("text")}`,
    color("muted") && `--muted:${color("muted")}`,
    color("white") && `--white:${color("white")}`,
    color("surfaceBackground") && `--surface-bg:${color("surfaceBackground")}`,
    color("pageBackground") && `--page-bg:${color("pageBackground")}`,
    color("headerBackground") && `--header-bg:${color("headerBackground")}`,
    color("navigationBackground") && `--nav-bg:${color("navigationBackground")}`,
    color("footerBackground") && `--footer-bg:${color("footerBackground")}`,
    color("footerText") && `--footer-text:${color("footerText")}`,
    `--border:${color("border") || `${color("wine") || "#2f9fdd"}2e`}`,
    `--accent-wash:${color("wine") || "#2f9fdd"}1a`,
    radius !== null && `--radius:${radius}px;--radius-sm:${Math.min(radius, 8)}px;--radius-lg:${Math.min(radius + 4, 32)}px`
  ].filter(Boolean);
  const bodyFont = font(theme.fonts?.body);
  const headingFont = font(theme.fonts?.head);
  const rules = [];

  if (declarations.length) rules.push(`:root{${declarations.join(";")}}`);
  const pageBackground = color("pageBackground") || color("sandPale");
  const surfaceBackground = color("surfaceBackground") || color("white");
  if (pageBackground) rules.push(`body{background-color:${pageBackground}!important}`);
  if (surfaceBackground) {
    rules.push(`.product-card,.product-media,.cat-item,.drawer{background-color:${surfaceBackground}!important}`);
  }
  if (color("headerBackground")) rules.push(`.site-header{background-color:${color("headerBackground")}!important}`);
  if (color("navigationBackground")) rules.push(`.bottom-nav{background-color:${color("navigationBackground")}!important}`);
  if (color("footerBackground")) rules.push(`.site-footer{background-color:${color("footerBackground")}!important}`);
  if (color("footerText")) rules.push(`.site-footer,.site-footer .footer-links a{color:${color("footerText")}!important}`);
  if (color("text")) rules.push(`body{color:${color("text")}!important}`);
  if (radius !== null) {
    rules.push(`.product-card,.product-media,.cat-item{border-radius:${radius}px!important}`);
  }
  if (bodyFont) rules.push(`body,body *{font-family:${bodyFont}!important}`);
  if (headingFont) rules.push(`body h1,body h2,body h3,body h4,body h5,body h6{font-family:${headingFont}!important}`);
  return rules.join("\n");
}
