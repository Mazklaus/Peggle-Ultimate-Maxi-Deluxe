import { defineConfig } from 'vite';

// base relative : le build fonctionne aussi bien sur GitHub Pages que sur itch.io.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true, chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
