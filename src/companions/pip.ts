/**
 * Pip : petite étoile surexcitée comme un chiot (fiche Narrative 01-pip.md).
 * Uniquement des données d'animation : le cerveau et la vue sont communs à tous les Astres.
 * Décalages en px dans la loge (rayon du corps ≈ 30 px), y négatif = vers le haut.
 */
import type { CompanionDef, ReactionDef } from '../core/companion/types';

const r = (
  id: string,
  duration: number,
  keys: ReactionDef['keys'],
  extra: Partial<ReactionDef> = {},
): ReactionDef => ({
  id,
  duration,
  keys,
  ...extra,
});

// ---------- AVANT le tir : idles courts ----------
const idleShort: ReactionDef[] = [
  r('pip_idle_pointe', 1.6, [
    { t: 0, arms: 'point', look: { x: 1, y: 0.2 }, body: { rot: 0.15 } },
    { t: 0.35, look: { x: -0.6, y: -0.6 }, mouth: 'grin' },
    { t: 0.6, look: { x: 1, y: 0.2 }, body: { rot: 0.2, y: -4 }, symbol: '!' },
    { t: 0.9, arms: 'rest', symbol: null, body: { rot: 0, y: 0 } },
  ]),
  r('pip_idle_hop', 0.7, [
    { t: 0, body: { sy: 0.8, sx: 1.15 } },
    { t: 0.25, body: { y: -18, sy: 1.2, sx: 0.9 }, tuft: 'up' },
    { t: 0.6, body: { y: 0, sy: 0.85, sx: 1.12 } },
    { t: 1, body: { sy: 1, sx: 1 }, tuft: 'calm' },
  ]),
  r('pip_idle_gratte', 1.4, [
    { t: 0, arms: 'scratch', eyes: 'squint', mouth: 'pout', body: { rot: -0.12 } },
    { t: 0.8, eyes: 'open', mouth: 'smile', arms: 'rest', body: { rot: 0 } },
  ]),
  r('pip_idle_etire', 1.5, [
    { t: 0, arms: 'up', body: { sy: 1.25, sx: 0.85, y: -6 }, eyes: 'closed', mouth: 'yawn' },
    { t: 0.55, body: { sy: 1.3, sx: 0.82, y: -8 } },
    { t: 0.8, body: { sy: 0.9, sx: 1.08, y: 0 }, arms: 'rest', eyes: 'open', mouth: 'smile' },
    { t: 1, body: { sy: 1, sx: 1 } },
  ]),
];

