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

// The app script moved from index.html into src/app/main.js, which imports the screen and shell
// modules split out of it.
export const APP_SCRIPT = "src/app/main.js";
const APP_SCRIPT_TAG = `<script type="module" src="/${APP_SCRIPT}"></script>`;

// main.js and every module it imports from src/screens and src/shell, in import order, followed by
// the sibling modules those import (a screen split across several files).
export async function appScriptFiles() {
  const main = await read(APP_SCRIPT);
  const modules = [...main.matchAll(/^import \{[^}]*\} from '\.\.\/((?:screens|shell)\/[\w/-]+\.js)';/gm)].map(match => `src/${match[1]}`);
  for (let index = 0; index < modules.length; index += 1) {
    const dir = modules[index].slice(0, modules[index].lastIndexOf("/") + 1);
    const source = await read(modules[index]);
    for (const match of source.matchAll(/^import \{[^}]*\} from '\.\/([\w/-]+\.js)';/gm)) {
      const file = `${dir}${match[1]}`;
      if (!modules.includes(file)) modules.push(file);
    }
  }
  return [APP_SCRIPT, ...modules];
}

// The app script as one text, the way it read before it was split. Each screen or shell module
// holds methods cut verbatim out of an object in main.js, as `export const name = { ... };`, and
// main.js spreads them back in with `  ...name,` at the same spot. Here the methods go back in
// place of that spread line, so a pattern bounded by a method's neighbours still matches. The rest
// of each module (imports, mount/unmount) follows main.js.
export async function readAppScript({ lf = false } = {}) {
  const [mainFile, ...moduleFiles] = await appScriptFiles();
  const mainRaw = await read(mainFile);
  let main = toLf(mainRaw);
  const rest = [];
  for (const file of moduleFiles) {
    const source = toLf(await read(file)).replace(/^export const (\w+) = \{\n([\s\S]*?)^\};\n/gm, (block, name, methods) => {
      const spread = `  ...${name},\n`;
      if (!main.includes(spread)) return block;
      main = main.replace(spread, () => methods);
      return "";
    });
    rest.push(source);
  }
  // Statement blocks cut out of a big method live as `export function name(...) { ... }` (body at a
  // two-space indent) and are called in place with `name.call(this, ...);` or
  // `return name.call(this, ...);`. Put each body back at its call, at the call's indent.
  for (let index = 0; index < rest.length; index += 1) {
    rest[index] = rest[index].replace(/^export function (\w+)\([^)]*\) \{\n([\s\S]*?)^\}\n/gm, (block, name, body) => {
      const call = new RegExp(`^( *)(?:return )?${name}\\.call\\(this(?:, [\\w, ]+)?\\);\\n`, "m");
      const found = main.match(call);
      if (!found) return block;
      const shift = " ".repeat(found[1].length - 2);
      main = main.replace(call, () => body.replace(/^(?=.)/gm, shift));
      return "";
    });
  }
  const text = [main, ...rest].join("\n");
  return lf || !mainRaw.includes("\r\n") ? text : text.replace(/\n/g, "\r\n");
}

// index.html with what moved out of it put back in place: the styles where its <style> block was
// (just before the theme-color meta tag) and the app script where its inline <script> was. A
// pattern that used to match index.html, in order, still does.
export async function readAppSource({ lf = false } = {}) {
  let html = await read("index.html");
  const styles = await readAppStyles();
  const anchor = html.search(/^ *<meta name="theme-color"/m);
  const at = anchor >= 0 ? anchor : html.indexOf("</head>");
  html = `${html.slice(0, at)}${styles}\n${html.slice(at)}`;
  if (html.includes(APP_SCRIPT_TAG)) {
    const script = await readAppScript();
    html = html.replace(APP_SCRIPT_TAG, () => `<script type="module" data-app-script>\n${script}\n</script>`);
  }
  return lf ? toLf(html) : html;
}
