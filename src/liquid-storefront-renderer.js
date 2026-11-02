import { Liquid } from "liquidjs";

const THEME_ROOT = "my-own-theme";
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

const mediaUrl = value => {
  const image = Array.isArray(value) ? value[0] : value;
  return typeof image === "string" ? image : String(image?.url || image?.src || "");
};

const currencyText = (value, currency) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "KES" }).format(amount);
  } catch {
    return String(amount);
  }
};

function removePlaceholderImages(value) {
  if (Array.isArray(value)) return value.map(removePlaceholderImages);
  if (!value || typeof value !== "object") return value;
  for (const [key, item] of Object.entries(value)) {
    if (/^image/i.test(key) && typeof item === "string" &&
        (/^data:image\/svg\+xml/i.test(item) || /via\.placeholder\.com/i.test(item))) {
      value[key] = "";
    } else {
      value[key] = removePlaceholderImages(item);
    }
  }
  return value;
}

function defaultsFor(settings = []) {
  return Object.fromEntries(settings.map(setting => [
    setting.id,
    setting.type === "image_url" && /^data:image\/svg\+xml/i.test(String(setting.default || ""))
      ? ""
      : setting.default
  ]));
}

export async function renderLiquidStorefront(catalog, {
  loadFile,
  settings = null,
  baseUrl = "/"
}) {
  if (typeof loadFile !== "function") throw new Error("Liquid theme file loader is required.");
  const manifest = JSON.parse(await loadFile("manifest.json"));
  if (!Array.isArray(manifest) || !manifest.includes("layout/theme.liquid")) {
    throw new Error("My Own Theme manifest is invalid.");
  }
  const files = new Map(await Promise.all(manifest.map(async path => {
    if (typeof path !== "string" || path.startsWith("/") || path.includes("..")) {
      throw new Error("My Own Theme manifest contains an invalid path.");
    }
    return [path, await loadFile(path)];
  })));
  const engine = new Liquid({ strictFilters: false, strictVariables: false });
  engine.registerFilter("asset_url", asset => `assets/${String(asset || "").replace(/^assets\//, "")}`);
  engine.registerFilter("stylesheet_tag", asset => {
    const name = String(asset || "").replace(/^assets\//, "");
    return `<style>${files.get(`assets/${name}`) || ""}</style>`;
  });
  engine.registerFilter("script_tag", asset => {
    const name = String(asset || "").replace(/^assets\//, "");
    const source = files.get(`assets/${name}`)?.replace(/https:\/\/via\.placeholder\.com\/[^"'`\\\s)]+/g, "");
    return source ? `<script>${source.replace(/<\/script/gi, "<\\/script")}<\/script>` : "";
  });

  const sectionFiles = [...files.entries()].filter(([path]) => path.startsWith("sections/"));
  const sections = new Map(sectionFiles.map(([path, source]) => {
    const name = path.slice("sections/".length).replace(/\.liquid$/, "");
    const schema = source.match(/\{% schema %\}([\s\S]*?)\{% endschema %\}/);
    return [name, {
      source: source.replace(/\{% schema %\}[\s\S]*$/, ""),
      schema: schema ? JSON.parse(schema[1]) : { settings: [] }
    }];
  }));
  const templates = [...files.entries()]
    .filter(([path]) => /^templates\/[^/]+\.json$/.test(path))
    .map(([path, source]) => [path.slice("templates/".length).replace(/\.json$/, ""), JSON.parse(source)]);
  const savedScreens = settings?.screens && typeof settings.screens === "object" ? settings.screens : {};
  const themeSchema = JSON.parse(files.get("config/settings_schema.json") || "[]");
  const themeDefaults = Object.assign({}, JSON.parse(files.get("config/settings_data.json") || "{}"));
  const themeSettings = Object.assign(themeDefaults, settings?.theme || {});
  const store = catalog?.store || {};
  const products = (catalog?.products || []).filter(product => product.status !== "archived");
  const categories = catalog?.categories || [];
  const product = products[0] || {};
  const category = categories[0] || {};
  const name = String(store.name || store.title || "");
  const currency = store.currency || "KES";
  const urlFor = item => mediaUrl(item?.images?.[0] || item?.image);
  const imageUrlsFor = item => (Array.isArray(item?.images) ? item.images : [item?.image])
    .map(mediaUrl).filter(Boolean);

  function prepare(section) {
    section.settings = { ...defaultsFor(sections.get(section.type)?.schema.settings), ...(section.settings || {}) };
    section.blocks = (section.blocks || []).map(block => ({
      ...block,
      settings: { ...defaultsFor(sections.get(section.type)?.schema.blocks?.find(item => item.type === block.type)?.settings),
        ...(block.settings || {}) }
    }));
    const value = section.settings;
    if (section.type === "site_header") {
      Object.assign(value, { text_1: "Home", text_2: "Categories", text_3: "", text_4: "", text_5: "", text_6: name });
    } else if (section.type === "hero_section") {
      Object.assign(value, { text_1: name, text_2: String(product.name || ""), text_3: String(product.description || ""),
        text_4: currencyText(product.price, currency), image_1: urlFor(product), image_2: urlFor(product),
        alt_5: String(product.name || ""), alt_6: String(product.name || "") });
    } else if (section.type === "product_collection") {
      value.text_1 = value.text_1 || "Products";
      section.blocks = products.map(item => ({
        type: "item",
        settings: { text_1: String(item.name || ""), text_2: currencyText(item.price, currency),
          text_3: "Add to Cart", image_1: urlFor(item), alt_4: String(item.name || "") }
      }));
    } else if (section.type === "category_grid_section") {
      section.blocks = categories.map(item => ({
        type: "item",
        settings: { text_1: String(item.name || ""), image_1: urlFor(item), alt_2: String(item.name || "") }
      }));
    } else if (section.type === "page_header") {
      value.text_1 = "Categories";
    } else if (section.type === "product_detail") {
      const images = imageUrlsFor(product);
      Object.assign(value, { text_1: String(product.name || ""), text_2: "", text_3: currencyText(product.price, currency),
        text_4: String(product.description || ""), image_1: urlFor(product), alt_9: String(product.name || "") });
      [2, 3, 4].forEach(index => {
        value[`image_${index}`] = images[index - 1] || "";
        value[`alt_${index + 8}`] = String(product.name || "");
      });
    } else if (section.type === "skincare_section") {
      Object.assign(value, { text_1: category.name ? "Shop" : "", text_2: String(category.name || ""),
        text_3: "", text_4: String(category.description || ""), text_5: category.name ? "View category" : "",
        text_6: String(product.name || ""), text_7: "", image_1: urlFor(category),
        alt_8: String(category.name || "") });
    } else if (section.type === "category_banner") {
      Object.assign(value, { text_1: String(category.name || ""), text_2: category.name ? "View category" : "" });
    } else if (section.type === "cart_section") {
      Object.keys(value).forEach(key => {
        if (/^(?:text|image)_/.test(key)) value[key] = "";
      });
    } else if (section.type === "site_footer") {
      Object.assign(value, { text_1: String(store.description || ""), text_2: String(store.tagline || ""),
        text_3: name, text_4: `© ${new Date().getFullYear()} ${name}` });
      section.blocks = [];
    }
    return removePlaceholderImages(section);
  }

  const renderSections = async (entries, isHome = false) => {
    let output = "";
    for (const entry of entries || []) {
      if (entry.wrap) {
        output += `${entry.wrap}${await renderSections(entry.children, isHome)}${entry.end || ""}`;
        continue;
      }
      if (!isHome && ["site_header", "site_footer"].includes(entry.type)) continue;
      const section = prepare(entry);
      const definition = sections.get(section.type);
      if (!definition) throw new Error(`My Own Theme section is missing: ${section.type}`);
      output += await engine.parseAndRender(definition.source, {
        section: { id: section.uid || section.type, settings: section.settings,
          blocks: section.blocks.map(block => ({ id: block.uid || block.type, settings: block.settings })) },
        settings: themeSettings
      });
    }
    return output;
  };

  const content = [];
  const selectedTemplates = templates.filter(([screen]) =>
    screen !== "index" || !templates.some(([name]) => name === "home"));
  for (const [screen, template] of selectedTemplates) {
    const order = Array.isArray(savedScreens[screen]) ? savedScreens[screen] : template.order || [];
    content.push(await renderSections(order, screen === "home" || screen === "index"));
  }
  const html = await engine.parseAndRender(files.get("layout/theme.liquid"), {
    content_for_layout: content.join("\n"),
    settings: themeSettings,
    shop: store,
    page_title: name
  });
  const resolvedBaseUrl = /^[a-z][a-z\d+.-]*:/i.test(baseUrl)
    ? baseUrl
    : new URL(baseUrl, globalThis.location?.origin || "https://localhost").href;
  const baseTag = `<base href="${escapeHtml(resolvedBaseUrl)}">`;
  const themeMarker = '<meta name="eshop-filled-theme" content="craft-main-storefront"><meta name="eshop-liquid-theme" content="my-own-theme">';
  return html.replace(/<head\b[^>]*>/i, match => `${match}${baseTag}${themeMarker}`);
}

export { escapeHtml as escapeLiquidHtml };
