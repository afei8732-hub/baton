import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * The UI is a single Custom UI bundle served from static/baton.
 * `?preview=1` on index.html turns on the offline fixture harness, so the
 * screenshots and the demo video are produced from the same bundle that ships.
 */
export default defineConfig({
  root: resolve(__dirname, 'src/ui'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'static/baton'),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/ui/index.html'),
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5199,
    strictPort: true,
  },
});
