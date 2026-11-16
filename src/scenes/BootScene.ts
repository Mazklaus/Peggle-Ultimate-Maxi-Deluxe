import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import {
  buildCatalog,
  LEVELS_DIR,
  parseIndex,
  TEST_LEVEL_KEY,
  type LevelCatalog,
} from '../core/levelCatalog';
import { parseLevel } from '../core/levelFormat';
import { browserStorage, loadSave } from '../core/save';
import { REGISTRY, SCENES } from './keys';
import { textStyle } from './theme';

/**
 * Démarrage : charge la sauvegarde et les niveaux, puis aiguille.
 *   ./            -> écran titre
 *   ./?test       -> niveau envoyé par l'éditeur (localStorage « ricochet:test-level »)
 *   ./?level=<id> -> lance directement un niveau (QA, debug)
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    this.load.json('level-index', `${LEVELS_DIR}/index.json`);
    this.load.once('filecomplete-json-level-index', () => {
      const { index } = parseIndex(this.cache.json.get('level-index'));
      for (const id of index?.levels ?? [])
        this.load.json(`level:${id}`, `${LEVELS_DIR}/${id}.json`);
    });
  }

  create(): void {
    this.registry.set(REGISTRY.save, loadSave());

    const parsed = parseIndex(this.cache.json.get('level-index'));
    const catalog: LevelCatalog = parsed.index
      ? buildCatalog(
          parsed.index,
          Object.fromEntries(
            parsed.index.levels
              .filter((id) => this.cache.json.exists(`level:${id}`))
              .map((id) => [id, this.cache.json.get(`level:${id}`) as unknown]),
          ),
        )
      : { levels: [], errors: [parsed.error ?? 'index.json introuvable.'] };
    for (const e of catalog.errors) console.warn(`[niveaux] ${e}`);
    this.registry.set(REGISTRY.catalog, catalog);

    const params = new URLSearchParams(window.location.search);
    if (params.has('test')) return this.startTestLevel();
    // ?cutscene=intro | reveil_pip | fin_ch1 : rejoue une séquence de vignettes (tests).
    const cut = params.get('cutscene');
    if (cut === 'intro' || cut === 'reveil_pip' || cut === 'fin_ch1') {
      return void this.scene.start(SCENES.cutscene, {
        sequence: cut,
        next: { scene: SCENES.title },
      });
    }
    const direct = params.get('level');
    if (direct) {
      const level = catalog.levels.find((l) => l.id === direct);
      if (level) return void this.scene.start(SCENES.game, { level });
      return this.fail([`Niveau « ${direct} » introuvable.`, ...catalog.errors]);
    }
    if (catalog.levels.length === 0) return this.fail(catalog.errors);
    this.scene.start(SCENES.title);
  }

  private startTestLevel(): void {
    let raw: string | null = null;
    try {
      raw = browserStorage()?.getItem(TEST_LEVEL_KEY) ?? null;
    } catch {
      raw = null;
    }
    if (!raw)
      return this.fail(['Aucun niveau de test : utiliser le bouton « Tester » de l’éditeur.']);
    const res = parseLevel(raw);
    if (res.errors) return this.fail(['Niveau de test invalide :', ...res.errors]);
    this.scene.start(SCENES.game, { level: res.level, test: true });
  }

  private fail(lines: string[]): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, lines.slice(0, 12).join('\n'), {
        ...textStyle(18),
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 160 },
      })
      .setOrigin(0.5);
  }
}