// ---------- AVANT le tir : idles longs comiques ----------
const idleLong: ReactionDef[] = [
  // L1 « La mouche »
  r('pip_long_mouche', 4.2, [
    { t: 0, prop: 'fly', look: { x: -0.8, y: -0.8 }, eyes: 'squint', mouth: 'o' },
    { t: 0.15, look: { x: 0.9, y: -0.5 }, body: { rot: 0.25 } },
    { t: 0.3, look: { x: 0, y: -0.2 }, eyes: 'spiral', body: { rot: 0 } }, // louche
    { t: 0.45, arms: 'up', body: { y: -26, sy: 1.25, sx: 0.85 }, eyes: 'wide', mouth: 'open' },
    { t: 0.55, arms: 'rest', body: { y: 0, sy: 0.85, sx: 1.15 }, mouth: 'o', symbol: '?' },
    { t: 0.62, prop: 'none', mouth: 'puffed', eyes: 'wide', symbol: '!' }, // gobée !
    {
      t: 0.72,
      shake: 3,
      mouth: 'open',
      eyes: 'squint',
      burst: { kind: 'sparkle', count: 4 },
      symbol: null,
    },
    { t: 0.85, shake: 0, mouth: 'grin', eyes: 'happy' },
    { t: 1, eyes: 'open', mouth: 'smile' },
  ]),
  // L2 « Le jongleur raté »
  r('pip_long_jongleur', 4.5, [
    { t: 0, prop: 'juggle', arms: 'clap', look: { x: 0, y: -1 }, mouth: 'grin' },
    { t: 0.5, body: { y: -3 } },
    { t: 0.62, prop: 'bonk', look: { x: 0, y: -1 }, eyes: 'wide', mouth: 'o', arms: 'wide' },
    {
      t: 0.7,
      body: { sy: 0.6, sx: 1.35, y: 6 },
      eyes: 'spiral',
      mouth: 'zigzag',
      burst: { kind: 'dizzy', count: 3 },
    },
    { t: 0.88, body: { sy: 1, sx: 1, y: 0, rot: 0.2 }, shake: 2 },
    { t: 0.95, body: { rot: -0.2 }, shake: 2 },
    { t: 1, body: { rot: 0 }, shake: 0, prop: 'none', eyes: 'open', mouth: 'smile', arms: 'rest' },
  ]),
  // L3 « L'entraînement »
  r('pip_long_pompes', 4.2, [
    {
      t: 0,
      body: { rot: 1.4, y: 14, sx: 1, sy: 1 },
      arms: 'pushup',
      eyes: 'squint',
      mouth: 'pout',
    },
    { t: 0.12, body: { y: 20 } },
    { t: 0.22, body: { y: 12 } },
    { t: 0.3, body: { y: 20 } },
    { t: 0.37, body: { y: 12 } },
    { t: 0.43, body: { y: 20 }, burst: { kind: 'sweat', count: 2 } },
    { t: 0.48, body: { y: 12 } },
    { t: 0.53, body: { y: 20 } },
    {
      t: 0.6,
      body: { y: 24, sy: 0.55, sx: 1.3, rot: 1.57 },
      eyes: 'closed',
      mouth: 'yawn',
      burst: { kind: 'sweat', count: 3 },
    },
    {
      t: 0.8,
      body: { y: 0, sy: 1.1, sx: 1.05, rot: 0 },
      arms: 'chest',
      eyes: 'happy',
      mouth: 'grin',
    },
    { t: 1, body: { sy: 1, sx: 1 }, arms: 'rest', eyes: 'open', mouth: 'smile' },
  ]),
  // L4 « La course »
  r('pip_long_course', 3.6, [
    { t: 0, body: { rot: 0.3 }, eyes: 'squint', mouth: 'grin', arms: 'flail' },
    { t: 0.25, body: { x: 70, rot: 0.35 } },
    {
      t: 0.3,
      body: { x: 72, rot: -0.4, sx: 0.8 },
      burst: { kind: 'smoke', count: 4 },
      eyes: 'wide',
    }, // dérapage
    { t: 0.6, body: { x: -70, rot: -0.35, sx: 1 } },
    { t: 0.65, body: { x: -72, rot: 0.4, sx: 0.8 }, burst: { kind: 'smoke', count: 4 } },
    {
      t: 0.85,
      body: { x: 0, rot: 0, sx: 1 },
      arms: 'rest',
      mouth: 'whistle',
      eyes: 'happy',
      symbol: '♪',
    },
    { t: 1, symbol: null, mouth: 'smile', eyes: 'open' },
  ]),
];

// ---------- Inactivité (V1 à V3, l'endormissement est un état) ----------
const inactivite: ReactionDef[] = [
  r('pip_toc_toc', 1.6, [
    { t: 0, arms: 'point', look: { x: 0, y: 0.2 }, body: { x: 6 }, mouth: 'o' },
    { t: 0.15, body: { x: 12 }, shake: 2 },
    { t: 0.25, body: { x: 6 }, shake: 0 },
    { t: 0.35, body: { x: 12 }, shake: 2, symbol: '?' },
    { t: 0.45, body: { x: 6 }, shake: 0 },
    { t: 0.8, body: { x: 0 }, arms: 'rest', symbol: null, mouth: 'smile' },
  ]),
  r('pip_ennui', 3, [
    {
      t: 0,
      body: { rot: -1.4, y: 16 },
      arms: 'up',
      prop: 'juggle',
      eyes: 'squint',
      mouth: 'neutral',
    },
    { t: 0.5, mouth: 'yawn', eyes: 'closed' },
    { t: 0.7, mouth: 'neutral', eyes: 'squint' },
    { t: 1, body: { rot: 0, y: 0 }, arms: 'rest', prop: 'none', eyes: 'open', mouth: 'smile' },
  ]),
  r('pip_mime', 2, [
    { t: 0, arms: 'point', body: { rot: 0.2 }, mouth: 'grin' },
    { t: 0.15, body: { y: -10, sx: 0.9, sy: 1.1 }, symbol: '!' },
    { t: 0.3, body: { y: 0, sx: 1, sy: 1 } },
    { t: 0.45, body: { y: -14, sx: 0.88, sy: 1.15 }, symbol: '!!' },
    { t: 0.6, body: { y: 0, sx: 1, sy: 1 } },
    { t: 0.75, body: { y: -20, sx: 0.85, sy: 1.2 }, shake: 1.5 },
    { t: 1, body: { y: 0, sx: 1, sy: 1, rot: 0 }, arms: 'rest', symbol: null, shake: 0 },
  ]),
];

