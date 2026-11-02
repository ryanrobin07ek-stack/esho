import { readFile } from "node:fs/promises";
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
const formatter = await eslint.loadFormatter("stylish");
const output = formatter.format(results.flat());
if (output) process.stdout.write(output);
if (results.flat().some(result => result.errorCount)) process.exitCode = 1;
