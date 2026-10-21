import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { parse } from "acorn";
import { installSkeletonPreviewRuntime } from "./theme-skeleton-preview-runtime.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public", "theme-skeletons");
const PILOTS = new Set([
  "cira-atelier-event-architecture-management",
  "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "kicks-vault-curated-sneaker-footwear-archive"
]);
const EXCLUDED = new Set([
  "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
  "zima-fresh-supermarket-fresh-groceries-farm-produce-daily-essent"
]);
const COLOR_RE = /#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;

const BEHAVIOR_KEYS = new Set(["id", "key", "route", "icon", "class", "selector", "event", "method", "role", "field"]);
const PRICE_KEYS = /(?:price|amount|fee|cost|threshold|stock|quantity|rating|reviews?)/i;

function scrubDataConstants(script) {
  let ast;
  try {
    ast = parse(script, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true });
  } catch {
    return { script, names: [], parseFailed: true };
  }
  const edits = [];
  const names = new Set();
  const visitValue = (node, propertyName = "") => {
    if (!node) return;
    if (node.type === "ArrayExpression") {
      node.elements.forEach(element => visitValue(element, propertyName));
      return;
    }
    if (node.type === "ObjectExpression") {
      for (const property of node.properties) {
        if (property.type !== "Property") continue;
        const key = property.key.name ?? property.key.value ?? "";
        visitValue(property.value, String(key));
      }
      return;
    }
    if (node.type === "Literal" && typeof node.value === "string" && !BEHAVIOR_KEYS.has(propertyName.toLowerCase())) {
      edits.push({ start: node.start, end: node.end, value: '""' });
    } else if (node.type === "Literal" && typeof node.value === "number" && PRICE_KEYS.test(propertyName)) {
      edits.push({ start: node.start, end: node.end, value: "0" });
    }
  };
  const walk = node => {
    if (!node || typeof node !== "object") return;
    if (node.type === "VariableDeclarator" && node.id?.type === "Identifier" && /^[A-Z][A-Z0-9_]*$/.test(node.id.name)) {
      names.add(node.id.name);
      visitValue(node.init);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "start" || key === "end" || key === "loc") continue;
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object" && typeof value.type === "string") walk(value);
    }
  };
  walk(ast);
  let result = script;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, edit.start)}${edit.value}${result.slice(edit.end)}`;
  }
  return { script: result, names: [...names], parseFailed: false };
}

function scrubSensitiveText(text) {
  return text
    .replace(/https?:\/\/[^"'`\s)<>]+/gi, url => (
      /images?|photo-|unsplash|pexels|tile\.openstreetmap|maps\.google|cdn\.[^/]+\/.*\.(?:png|jpe?g|webp|gif|svg)/i.test(url) ? "" : url
    ))
    .replace(/(?:\.{1,2}\/)?(?:src\/)?assets\/images\/[\w./-]+\.(?:png|jpe?g|webp|gif|svg)/gi, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/\+?(?:254|0)[\d ()-]{7,}\d/g, "")
    .replace(/\+254(?:\s+[\w.-]+){0,3}/g, "")
    .replace(/(?:KES|KSh|USD|[$€£])\s?[\d,.]{2,}/gi, "");
}

