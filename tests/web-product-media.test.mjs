import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("website product form accepts and stores up to eight product photos", () => {
  assert.match(app, /imageInput\.multiple = true/);
  assert.match(app, /Add photos \(up to 8\)/);
  assert.match(app, /const files = Array\.from\(imageInput\.files \|\| \[\]\)/);
  assert.match(app, /if \(files\.length > 8\)/);
  assert.match(app, /data\.getAll\("image"\)\.filter\(file => file instanceof File && file\.size > 0\)/);
  assert.match(app, /for \(const imageFile of imageFiles\)\s*\{\s*images\.push\(await AppUtils\.compressImageFile\(imageFile\)\)/);
  assert.match(app, /name="imageFile" class="form-input" accept="image\/\*" multiple/);
  assert.match(app, /const selectedImages = Array\.from\(imageInput\.files \|\| \[\]\)/);
  assert.match(app, /Promise\.all\(selectedImages\.map\(file => this\.readProductImage\(file\)\)\)/);
});
