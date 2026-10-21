// Builds a plain-script copy of the app engine (+ generic mapper) so it can run in a browser test page.
import fs from "node:fs";
const P = "../claudemd/public/";
const strip = s => s.replace(/^import .*$/gm, "").replace(/^export /gm, "");
let eng = strip(fs.readFileSync(P + "theme-skeleton-engine.js", "utf8"));
const dat = strip(fs.readFileSync(P + "theme-skeleton-data.js", "utf8"));
const gen = fs.readFileSync("generic-mapper.js", "utf8");
if (!eng.includes("const nativeData = dataForTheme(schema.themeId, data);")) throw new Error("engine changed; patch point missing");
eng = eng.replace("const nativeData = dataForTheme(schema.themeId, data);", "const nativeData = schema.fieldMap ? mapGeneric(schema, data) : dataForTheme(schema.themeId, data);");
fs.writeFileSync("engine.bundle.js", `(()=>{\nconst dataForTheme = (()=>{\n${dat}\nreturn dataForTheme;\n})();\n${gen}\n${eng}\nwindow.fillThemeSkeleton = fillThemeSkeleton;\n})();`);
console.log("engine.bundle.js", fs.statSync("engine.bundle.js").size, "bytes");
