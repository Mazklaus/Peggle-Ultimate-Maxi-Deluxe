import { defineConfig } from 'vite';

// base relative : le build fonctionne aussi bien sur GitHub Pages que sur itch.io.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    // Trois pages : le jeu, l'éditeur de niveaux et le banc d'écoute audio.
    rollupOptions: {
      input: { main: 'index.html', editor: 'editor.html', sons: 'sons.html', lab: 'lab.html' },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
