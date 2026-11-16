/**
 * Choix de l'Astre pour un niveau (specs UI/UX jalon 2, 2.1), sans Phaser.
 * JOUER lance toujours tout de suite avec l'Astre préselectionné ; on ne change que si on veut.
 */

/** Ce que le choix lit d'un Astre (voir COMPANION_ROSTER). */
export interface RosterEntry {
  id: string;
  /** null : pas encore porté en jeu, grisé dans le sélecteur. */
  def: unknown;
  wakesAtChapter: number;
}

export interface CompanionChoice {
  /** Astre lancé par JOUER, null pour un niveau sans Astre (prologue). */
  selected: string | null;
  /** Astres choisissables (réveillés et portés), ordre de l'aventure. */
  choices: string[];
  /** Niveau de découverte : l'Astre du chapitre est imposé. */
  locked: boolean;
  /** La pastille ouvre le sélecteur (au moins deux choix, niveau non imposé). */
  canChoose: boolean;
}

export function companionChoice(
  level: { companion: string | null; companionLocked: boolean },
  roster: readonly RosterEntry[],
  /** Chapitre le plus avancé atteint par le joueur. */
  reachedChapter: number,
  lastChosen?: string,
): CompanionChoice {
  if (!level.companion) return { selected: null, choices: [], locked: false, canChoose: false };
  const choices = roster
    .filter((c) => c.wakesAtChapter <= reachedChapter && c.def !== null)
    .map((c) => c.id);
  if (level.companionLocked)
    return { selected: level.companion, choices, locked: true, canChoose: false };
  const selected =
    lastChosen && choices.includes(lastChosen)
      ? lastChosen
      : choices.includes(level.companion)
        ? level.companion
        : (choices[0] ?? level.companion);
  return { selected, choices, locked: false, canChoose: choices.length > 1 };
}
