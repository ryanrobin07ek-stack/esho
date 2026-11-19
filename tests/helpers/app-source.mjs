// The app shell used to be one index.html with its CSS inline. Its stylesheet now lives in
// src/styles/*.css (imported from src/bootstrap.js in cascade order). Source-matching tests read
// it through here so they see the same text they used to find in index.html.
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const toLf = text => text.replace(/\r\n/g, "\n");

// The style files in the order src/bootstrap.js imports them.
export async function appStyleFiles() {
  const bootstrap = await read("src/bootstrap.js");
  return [...bootstrap.matchAll(/^import '\.\/(styles\/[\w-]+\.css)';/gm)].map(match => `src/${match[1]}`);
}

// The former inline <style> block: every app style file, concatenated in cascade order.
export async function readAppStyles({ lf = false } = {}) {
  const files = await appStyleFiles();
  const text = (await Promise.all(files.map(read))).join("\n");
  return lf ? toLf(text) : text;
}

// index.html with the moved styles put back where its <style> block was (just before the
// theme-color meta tag), so a pattern that used to match index.html, in order, still does.
export async function readAppSource({ lf = false } = {}) {
  const html = await read("index.html");
  const styles = await readAppStyles();
  const anchor = html.search(/^ *<meta name="theme-color"/m);
  const at = anchor >= 0 ? anchor : html.indexOf("</head>");
  const text = `${html.slice(0, at)}${styles}\n${html.slice(at)}`;
  return lf ? toLf(text) : text;
}
