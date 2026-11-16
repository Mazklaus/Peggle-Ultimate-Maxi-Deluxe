/**
 * Éditeur de niveaux web (page editor.html) : DOM + canvas 2D, sans Phaser.
 * Brouillon sauvegardé automatiquement ; « Tester » envoie le niveau au jeu via localStorage.
 */
import {
  COMPANIONS,
  DEFAULT_PEG_R,
  PEG_MAX_Y,
  PEG_MIN_Y,
  RHYTHMS,
  ZONE_H,
  ZONE_W,
  parseLevel,
  serializeLevel,
  type LevelData,
  type LevelPeg,
  type PegShape,
} from '../core/levelFormat';
import {
  BRICK_H,
  BRICK_W,
  clampToZone,
  countPegs,
  crowdedPegs,
  emptyLevel,
  makePeg,
  pegAt,
  setKind,
  snap,
  type ToolKind,
} from './model';

const DRAFT_KEY = 'ricochet:editor-draft';
const TEST_KEY = 'ricochet:test-level';

/** Couleurs de la direction visuelle. */
const KIND_COLOR: Record<ToolKind, string> = {
  heart: '#FFB23F',
  common: '#6FCBFF',
  power: '#4FF0A8',
  wall: '#6F78B8',
  auto: '#F4F1FF',
};
const KIND_LABEL: Record<ToolKind, string> = {
  auto: 'auto',
  heart: 'cœur',
  common: 'commun',
  power: 'pouvoir',
  wall: 'mur',
};

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} introuvable`);
  return el as T;
};

const canvas = $<HTMLCanvasElement>('canvas');
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

let level: LevelData = loadDraft();
let selected = -1;
const history: string[] = [];

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function loadDraft(): LevelData {
  const text = storageGet(DRAFT_KEY);
  if (text) {
    try {
      const draft = JSON.parse(text) as LevelData;
      if (draft.format === 1 && Array.isArray(draft.pegs)) return { ...emptyLevel(), ...draft };
    } catch {
      /* brouillon illisible : on repart d'un niveau vide */
    }
  }
  return emptyLevel();
}

/** À appeler avant chaque modification, pour Annuler. */
function checkpoint(): void {
  history.push(JSON.stringify(level));
  if (history.length > 100) history.shift();
}

function undo(): void {
  const prev = history.pop();
  if (!prev) return;
  level = JSON.parse(prev) as LevelData;
  selected = -1;
  refresh();
}

// ---------- outils ----------

const tool = {
  kind(): ToolKind {
    return (document.querySelector<HTMLInputElement>('input[name=kind]:checked')?.value ??
      'auto') as ToolKind;
  },
  shape(): PegShape {
    return (document.querySelector<HTMLInputElement>('input[name=shape]:checked')?.value ??
      'circle') as PegShape;
  },
  grid(): number {
    return $<HTMLInputElement>('snap').checked ? Number($<HTMLInputElement>('grid').value) || 0 : 0;
  },
};

function selectRadio(name: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(`input[name=${name}][value="${value}"]`);
  if (input) input.checked = true;
}

// ---------- rendu ----------

function draw(): void {
  ctx.clearRect(0, 0, ZONE_W, ZONE_H);
  ctx.fillStyle = '#0B1026';
  ctx.fillRect(0, 0, ZONE_W, ZONE_H);

  // Zones interdites (canon en haut, réceptacle en bas).
  ctx.fillStyle = 'rgba(255, 122, 107, 0.08)';
  ctx.fillRect(0, 0, ZONE_W, PEG_MIN_Y);
  ctx.fillRect(0, PEG_MAX_Y, ZONE_W, ZONE_H - PEG_MAX_Y);
  ctx.strokeStyle = 'rgba(255, 122, 107, 0.4)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, PEG_MIN_Y);
  ctx.lineTo(ZONE_W, PEG_MIN_Y);
  ctx.moveTo(0, PEG_MAX_Y);
  ctx.lineTo(ZONE_W, PEG_MAX_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Grille.
  const g = tool.grid();
  if (g >= 8) {
    ctx.fillStyle = 'rgba(111, 120, 184, 0.35)';
    for (let x = 0; x <= ZONE_W; x += g)
      for (let y = PEG_MIN_Y; y <= PEG_MAX_Y; y += g) ctx.fillRect(x - 0.5, y - 0.5, 1.5, 1.5);
  }

  // Canon et réceptacle (repères).
  ctx.fillStyle = '#8C93C9';
  ctx.beginPath();
  ctx.arc(ZONE_W / 2, 0, 18, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = 'rgba(185, 166, 255, 0.35)';
  ctx.fillRect(ZONE_W / 2 - 50, ZONE_H - 22, 100, 16);

  const crowded = crowdedPegs(level.pegs);
  level.pegs.forEach((p, i) => drawPeg(p, i === selected, crowded.has(i)));
}

function drawPeg(p: LevelPeg, isSelected: boolean, isCrowded: boolean): void {
  const kind: ToolKind = p.kind ?? 'auto';
  const color = KIND_COLOR[kind];
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.shape === 'brick') {
    ctx.rotate(((p.angle ?? 0) * Math.PI) / 180);
    const w = p.w ?? BRICK_W;
    const h = p.h ?? BRICK_H;
    tracePath(() => ctx.rect(-w / 2, -h / 2, w, h), kind, color);
  } else {
    const r = p.r ?? DEFAULT_PEG_R;
    // Doublage forme / couleur (daltonisme) : cœur en losange, pouvoir avec un anneau.
    if (kind === 'heart')
      tracePath(
        () => {
          ctx.moveTo(0, -r * 1.2);
          ctx.lineTo(r * 1.2, 0);
          ctx.lineTo(0, r * 1.2);
          ctx.lineTo(-r * 1.2, 0);
          ctx.closePath();
        },
        kind,
        color,
      );
    else tracePath(() => ctx.arc(0, 0, r, 0, Math.PI * 2), kind, color);
    if (kind === 'power') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  if (isCrowded || isSelected) {
    ctx.strokeStyle = isCrowded ? '#FF7A6B' : '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      p.x,
      p.y,
      (p.shape === 'brick' ? (p.w ?? BRICK_W) / 2 : DEFAULT_PEG_R) + 6,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
}

/** Remplit la forme ; les pegs « auto » sont en contour pointillé (type tiré au hasard). */
function tracePath(path: () => void, kind: ToolKind, color: string): void {
  ctx.beginPath();
  path();
  if (kind === 'auto') {
    ctx.fillStyle = 'rgba(244, 241, 255, 0.12)';
    ctx.fill();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// ---------- panneaux ----------

function refresh(): void {
  draw();
  writeForm();
  const c = countPegs(level.pegs);
  $('counts').textContent =
    `${c.total} pegs : ${c.heart} cœurs, ${c.common} communs, ${c.power} pouvoir, ${c.wall} murs, ` +
    `${c.auto} auto (tirage : ${level.assign.hearts} cœurs, ${level.assign.power} pouvoir, ` +
    `${level.assign.bonus} bonus).`;
  const errors = parseLevel(level).errors ?? [];
  const list = $('errors');
  list.replaceChildren(
    ...(errors.length ? errors : ['Niveau valide.']).map((msg) => {
      const li = document.createElement('li');
      li.textContent = msg;
      if (!errors.length) li.className = 'ok';
      return li;
    }),
  );
  renderSelection();
  storageSet(DRAFT_KEY, JSON.stringify(level));
}

function renderSelection(): void {
  const box = $('selection');
  const p = level.pegs[selected];
  if (!p) {
    box.textContent = 'Aucun peg sélectionné.';
    return;
  }
  const kind = KIND_LABEL[p.kind ?? 'auto'];
  box.textContent = `#${selected} ${p.shape === 'brick' ? `brique ${p.angle ?? 0}°` : 'rond'}, ${kind}, (${p.x}, ${p.y})`;
}

