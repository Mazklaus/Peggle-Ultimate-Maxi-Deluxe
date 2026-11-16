/**
 * Voix des 7 autres Astres (jalon 2). Chaque voix part des contours mélodiques de Pip
 * (même langue « astrale »), transformés selon le caractère de l'Astre (tempo, tessiture,
 * articulation), puis on réécrit à la main ses cris signatures décrits dans sa fiche
 * (/narrative/astres/02 à 08).
 */
import { PIP_VOICE, type Phrase, type VoiceCue, type VoiceNote, type VoiceProfile } from './voice';

type Phrases = Record<VoiceCue, readonly Phrase[]>;

export interface DeriveOptions {
  /** > 1 parle plus vite, < 1 plus lentement. */
  rate: number;
  /** Tessiture autorisée (demi-tons autour de la tonique) : les notes hors plage sont repliées à l'octave. */
  range?: [number, number];
  /** Grille rythmique (s) : Horloge parle toujours en mesure. */
  grid?: number;
  /** Supprime glissandos et trilles (instruments qui ne glissent pas). */
  plain?: boolean;
  /** Cris réécrits à la main. */
  overrides?: Partial<Phrases>;
}

const n = (s: number, d: number, extra: Partial<VoiceNote> = {}): VoiceNote => ({ s, d, ...extra });

function fold(s: number, [lo, hi]: [number, number]): number {
  let v = s;
  while (v > hi) v -= 12;
  while (v < lo) v += 12;
  return v;
}

function snap(t: number, grid: number): number {
  return Math.max(grid, Math.round(t / grid) * grid);
}

/** Transforme les phrases de base selon le caractère de l'Astre. */
export function deriveVoice(base: Phrases, opts: DeriveOptions): Phrases {
  const out = {} as Record<VoiceCue, readonly Phrase[]>;
  for (const cue of Object.keys(base) as VoiceCue[]) {
    const own = opts.overrides?.[cue];
    if (own) {
      out[cue] = own;
      continue;
    }
    out[cue] = (base[cue] ?? []).map((phrase) =>
      phrase.map((note) => {
        const v: VoiceNote = { ...note, d: note.d / opts.rate };
        if (note.gap !== undefined) v.gap = note.gap / opts.rate;
        if (opts.range) {
          v.s = fold(note.s, opts.range);
          if (note.to !== undefined) v.to = v.s + (note.to - note.s);
        }
        if (opts.grid) {
          v.d = snap(v.d, opts.grid);
          if (v.gap !== undefined) v.gap = Math.round(v.gap / opts.grid) * opts.grid;
        }
        if (opts.plain) {
          delete v.to;
          delete v.trill;
        }
        return v;
      }),
    );
  }
  return out;
}

const base = PIP_VOICE.phrases;

/** Bourdon : gros nounours dormeur. Tuba lent et grave, « BWOMP » au réveil, ronflements. */
export const BOURDON_VOICE: VoiceProfile = {
  astre: 'bourdon',
  instrument: 'tuba',
  root: 50,
  phrases: deriveVoice(base, {
    rate: 0.6,
    range: [-12, 9],
    overrides: {
      cristal: [[n(0, 0.12, { v: 0.6 })], [n(-5, 0.12, { v: 0.6 })]], // « bom » de contrebasse
      sommeil: [[n(-12, 1.2, { to: -7, v: 0.45 }), n(-7, 1.4, { to: -14, v: 0.4, gap: 0.2 })]],
      inactivite: [
        [n(-12, 1.0, { to: -9, v: 0.5 }), n(-9, 1.1, { to: -15, v: 0.45, gap: 0.15 })],
        [n(-5, 0.5, { breath: true, v: 0.5 }), n(-12, 0.9, { to: -10, v: 0.45 })],
      ],
      pouvoir_active: [[n(-12, 0.12, { v: 1 }), n(-12, 0.5, { to: 0, v: 0.9, gap: 0.03 })]], // BWOMP
      gros_coup: [
        [n(-12, 0.1, { v: 1 }), n(-12, 0.45, { to: 0, v: 0.9, gap: 0.03 })],
        [n(0, 0.3, { v: 0.7 }), n(4, 0.3, { v: 0.7 }), n(7, 0.6, { v: 0.8 })],
      ],
      orbe_coincee: [
        [n(-7, 0.5, { breath: true, v: 0.5 }), n(-12, 1.4, { to: -9, v: 0.55, gap: 0.1 })],
      ],
      reveil: [[n(-12, 0.08, { v: 0.9 }), n(-5, 0.35, { to: 2, v: 0.8, gap: 0.02 })]],
      final_ralenti: [[n(-12, 2.4, { to: 0, v: 0.7 })]], // immense « bwooo » qui monte
      victoire: [
        [n(0, 0.25), n(0, 0.12, { gap: 0.05 }), n(4, 0.25), n(7, 0.25), n(12, 0.7, { v: 0.9 })], // fanfare
        [n(-5, 0.3), n(0, 0.3), n(4, 0.3), n(0, 0.3), n(7, 0.8, { v: 0.9 })],
      ],
      echec: [[n(4, 0.5, { to: -8, v: 0.6 }), n(-12, 0.9, { breath: true, v: 0.4, gap: 0.1 })]],
    },
  }),
};

