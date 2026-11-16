/**
 * Musique de l'histoire (pur, testé) : thème du phare sur la carte et dans les cinématiques,
 * final de la Grande Veilleuse. Storyboards Narrative : à la fin de chaque chapitre,
 * l'instrument de l'Astre rejoint le thème du phare ; le final commence par un silence total.
 */

/** Nombre d'Astres réveillés = chapitres 1 à 8 terminés. */
export function awakeAstres(isChapterDone: (chapter: number) => boolean): number {
  let n = 0;
  for (let c = 1; c <= 8; c++) if (isChapterDone(c)) n += 1;
  return n;
}

export type StoryCue = { kind: 'phare'; astres: number } | { kind: 'silence' } | { kind: 'finale' };

/**
 * Ce que la musique fait quand le plan `shotId` (position `index`) d'une séquence commence.
 * intro : boîte à musique seule ; fin_chN : le phare avec N voix (la nouvelle venue comprise) ;
 * final (fin_ch8) : silence au plan V1, réveil de la Veilleuse au plan V3.
 */
export function cutsceneCue(sequence: string, shotId: string, index: number): StoryCue | null {
  if (sequence === 'fin_ch8') {
    if (shotId === 'V1') return { kind: 'silence' };
    if (shotId === 'V3') return { kind: 'finale' };
  }
  if (index !== 0) return null;
  if (sequence === 'intro') return { kind: 'phare', astres: 0 };
  const m = /^fin_ch([1-8])$/.exec(sequence);
  return m ? { kind: 'phare', astres: Number(m[1]) } : null;
}