const fields = {
  id: $<HTMLInputElement>('f-id'),
  chapter: $<HTMLInputElement>('f-chapter'),
  index: $<HTMLInputElement>('f-index'),
  companion: $<HTMLSelectElement>('f-companion'),
  companionLocked: $<HTMLInputElement>('f-companionLocked'),
  title: $<HTMLInputElement>('f-title'),
  rhythm: $<HTMLSelectElement>('f-rhythm'),
  orbs: $<HTMLInputElement>('f-orbs'),
  star2: $<HTMLInputElement>('f-star2'),
  star3: $<HTMLInputElement>('f-star3'),
  hearts: $<HTMLInputElement>('f-hearts'),
  power: $<HTMLInputElement>('f-power'),
  bonus: $<HTMLInputElement>('f-bonus'),
};

function fillSelect(select: HTMLSelectElement, values: readonly string[], empty: string): void {
  select.replaceChildren(
    ...['', ...values].map((v) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v || empty;
      return o;
    }),
  );
}
fillSelect(fields.companion, COMPANIONS, '(aucun)');
fillSelect(fields.rhythm, RHYTHMS, '(non précisé)');

function writeForm(): void {
  if (
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.id.startsWith('f-')
  )
    return; // ne pas écraser la saisie en cours
  fields.id.value = level.id;
  fields.chapter.value = String(level.chapter);
  fields.index.value = String(level.index);
  fields.companion.value = level.companion ?? '';
  fields.companionLocked.checked = level.companionLocked;
  fields.title.value = level.title ?? '';
  fields.rhythm.value = level.rhythm ?? '';
  fields.orbs.value = String(level.orbs);
  fields.star2.value = String(level.stars[0]);
  fields.star3.value = String(level.stars[1]);
  fields.hearts.value = String(level.assign.hearts);
  fields.power.value = String(level.assign.power);
  fields.bonus.value = String(level.assign.bonus);
}

