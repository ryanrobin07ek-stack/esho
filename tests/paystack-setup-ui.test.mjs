import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readAppSource } from "./helpers/app-source.mjs";

const pageSource = await readAppSource();
const loadSetup = pageSource.match(/const loadSetup = async \(\) => \{([\s\S]*?)retry\?\.addEventListener/)?.[1] || "";
const setupErrors = loadSetup.match(/const errors = \[([\s\S]*?)\n      \];/)?.[1] || "";

test("Paystack shop setup is not blocked by the optional app-wide default lookup", () => {
  assert.ok(loadSetup, "The Paystack setup loader should exist.");
  assert.ok(setupErrors, "Required setup and bank failures should be collected.");
  assert.doesNotMatch(setupErrors, /defaultResult/,
    "A failed default-account lookup must not block shop-level setup.");
  assert.match(loadSetup, /defaultResult\.status === "rejected"[\s\S]*?console\.warn/,
    "Optional default-account failures should still be diagnosable.");
  assert.match(loadSetup, /errors\.map\(error => error instanceof Error \? error\.message : String\(error\)\)/,
    "Required setup failures should display their actionable error.");
});
