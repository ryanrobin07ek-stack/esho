import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { createReadStream } from 'node:fs';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, rm } from 'node:fs/promises';
const input = {
  app: resolve(process.cwd(), 'index.html')
};
const registerPage = resolve(process.cwd(), 'register.html');
if (existsSync(registerPage)) input.register = registerPage;
const sqliteWasm = resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');

export default defineConfig({
  plugins: [
    {
      name: 'serve-jeep-sqlite-wasm',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] !== '/assets/sql-wasm.wasm' || !['GET', 'HEAD'].includes(req.method || '')) {
            next();
            return;
          }
          res.setHeader('Content-Type', 'application/wasm');
          if (req.method === 'HEAD') {
            res.end();
            return;
          }
          createReadStream(sqliteWasm).on('error', next).pipe(res);
        });
      }
    },
    {
      name: 'copy-jeep-sqlite-wasm',
      apply: 'build',
      async closeBundle() {
        const assetsDir = resolve(process.cwd(), 'www', 'assets');
        await mkdir(assetsDir, { recursive: true });
        await copyFile(sqliteWasm, resolve(assetsDir, 'sql-wasm.wasm'));
        await rm(resolve(process.cwd(), 'www', 'theme-skeletons'), { recursive: true, force: true });
      }
    }
  ],
  build: {
    outDir: 'www',
    emptyOutDir: true,
    rollupOptions: {
      input
    }
  }
});