function readForm(): void {
  const num = (el: HTMLInputElement): number => Math.round(Number(el.value) || 0);
  level.id = fields.id.value.trim();
  level.chapter = num(fields.chapter);
  level.index = num(fields.index);
  level.companion = (fields.companion.value || null) as LevelData['companion'];
  level.companionLocked = fields.companionLocked.checked;
  if (fields.title.value.trim()) level.title = fields.title.value.trim();
  else delete level.title;
  if (fields.rhythm.value) level.rhythm = fields.rhythm.value as LevelData['rhythm'];
  else delete level.rhythm;
  level.orbs = num(fields.orbs);
  level.stars = [num(fields.star2), num(fields.star3)];
  level.assign = { hearts: num(fields.hearts), power: num(fields.power), bonus: num(fields.bonus) };
}

for (const el of Object.values(fields)) {
  el.addEventListener('focus', checkpoint);
  el.addEventListener('input', () => {
    readForm();
    refresh();
  });
}

// ---------- souris ----------

function toZone(e: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * ZONE_W,
    y: ((e.clientY - rect.top) / rect.height) * ZONE_H,
  };
}

function placed(x: number, y: number): { x: number; y: number } {
  const g = tool.grid();
  return clampToZone(snap(x, g), snap(y, g));
}

let drag: { index: number; dx: number; dy: number; moved: boolean } | null = null;

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  const pt = toZone(e);
  const hit = pegAt(level.pegs, pt.x, pt.y);
  if (e.button === 2) {
    if (hit >= 0) removePeg(hit);
    return;
  }
  if (e.button !== 0) return;
  checkpoint();
  if (hit >= 0) {
    const p = level.pegs[hit] as LevelPeg;
    selected = hit;
    drag = { index: hit, dx: p.x - pt.x, dy: p.y - pt.y, moved: false };
  } else {
    const pos = placed(pt.x, pt.y);
    level.pegs.push(makePeg(pos.x, pos.y, tool.shape(), tool.kind()));
    selected = level.pegs.length - 1;
    drag = { index: selected, dx: 0, dy: 0, moved: true };
  }
  refresh();
});
window.addEventListener('mousemove', (e) => {
  if (!drag) return;
  const p = level.pegs[drag.index];
  if (!p) return;
  const pt = toZone(e);
  const pos = placed(pt.x + drag.dx, pt.y + drag.dy);
  if (pos.x === p.x && pos.y === p.y) return;
  p.x = pos.x;
  p.y = pos.y;
  drag.moved = true;
  draw();
  renderSelection();
});
window.addEventListener('mouseup', () => {
  if (!drag) return;
  if (!drag.moved) history.pop(); // simple sélection : rien à annuler
  drag = null;
  refresh();
});

