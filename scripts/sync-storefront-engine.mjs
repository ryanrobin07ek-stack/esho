import { execFileSync } from "node:child_process";
import { copyFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engineRoot = process.env.STOREFRONT_ENGINE_DIR
  ? path.resolve(process.env.STOREFRONT_ENGINE_DIR)
  : "";

if (!engineRoot) {
  throw new Error("Set STOREFRONT_ENGINE_DIR to the storefront-engine project directory.");
}

const engineBuild = path.join(engineRoot, "tools", "build.mjs");
await access(engineBuild);
execFileSync(process.execPath, [engineBuild], { cwd: engineRoot, stdio: "inherit" });

const sourceDir = path.join(engineRoot, "dist");
const targetDir = path.join(appRoot, "public", "theme-packages", "storefront-engine");
await mkdir(targetDir, { recursive: true });
await copyFile(path.join(sourceDir, "index.html"), path.join(targetDir, "index.html"));
await copyFile(path.join(sourceDir, "index.html"), path.join(targetDir, "studio.html"));
await copyFile(path.join(sourceDir, "data.json"), path.join(targetDir, "data.json"));
console.log("Synced storefront engine to public/theme-packages/storefront-engine.");
