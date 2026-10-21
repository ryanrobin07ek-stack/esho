// Usage: node adapt-test.mjs <outDir> <originalIndexHtml>
// Renders the wired skeleton through the real engine with 0/1/3/50 products and checks it adapts.
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path";
let chromium; for (const base of [import.meta.url, "/opt/npm-tools/node_modules/"]) { try { ({ chromium } = createRequire(base)("playwright")); break; } catch {} }
const [dir, origFile] = process.argv.slice(2);
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(dir, "schema-v2.json"), "utf8"));
const orig = fs.readFileSync(origFile, "utf8");
import { findArraySpan, evalArray } from "../skel/fixed-skeletons/fill.mjs";
import { pathToFileURL } from "node:url";
const arrName = schema.fieldMap.array, nameKey = schema.fieldMap.fields.name;
let demoNames = [];
for (const sc of orig.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || []) { const sp = findArraySpan(sc, arrName); if (!sp) continue; const a = evalArray(sc.slice(sp.start, sp.end)); if (Array.isArray(a)) demoNames = a.map(x => x?.[nameKey]).filter(x => typeof x === "string" && x.length > 5); break; }
console.log("demo products in original:", demoNames.length);
const IMG = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#888"/></svg>');
const categories = [{ id: "c1", name: "Alpha Goods", slug: "alpha-goods" }, { id: "c2", name: "Beta Goods", slug: "beta-goods" }];
const mk = n => ({ store: { name: "ZQ Store", currency: "KES" }, categories, products: Array.from({ length: n }, (_, i) => ({ id: "p" + (i + 1), name: "ZQ Widget " + (i + 1), price: 100 * (i + 1), comparePrice: i % 2 ? 150 * (i + 1) : null, image: IMG, description: "ZQ desc " + (i + 1), category_id: i % 2 ? "c2" : "c1", featured: i < 4, bestseller: i % 3 === 0 })) });
const b = await chromium.launch(); let failed = 0;
for (const n of [0, 1, 3, 50]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.route("**/*", r => { const u = r.request().url();
    if (/^(file|data|about|blob):/.test(u)) return r.continue();
    if (/tailwindcss\.com/.test(u)) return r.fulfill({ contentType: "text/javascript", body: "window.tailwind=window.tailwind||{config:{}};" });
    if (/lucide/.test(u)) return r.fulfill({ contentType: "text/javascript", body: "window.lucide={createIcons(){},icons:{}};" });
    return r.abort(); });
  const page = await ctx.newPage(); const errs = new Set();
  page.on("pageerror", e => errs.add(e.message.slice(0, 80)));
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ path: "engine.bundle.js" });
  const filled = await page.evaluate(([h, s, d]) => fillThemeSkeleton(h, s, d, { mode: "live" }), [html, schema, mk(n)]);
  const ff = path.resolve("out", "_filled-" + n + ".html"); fs.writeFileSync(ff, filled);
  const p2 = await ctx.newPage(); p2.on("pageerror", e => errs.add(e.message.slice(0, 80)));
  await p2.goto(pathToFileURL(ff).href, { waitUntil: "domcontentloaded" }); await p2.waitForTimeout(600);
  const res = {};
  for (const h of ["#/", "#/shop"]) {
    await p2.evaluate(h => { location.hash = h; }, h); await p2.waitForTimeout(500);
    res[h] = await p2.evaluate(() => ({ names: new Set((document.body.innerText.match(/ZQ Widget \d+/gi) || []).map(s => s.toLowerCase())).size }));
  }
  const dom = await p2.evaluate(() => document.documentElement.outerHTML);
  const demoLeft = demoNames.filter(x => dom.includes(x));
  const usesCdnCss = /cdn\.tailwindcss\.com/.test(html);
  const hscroll = usesCdnCss ? false : await p2.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
  const okShown = n === 0 ? true : res["#/shop"].names >= Math.min(n, 3) || res["#/"].names >= Math.min(n, 1);
  const pass = okShown && !demoLeft.length && !errs.size && !hscroll;
  if (!pass) failed++;
  console.log(`N=${String(n).padEnd(2)} ${pass ? "PASS" : "FAIL"}  home names:${res["#/"].names} shop names:${res["#/shop"].names}  demoLeft:${demoLeft.length}${demoLeft[0] ? " (" + demoLeft[0] + ")" : ""}  hscroll:${hscroll}  errors:${[...errs].join(" | ") || "none"}`);
  await ctx.close();
}
await b.close(); process.exit(failed ? 1 : 0);