function removePeg(i: number): void {
  checkpoint();
  level.pegs.splice(i, 1);
  selected = -1;
  refresh();
}

// ---------- clavier et outils ----------

const KIND_KEYS: ToolKind[] = ['auto', 'heart', 'common', 'power', 'wall'];

function applyKindToSelection(kind: ToolKind): void {
  const p = level.pegs[selected];
  if (!p) return;
  checkpoint();
  setKind(p, kind);
  refresh();
}

function rotateSelection(delta: number): void {
  const p = level.pegs[selected];
  if (!p || p.shape !== 'brick') return;
  checkpoint();
  p.angle = ((((p.angle ?? 0) + delta) % 360) + 360) % 360;
  refresh();
}

document
  .querySelectorAll<HTMLInputElement>('input[name=kind]')
  .forEach((input) =>
    input.addEventListener('change', () => applyKindToSelection(input.value as ToolKind)),
  );
document
  .querySelectorAll<HTMLInputElement>('#snap, #grid')
  .forEach((input) => input.addEventListener('input', draw));

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
    return;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= KIND_KEYS.length) {
    const kind = KIND_KEYS[n - 1] as ToolKind;
    selectRadio('kind', kind);
    applyKindToSelection(kind);
  } else if (e.key === 'b' || e.key === 'B') {
    selectRadio('shape', tool.shape() === 'circle' ? 'brick' : 'circle');
  } else if (e.key === 'q' || e.key === 'Q') rotateSelection(-15);
  else if (e.key === 'e' || e.key === 'E') rotateSelection(15);
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selected >= 0) removePeg(selected);
  else if (e.key === 'Escape') {
    selected = -1;
    refresh();
  }
});

// ---------- fichiers et test ----------

function json(): string {
  return serializeLevel(level);
}

$('new').addEventListener('click', () => {
  if (level.pegs.length && !confirm('Effacer le niveau en cours ?')) return;
  checkpoint();
  level = emptyLevel();
  selected = -1;
  refresh();
});

$('undo').addEventListener('click', undo);

$('import').addEventListener('click', () => $<HTMLInputElement>('file').click());
$<HTMLInputElement>('file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const text = await file.text();
  try {
    const raw = JSON.parse(text) as Partial<LevelData>;
    if (raw.format !== 1) throw new Error('format attendu : 1');
    checkpoint();
    // On garde aussi un niveau invalide, pour pouvoir le corriger ; les erreurs s'affichent.
    level = { ...emptyLevel(), ...raw, pegs: raw.pegs ?? [] } as LevelData;
    selected = -1;
    refresh();
  } catch (err) {
    alert(`Import impossible : ${(err as Error).message}`);
  }
});

$('export').addEventListener('click', () => {
  const blob = new Blob([json()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${level.id || 'niveau'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('copy').addEventListener('click', async () => {
  const button = $<HTMLButtonElement>('copy');
  try {
    await navigator.clipboard.writeText(json());
    button.textContent = 'Copié ✓';
  } catch {
    button.textContent = 'Copie refusée';
  }
  setTimeout(() => (button.textContent = 'Copier le JSON'), 1500);
});

$('test').addEventListener('click', () => {
  const errors = parseLevel(level).errors;
  if (errors) {
    alert(`Le niveau n'est pas valide :\n- ${errors.join('\n- ')}`);
    return;
  }
  if (!storageSet(TEST_KEY, json())) {
    alert('Stockage local indisponible : impossible de lancer le test.');
    return;
  }
  // Onglet nommé : relancer un test réutilise le même onglet de jeu.
  window.open('./?test', 'ricochet-test');
});

refresh();
