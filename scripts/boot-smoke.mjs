// Verifies the PRODUCTION build (www/) boots in a real browser.
// Usage: npm run build && npm run test:boot
// Guards against startup deadlocks (e.g. top-level await in src/bootstrap.js)
// that leave the app on a blank page.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 4179;
const base = `http://localhost:${port}/`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch {} };
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('vite preview did not start');
}

let failed = false;
try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'load' });
  let booted = false;
  for (let i = 0; i < 30 && !booted; i++) {
    await page.waitForTimeout(1000);
    booted = await page.evaluate(() => Boolean(window.ShopSQLite) && (document.querySelector('#app')?.children.length || 0) > 0);
  }
  await browser.close();
  if (!booted) { console.error('FAIL: production build did not boot (blank page).', errors.slice(0, 3)); failed = true; }
  else if (errors.length) { console.error('FAIL: uncaught page errors:', errors.slice(0, 3)); failed = true; }
  else console.log('OK: production build boots with no uncaught errors.');
} catch (error) {
  console.error('FAIL:', error.message); failed = true;
} finally { stop(); }
process.exit(failed ? 1 : 0);