// ---------- PENDANT le vol ----------
const tir_lance: ReactionDef[] = [
  r('pip_go', 0.7, [
    { t: 0, body: { sy: 0.8, sx: 1.15 } },
    { t: 0.3, body: { sy: 1.35, sx: 0.8, y: -12 }, arms: 'up', mouth: 'open', tuft: 'up' },
    { t: 1, body: { sy: 1, sx: 1, y: 0 }, arms: 'steer' },
  ]),
  r('pip_pointeur', 0.9, [
    { t: 0, arms: 'point', body: { rot: 0.25 }, mouth: 'grin', eyes: 'squint' },
    { t: 1, body: { rot: 0 } },
  ]),
  r('pip_croise', 0.9, [
    { t: 0, arms: 'cross', body: { sy: 0.85, sx: 1.08 }, eyes: 'closed', mouth: 'pout' },
    { t: 0.85, body: { sy: 1, sx: 1 } },
  ]),
];

const proche_coeur: ReactionDef[] = [
  r('pip_oh', 0.6, [
    {
      t: 0,
      body: { x: -8, y: -6, sy: 1.15 },
      arms: 'cover',
      eyes: 'wide',
      mouth: 'o',
      symbol: '!',
    },
    { t: 1, body: { x: 0, y: 0, sy: 1 }, symbol: null },
  ]),
];

const presque: ReactionDef[] = [
  r('pip_noooon', 1.2, [
    { t: 0, arms: 'cover', eyes: 'wide', mouth: 'open', symbol: '!!' },
    { t: 0.3, body: { sy: 1.5, sx: 0.75, y: 14 }, mouth: 'yawn', eyes: 'closed', tuft: 'down' },
    { t: 0.75, body: { sy: 1.2, sx: 0.9, y: 8 } },
    { t: 1, body: { sy: 1, sx: 1, y: 0 }, symbol: null },
  ]),
  r('pip_souffle', 1.1, [
    { t: 0, mouth: 'puffed', body: { sx: 1.2, sy: 1.1 }, eyes: 'squint', flush: 0.6 },
    {
      t: 0.5,
      mouth: 'o',
      body: { sx: 0.9, sy: 0.95, x: 6 },
      burst: { kind: 'smoke', count: 5 },
      flush: 0,
    },
    { t: 0.8, eyes: 'wide', mouth: 'pout', symbol: '?' },
    { t: 1, body: { sx: 1, sy: 1, x: 0 }, symbol: null },
  ]),
];

/**
 * Orbe coincée (DA specs-astres.md §6, astres-rig.js) : Pip gonfle les joues et souffle
 * dessus, pose tenue jusqu'à orbe_debloquee ; le souffle (reach) suit son regard.
 */
const orbe_coincee: ReactionDef[] = [
  r(
    'pip_souffle_orbe',
    1.2,
    [
      { t: 0, mouth: 'puffed', eyes: 'squint', arms: 'wide', reach: 0 },
      { t: 0.29, body: { sx: 1.5, sy: 1.45 }, flush: 0.7 },
      { t: 0.42, shake: 0 },
      { t: 0.5, body: { sx: 1.6, sy: 1.55 }, reach: 0 },
      { t: 0.54, mouth: 'o', shake: 1.2, flush: 1 },
      { t: 0.58, reach: 1 },
      { t: 1, body: { sx: 1.55, sy: 1.5 }, reach: 1, shake: 1.2 },
    ],
    { hold: true },
  ),
];

/** L'orbe repart : Pip se dégonfle en toupie, étourdi, puis tout fier. */
const orbe_debloquee: ReactionDef[] = [
  r('pip_degonfle', 1.3, [
    {
      t: 0,
      eyes: 'spiral',
      mouth: 'open',
      body: { sx: 1.55, sy: 1.5 },
      burst: { kind: 'smoke', count: 3 },
    },
    { t: 0.12, body: { x: 14, y: -12 } },
    { t: 0.23, body: { x: -12, y: -24 } },
    { t: 0.38, body: { sx: 0.85, sy: 0.85, x: 0, rot: Math.PI * 3 } },
    { t: 0.39, body: { rot: Math.PI } },
    { t: 0.54, body: { y: 0 } },
    { t: 0.62, body: { sx: 0.9, sy: 0.9, rot: Math.PI * 2 } },
    { t: 0.63, body: { rot: 0 } },
    { t: 0.66, eyes: 'open', mouth: 'grin', burst: { kind: 'sparkle', count: 2 } },
    { t: 0.77, body: { sx: 1.1, sy: 1.15 }, arms: 'up' },
    { t: 1, body: { sx: 1, sy: 1 }, arms: 'rest' },
  ]),
];

