import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectPhase4RolloutReport } from "../scripts/phase4-rollout-check.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PILOTS = [
  "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "cira-atelier-event-architecture-management",
  "kicks-vault-curated-sneaker-footwear-archive"
];

test("Phase 4 generates 23 leak-checked skeletons with valid inline scripts", async () => {
  const report = await collectPhase4RolloutReport();
  assert.equal(report.eligibleThemeCount, 23);
  assert.equal(report.convertedThemeCount, 23);
  assert.equal(report.failedThemeCount, 0);
  for (const record of report.records) {
    assert.equal(record.status, "CONVERTED", record.themeId);
    assert.equal(record.leakTest.outcome, "PASS", `${record.themeId}: ${record.leakTest.hits.join(", ")}`);
    assert.equal(record.inlineScriptSyntax, "PASS", record.themeId);
    assert.equal(record.generatedOutputPresent, true, record.themeId);
    assert.deepEqual(record.dataBindings, {}, `${record.themeId}: mapping is explicitly not implemented`);
    await access(path.join(ROOT, "public", "theme-skeletons", record.themeId, "index.html"));
    await access(path.join(ROOT, "public", "theme-skeletons", record.themeId, "schema-v2.json"));
  }
});

test("Phase 4 leaves pilot skeletons and excluded themes untouched", async () => {
  for (const themeId of PILOTS) {
    await access(path.join(ROOT, "public", "theme-skeletons", themeId, "index.html"));
    await access(path.join(ROOT, "public", "theme-skeletons", themeId, "schema-v2.json"));
  }
  for (const themeId of [
    "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
    "zima-fresh-supermarket-fresh-groceries-farm-produce-daily-essent"
  ]) {
    await assert.rejects(access(path.join(ROOT, "public", "theme-skeletons", themeId)));
  }
});