/** Twi & Nkl : deux jumelles chamailleuses. Deux clarinettes en question-réponse. */
export const JUMELLES_VOICE: VoiceProfile = {
  astre: 'twi_nkl',
  instrument: 'clarinet',
  root: 74,
  duet: { interval: 4, delay: 0.14 },
  phrases: deriveVoice(base, {
    rate: 1.05,
    range: [-12, 12],
    overrides: {
      cristal: [[n(0, 0.06, { v: 0.55 })], [n(4, 0.06, { v: 0.55 })]], // « tu ! » / « ti ! »
      pouvoir_active: [
        [n(0, 0.12), n(4, 0.12, { gap: 0.03 }), n(7, 0.45, { gap: 0.03, trill: 2 })],
      ],
      tir_moyen: [[n(2, 0.12, { v: 0.5 }), n(0, 0.15, { v: 0.5, gap: 0.05 })]], // « hm » croisé
      victoire: [
        [n(0, 0.15), n(4, 0.15), n(7, 0.15), n(9, 0.15), n(12, 0.6, { trill: 2 })],
        [n(7, 0.2), n(4, 0.2), n(7, 0.2), n(12, 0.7)],
      ],
    },
  }),
};

/** Volte : comète frimeuse. Banjo / guitare en glissandos et riffs. */
export const VOLTE_VOICE: VoiceProfile = {
  astre: 'volte',
  instrument: 'banjo',
  root: 62,
  phrases: deriveVoice(base, {
    rate: 1.2,
    range: [-5, 19],
    overrides: {
      cristal: [[n(0, 0.08, { to: 2, v: 0.55 })], [n(4, 0.08, { to: 7, v: 0.55 })]],
      inactivite: [
        [n(0, 0.09), n(4, 0.09), n(7, 0.09), n(4, 0.09), n(0, 0.09), n(4, 0.09), n(7, 0.2)], // riff impatient
        [n(12, 0.1), n(12, 0.1, { gap: 0.1 }), n(12, 0.1, { gap: 0.1 }), n(9, 0.3, { to: 7 })],
      ],
      gros_coup: [
        [n(0, 0.07), n(4, 0.07), n(7, 0.07), n(12, 0.07), n(16, 0.07), n(19, 0.35, { to: 21 })],
        [n(7, 0.25, { to: 19 }), n(19, 0.4, { trill: 2 })],
      ],
      victoire: [
        [
          n(0, 0.08),
          n(4, 0.08),
          n(7, 0.08),
          n(9, 0.08),
          n(12, 0.08),
          n(9, 0.08),
          n(12, 0.08),
          n(16, 0.08),
          n(19, 0.5, { trill: 2 }),
        ], // solo de banjo
      ],
      rate: [[n(12, 0.4, { to: 0, v: 0.6 }), n(7, 0.08, { gap: 0.2 }), n(12, 0.15)]],
    },
  }),
};

/** Mousse : nébuleuse timide. Vibraphone feutré, tout bas. */
export const MOUSSE_VOICE: VoiceProfile = {
  astre: 'mousse',
  instrument: 'vibraphone',
  root: 74,
  gain: 0.7,
  phrases: deriveVoice(base, {
    rate: 0.85,
    range: [-7, 12],
    plain: true,
    overrides: {
      cristal: [[n(0, 0.2, { v: 0.45 })], [n(7, 0.2, { v: 0.45 })]],
      victoire: [[n(0, 0.18), n(4, 0.18), n(7, 0.18), n(12, 0.18), n(9, 0.18), n(12, 0.6)]],
      gros_coup: [
        [n(7, 0.15, { v: 0.6 }), n(12, 0.5, { v: 0.6, gap: 0.05 })],
        [n(4, 0.2, { v: 0.5 }), n(9, 0.4, { v: 0.5 })],
      ],
    },
  }),
};

