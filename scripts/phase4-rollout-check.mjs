import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PILOT_IDS = new Set([
  "cira-atelier-event-architecture-management",
  "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "kicks-vault-curated-sneaker-footwear-archive"
]);
const EXCLUDED_IDS = new Set([
  "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
  "zima-fresh-supermarket-fresh-groceries-farm-produce-daily-essent"
]);

function sourceLeakCandidates(source) {
  const staticMarkup = source
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  return [...new Set([
    ...(source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).filter(email => email.toLowerCase() !== "jack@greensock.com"),
    ...(source.match(/\+?254[\d ()-]{7,}\d/g) || []),
    ...(source.match(/photo-\d{8,}/g) || []),
    ...(source.match(/(?:src\/)?assets\/images\/[\w./-]+\.(?:png|jpe?g|webp|gif|svg)/gi) || []),
    ...(staticMarkup.match(/(?:KES|KSh|USD|[$€£])\s?[\d,.]{2,}/gi) || [])
  ])];
}

export async function collectPhase4RolloutReport({ root = ROOT } = {}) {
  const schemaDirectory = path.join(root, "schemas");
  const files = (await readdir(schemaDirectory)).filter(name => name.endsWith(".schema.json"));
  const schemas = await Promise.all(files.map(async name => JSON.parse(
    await readFile(path.join(schemaDirectory, name), "utf8")
  )));
  const eligible = schemas.filter(schema => !PILOT_IDS.has(schema.themeId) && !EXCLUDED_IDS.has(schema.themeId));
  if (eligible.length !== 23) throw new Error(`Expected 23 eligible themes; found ${eligible.length}.`);

  const records = [];
  for (const schema of eligible) {
    const sourcePath = path.resolve(root, schema.sourceFile);
    const source = await readFile(sourcePath, "utf8");
    const outputDirectory = path.join(root, "public", "theme-skeletons", schema.themeId);
    const html = await readFile(path.join(outputDirectory, "index.html"), "utf8");
    const v2 = JSON.parse(await readFile(path.join(outputDirectory, "schema-v2.json"), "utf8"));
    const leaks = sourceLeakCandidates(source).filter(candidate => html.includes(candidate));
    const document = new JSDOM(html).window.document;
    const scriptErrors = [];
    for (const [index, script] of [...document.querySelectorAll("script:not([src])")].entries()) {
      if (script.type === "application/ld+json") continue;
      try {
        new vm.Script(script.textContent, { filename: `${schema.themeId} inline script ${index}` });
      } catch (error) {
        scriptErrors.push(error.message);
      }
    }
    records.push({
      themeId: schema.themeId,
      status: leaks.length || scriptErrors.length ? "FAILED" : "CONVERTED",
      sourceFile: schema.sourceFile,
      dataBindings: v2.dataBindings,
      shopDataFill: v2.conversionWarning,
      leakTest: { outcome: leaks.length ? "FAIL" : "PASS", hits: leaks },
      inlineScriptSyntax: scriptErrors.length ? "FAIL" : "PASS",
      scriptErrors,
      generatedOutputPresent: true
    });
    document.defaultView.close();
  }
  return {
    phase: 4,
    eligibleThemeCount: eligible.length,
    convertedThemeCount: records.filter(record => record.status === "CONVERTED").length,
    failedThemeCount: records.filter(record => record.status === "FAILED").length,
    records
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = await collectPhase4RolloutReport();
  for (const record of report.records) {
    console.log(`${record.status} | ${record.themeId} | leak=${record.leakTest.outcome} | inline-js=${record.inlineScriptSyntax} | fill=${record.shopDataFill}`);
  }
  console.log(`Converted ${report.convertedThemeCount}; failed ${report.failedThemeCount}; eligible ${report.eligibleThemeCount}.`);
}
