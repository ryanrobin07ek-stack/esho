#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { WEBSITE_THEME_CATALOG } from "../src/theme-catalog.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THEME_ROOT = path.join(PROJECT_ROOT, "live-websites");
const ADAPTER_PATH = path.join(PROJECT_ROOT, "public", "theme-catalog-adapter.js");
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, "schemas");
const NAVIGATION_TIMEOUT_MS = 15_000;
const TITLE_SELECTOR = "h1, h2, h3, h4, h5, h6, [class*='product-title'], [class*='card-title'], [class*='product-name'], [class*='service-title'], [class*='item-name'], [class*='dish-name']";
const CATEGORY_SELECTOR = "[class*='category-name'], [class*='category-label'], [data-product-category]";
const PRICE_SELECTOR = ".price-current, .current-price, .product-price, .card-price, [class*='service-card-price'], [data-price]";
const PRICE_TEXT_PATTERN = "(?:KES|KSh|USD|[$€£])\\s?[\\d,.]+|[\\d,.]+\\s?(?:KES|KSh|USD)";

function parseArgs(args) {
  const options = { theme: null, concurrency: 4, output: DEFAULT_OUTPUT };
  for (const argument of args) {
    if (argument.startsWith("--theme=")) options.theme = argument.slice("--theme=".length);
    else if (argument.startsWith("--concurrency=")) options.concurrency = Number(argument.slice("--concurrency=".length));
    else if (argument.startsWith("--out=")) options.output = path.resolve(process.cwd(), argument.slice("--out=".length));
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error("--concurrency must be a positive integer.");
  }
  return options;
}

function usage() {
  return "Usage: node scripts/extract-theme-schema.mjs [--theme=<id>] [--concurrency=4] [--out=schemas]";
}

function normalizeWords(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().match(/[a-z0-9]+/g) || [];
}

function titleOf(html) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || "";
  return title.replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f\d]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function findHtmlFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findHtmlFiles(absolutePath));
    else if (entry.isFile() && entry.name.toLowerCase() === "index.html") files.push(absolutePath);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function mapCatalogThemesToFiles() {
  const htmlFiles = await findHtmlFiles(THEME_ROOT);
  const fileRecords = await Promise.all(htmlFiles.map(async absolutePath => {
    const html = await readFile(absolutePath, "utf8");
    return {
      absolutePath,
      title: titleOf(html),
      words: new Set(normalizeWords(titleOf(html)))
    };
  }));
  const matchedFiles = new Set();
  const themeFiles = [];
  const missing = [];

  for (const theme of WEBSITE_THEME_CATALOG) {
    const themeWords = new Set([...normalizeWords(theme.name), ...normalizeWords(theme.id)]);
    const candidates = fileRecords.map(record => {
      const overlap = [...themeWords].filter(word => record.words.has(word)).length;
      return { ...record, overlap, score: overlap / Math.max(themeWords.size, 1) };
    }).sort((left, right) => right.score - left.score);
    const best = candidates[0];
    const second = candidates[1];
    if (!best || best.score < 0.5 || (second && best.score - second.score < 0.08) || matchedFiles.has(best.absolutePath)) {
      missing.push(theme.id);
      continue;
    }
    matchedFiles.add(best.absolutePath);
    themeFiles.push({ theme, ...best });
  }
  if (missing.length) {
    throw new Error(`No unambiguous local HTML file found for catalog theme id(s): ${missing.join(", ")}.`);
  }

  const unmatchedFiles = fileRecords.filter(record => !matchedFiles.has(record.absolutePath));
  for (const record of unmatchedFiles) {
    console.warn(`WARNING: HTML file is not in src/theme-catalog.js: ${path.relative(PROJECT_ROOT, record.absolutePath)}`);
  }
  return { themeFiles, unmatchedFiles };
}

