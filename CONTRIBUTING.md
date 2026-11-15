# Conventions

## Branches

- `main` : toujours vert et jouable. Pas de push direct, tout passe par PR.
- Branches courtes depuis `main` : `<type>/<sujet-court>`, par ex. `feat/tir-bille`, `fix/rebond-mur`, `tools/deploy-web`.

## Commits (Conventional Commits)

```
<type>(<portée optionnelle>): <résumé à l'impératif>
```

Types : `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `perf`.
Exemple : `feat(physique): ajouter le rebond sur les pegs`.

## Pull requests

- Une PR = un sujet, petite de préférence.
- La CI doit être verte (`npm run ci` en local avant de pousser).
- Relue par le Lead Programmer, qui merge (squash) une fois validée.

## Style de code

- TypeScript strict, formaté par Prettier, vérifié par ESLint.
- Fichiers : `PascalCase.ts` pour les classes/scènes, `camelCase.ts` sinon.
- La logique de jeu testable va dans `src/core/` et n'importe jamais Phaser (règle ESLint).
- Les scènes (`src/scenes/`) restent fines : affichage, input, appel à `src/core`.
- Commentaires et docs en français, identifiants en anglais.
