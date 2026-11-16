import type { LevelState } from './level';

/**
 * Défis (règles du Game Designer, regles-modes-jalon3 §1), sans Phaser : un objectif et au
 * plus une contrainte posés sur un niveau. Médaille = objectif atteint ET niveau gagné.
 * Si l'objectif devient impossible, le défi est raté (le niveau se termine à la fin du tir).
 */

export const CHALLENGE_GOALS = [
  'score',
  'nettoyage',
  'tir_unique',
  'economie',
  'pouvoir',
  'chaine',
] as const;
export const CHALLENGE_CONSTRAINTS = [
  'sans_receptacle',
  'orbes_reduits',
  'astre_impose',
  'sans_guide',
  'chrono',
  /** Cristaux pouvoir neutres, comptés comme communs (ajout du GD). */
  'sans_pouvoir',
] as const;

export type ChallengeGoal = (typeof CHALLENGE_GOALS)[number];
export type ChallengeConstraint = (typeof CHALLENGE_CONSTRAINTS)[number];

export interface Challenge {
  goal: ChallengeGoal;
  /** S points, N cœurs, K orbes, P activations, contacts de cristaux en un tir (absent pour nettoyage seulement). */
  value?: number;
  constraint?: ChallengeConstraint;
  /** Astre imposé (contrainte astre_impose). */
  astre?: string;
}

export const CHALLENGE_RULES = {
  /** Contrainte orbes_reduits : stock de départ -3. */
  reducedOrbs: 3,
  /** Contrainte chrono : 90 s de jeu (pause exclue). */
  chronoSeconds: 90,
};

/** Valeur cible de l'objectif (0 pour nettoyage, mesuré en part de cristaux). */
export function goalTarget(c: Challenge): number {
  if (c.goal === 'nettoyage') return 1;
  return c.value ?? 0;
}

/** Erreurs de forme d'un champ challenge (vide = valide). */
export function challengeErrors(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return ['challenge : objet attendu.'];
  const r = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (!(CHALLENGE_GOALS as readonly unknown[]).includes(r.goal))
    errors.push(`challenge.goal : un de ${CHALLENGE_GOALS.join(', ')}.`);
  if (r.value !== undefined && !(Number.isInteger(r.value) && (r.value as number) > 0))
    errors.push('challenge.value : entier positif.');
  if (r.goal !== 'nettoyage' && r.value === undefined)
    errors.push('challenge.value : requis pour cet objectif.');
  if (
    r.constraint !== undefined &&
    !(CHALLENGE_CONSTRAINTS as readonly unknown[]).includes(r.constraint)
  )
    errors.push(`challenge.constraint : un de ${CHALLENGE_CONSTRAINTS.join(', ')}.`);
  if (r.constraint === 'astre_impose' && typeof r.astre !== 'string')
    errors.push('challenge.astre : id de l’Astre requis avec astre_impose.');
  return errors;
}

export type ChallengeState = 'pending' | 'reached' | 'failed' | 'success';

/** Ce que la scène sait au moment d'une mise à jour. */
export interface ChallengeSnapshot {
  score: number;
  /** Cristaux cassables restants (ni murs, ni allumés). */
  breakableLeft: number;
  breakableTotal: number;
  heartsLeft: number;
  orbs: number;
  /** Le réceptacle peut encore rendre des orbes (faux sans réceptacle). */
  canRegainOrbs: boolean;
}

/**
 * Suivi d'un défi pendant le niveau. `reached` : objectif atteint (ligne menthe), la médaille
 * tombe à la victoire (`success`). `failed` : impossible ou niveau perdu (ligne corail).
 */
export class ChallengeTracker {
  state: ChallengeState = 'pending';
  /** Meilleure valeur mesurée (score, rebonds, cœurs en un tir, activations...). */
  progress = 0;
  private shotHearts = 0;
  private powers = 0;
  private elapsed = 0;

  constructor(readonly challenge: Challenge) {}

  get target(): number {
    return goalTarget(this.challenge);
  }

  /** Part de l'objectif atteinte, 0..1 (jauge du HUD). */
  get ratio(): number {
    const t = this.target;
    return t <= 0 ? 0 : Math.min(1, this.progress / t);
  }

  get done(): boolean {
    return this.state === 'failed' || this.state === 'success';
  }