function extractAdapterDeclaration(source, name, nextName) {
  const startMarker = `const ${name} = `;
  const endMarker = `\n  const ${nextName} =`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not extract ${name} from ${path.relative(PROJECT_ROOT, ADAPTER_PATH)}.`);
  }
  return source.slice(start + startMarker.length, end).trim().replace(/;$/, "");
}

export function extractAdapterDetection(source) {
  const classesStart = source.indexOf("  const commerceCardClasses = [");
  const classesEnd = source.indexOf("\n  ];", classesStart);
  if (classesStart < 0 || classesEnd < 0) {
    throw new Error("Could not extract commerceCardClasses from theme-catalog-adapter.js.");
  }
  const classesSource = source.slice(classesStart + "  const commerceCardClasses = ".length, classesEnd + 4).trim();
  const cardSelectorSource = extractAdapterDeclaration(source, "cardSelector", "isProductCard");
  const isProductCardSource = extractAdapterDeclaration(source, "isProductCard", "labelNode");
  const labelNodeSource = extractAdapterDeclaration(source, "labelNode", "setText");
  const gridLabelSource = extractAdapterDeclaration(source, "gridLabel", "gridKey");
  return { classesSource, cardSelectorSource, isProductCardSource, labelNodeSource, gridLabelSource };
}

export function launchChromium() {
  const executablePath = chromium.executablePath();
  return chromium.launch({
    headless: true,
    ...(existsSync(executablePath) ? {} : { channel: "chrome" })
  });
}

async function readAdapterDetection() {
  return extractAdapterDetection(await readFile(ADAPTER_PATH, "utf8"));
}

async function collectThemeSchema(page, item, sourceFile, adapterDetection) {
  const navigationWarnings = [];
  const themeUrl = pathToFileURL(item.absolutePath).href;
  try {
    await page.goto(themeUrl, {
      waitUntil: "networkidle",
      timeout: NAVIGATION_TIMEOUT_MS
    });
  } catch (error) {
    if (error.name !== "TimeoutError" || page.url() !== themeUrl) throw error;
    const warning = `page.goto networkidle timed out after ${NAVIGATION_TIMEOUT_MS}ms; analyzed the loaded document`;
    navigationWarnings.push(warning);
    console.warn(`[${item.theme.id}] ${warning}`);
  }

  const schema = await page.evaluate(({ themeId, sourceFile: relativeSourceFile, detection, titleSelector, categorySelector, priceSelector, pricePattern }) => {
    const commerceCardClasses = (new Function(`return (${detection.classesSource});`))();
    const makeFunction = (parameters, source) => (new Function(...parameters, `return (${source});`));
    const cardSelector = makeFunction(["commerceCardClasses", "document"], detection.cardSelectorSource)(commerceCardClasses, document);
    const isProductCard = makeFunction(["cardSelector", "document"], detection.isProductCardSource)(cardSelector, document);
    const labelNode = makeFunction([], detection.labelNodeSource)();
    const gridLabel = makeFunction(["document"], detection.gridLabelSource)(document);
    const groups = new Map();
    for (const card of document.querySelectorAll("[data-product-id], [class]")) {
      if (!isProductCard(card) || !card.parentElement) continue;
      const siblings = [...card.parentElement.children].filter(isProductCard);
      if (siblings.length) groups.set(card.parentElement, siblings);
    }

    const stableClasses = element => [...element.classList].filter(className =>
      className.length > 3 &&
      !/^[a-z]{1,2}\d*$/i.test(className) &&
      !/^css-/i.test(className) &&
      !/^sc-/i.test(className) &&
      !/^(?:_[a-z0-9]{5,}|[a-z0-9_-]*[a-f0-9]{6,})$/i.test(className)
    );
    const escapeIdentifier = value => CSS.escape(value);
    const simpleSelector = element => {
      const tag = element.tagName.toLowerCase();
      const classes = stableClasses(element);
      return `${tag}${classes.map(className => `.${escapeIdentifier(className)}`).join("")}`;
    };
    const allElementsEqual = (actual, expected) => actual.length === expected.length &&
      actual.every((element, index) => element === expected[index]);
    const uniqueGlobalSelector = element => {
      const selector = simpleSelector(element);
      const matches = [...document.querySelectorAll(selector)];
      return matches.length === 1 && matches[0] === element ? selector : null;
    };
    const globalSelector = element => {
      const direct = uniqueGlobalSelector(element);
      if (direct) return { selector: direct, confidence: "high" };

      const ancestors = [];
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        ancestors.push(ancestor);
        if (uniqueGlobalSelector(ancestor)) break;
      }
      let selector = ancestors.length && uniqueGlobalSelector(ancestors.at(-1))
        ? uniqueGlobalSelector(ancestors.at(-1))
        : "html";
      const chain = ancestors.length && uniqueGlobalSelector(ancestors.at(-1))
        ? [...ancestors.slice(0, -1).reverse(), element]
        : [...ancestors.reverse(), element];
      let lowConfidence = false;
      for (const child of chain) {
        const parent = child.parentElement;
        if (!parent) continue;
        let segment = simpleSelector(child);
        const siblingMatches = [...parent.children].filter(sibling => sibling.matches(segment));
        if (siblingMatches.length !== 1 || siblingMatches[0] !== child) {
          const sameTypeIndex = [...parent.children].filter(sibling => sibling.tagName === child.tagName)
            .indexOf(child) + 1;
          segment += `:nth-of-type(${sameTypeIndex})`;
        }
        selector += ` > ${segment}`;
      }
      const matches = [...document.querySelectorAll(selector)];
      if (matches.length === 1 && matches[0] === element) return { selector, confidence: "high" };

      lowConfidence = true;
      let fallback = "html";
      const path = [];
      for (let child = element; child && child !== document.documentElement; child = child.parentElement) {
        path.unshift(`${child.tagName.toLowerCase()}:nth-child(${[...child.parentElement.children].indexOf(child) + 1})`);
      }
      fallback += path.map(segment => ` > ${segment}`).join("");
      const fallbackMatches = [...document.querySelectorAll(fallback)];
      if (fallbackMatches.length === 1 && fallbackMatches[0] === element) {
        return { selector: fallback, confidence: lowConfidence ? "low" : "high" };
      }
      return { selector: null, confidence: "low" };
    };
    const relativeSelector = (root, element) => {
      if (!root || !element || !root.contains(element)) return { selector: null, confidence: "high" };
      const chain = [];
      for (let child = element; child !== root; child = child.parentElement) {
        if (!child) return { selector: null, confidence: "low" };
        let segment = simpleSelector(child);
        const siblings = [...child.parentElement.children].filter(sibling => sibling.matches(segment));
        if (siblings.length !== 1 || siblings[0] !== child) {
          const sameTypeIndex = [...child.parentElement.children].filter(sibling => sibling.tagName === child.tagName)
            .indexOf(child) + 1;
          segment += `:nth-of-type(${sameTypeIndex})`;
        }
        chain.unshift(segment);
      }
      let selector = `:scope > ${chain.join(" > ")}`;
      if (root.querySelector(selector) === element) return { selector, confidence: "high" };

      const fallbackChain = [];
      for (let child = element; child !== root; child = child.parentElement) {
        if (!child) return { selector: null, confidence: "low" };
        fallbackChain.unshift(`${child.tagName.toLowerCase()}:nth-child(${[...child.parentElement.children].indexOf(child) + 1})`);
      }
      selector = `:scope > ${fallbackChain.join(" > ")}`;
      return { selector: root.querySelector(selector) === element ? selector : null, confidence: "low" };
    };
    const cardGroupSelector = (parent, cards) => {
      const commonClasses = stableClasses(cards[0]).filter(className =>
        cards.every(card => card.classList.contains(className))
      );
      const selector = `:scope > ${cards[0].tagName.toLowerCase()}${commonClasses.map(className => `.${escapeIdentifier(className)}`).join("")}`;
      const matched = [...parent.querySelectorAll(selector)];
      if (allElementsEqual(matched, cards) && parent.querySelector(selector) === cards[0]) {
        return { selector, confidence: "high" };
      }
      const tagSelector = `:scope > ${cards[0].tagName.toLowerCase()}`;
      const tagMatches = [...parent.querySelectorAll(tagSelector)];
      if (allElementsEqual(tagMatches, cards)) return { selector: tagSelector, confidence: "high" };

      const singleCardSelector = relativeSelector(parent, cards[0]);
      return { selector: singleCardSelector.selector, confidence: "low" };
    };
    const styleOf = element => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight
      };
    };
    const slot = (card, root, element) => {
      const result = relativeSelector(root, element);
      const computed = styleOf(element) || {
        color: null,
        backgroundColor: null,
        fontFamily: null,
        fontSize: null,
        fontWeight: null
      };
      return { selector: result.selector, ...computed, selectorConfidence: result.confidence };
    };
    const productGroups = [];
    const labelOccurrences = new Map();
    let groupIndex = 0;
    for (const [parent, cards] of groups) {
      const label = gridLabel(parent, groupIndex++);
      const normalizedLabel = label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim() || "products";
      labelOccurrences.set(normalizedLabel, (labelOccurrences.get(normalizedLabel) || 0) + 1);
      const parentSelector = globalSelector(parent);
      const cardSelectorResult = cardGroupSelector(parent, cards);
      const firstCard = cards[0];
      const title = labelNode(firstCard, titleSelector);
      const categoryLabel = labelNode(firstCard, categorySelector);
      const price = labelNode(firstCard, priceSelector) || [...firstCard.querySelectorAll("*")].find(element =>
        element.children.length === 0 && new RegExp(pricePattern, "i").test(element.textContent)
      );
      const image = firstCard.querySelector("img");
      const productLink = firstCard.querySelector("a[href]");
      const slots = {
        title: slot(firstCard, firstCard, title),
        categoryLabel: slot(firstCard, firstCard, categoryLabel),
        price: slot(firstCard, firstCard, price),
        image: slot(firstCard, firstCard, image),
        productLink: slot(firstCard, firstCard, productLink),
        addButtonExists: Boolean(firstCard.querySelector(
          "[data-add-to-cart], [data-action*='add-to-bag'], [class*='add-to-cart'], [class*='add-btn']"
        ))
      };
      const cardStyle = styleOf(firstCard);
      const gridStyle = getComputedStyle(parent);
      let gridColumns = gridStyle.display.includes("grid") && gridStyle.gridTemplateColumns !== "none"
        ? gridStyle.gridTemplateColumns.trim().split(/\s+/).length
        : null;
      if (!gridColumns) {
        const positions = cards.map(card => card.getBoundingClientRect().x).sort((left, right) => left - right);
        const columns = positions.filter((position, index) =>
          index === 0 || Math.abs(position - positions[index - 1]) > 2
        );
        gridColumns = columns.length || null;
      }
      productGroups.push({
        label,
        parentSelector: parentSelector.selector,
        cardSelector: cardSelectorResult.selector,
        cardCount: cards.length,
        gridColumns,
        selectorConfidence: parentSelector.confidence === "high" && cardSelectorResult.confidence === "high"
          ? "high" : "low",
        cardStyle,
        slots
      });
    }

    const parseColor = value => {
      const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)%?)?\s*\)$/i);
      if (!match) return null;
      const alpha = match[4] === undefined ? 1 : Number(match[4]);
      return alpha <= 0.02 ? null : [Number(match[1]), Number(match[2]), Number(match[3])];
    };
    const colors = [];
    const addColor = value => {
      const rgb = parseColor(value);
      if (!rgb) return;
      const existing = colors.find(entry =>
        Math.hypot(entry.rgb[0] - rgb[0], entry.rgb[1] - rgb[1], entry.rgb[2] - rgb[2]) <= 18
      );
      if (existing) existing.count += 1;
      else colors.push({ value, rgb, count: 1 });
    };
    for (const element of document.querySelectorAll("*")) {
      const bounds = element.getBoundingClientRect();
      if (bounds.width * bounds.height <= 400) continue;
      const style = getComputedStyle(element);
      addColor(style.backgroundColor);
      addColor(style.color);
    }
    colors.sort((left, right) => right.count - left.count);
    const fontCounts = new Map();
    for (const element of document.querySelectorAll("*")) {
      if (element.getBoundingClientRect().width <= 0 || element.getBoundingClientRect().height <= 0) continue;
      const font = getComputedStyle(element).fontFamily;
      fontCounts.set(font, (fontCounts.get(font) || 0) + 1);
    }
    const fonts = [...fontCounts].sort((left, right) => right[1] - left[1]).map(([font]) => font);
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = document.body ? getComputedStyle(document.body) : rootStyle;
    const warnings = [];
    if (!productGroups.length) warnings.push("no product cards detected");
    for (const group of productGroups) {
      const slotsUsed = ["title", "categoryLabel", "price", "image", "productLink"]
        .map(name => group.slots[name]).filter(slotData => slotData.selector);
      const lowSlots = slotsUsed.filter(slotData => slotData.selectorConfidence === "low").length;
      if (lowSlots) warnings.push(`${lowSlots} of ${slotsUsed.length} slots used low-confidence selectors in "${group.label}"`);
      if (group.selectorConfidence === "low") warnings.push(`low-confidence group selector in "${group.label}"`);
    }
    return {
      themeId,
      sourceFile: relativeSourceFile,
      generatedAt: new Date().toISOString(),
      page: {
        background: bodyStyle.backgroundColor !== "rgba(0, 0, 0, 0)" ? bodyStyle.backgroundColor : rootStyle.backgroundColor,
        foreground: bodyStyle.color,
        root: {
          background: rootStyle.backgroundColor,
          foreground: rootStyle.color
        },
        body: {
          background: bodyStyle.backgroundColor,
          foreground: bodyStyle.color
        },
        accentColors: colors.slice(0, 5).map(color => color.value),
        fontFamilies: fonts
      },
      productGroups,
      warnings
    };
  }, {
    themeId: item.theme.id,
    sourceFile,
    detection: adapterDetection,
    titleSelector: TITLE_SELECTOR,
    categorySelector: CATEGORY_SELECTOR,
    priceSelector: PRICE_SELECTOR,
    pricePattern: PRICE_TEXT_PATTERN
  });
  schema.warnings.unshift(...navigationWarnings);
  return schema;
}

function failedThemeSchema(item, sourceFile, error) {
  return {
    themeId: item.theme.id,
    sourceFile,
    generatedAt: new Date().toISOString(),
    page: {
      background: "",
      foreground: "",
      root: { background: "", foreground: "" },
      body: { background: "", foreground: "" },
      accentColors: [],
      fontFamilies: []
    },
    productGroups: [],
    warnings: [`navigation or analysis failed: ${error.message}`]
  };
}

async function runWorker(browser, queue, results, outputDirectory, adapterDetection) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      const sourceFile = path.relative(PROJECT_ROOT, item.absolutePath).split(path.sep).join("/");
      let schema;
      try {
        schema = await collectThemeSchema(page, item, sourceFile, adapterDetection);
      } catch (error) {
        console.error(`[${item.theme.id}] ${error.message}`);
        schema = failedThemeSchema(item, sourceFile, error);
      }
      if (!schema.productGroups.length) results.needsManualReview.push(item.theme.id);
      const lowConfidenceCount = schema.productGroups.reduce((count, group) =>
        count + (group.selectorConfidence === "low" ? 1 : 0) +
        ["title", "categoryLabel", "price", "image", "productLink"]
          .filter(slotName => group.slots[slotName]?.selector && group.slots[slotName].selectorConfidence === "low").length,
      0);
      results.indexEntries.push({
        themeId: schema.themeId,
        productGroupCount: schema.productGroups.length,
        totalCardsDetected: schema.productGroups.reduce((sum, group) => sum + group.cardCount, 0),
        warningCount: schema.warnings.length,
        accentColors: schema.page.accentColors
      });
      const outputPath = path.join(outputDirectory, `${item.theme.id}.schema.json`);
      await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
      console.log(`[${item.theme.id}] ${schema.productGroups.length} groups, ${schema.productGroups.reduce((sum, group) => sum + group.cardCount, 0)} cards, ${schema.warnings.length} warnings, ${lowConfidenceCount} low-confidence selectors`);
    }
  } finally {
    await context.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  let selected = [];
  if (options.theme) {
    const targetPath = path.join(THEME_ROOT, options.theme, "index.html");
    if (!existsSync(targetPath)) {
      throw new Error(`Theme source not found at ${path.relative(PROJECT_ROOT, targetPath)}.`);
    }
    const html = await readFile(targetPath, "utf8");
    const title = titleOf(html);
    selected = [{
      absolutePath: targetPath,
      title,
      words: new Set(normalizeWords(title)),
      theme: { id: options.theme, name: options.theme }
    }];
  } else {
    const result = await mapCatalogThemesToFiles();
    selected = result.themeFiles;
  }

  if (options.theme && !selected.length) {
    throw new Error(`Unknown theme id "${options.theme}". Check src/theme-catalog.js.`);
  }
  const adapterDetection = await readAdapterDetection();
  await mkdir(options.output, { recursive: true });
  const browser = await launchChromium();
  const results = { indexEntries: [], needsManualReview: [] };
  try {
    const queue = [...selected];
    const workerCount = Math.min(options.concurrency, selected.length);
    await Promise.all(Array.from({ length: workerCount }, () =>
      runWorker(browser, queue, results, options.output, adapterDetection)
    ));
  } finally {
    await browser.close();
  }
  results.indexEntries.sort((left, right) => left.themeId.localeCompare(right.themeId));
  await writeFile(path.join(options.output, "index.json"), `${JSON.stringify(results.indexEntries, null, 2)}\n`, "utf8");
  console.log(`\nProcessed ${results.indexEntries.length} of ${selected.length} requested theme(s).`);
  if (results.needsManualReview.length) {
    console.log("\nNEEDS MANUAL REVIEW");
    for (const themeId of results.needsManualReview) console.log(`- ${themeId}`);
  } else {
    console.log("\nNEEDS MANUAL REVIEW\n- None");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 1;
  });
}
