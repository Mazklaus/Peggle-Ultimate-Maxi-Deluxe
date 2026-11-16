/**
 * Panneau de debug (QA) : ?debug=1. Boutons HTML hors du canvas pour émettre chaque événement,
 * donner le pouvoir, régler orbes / cœurs, et lire l'état de l'Astre en direct.
 */
import { gameEvents, type GameEventName } from '../core/events';

export interface DebugTarget {
  gainPower(): void;
  setOrbs(n: number): void;
  /** Allume tous les cœurs sauf n (ils se brisent à la fin du tir suivant). */
  keepHearts(n: number): void;
  status(): string;
}

const EVENTS: GameEventName[] = [
  'tir_lance',
  'gros_coup',
  'chaine_longue',
  'rate',
  'orbe_recupere',
  'presque',
  'dernier_coeur',
  'dernier_orbe',
  'final_ralenti',
  'victoire',
  'echec',
  'inactivite',
];

const PAYLOAD = {
  hits: 5,
  bounces: 10,
  shotScore: 3000,
  astre: 'pip',
  score: 0,
  angle: 0,
} as never;

export function debugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

let panel: HTMLDivElement | null = null;
let timer: number | undefined;

export function mountDebugPanel(target: DebugTarget): () => void {
  unmount();
  panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;left:0;bottom:0;right:0;z-index:10;display:flex;flex-wrap:wrap;gap:4px;padding:6px;' +
    'background:rgba(11,16,38,.85);font:12px sans-serif;color:#F4F1FF';
  const add = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText =
      'background:#1B2350;color:#F4F1FF;border:1px solid #3B2E6E;border-radius:4px;padding:3px 6px;cursor:pointer';
    b.onclick = fn;
    panel?.appendChild(b);
  };
  for (const e of EVENTS) add(e, () => gameEvents.emit(e, PAYLOAD));
  add('+pouvoir', () => target.gainPower());
  add('orbes=1', () => target.setOrbs(1));
  add('orbes=10', () => target.setOrbs(10));
  add('cœurs=1', () => target.keepHearts(1));
  add('cœurs=3', () => target.keepHearts(3));
  const status = document.createElement('span');
  status.style.cssText = 'flex-basis:100%;font-family:monospace';
  panel.appendChild(status);
  document.body.appendChild(panel);
  timer = window.setInterval(() => (status.textContent = target.status()), 200);
  return unmount;
}

function unmount(): void {
  if (timer !== undefined) window.clearInterval(timer);
  panel?.remove();
  panel = null;
}
