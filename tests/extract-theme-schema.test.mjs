import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { extractAdapterDetection, launchChromium } from "../scripts/extract-theme-schema.mjs";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extractorPath = path.join(projectRoot, "scripts", "extract-theme-schema.mjs");
const adapterPath = path.join(projectRoot, "public", "theme-catalog-adapter.js");
const knownThemeId = "aurex-electronics";
const knownThemePath = path.join(projectRoot, "live-websites", knownThemeId, "index.html");

const sha256 = value => createHash("sha256").update(value).digest("hex");
test("extractor schemas round-trip stable selectors for a known theme without mutating its HTML", async () => {
  const sourceBefore = await readFile(knownThemePath);
  const sourceHashBefore = sha256(sourceBefore);
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "theme-schema-test-"));
  const outputDirectory = path.join(tempDirectory, "schemas");
  let browser;
  try {
    await execFileAsync(process.execPath, [
      extractorPath,
      `--theme=${knownThemeId}`,
      "--concurrency=1",
      `--out=${outputDirectory}`
    ], { cwd: projectRoot, timeout: 90_000 });
    const schema = JSON.parse(await readFile(path.join(outputDirectory, `${knownThemeId}.schema.json`), "utf8"));
    assert.equal(schema.themeId, knownThemeId);
    assert.equal(schema.productGroups.length, 2, "Aurex Electronics has two hand-verified rendered product groups.");
    assert.ok(schema.productGroups.some(group => group.parentSelector.includes(".products-grid")));

    browser = await launchChromium();
    const page = await browser.newPage();
    await page.goto(`file://${knownThemePath.replaceAll("\\", "/")}`, {
      waitUntil: "networkidle",
      timeout: 15_000
    });
    const selectorResults = await page.evaluate(groups => groups.map(group => {
      const parent = document.querySelector(group.parentSelector);
      const cards = parent ? [...parent.querySelectorAll(group.cardSelector)] : [];
      const firstCard = cards[0] || null;
      const slots = {};
      for (const [name, slot] of Object.entries(group.slots)) {
        if (slot && typeof slot === "object" && slot.selector) {
          slots[name] = Boolean(firstCard?.querySelector(slot.selector));
        }
      }
      return {
        parentFound: Boolean(parent),
        cardsFound: cards.length === group.cardCount,
        slots
      };
    }), schema.productGroups);
    for (const result of selectorResults) {
      assert.equal(result.parentFound, true, "Parent selector must resolve on the original page.");
      assert.equal(result.cardsFound, true, "Card selector must resolve the complete original card group.");
      for (const [slotName, found] of Object.entries(result.slots)) {
        assert.equal(found, true, `${slotName} selector must resolve on the first product card.`);
      }
    }

    const adapterSource = await readFile(adapterPath, "utf8");
    const detection = extractAdapterDetection(adapterSource);
    const actualGroups = await page.evaluate(detection => {
      const classes = (new Function(`return (${detection.classesSource});`))();
      const make = (parameters, source) => new Function(...parameters, `return (${source});`);
      const cardSelector = make(["commerceCardClasses", "document"], detection.cardSelectorSource)(classes, document);
      const isProductCard = make(["cardSelector", "document"], detection.isProductCardSource)(cardSelector, document);
      const gridLabel = make(["document"], detection.gridLabelSource)(document);
      const grouped = new Map();
      for (const card of document.querySelectorAll("[data-product-id], [class]")) {
        if (!isProductCard(card) || !card.parentElement) continue;
        const siblings = [...card.parentElement.children].filter(isProductCard);
        if (siblings.length) grouped.set(card.parentElement, siblings);
      }
      return [...grouped].map(([parent, cards], index) => ({
        label: gridLabel(parent, index),
        cardCount: cards.length
      }));
    }, detection);
    assert.deepEqual(
      schema.productGroups.map(({ label, cardCount }) => ({ label, cardCount })),
      actualGroups,
      "Schema discovery must agree with the adapter’s exact card detection on the fixture theme."
    );
  } finally {
    await browser?.close();
    const sourceAfter = await readFile(knownThemePath);
    assert.equal(sha256(sourceAfter), sourceHashBefore, "Extractor must not mutate source theme HTML.");
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