function scrubSensitiveLiterals(script) {
  const comments = [];
  const ast = parse(script, {
    ecmaVersion: "latest",
    sourceType: "script",
    allowReturnOutsideFunction: true,
    onComment: comments
  });
  const edits = [];
  for (const comment of comments) {
    const value = comment.value
      .replace(/(?:KES|KSh|USD|[$€£])\s?[\d,.]{2,}/gi, "")
      .replace(/\+?(?:254|0)[\d ()-]{7,}\d/g, "");
    if (value !== comment.value) {
      const replacement = comment.type === "Line" ? `//${value}` : `/*${value}*/`;
      edits.push({ start: comment.start, end: comment.end, value: replacement });
    }
  }
  const walk = node => {
    if (!node || typeof node !== "object") return;
    if (node.type === "Literal" && typeof node.value === "string") {
      const value = scrubSensitiveText(node.value);
      if (value !== node.value) edits.push({ start: node.start, end: node.end, value: JSON.stringify(value) });
    } else if (node.type === "TemplateElement") {
      const value = scrubSensitiveText(node.value.raw);
      if (value !== node.value.raw) edits.push({ start: node.start, end: node.end, value });
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "start" || key === "end" || key === "loc") continue;
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object" && typeof value.type === "string") walk(value);
    }
  };
  walk(ast);
  let result = script;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, edit.start)}${edit.value}${result.slice(edit.end)}`;
  }
  return result;
}

function skeletonizeMarkupFragment(markup) {
  return markup
    .replace(/(?:KES|KSh|USD|[$€£])\s?[\d,.]{2,}/gi, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/\+?(?:254|0)[\d ()-]{7,}\d/g, "")
    .replace(/(?:\.{1,2}\/)?(?:src\/)?assets\/images\/[\w./-]+\.(?:png|jpe?g|webp|gif|svg)/gi, "")
    .replace(/https?:\/\/[^"'`\s)<>]+/gi, url => (
      /images?|photo-|unsplash|pexels|tile\.openstreetmap|maps\.google|cdn\.[^/]+\/.*\.(?:png|jpe?g|webp|gif|svg)/i.test(url) ? "" : url
    ))
    .replace(/\s+(src|srcset|alt|title|onerror|placeholder|aria-label|value)\s*=\s*("([^"]*)"|'([^']*)')/gi, "")
    .replace(/\s+data-(?:title|meta|image|description|price|product|service|category|name|address|phone|email|location|property|review|brand|variant)[\w-]*\s*=\s*("([^"]*)"|'([^']*)')/gi, "")
    .replace(/\s+(href)\s*=\s*("([^"]*)"|'([^']*)')/gi, (attribute, name, value, doubleValue, singleValue) => {
      const target = doubleValue ?? singleValue ?? "";
      if (target.startsWith("#") && !/^(#(?:tel:|mailto:))/i.test(target)) return ` ${name}=${value}`;
      return "";
    })
    .replace(/url\(\s*(['"]?)[^)'"]+\1\s*\)/gi, "none")
    .replace(/<img\b([^>]*)>/gi, (match, attributes) => {
      const classMatch = attributes.match(/\bclass=(["'])(.*?)\1/i);
      const updated = classMatch
        ? attributes.replace(classMatch[0], `class=${classMatch[1]}${classMatch[2]} eshop-placeholder-media${classMatch[1]}`)
        : `${attributes} class="eshop-placeholder-media"`;
      return `<img${updated}>`;
    })
    .replace(/>([^<>]+)</g, (match, text) => {
      if (!text.trim()) return match;
      return `><span class="eshop-skeleton-bar" data-skeleton-text="" style="width:${barWidth(text)}%"></span><`;
    });
}

function skeletonizeTemplateLiterals(script) {
  const ast = parse(script, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true });
  const edits = [];
  const templates = [];
  const walk = node => {
    if (!node || typeof node !== "object") return;
    if (node.type === "TemplateLiteral") {
      templates.push(node);
      node.expressions.forEach(walk);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "start" || key === "end" || key === "loc") continue;
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object" && typeof value.type === "string") walk(value);
    }
  };
  walk(ast);
  const nestedTemplateRanges = new Set();
  for (const template of templates) {
    if (templates.some(other => other !== template && other.start < template.start && other.end > template.end)) {
      nestedTemplateRanges.add(`${template.start}:${template.end}`);
    }
  }
  for (const template of templates) {
    if (nestedTemplateRanges.has(`${template.start}:${template.end}`)) continue;
    let markup = template.quasis[0].value.raw;
    const expressionMarkup = new Map();
    template.expressions.forEach((expression, index) => {
      const marker = `__ESHOP_EXPR_${index}__`;
      let expressionSource = script.slice(expression.start, expression.end);
      if (expressionSource.includes("`")) {
        expressionSource = skeletonizeTemplateLiterals(expressionSource);
      }
      const inTextNode = markup.lastIndexOf(">") > markup.lastIndexOf("<")
        && !/\.map\s*\(|\.join\s*\(|=>|\breturn\b/.test(expressionSource);
      expressionMarkup.set(index, inTextNode
        ? '<span class="eshop-skeleton-bar" data-skeleton-text="" style="width:40%"></span>'
        : `\${${expressionSource}}`);
      markup += marker + template.quasis[index + 1].value.raw;
    });
    let converted = skeletonizeMarkupFragment(markup);
    template.expressions.forEach((expression, index) => {
      converted = converted.replace(`__ESHOP_EXPR_${index}__`, expressionMarkup.get(index));
    });
    edits.push({ start: template.start, end: template.end, value: `\`${converted}\`` });
  }
  let result = script;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, edit.start)}${edit.value}${result.slice(edit.end)}`;
  }
  return result;
}

function barWidth(text) {
  return Math.max(8, Math.min(96, Math.round(text.trim().length * 2.7)));
}

function tokenizeColors(document, prefix) {
  const colors = new Map();
  const token = color => {
    const normalized = color.replace(/\s+/g, "").toLowerCase();
    if (!colors.has(normalized)) colors.set(normalized, `--theme-${prefix}-color-${String(colors.size + 1).padStart(2, "0")}`);
    return `var(${colors.get(normalized)})`;
  };
  for (const style of document.querySelectorAll("style")) {
    style.textContent = style.textContent
      .replace(/((?:^|[;{])\s*[-\w]+\s*:\s*)([^;{}]*)/g, (match, declaration, value) =>
        declaration + value.replace(COLOR_RE, token))
      .replace(/url\(\s*(['"]?)[^)'"]+\1\s*\)/gi, "none");
  }
  for (const element of document.querySelectorAll("[style]")) {
    element.setAttribute("style", element.getAttribute("style")
      .replace(COLOR_RE, token).replace(/url\(\s*(['"]?)[^)'"]+\1\s*\)/gi, "none"));
  }
  if (colors.size) {
    const style = document.createElement("style");
    style.dataset.themeTokens = "";
    style.textContent = `:root{${[...colors.entries()].map(([value, name]) => `${name}:${value};`).join("")}}`;
    document.head.append(style);
  }
  return Object.fromEntries([...colors.entries()].map(([value, name]) => [name, value]));
}

function skeletonizeStaticText(root, document) {
  const walker = document.createTreeWalker(root, document.defaultView.NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (!node.textContent.trim() || node.parentElement.closest("script, style, noscript")) continue;
    const bar = document.createElement("span");
    bar.className = "eshop-skeleton-bar";
    bar.dataset.skeletonText = "";
    bar.style.width = `${barWidth(node.textContent)}%`;
    node.replaceWith(bar);
  }
}

function stripMarkup(document) {
  for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')]) script.remove();
  for (const script of document.querySelectorAll("script:not([src]):not([type='application/ld+json'])")) {
    try {
      script.textContent = skeletonizeTemplateLiterals(script.textContent);
    } catch {
      script.textContent = script.textContent.replace(/`[^`]*`/gs, template => {
        if (!/<\/?[a-z][\s>]/i.test(template)) return template;
        return template.replace(/>([^<>]+)</g, (match, text) => (
          text.trim()
            ? `><span class="eshop-skeleton-bar" data-skeleton-text="" style="width:${barWidth(text)}%"></span><`
            : match
        )).replace(/\s+(src|srcset|alt|title|onerror|placeholder|aria-label|value)\s*=\s*("([^"]*)"|'([^']*)')/gi, "");
      });
    }
  }
  const title = document.querySelector("title");
  if (title) title.textContent = "";
  for (const meta of document.querySelectorAll("meta")) {
    if (meta.hasAttribute("charset") || meta.getAttribute("name") === "viewport") continue;
    meta.setAttribute("content", "");
  }
  for (const link of [...document.querySelectorAll('link[rel="preload"], link[rel="modulepreload"]')]) {
    if (link.getAttribute("as") === "image" || /image/i.test(link.getAttribute("type") || "")) link.remove();
  }
  const roots = [document.body, ...document.querySelectorAll("template")].map(element => element.content || element);
  for (const root of roots) {
    for (const image of root.querySelectorAll("img")) {
      image.removeAttribute("src");
      image.removeAttribute("srcset");
      image.removeAttribute("alt");
      image.removeAttribute("title");
      image.classList.add("eshop-placeholder-media");
      image.dataset.skeletonMedia = "";
    }
    for (const element of root.querySelectorAll("source")) element.removeAttribute("srcset");
    for (const element of root.querySelectorAll("[alt], [title], [aria-label], [placeholder]")) {
      for (const attribute of ["alt", "title", "aria-label", "placeholder"]) element.removeAttribute(attribute);
    }
    for (const element of root.querySelectorAll("*")) {
      for (const attribute of [...element.attributes]) {
        if (/^data-(?:title|meta|image|description|price|product|service|category|name|address|phone|email|location|property|review|brand|variant)[\w-]*$/i.test(attribute.name)) {
          element.removeAttribute(attribute.name);
        }
      }
      for (const attribute of [...element.attributes]) {
        if (attribute.name.toLowerCase() === "onerror") element.removeAttribute(attribute.name);
      }
    }
    for (const anchor of root.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href");
      if (!href.startsWith("#") || /^(?:tel:|mailto:)/i.test(href)) anchor.removeAttribute("href");
    }
    for (const element of root.querySelectorAll("[style]")) {
      element.setAttribute("style", element.getAttribute("style").replace(/url\(\s*(['"]?)[^)'"]+\1\s*\)/gi, "none"));
    }
    skeletonizeStaticText(root, document);
  }
  for (const style of document.querySelectorAll("style")) {
    style.textContent = style.textContent.replace(/url\(\s*(['"]?)[^)'"]+\1\s*\)/gi, "none");
  }
  const style = document.createElement("style");
  style.dataset.eshopSkeletonStyles = "";
  style.textContent = ".eshop-skeleton-bar{display:inline-block;max-width:100%;height:.72em;min-width:2.5em;border-radius:999px;background:#d1d5db;vertical-align:middle}.eshop-placeholder-media{background:linear-gradient(135deg,#d1d5db,#f3f4f6);object-fit:cover}";
  document.head.append(style);
}

function fontFamilies(source) {
  return [...new Set([...source.matchAll(/font-family\s*:\s*([^;}]+)/gi)]
    .map(match => match[1].trim().replace(/['"]/g, "").split(",")[0].trim())
    .filter(font => font && !font.startsWith("var(")))].slice(0, 8);
}

export async function convertPhase4Theme(themeId, options = {}) {
  const root = options.root || ROOT;
  const schemaDirectory = path.join(root, "schemas");
  const files = (await readdir(schemaDirectory)).filter(file => file.endsWith(".schema.json"));
  const schemaFile = files.find(file => file.slice(0, -".schema.json".length) === themeId);
  if (!schemaFile) throw new Error(`No v1 schema found for ${themeId}.`);
  const hint = JSON.parse(await readFile(path.join(schemaDirectory, schemaFile), "utf8"));
  const sourcePath = path.resolve(root, hint.sourceFile);
  const relative = path.relative(root, sourcePath);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`Invalid theme source path: ${hint.sourceFile}`);
  const source = await readFile(sourcePath, "utf8");
  const dom = new JSDOM(source);
  const { document } = dom.window;
  const scrubbedConstants = new Set();
  const parseFailures = [];
  for (const script of document.querySelectorAll("script:not([src]):not([type='application/ld+json'])")) {
    const result = scrubDataConstants(script.textContent);
    result.names.forEach(name => scrubbedConstants.add(name));
    if (result.parseFailed) parseFailures.push(script.getAttribute("id") || "inline-script");
    script.textContent = scrubSensitiveLiterals(result.script);
  }
  stripMarkup(document);
  const colors = tokenizeColors(document, themeId.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
  installSkeletonPreviewRuntime(document);
  const themeSchema = {
    version: 2,
    themeId,
    classification: "rollout",
    tokens: { colors, fonts: { families: fontFamilies(source) } },
    dataBindings: {},
    scrubbedJavascriptConstants: [...scrubbedConstants],
    repeaters: [],
    singleSlots: {},
    stripRules: {
      removeImageSources: true,
      replaceVisibleTextWithSkeletonBars: true,
      removeDemoJsonLd: true,
      scrubUppercaseJavascriptData: [...scrubbedConstants],
      parseFailures
    },
    emptyState: {
      editor: "show-demo-style-bars-and-palette-gradient-media",
      live: "theme-specific-shop-data-mapping-required"
    },
    conversionWarning: "Skeleton conversion only; theme-native product/category fill mapping requires separate verification."
  };
  const html = `<!doctype html>\n${document.documentElement.outerHTML}`;
  dom.window.close();
  return {
    html,
    schema: themeSchema,
    sourcePath,
    dataArrays: [...scrubbedConstants],
    parseFailures
  };
}

export async function convertPhase4(options = {}) {
  const root = options.root || ROOT;
  const output = options.output || path.join(root, "public", "theme-skeletons");
  const schemaDirectory = path.join(root, "schemas");
  const files = (await readdir(schemaDirectory)).filter(file => file.endsWith(".schema.json"));
  const themes = [];
  for (const file of files) {
    const schema = JSON.parse(await readFile(path.join(schemaDirectory, file), "utf8"));
    if (schema.themeId && !PILOTS.has(schema.themeId) && !EXCLUDED.has(schema.themeId)) themes.push(schema.themeId);
  }
  themes.sort();
  if (themes.length !== 23) throw new Error(`Expected 23 eligible themes; found ${themes.length}.`);
  const results = [];
  for (const themeId of themes) {
    const converted = await convertPhase4Theme(themeId, { root });
    const directory = path.join(output, themeId);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), converted.html, "utf8");
    await writeFile(path.join(directory, "schema-v2.json"), `${JSON.stringify(converted.schema, null, 2)}\n`, "utf8");
    results.push({ themeId, ...converted });
    console.log(`Converted ${themeId}; scrubbed constants: ${converted.dataArrays.length}; parse failures: ${converted.parseFailures.length}`);
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await convertPhase4();
}
