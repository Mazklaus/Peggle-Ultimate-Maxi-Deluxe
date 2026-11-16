import { defineConfig } from 'vite';

// base relative : le build fonctionne aussi bien sur GitHub Pages que sur itch.io.
// Build release : pas de sourcemaps publiées (11 Mo) ; `npx vite build --mode debug` pour enquêter.
export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: mode === 'debug',
    chunkSizeWarningLimit: 2000,
    // Trois pages : le jeu, l'éditeur de niveaux et le banc d'écoute audio.
    rollupOptions: {
      input: { main: 'index.html', editor: 'editor.html', sons: 'sons.html', lab: 'lab.html' },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
