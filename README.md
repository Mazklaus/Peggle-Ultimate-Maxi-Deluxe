# Peg Shooter (nom provisoire)

Jeu original de tir sur pegs, en 2D physique, jouable dans le navigateur.

## Stack

| Brique   | Choix                        | Pourquoi                                                        |
| -------- | ---------------------------- | --------------------------------------------------------------- |
| Moteur   | Phaser 4                     | Moteur web 2D mature, rendu WebGL/Canvas, scènes, input, audio. |
| Physique | Matter.js (intégré à Phaser) | Rebonds cercle/polygone fiables, corps statiques pour les pegs. |
| Langage  | TypeScript (strict)          | Typage pour une équipe à plusieurs programmeurs.                |
| Build    | Vite                         | Serveur de dev instantané, build statique déployable partout.   |
| Tests    | Vitest                       | Tests unitaires de la logique pure (`src/core`).                |
| Qualité  | ESLint + Prettier            | Style unique, vérifié en CI.                                    |
| CI       | GitHub Actions               | lint, format, typecheck, tests, build sur chaque PR.            |

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
npm run ci         # tout ce que la CI vérifie
npm run build      # build web statique dans dist/
```

## Arborescence

```
src/
  core/      logique pure, sans Phaser (règles, score) : testée par Vitest
  scenes/    scènes Phaser (affichage, input, physique)
  config.ts  constantes globales
tests/       tests Vitest
```

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les conventions.

## Pipeline de build

```
PR          -> CI (.github/workflows/ci.yml) : lint, format, typecheck, tests, build
merge main  -> Deploy web (.github/workflows/deploy-web.yml) : build puis publication GitHub Pages
```

- Build web jouable : https://mazklaus.github.io/Peggle-Ultimate-Maxi-Deluxe/
- Redéployer à la main : onglet Actions > Deploy web > Run workflow.
- Éditeur de niveaux : https://mazklaus.github.io/Peggle-Ultimate-Maxi-Deluxe/editor.html (format : [docs/level-format.md](docs/level-format.md)).
- Tester la build de prod en local : `npm run build && npm run preview`.
- Archive pour itch.io : zipper le contenu de `dist/` (le `base: './'` de Vite rend les chemins relatifs).