  /** Temps de jeu écoulé (s, pause exclue) : contrainte chrono. Renvoie l'état. */
  tick(dtSeconds: number): ChallengeState {
    if (this.challenge.constraint !== 'chrono' || this.done) return this.state;
    this.elapsed += dtSeconds;
    if (this.elapsed > CHALLENGE_RULES.chronoSeconds) this.state = 'failed';
    return this.state;
  }

  get secondsLeft(): number | null {
    if (this.challenge.constraint !== 'chrono') return null;
    return Math.max(0, CHALLENGE_RULES.chronoSeconds - this.elapsed);
  }

  shotStarted(): void {
    this.shotHearts = 0;
  }

  /** Un cristal s'allume pendant le tir. */
  crystalLit(kind: string, s: ChallengeSnapshot): ChallengeState {
    if (kind === 'heart') this.shotHearts += 1;
    if (this.challenge.goal === 'tir_unique') this.measure(this.shotHearts);
    return this.update(s);
  }

  /** Le pouvoir de l'Astre s'active (cristal pouvoir). */
  powerActivated(s: ChallengeSnapshot): ChallengeState {
    this.powers += 1;
    if (this.challenge.goal === 'pouvoir') this.measure(this.powers);
    return this.update(s);
  }

  /** Fin d'un tir (rebonds du tir), avant la résolution de victoire / échec. */
  shotEnded(bounces: number, s: ChallengeSnapshot): ChallengeState {
    if (this.challenge.goal === 'chaine') this.measure(bounces);
    const st = this.update(s);
    if (st !== 'pending' && st !== 'reached') return st;
    // Impossible désormais ?
    const g = this.challenge.goal;
    if (g === 'tir_unique' && this.state === 'pending' && s.heartsLeft < this.target)
      this.state = 'failed';
    if (g === 'economie' && !s.canRegainOrbs && s.orbs < this.target) this.state = 'failed';
    return this.state;
  }

  /** Fin du niveau : médaille si gagné et objectif atteint, sinon raté. */
  levelEnded(won: boolean, s: ChallengeSnapshot): ChallengeState {
    if (this.state === 'failed') return this.state;
    this.update(s);
    if (this.challenge.goal === 'economie') this.measure(s.orbs);
    const reached = this.state === 'reached' || this.meetsAtEnd(s);
    this.state = won && reached ? 'success' : 'failed';
    return this.state;
  }

  private measure(v: number): void {
    this.progress = Math.max(this.progress, v);
  }

  /** Objectifs vérifiables à tout moment : passent en `reached` dès qu'ils sont atteints. */
  private update(s: ChallengeSnapshot): ChallengeState {
    if (this.state !== 'pending') return this.state;
    const g = this.challenge.goal;
    if (g === 'score') this.progress = s.score;
    if (g === 'nettoyage')
      this.progress = s.breakableTotal === 0 ? 1 : 1 - s.breakableLeft / s.breakableTotal;
    if (g === 'economie') this.progress = s.orbs;
    const instant = g === 'score' || g === 'tir_unique' || g === 'chaine' || g === 'pouvoir';
    if (instant && this.progress >= this.target) this.state = 'reached';
    if (g === 'nettoyage' && s.breakableLeft === 0) this.state = 'reached';
    return this.state;
  }

  /** economie : jugé à la fin seulement (des orbes peuvent revenir). */
  private meetsAtEnd(s: ChallengeSnapshot): boolean {
    return this.challenge.goal === 'economie' && s.orbs >= this.target;
  }
}

/**
 * Contraintes qui changent le niveau lui-même, appliquées une fois au départ :
 * orbes_reduits (-3, au moins 1), sans_receptacle (pas d'orbe gratuit non plus),
 * sans_pouvoir (cristaux pouvoir neutres, comptés comme communs).
 */
export function applyChallengeConstraints(s: LevelState, c: Challenge): void {
  if (c.constraint === 'orbes_reduits') s.orbs = Math.max(1, s.orbs - CHALLENGE_RULES.reducedOrbs);
  if (c.constraint === 'sans_receptacle')
    s.tuning = { ...s.tuning, freeOrbShotScore: Number.POSITIVE_INFINITY };
  if (c.constraint === 'sans_pouvoir')
    for (const k of s.crystals) if (k.kind === 'power') k.kind = 'common';
}
