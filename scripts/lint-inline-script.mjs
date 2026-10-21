import { readFile } from "node:fs/promises";
import { ESLint } from "eslint";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attributes]) => !/\bsrc\s*=/.test(attributes));

if (scripts.length !== 1) {
  throw new Error(`Expected one inline application script, found ${scripts.length}.`);
}

const eslint = new ESLint({ overrideConfigFile: ".eslintrc.json", useEslintrc: false });
const scriptLineOffset = source.slice(0, scripts[0].index).split("\n").length;
const inlineScript = `${"\n".repeat(scriptLineOffset)}${scripts[0][2]}`;
const [result] = await eslint.lintText(inlineScript, { filePath: "index.inline.js" });
const formatter = await eslint.loadFormatter("stylish");
const output = formatter.format([result]);
if (output) process.stdout.write(output);
if (result.errorCount) process.exitCode = 1;
