/**
 * Bus d'événements de jeu, typé et sans Phaser.
 * Les clés reprennent les noms du plan de production du Game Director : ce sont des
 * identifiants de contenu partagés avec le son, l'UI et les Astres.
 */
import type { CrystalKind } from './level';

type Empty = Record<string, never>;

export interface GameEventMap {
  /** Un niveau commence (musique, Astre). */
  niveau_debut: { levelId: string; chapter: number };
  /** L'orbe part. */
  tir_lance: { angle: number };
  /** 5+ cristaux dans un même tir. */
  gros_coup: { hits: number };
  /** 10+ rebonds ou gros score sur un tir. */
  chaine_longue: { bounces: number; shotScore: number };
  /** Aucun cristal-cœur touché sur le tir. */
  rate: Empty;
  /** Orbe attrapé par le réceptacle. */
  orbe_recupere: Empty;
  /** Cristal pouvoir touché. */
  pouvoir_active: { astre: string };
  /** L'orbe frôle le dernier cœur sans le toucher. */
  presque: Empty;
  /** Il ne reste qu'un cœur. */
  dernier_coeur: Empty;
  /** Il ne reste qu'un orbe. */
  dernier_orbe: Empty;
  /** Le tir vient de toucher le dernier cœur. */
  final_ralenti: Empty;
  victoire: { score: number };
  echec: { score: number };
  /** 8 s sans tirer. */
  inactivite: Empty;
  // Événements fins (son, UI, Astres)
  cristal_allume: { kind: CrystalKind; chain: number; points: number };
  mur_touche: Empty;
  cristaux_brises: { count: number };
  astre_cri: { astre: string; reaction: string; variant: number };
}

export type GameEventName = keyof GameEventMap;
export type GameEventHandler<K extends GameEventName> = (data: GameEventMap[K]) => void;
export type AnyEventHandler = <K extends GameEventName>(name: K, data: GameEventMap[K]) => void;

export class EventBus {
  private handlers = new Map<GameEventName, Set<GameEventHandler<never>>>();
  private anyHandlers = new Set<AnyEventHandler>();

  /** Abonne un écouteur ; renvoie la fonction de désabonnement. */
  on<K extends GameEventName>(name: K, fn: GameEventHandler<K>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(fn as GameEventHandler<never>);
    return () => this.off(name, fn);
  }

  off<K extends GameEventName>(name: K, fn: GameEventHandler<K>): void {
    this.handlers.get(name)?.delete(fn as GameEventHandler<never>);
  }

  /** Écoute tous les événements (son, journal de debug). */
  onAny(fn: AnyEventHandler): () => void {
    this.anyHandlers.add(fn);
    return () => {
      this.anyHandlers.delete(fn);
    };
  }

  emit<K extends GameEventName>(name: K, data: GameEventMap[K]): void {
    for (const fn of [...(this.handlers.get(name) ?? [])]) (fn as GameEventHandler<K>)(data);
    for (const fn of [...this.anyHandlers]) fn(name, data);
  }

  /** Retire tous les écouteurs (à appeler quand une scène s'arrête). */
  clear(): void {
    this.handlers.clear();
    this.anyHandlers.clear();
  }
}

/** Bus partagé par tout le jeu. */
export const gameEvents = new EventBus();
