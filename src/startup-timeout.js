// Startup must never hang silently. The local database (jeep-sqlite web store, native plugin) and
// the POS engine are awaited before the first screen renders, so a step that never settles (a wasm
// file that fails to load, a plugin bridge that never answers) would leave a blank page forever.
// Racing each step against a timer turns that into an error the bootstrap shows to the owner.
export const STARTUP_TIMEOUT_MS = 60_000;

export function withStartupTimeout(promise, label, ms = STARTUP_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not finish within ${Math.round(ms / 1000)} seconds.`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}
