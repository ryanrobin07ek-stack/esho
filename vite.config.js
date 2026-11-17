import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { copyFile, mkdir, rm } from 'node:fs/promises';
const input = {
  app: resolve(process.cwd(), 'index.html')
};
const registerPage = resolve(process.cwd(), 'register.html');
if (existsSync(registerPage)) input.register = registerPage;
const sqliteWasm = resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
const taxonomyBase64 = readFileSync(resolve(process.cwd(), 'public', 'data', 'shopify-product-taxonomy.json.gz')).toString('base64');
const bootstrapModule = resolve(process.cwd(), 'src/bootstrap.js');
const normalizeModuleId = id => id.replaceAll('\\', '/');

export default defineConfig({
  plugins: [
    {
      name: 'bundle-offline-product-taxonomy',
      enforce: 'pre',
      transform(code, id) {
        if (normalizeModuleId(id) !== normalizeModuleId(bootstrapModule)) return null;
        return `globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__=${JSON.stringify(taxonomyBase64)};\n${code}`;
      }
    },
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
        await rm(resolve(process.cwd(), 'www', 'data', 'shopify-product-taxonomy.json.gz'), { force: true });
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
