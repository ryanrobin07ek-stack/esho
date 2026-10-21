import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
const input = {
  app: resolve(process.cwd(), 'index.html')
};
const registerPage = resolve(process.cwd(), 'register.html');
if (existsSync(registerPage)) input.register = registerPage;

export default defineConfig({
  plugins: [{
    name: 'remove-retired-theme-skeleton-assets',
    apply: 'build',
    closeBundle: () => rm(resolve(process.cwd(), 'www', 'theme-skeletons'), { recursive: true, force: true })
  }],
  build: {
    outDir: 'www',
    emptyOutDir: true,
    rollupOptions: {
      input
    }
  }
});
