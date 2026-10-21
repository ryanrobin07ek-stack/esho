import { execFileSync } from "node:child_process"; import fs from "node:fs"; import path from "node:path";
const T = [["aura-luxe","aura-luxe","aura-luxe"],["elura-botanicals","elura","#U00e9lura"],["atelier-vera","atelier-vera","atelier-v"],["autopro-kenya","autopro","autopro"],
["kicks-vault","kicks","kicks"],["kifaru-build","kifaru","kifaru"],["kinetic-electronics","kinetic","kinetic"],["maison-alchemie","maison-alchemie","maison-alch"],
["veluna","veluna","veluna"],["woodora","woodora","woodora"],["volthaus","volthaus","volthaus"],["aurex-electronics","aurex","aurex"],["shamba-bora","shamba","shamba"]];
const SK = "../skel/fixed-skeletons/theme-skeletons", OR = "../themes/themes-html-css";
const rows = [];
for (const [theme, sp, op] of T) {
  const sd = fs.readdirSync(SK).find(d => d.startsWith(sp)), od = fs.readdirSync(OR).find(d => d.startsWith(op));
  const row = { theme };
  try { execFileSync("node", ["wire.mjs", path.join(SK, sd), theme], { stdio: "pipe" }); row.wire = "ok"; }
  catch (e) { row.wire = "FAIL: " + String(e.stderr).split("\n").find(l => /Error/.test(l))?.slice(0, 90); rows.push(row); console.log(theme.padEnd(20), row.wire); continue; }
  fs.copyFileSync(path.join(OR, od, "eshop-mobile.css"), "out/eshop-mobile.css");
  try { row.out = execFileSync("node", ["adapt-test.mjs", path.join("out", theme), path.join(OR, od, "index.html")], { stdio: "pipe", timeout: 150000 }).toString(); row.pass = true; }
  catch (e) { row.out = String(e.stdout || "") + String(e.stderr || "").slice(0, 200); row.pass = false; }
  const lines = row.out.split("\n").filter(l => /^N=/.test(l));
  console.log(theme.padEnd(20), row.pass ? "ALL PASS" : "FAIL    ", lines.map(l => l.slice(0, 4) + (l.includes("PASS") ? "✓" : "✗")).join(" "));
  if (!row.pass) lines.filter(l => l.includes("FAIL")).slice(0, 1).forEach(l => console.log("     ", l.slice(0, 230)));
}
