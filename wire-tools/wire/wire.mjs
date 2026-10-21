// Usage: node wire.mjs <skeletonDir> <fieldMapTheme> [fieldMaps.json]
// Inserts /*__ESHOP_DATA_products__*/ before the theme's product array and writes schema-v2.json with a fieldMap.
import fs from "node:fs"; import path from "node:path";
import { findArraySpan, evalArray } from "../skel/fixed-skeletons/fill.mjs";
const [dir, theme, mapsFile = "../tools/field-maps.work.json"] = process.argv.slice(2);
const entry = JSON.parse(fs.readFileSync(mapsFile, "utf8")).find(m => m.theme === theme);
if (!entry?.array) throw new Error("no field map / array for " + theme);
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(dir, "schema-v2.json"), "utf8"));
const shapeOf = v => typeof v === "string" ? "" : typeof v === "number" ? 0 : typeof v === "boolean" ? true
  : Array.isArray(v) ? [] : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).map(k => [k, shapeOf(v[k])])) : v;
let done = false;
for (const s of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || []) {
  const span = findArraySpan(s, entry.array); if (!span) continue;
  const lit = s.slice(span.start, span.end);
  const arr = evalArray(lit);
  if (!Array.isArray(arr) || !arr.length || typeof arr[0] !== "object") throw new Error("array found but first item not an object");
  const shape = shapeOf(arr[0]);
  // keep fields that mean "this item is an image list" so the mapper writes an array
  const f = entry.fields;
  if (f.image && Array.isArray(arr[0][f.image])) shape[f.image] = [];
  const out = s.slice(0, span.start) + "/*__ESHOP_DATA_products__*/ " + lit + s.slice(span.end);
  html = html.replace(s, () => out);
  schema.fieldMap = { array: entry.array, fields: entry.fields, defaults: entry.defaults || {}, shape };
  schema.dataBindings = { [entry.array]: "products" };
  schema.classification = "B";
  done = true; break;
}
if (!done) throw new Error("array " + entry.array + " not found in scripts");
const dest = path.join("out", theme); fs.mkdirSync(dest, { recursive: true });
fs.writeFileSync(path.join(dest, "index.html"), html);
fs.writeFileSync(path.join(dest, "schema-v2.json"), JSON.stringify(schema, null, 2));
console.log("wired", theme, "->", dest, "| shape keys:", Object.keys(schema.fieldMap.shape).join(","));