const pouvoir_active: ReactionDef[] = [
  r('pip_garde_a_vous', 1.2, [
    {
      t: 0,
      body: { sy: 1.2, sx: 0.88, y: -6 },
      tuft: 'antenna',
      eyes: 'wide',
      prop: 'beam',
      glow: 1,
    },
    { t: 0.8, body: { sy: 1, sx: 1, y: 0 }, prop: 'none', burst: { kind: 'sparkle', count: 6 } },
    { t: 1, glow: 0.4 },
  ]),
];

const final_ralenti: ReactionDef[] = [
  r('pip_grand_o', 1.4, [
    { t: 0, mouth: 'o', eyes: 'wide', tuft: 'up', body: { sy: 1.05 } },
    { t: 0.7, mouth: 'open', body: { sy: 1.25, sx: 0.9, y: -6 }, glow: 1 },
    {
      t: 0.85,
      eyes: 'stars',
      body: { y: -30, sy: 1.3, sx: 0.85 },
      arms: 'up',
      burst: { kind: 'confetti', count: 12 },
    },
    { t: 1, body: { y: 0, sy: 1, sx: 1 } },
  ]),
];

// ---------- APRÈS le tir ----------
const gros_coup: ReactionDef[] = [
  r('pip_toupie', 1.1, [
    { t: 0, eyes: 'stars', mouth: 'grin', arms: 'wide', burst: { kind: 'sparkle', count: 6 } },
    { t: 0.8, body: { rot: Math.PI * 4 } },
    { t: 0.81, body: { rot: 0 } },
    { t: 1, arms: 'rest' },
  ]),
  r('pip_supporter', 1.2, [
    { t: 0, arms: 'wave', mouth: 'open', eyes: 'happy' },
    { t: 0.15, body: { y: -22, sy: 1.2, sx: 0.9 } },
    { t: 0.3, body: { y: 0, sy: 0.85, sx: 1.12 } },
    { t: 0.45, body: { y: -22, sy: 1.2, sx: 0.9 }, burst: { kind: 'sparkle', count: 3 } },
    { t: 0.6, body: { y: 0, sy: 0.85, sx: 1.12 } },
    { t: 0.75, body: { y: -22, sy: 1.2, sx: 0.9 }, burst: { kind: 'sparkle', count: 3 } },
    { t: 0.9, body: { y: 0, sy: 1, sx: 1 } },
  ]),
  r('pip_fier', 1.2, [
    {
      t: 0,
      body: { sx: 1.25, sy: 1.15 },
      arms: 'chest',
      eyes: 'happy',
      mouth: 'grin',
      look: { x: -0.7, y: -0.5 },
    },
    { t: 0.3, shake: 1 },
    { t: 0.5, shake: 0, symbol: '✦' },
    { t: 1, body: { sx: 1, sy: 1 }, symbol: null },
  ]),
];

const chaine_longue: ReactionDef[] = [
  r('pip_effondre', 1.3, [
    { t: 0, body: { rot: -1.57, y: 16, sy: 0.9 }, eyes: 'spiral', mouth: 'grin', arms: 'flail' },
    { t: 0.8, body: { rot: -1.57, y: 16 } },
    { t: 1, body: { rot: 0, y: 0, sy: 1 }, arms: 'rest', eyes: 'happy' },
  ]),
  r(
    'pip_hysterie',
    1.1,
    [
      { t: 0, body: { sx: 1.4, sy: 1.4 }, eyes: 'stars', mouth: 'open', glow: 1 },
      { t: 0.2, body: { sx: 0.1, sy: 0.1 }, burst: { kind: 'confetti', count: 18 } },
      { t: 0.55, body: { sx: 0.1, sy: 0.1 } },
      { t: 0.8, body: { sx: 1.15, sy: 1.15 }, tuft: 'messy', eyes: 'happy' },
      { t: 1, body: { sx: 1, sy: 1 } },
    ],
    { aftermath: { tuft: 'messy', seconds: 5 } },
  ),
];

