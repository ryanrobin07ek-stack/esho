// The till used to live in one file, src/pos.js. It is now split into modules under
// src/till/ and src/screens/till/. Source-level tests read all of it as one text so
// their assertions keep working no matter which module a function moved to.
import { readFile, readdir } from 'node:fs/promises';

const src = new URL('../../src/', import.meta.url);

async function moduleFiles(dir) {
  try {
    return (await readdir(new URL(dir, src)))
      .filter((name) => name.endsWith('.js'))
      .sort()
      .map((name) => `${dir}${name}`);
  } catch {
    return [];
  }
}

export async function readTillSource() {
  const files = ['pos.js', ...(await moduleFiles('till/')), ...(await moduleFiles('screens/till/'))];
  const parts = await Promise.all(files.map((file) => readFile(new URL(file, src), 'utf8')));
  return parts.join('\n').replace(/\r\n/g, '\n');
}
