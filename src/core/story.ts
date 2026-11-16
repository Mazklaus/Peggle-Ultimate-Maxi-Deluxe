/**
 * Vignettes de l'histoire (DA vignettes-jalon1 et 2, storyboards du Narrative), sans Phaser :
 * quelle séquence jouer au lancement ou à la victoire d'un niveau.
 *   - réveil de l'Astre : au tout premier lancement du niveau 1 de chaque chapitre ;
 *   - fin de chapitre : après la victoire au niveau 12 (au ch. 8, suivie du final).
 * Chaque séquence ne se joue qu'une fois (drapeau du même nom dans save.seen).
 */
type Ch2to8 = 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type CutsceneSequence =
  'intro' | 'reveil_pip' | 'fin_ch1' | `reveil_ch${Ch2to8}` | `fin_ch${Ch2to8}`;

const levelRe = /^ch([1-8])-(\d{2})$/;

/** Séquence de réveil à jouer au lancement de ce niveau, sinon null. */
export function wakeSequenceFor(levelId: string): CutsceneSequence | null {
  const m = levelRe.exec(levelId);
  if (!m || m[2] !== '01') return null;
  const n = Number(m[1]);
  return n === 1 ? 'reveil_pip' : (`reveil_ch${n}` as CutsceneSequence);
}

/** Séquence de fin de chapitre à jouer après la victoire à ce niveau, sinon null. */
export function endSequenceFor(levelId: string): CutsceneSequence | null {
  const m = levelRe.exec(levelId);
  if (!m || m[2] !== '12') return null;
  return `fin_ch${Number(m[1])}` as CutsceneSequence;
}

/** Chaîne reçue (URL de test) -> séquence connue, sinon null. */
export function parseSequence(s: string | null): CutsceneSequence | null {
  if (s === 'intro' || s === 'reveil_pip' || s === 'fin_ch1') return s;
  return s && /^(reveil|fin)_ch[2-8]$/.test(s) ? (s as CutsceneSequence) : null;
}

/** Chapitre (2 à 8) d'une séquence du jalon 2, sinon null (séquences du jalon 1). */
export function sequenceChapter(s: CutsceneSequence): number | null {
  const m = /^(?:reveil|fin)_ch([2-8])$/.exec(s);
  return m ? Number(m[1]) : null;
}