const tir_moyen: ReactionDef[] = [
  r('pip_hoche', 0.6, [
    { t: 0, body: { y: 3 }, eyes: 'happy', mouth: 'smile' },
    { t: 0.3, body: { y: -2 } },
    { t: 0.6, body: { y: 3 } },
    { t: 1, body: { y: 0 }, eyes: 'open' },
  ]),
];

const rate: ReactionDef[] = [
  r('pip_meche_tombante', 1.2, [
    {
      t: 0,
      body: { sy: 0.8, sx: 1.12, y: 6 },
      tuft: 'down',
      mouth: 'pout',
      eyes: 'squint',
      arms: 'down',
    },
    { t: 0.65, body: { sy: 0.78 } },
    {
      t: 0.75,
      body: { sy: 1.2, sx: 0.9, y: -8 },
      tuft: 'up',
      mouth: 'grin',
      eyes: 'open',
      arms: 'up',
      symbol: '!',
    },
    { t: 1, body: { sy: 1, sx: 1, y: 0 }, arms: 'rest', symbol: null },
  ]),
  r('pip_pas_moi', 1.3, [
    { t: 0, look: { x: -1, y: -0.6 }, mouth: 'whistle', body: { rot: -0.2 }, symbol: '♪' },
    { t: 0.5, look: { x: -0.9, y: -0.8 } },
    { t: 1, body: { rot: 0 }, symbol: null, mouth: 'smile' },
  ]),
  r('pip_pas_grave', 1.2, [
    {
      t: 0,
      arms: 'point',
      body: { x: -8, rot: -0.15 },
      mouth: 'smile',
      eyes: 'happy',
      look: { x: -1, y: 0 },
    },
    { t: 0.3, body: { x: -12 } },
    { t: 0.45, body: { x: -8 } },
    { t: 0.6, body: { x: -12 }, symbol: '♥' },
    { t: 1, body: { x: 0, rot: 0 }, arms: 'rest', symbol: null },
  ]),
];

const orbe_recupere: ReactionDef[] = [
  r('pip_ouf', 1, [
    { t: 0, arms: 'scratch', eyes: 'closed', mouth: 'smile', burst: { kind: 'sweat', count: 1 } },
    { t: 0.5, eyes: 'happy', mouth: 'grin' },
    { t: 1, arms: 'rest', eyes: 'open' },
  ]),
  r('pip_applaudit', 1, [
    {
      t: 0,
      arms: 'clap',
      tuft: 'up',
      eyes: 'happy',
      mouth: 'open',
      burst: { kind: 'note', count: 3 },
    },
    { t: 0.6, burst: { kind: 'note', count: 2 } },
    { t: 1, arms: 'rest' },
  ]),
];

const reveil: ReactionDef[] = [
  r('pip_sursaut', 0.6, [
    {
      t: 0,
      body: { y: -24, sy: 1.3, sx: 0.8 },
      eyes: 'wide',
      mouth: 'open',
      tuft: 'up',
      symbol: '!',
    },
    { t: 0.5, body: { y: 0, sy: 0.9, sx: 1.1 } },
    { t: 1, body: { sy: 1, sx: 1 }, symbol: null },
  ]),
];

const victoire: ReactionDef[] = [
  r(
    'pip_feu_artifice',
    2.5,
    [
      { t: 0, body: { sy: 0.7, sx: 1.25 }, eyes: 'stars', mouth: 'open' },
      {
        t: 0.15,
        body: { y: -170, sy: 1.4, sx: 0.75 },
        arms: 'up',
        burst: { kind: 'sparkle', count: 10 },
      },
      { t: 0.35, body: { y: -170 }, burst: { kind: 'confetti', count: 20 } },
      { t: 0.5, body: { y: 0, sy: 0.75, sx: 1.25 } },
      { t: 0.6, body: { y: -30, sy: 1.15, sx: 0.9 } },
      { t: 0.7, body: { y: 0, sy: 0.85 } },
      { t: 0.78, body: { y: -14, sy: 1.1 } },
      {
        t: 0.86,
        body: { y: 0, sy: 1, sx: 1 },
        arms: 'wide',
        mouth: 'grin',
        eyes: 'happy',
        symbol: '✦',
      },
      { t: 1, arms: 'up' },
    ],
    { hold: true },
  ),
  r(
    'pip_calin',
    2.2,
    [
      { t: 0, eyes: 'happy', mouth: 'grin', arms: 'wide' },
      { t: 0.25, body: { x: 72, rot: 0.2 } },
      {
        t: 0.35,
        body: { x: 78, sx: 0.65, sy: 1.25 },
        arms: 'cross',
        eyes: 'closed',
        burst: { kind: 'heart', count: 6 },
        symbol: '♥',
      },
      { t: 0.8, body: { x: 78, sx: 0.7, sy: 1.2 }, burst: { kind: 'heart', count: 3 } },
      { t: 1, body: { x: 0, sx: 1, sy: 1, rot: 0 }, arms: 'up', eyes: 'happy' },
    ],
    { hold: true },
  ),
];

