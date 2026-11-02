import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { importStandaloneTheme } from "../public/theme-importer.js";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error("Usage: node scripts/import-standalone-themes.mjs <input-folder> <output-folder>");
}

const inputRoot = path.resolve(inputArg);
const outputRoot = path.resolve(outputArg);
if (inputRoot === outputRoot || outputRoot.startsWith(`${inputRoot}${path.sep}`)) {
  throw new Error("The output folder must be outside the input folder.");
}

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findHtmlFiles(resolved));
    else if (entry.isFile() && /\.html?$/i.test(entry.name)) files.push(resolved);
  }
  return files;
}

const files = await findHtmlFiles(inputRoot);
const parser = new JSDOM("").window.DOMParser;
const report = [];
for (const inputFile of files) {
  const relativePath = path.relative(inputRoot, inputFile);
  const themeId = path.basename(path.dirname(inputFile)).toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "imported-theme";
  try {
    const source = await readFile(inputFile, "utf8");
    const result = importStandaloneTheme(source, { themeId, DOMParser: parser });
    const destination = path.join(outputRoot, path.dirname(relativePath));
    await mkdir(destination, { recursive: true });
    await Promise.all([
      writeFile(path.join(destination, path.basename(inputFile)), result.html, "utf8"),
      writeFile(path.join(destination, "theme.manifest.json"), `${JSON.stringify(result.manifest, null, 2)}\n`, "utf8")
    ]);
    report.push({
      file: relativePath,
      themeId,
      status: result.manifest.status,
      ...(result.manifest.reason ? { reason: result.manifest.reason } : "")
    });
  } catch (error) {
    report.push({ file: relativePath, themeId, status: "failed", reason: error.message });
  }
}

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const counts = report.reduce((total, item) => {
  total[item.status] = (total[item.status] || 0) + 1;
  return total;
}, {});
console.log(`Imported ${report.length} HTML theme(s): ${JSON.stringify(counts)}.`);
if (report.some(item => item.status === "failed")) process.exitCode = 1;
