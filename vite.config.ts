/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { BUNDLE_FILE, buildLevelBundle } from './src/core/levelBundle';

/**
 * Perf (jalon 3) : au build, tous les niveaux sont regroupés dans dist/levels/bundle.json
 * (une requête au lieu d'environ 130). Les fichiers séparés restent publiés pour l'éditeur
 * et en secours.
 */
function levelBundle(): Plugin {
  return {
    name: 'ricochet-level-bundle',
    apply: 'build',
    generateBundle() {
      const dir = resolve(process.cwd(), 'public/levels');
      const read = (file: string): unknown => {
        const p = resolve(dir, file);
        return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as unknown) : undefined;
      };
      this.emitFile({
        type: 'asset',
        fileName: `levels/${BUNDLE_FILE}`,
        source: JSON.stringify(buildLevelBundle(read)),
      });
    },
  };
}

// base relative : le build fonctionne aussi bien sur GitHub Pages que sur itch.io.
// Build release : pas de sourcemaps publiées (11 Mo) ; `npx vite build --mode debug` pour enquêter.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [levelBundle()],
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
