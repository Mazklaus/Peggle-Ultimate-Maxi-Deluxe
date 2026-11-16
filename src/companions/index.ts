/**
 * Les 8 Astres compagnons : ce que la carte et le sélecteur lisent (jalon 2).
 * Couleurs : DA (astres-rig.js). Pouvoirs et charges : Game Designer (reglages-jalon1.md,
 * reglages-jalon2.md §4 bis). Un Astre se réveille au chapitre où il apparaît.
 *
 * `def` vaut null tant que l'Astre n'est pas encore jouable (pouvoir pas encore codé) :
 * le sélecteur le grise. Pour les tests, ?astre=<id> force n'importe quel Astre en jeu.
 */
import type { CompanionDef } from '../core/companion/types';
import type { Companion } from '../core/levelFormat';
import { BOURDON, HORLOGE, JUMELLES, MOUSSE, VOLTE } from './astres';
import { PIP } from './pip';

/** next = s'applique au tir suivant (charges), immediate = agit pendant le tir, reserve = charge gardée. */
export type PowerKind = 'next' | 'immediate' | 'reserve';

export interface CompanionPower {
  name: string;
  kind: PowerKind;
  /** Charges au plus (pouvoirs next et reserve), 0 pour un pouvoir immédiat. */
  maxCharges: number;
}

export interface CompanionInfo {
  id: Companion;
  name: string;
  color: number;
  def: CompanionDef | null;
  power: CompanionPower;
  /** Chapitre où l'Astre se réveille (il est choisissable dès qu'on y a accès). */
  wakesAtChapter: number;
}

export const COMPANION_ROSTER: readonly CompanionInfo[] = [
  {
    id: 'pip',
    name: 'Pip',
    color: 0xffe45c,
    def: PIP,
    power: { name: 'Trajectoire révélée', kind: 'next', maxCharges: 4 },
    wakesAtChapter: 1,
  },
  {
    id: 'bourdon',
    name: 'Bourdon',
    color: 0xffa98a,
    def: BOURDON,
    power: { name: 'Onde de choc', kind: 'immediate', maxCharges: 0 },
    wakesAtChapter: 2,
  },
  {
    id: 'jumelles',
    name: 'Twi & Nkl',
    color: 0x8fe3ff,
    def: JUMELLES,
    power: { name: 'Orbe scindé', kind: 'immediate', maxCharges: 0 },
    wakesAtChapter: 3,
  },
  {
    id: 'volte',
    name: 'Volte',
    color: 0xff6b4a,
    def: VOLTE,
    power: { name: 'Rebond fou', kind: 'immediate', maxCharges: 0 },
    wakesAtChapter: 4,
  },
  {
    id: 'mousse',
    name: 'Mousse',
    color: 0x7ee0c6,
    def: MOUSSE,
    power: { name: 'Aimant à cœurs', kind: 'next', maxCharges: 2 },
    wakesAtChapter: 5,
  },
  {
    id: 'horloge',
    name: 'Horloge',
    color: 0xe8d9b0,
    def: HORLOGE,
    power: { name: 'Ralenti du temps', kind: 'next', maxCharges: 2 },
    wakesAtChapter: 6,
  },
  {
    id: 'grelot',
    name: 'Grelot',
    color: 0xa8f06a,
    def: null,
    power: { name: 'Orbe éclair', kind: 'next', maxCharges: 2 },
    wakesAtChapter: 7,
  },
  {
    id: 'nuage-lune',
    name: 'Nuage-Lune',
    color: 0xd6dcff,
    def: null,
    power: { name: 'Seconde chance', kind: 'reserve', maxCharges: 1 },
    wakesAtChapter: 8,
  },
];

export function companionById(id: string | null | undefined): CompanionInfo | undefined {
  return COMPANION_ROSTER.find((c) => c.id === id);
}

/** Astres réveillés quand le joueur a atteint `chapter` (pour le sélecteur). */
export function awakeCompanions(chapter: number): CompanionInfo[] {
  return COMPANION_ROSTER.filter((c) => c.wakesAtChapter <= chapter);
}
