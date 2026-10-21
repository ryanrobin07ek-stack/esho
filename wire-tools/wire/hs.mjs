import { createRequire } from "node:module"; import { pathToFileURL } from "node:url";
const { chromium } = createRequire("/opt/npm-tools/node_modules/")("playwright");
const b = await chromium.launch();
for (const f of process.argv.slice(2)) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.route("**/*", r => /^(file|data):/.test(r.request().url()) ? r.continue() : r.abort());
  const p = await ctx.newPage(); await p.goto(pathToFileURL(f).href); await p.waitForTimeout(800);
  const r = await p.evaluate(() => { const w = innerWidth; const wide = [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > w + 2 && getComputedStyle(e).position !== "fixed").slice(0, 3).map(e => e.tagName + "." + String(e.className).slice(0, 30) + " r=" + Math.round(e.getBoundingClientRect().right)); return { sw: document.documentElement.scrollWidth, w, wide }; });
  console.log(f.split("/").slice(-3).join("/").slice(0, 60).padEnd(61), JSON.stringify(r)); await ctx.close();
}
await b.close();
