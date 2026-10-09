import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  build: {
    outDir: 'www',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(process.cwd(), 'index.html'),
        register: resolve(process.cwd(), 'register.html')
      }
    }
  }
});
