import { readFile, readdir } from "node:fs/promises";
import { ESLint } from "eslint";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attributes]) => !/\bsrc\s*=/.test(attributes));

if (scripts.length === 0) {
  throw new Error("Expected at least one inline application script.");
}

const eslint = new ESLint({ overrideConfigFile: ".eslintrc.json", useEslintrc: false });
const results = await Promise.all(scripts.map(async ([, , script], index) => {
  const scriptLineOffset = source.slice(0, scripts[index].index).split("\n").length;
  const inlineScript = `${"\n".repeat(scriptLineOffset)}${script}`;
  return eslint.lintText(inlineScript, { filePath: `index.inline-${index + 1}.js` });
}));

// The app script moved out of index.html into src/app/main.js and the screen and shell modules
// split from it. They are ES modules; keep the same undefined-name check on them, and refuse
// assignments to imported names (imports are read-only).
const moduleLint = new ESLint({
  overrideConfigFile: ".eslintrc.json",
  useEslintrc: false,
  overrideConfig: { parserOptions: { sourceType: "module" }, rules: { "no-import-assign": "error" } }
});
const listJs = async dir => {
  const entries = await readdir(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? listJs(`${dir}/${entry.name}`)
    : entry.name.endsWith(".js") ? [`${dir}/${entry.name}`] : []));
  return nested.flat();
};
const moduleFiles = (await Promise.all(["src/app", "src/screens", "src/shell"].map(listJs))).flat();
results.push(...await moduleLint.lintFiles(moduleFiles));

const formatter = await eslint.loadFormatter("stylish");
const output = formatter.format(results.flat());
if (output) process.stdout.write(output);
if (results.flat().some(result => result.errorCount)) process.exitCode = 1;