const echec: ReactionDef[] = [
  r(
    'pip_flaque',
    2.5,
    [
      { t: 0, body: { sy: 0.9 }, eyes: 'squint', mouth: 'pout', tuft: 'down' },
      { t: 0.3, body: { sy: 0.2, sx: 1.9, y: 24 }, eyes: 'wink', mouth: 'neutral' },
      { t: 0.65, body: { sy: 0.2, sx: 1.9, y: 24 } },
      {
        t: 0.75,
        body: { sy: 1.3, sx: 0.85, y: -10 },
        tuft: 'up',
        eyes: 'open',
        mouth: 'grin',
        symbol: '!',
      },
      { t: 0.9, body: { sy: 1, sx: 1, y: 0 }, arms: 'point', symbol: null },
    ],
    { hold: true },
  ),
  r(
    'pip_drame',
    2.4,
    [
      { t: 0, arms: 'scratch', eyes: 'closed', mouth: 'open' },
      { t: 0.3, body: { rot: -1.4, y: 14 }, mouth: 'yawn' },
      { t: 0.6, body: { rot: -1.4, y: 14 } },
      {
        t: 0.75,
        body: { rot: 0, y: -12, sy: 1.15 },
        arms: 'up',
        eyes: 'open',
        mouth: 'grin',
        tuft: 'up',
      },
      { t: 0.9, body: { y: 0, sy: 1 }, arms: 'point' },
    ],
    { hold: true },
  ),
];

const dernier_coeur: ReactionDef[] = [
  r('pip_suspense', 0.8, [
    {
      t: 0,
      body: { sy: 0.8, sx: 1.1, y: 6 },
      eyes: 'wide',
      mouth: 'zigzag',
      shake: 1.5,
      symbol: '!',
    },
    { t: 1, symbol: null },
  ]),
];

const dernier_orbe: ReactionDef[] = [
  r('pip_priere', 0.9, [
    {
      t: 0,
      arms: 'pray',
      tuft: 'curl',
      look: { x: -0.7, y: -0.8 },
      eyes: 'wide',
      mouth: 'pout',
      body: { y: -4 },
    },
    { t: 1, body: { y: 0 } },
  ]),
];

export const PIP: CompanionDef = {
  id: 'pip',
  // Palette DA (specs-astres.md) : base, reflet, ombre.
  color: 0xffe45c,
  colorLight: 0xfff6b8,
  colorDark: 0xe0b92e,
  reach: 'blow',
  idleShort,
  idleLong,
  reactions: {
    tir_lance,
    proche_coeur,
    presque,
    pouvoir_active,
    orbe_coincee,
    orbe_debloquee,
    final_ralenti,
    gros_coup,
    chaine_longue,
    tir_moyen,
    rate,
    orbe_recupere,
    inactivite,
    reveil,
    victoire,
    echec,
    dernier_coeur,
    dernier_orbe,
  },
  states: {
    dernier_coeur: {
      body: { sy: 0.85, sx: 1.08, y: 5 },
      eyes: 'wide',
      mouth: 'zigzag',
      shake: 0.8,
      look: { x: 1, y: 0.3 },
    },
    dernier_orbe: {
      arms: 'pray',
      tuft: 'curl',
      eyes: 'wide',
      mouth: 'pout',
      look: { x: -0.6, y: -0.8 },
    },
    sommeil: {
      body: { sy: 0.9, sx: 1.06, y: 6 },
      eyes: 'closed',
      mouth: 'neutral',
      tuft: 'down',
      symbol: 'zzz',
    },
    crispation: {
      body: { sy: 0.82, sx: 1.1, y: 4 },
      eyes: 'wide',
      mouth: 'zigzag',
      arms: 'bite',
      shake: 0.6,
    },
  },
};