/** Horloge : vieille étoile pointilleuse. Marimba toujours en mesure + tic-tac de pendule. */
export const HORLOGE_VOICE: VoiceProfile = {
  astre: 'horloge',
  instrument: 'marimba',
  root: 62,
  halo: 'ticktock',
  phrases: deriveVoice(base, {
    rate: 1,
    range: [-5, 17],
    grid: 0.125,
    plain: true,
    overrides: {
      cristal: [[n(0, 0.125, { v: 0.55 })], [n(7, 0.125, { v: 0.55 })]], // « tic » en rythme
      inactivite: [
        // tapote sa montre : le tic-tac accélère
        [0.5, 0.4, 0.3, 0.22, 0.16, 0.12, 0.1].map((g) => n(0, 0.05, { tick: true, gap: g })),
      ],
      sommeil: [[0, 1, 2, 3].map((i) => n(i % 2 ? -5 : 0, 0.05, { tick: true, gap: 0.7, v: 0.4 }))],
      reveil: [[n(12, 0.6, { trill: 2, v: 0.8 })]], // sonnerie de réveil (garde la trille)
      pouvoir_active: [
        [n(-12, 0.25, { tick: true, v: 0.9 }), n(-17, 0.25, { tick: true, v: 0.9, gap: 0.5 })],
      ],
      dernier_coeur: [
        [n(0, 0.05, { tick: true, v: 0.6 }), n(-5, 0.05, { tick: true, v: 0.7, gap: 0.6 })],
      ],
      tir_moyen: [[n(7, 0.125, { v: 0.6 })]],
      victoire: [
        // carillon de cathédrale
        [
          n(12, 0.25),
          n(7, 0.25),
          n(9, 0.25),
          n(4, 0.5),
          n(4, 0.25, { gap: 0.25 }),
          n(9, 0.25),
          n(12, 0.25),
          n(7, 0.5),
        ],
      ],
    },
  }),
};

/** Grelot : étoile filante pressée. Grelots et clochettes, toujours un peu en avance. */
export const GRELOT_VOICE: VoiceProfile = {
  astre: 'grelot',
  instrument: 'bells',
  root: 86,
  halo: 'jingle',
  phrases: deriveVoice(base, {
    rate: 1.5,
    range: [-7, 12],
    plain: true,
    overrides: {
      cristal: [[n(0, 0.08, { v: 0.5 })], [n(4, 0.08, { v: 0.5 })]], // « ding »
      inactivite: [Array.from({ length: 12 }, (_, i) => n(i % 2 ? 4 : 0, 0.04, { v: 0.4 }))], // roulement
      gros_coup: [
        Array.from({ length: 8 }, (_, i) =>
          n([0, 2, 4, 7, 9, 12, 9, 12][i] ?? 0, 0.06, { v: 0.6 }),
        ),
        [n(12, 0.08), n(9, 0.08), n(7, 0.08), n(4, 0.08), n(2, 0.08), n(0, 0.3)],
      ],
      presque: [[n(7, 0.08), n(4, 0.08), n(0, 0.08)], [n(9, 0.05, { v: 0.4 })]], // les clochettes se taisent
      victoire: [
        Array.from({ length: 10 }, (_, i) => n([12, 7, 9, 4, 12, 7, 9, 4, 0, 12][i] ?? 0, 0.12)),
      ],
    },
  }),
};

/** Nuage-Lune : croissant rêveur et poète. Harpe et chœur lointain. */
export const NUAGE_LUNE_VOICE: VoiceProfile = {
  astre: 'nuage_lune',
  instrument: 'harp',
  root: 62,
  halo: 'choir',
  phrases: deriveVoice(base, {
    rate: 0.75,
    range: [-5, 19],
    plain: true,
    overrides: {
      cristal: [[n(0, 0.05, { v: 0.4 }), n(4, 0.05, { v: 0.4 }), n(7, 0.1, { v: 0.4 })]], // arpège
      idle_long: [
        // le poème : déclamation lyrique, puis il tombe de son nuage
        [
          n(7, 0.4),
          n(9, 0.2),
          n(12, 0.6),
          n(9, 0.3),
          n(7, 0.6),
          n(-5, 0.4, { breath: true, gap: 0.2 }),
        ],
      ],
      gros_coup: [
        [n(0, 0.08), n(4, 0.08), n(7, 0.08), n(12, 0.08), n(16, 0.08), n(19, 0.5)],
        [n(12, 0.4), n(9, 0.4), n(7, 0.8)], // mini-poème en trois notes
      ],
      final_ralenti: [[n(7, 2.2, { v: 0.6 })]],
      victoire: [[n(0, 0.1), n(4, 0.1), n(7, 0.1), n(12, 0.1), n(16, 0.1), n(19, 0.1), n(24, 0.9)]],
    },
  }),
};

/** Les 8 voix, par identifiant d'Astre (identifiants du code des Astres). */
export const VOICES: Record<string, VoiceProfile> = {
  pip: PIP_VOICE,
  bourdon: BOURDON_VOICE,
  twi_nkl: JUMELLES_VOICE,
  volte: VOLTE_VOICE,
  mousse: MOUSSE_VOICE,
  horloge: HORLOGE_VOICE,
  grelot: GRELOT_VOICE,
  nuage_lune: NUAGE_LUNE_VOICE,
};

/** Astre compagnon de chaque chapitre (1 à 8). */
export const CHAPTER_ASTRE: readonly string[] = [
  'pip',
  'pip',
  'bourdon',
  'twi_nkl',
  'volte',
  'mousse',
  'horloge',
  'grelot',
  'nuage_lune',
];
