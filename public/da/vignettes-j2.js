/* ==========================================================================
   RICOCHET CÉLESTE · Vignettes du jalon 2 (Directeur artistique)
   Repris tel quel de vignettes-jalon2.html, sans le lecteur : la scène Phaser
   Cutscene appelle VignettesJ2.create(ctx) puis joue les plans (draw(t, dt)).
   Dépend de astres-rig.js, astres-reactions-j2.js, gardienne.js, veilleuse.js,
   elements-decor.js (globals AstresRig, Gardienne, Veilleuse, ElementsDecor).
   Généré par copie : ne pas éditer à la main, reprendre le fichier de la DA.
   ========================================================================== */
(function (global) {
  'use strict';
  function create(ctx) {
const CONS_JSON = {"note": "coordonnées px sur 1280x720 (carte et fond) ; points dans l ordre de jeu, le 12e = point clé ; aretes = traits de la figure", "chapitre2": {"nom": "le Hamac", "point_cle": "Bourdon endormi au creux du hamac", "niveaux": [{"x": 816, "y": 271}, {"x": 816, "y": 140}, {"x": 838, "y": 165}, {"x": 879, "y": 209}, {"x": 919, "y": 241}, {"x": 1104, "y": 271}, {"x": 1104, "y": 140}, {"x": 1082, "y": 165}, {"x": 1041, "y": 209}, {"x": 1001, "y": 241}, {"x": 960, "y": 252}, {"x": 960, "y": 218}], "aretes": [[0, 1], [1, 2], [2, 3], [3, 4], [4, 10], [10, 9], [9, 8], [8, 7], [7, 6], [6, 5], [10, 11]]}, "chapitre3": {"nom": "la Balançoire", "point_cle": "le milieu du siège, où les deux s'assoient", "niveaux": [{"x": 780, "y": 302}, {"x": 816, "y": 109}, {"x": 910, "y": 109}, {"x": 910, "y": 184}, {"x": 910, "y": 259}, {"x": 960, "y": 59}, {"x": 1140, "y": 302}, {"x": 1104, "y": 109}, {"x": 1010, "y": 109}, {"x": 1010, "y": 184}, {"x": 1010, "y": 259}, {"x": 960, "y": 265}], "aretes": [[0, 1], [1, 2], [2, 8], [8, 7], [7, 6], [2, 3], [3, 4], [8, 9], [9, 10], [4, 11], [11, 10]]}, "chapitre4": {"nom": "la Toupie", "point_cle": "la pointe qui tourne", "niveaux": [{"x": 960, "y": 84}, {"x": 960, "y": 125}, {"x": 881, "y": 146}, {"x": 823, "y": 196}, {"x": 874, "y": 255}, {"x": 1039, "y": 146}, {"x": 1097, "y": 196}, {"x": 1046, "y": 255}, {"x": 902, "y": 196}, {"x": 960, "y": 196}, {"x": 1018, "y": 196}, {"x": 960, "y": 328}], "aretes": [[0, 1], [1, 2], [2, 3], [3, 4], [4, 11], [1, 5], [5, 6], [6, 7], [7, 11], [3, 8], [8, 9], [9, 10], [10, 6]]}, "chapitre5": {"nom": "la Coquille d'escargot", "point_cle": "le cœur de la spirale", "niveaux": [{"x": 1136, "y": 215}, {"x": 1043, "y": 318}, {"x": 892, "y": 312}, {"x": 830, "y": 221}, {"x": 895, "y": 144}, {"x": 1002, "y": 147}, {"x": 1044, "y": 208}, {"x": 1003, "y": 257}, {"x": 940, "y": 253}, {"x": 921, "y": 220}, {"x": 944, "y": 201}, {"x": 963, "y": 208}], "aretes": [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11]]}, "chapitre6": {"nom": "le Sablier", "point_cle": "le goulot où passe le sable", "niveaux": [{"x": 859, "y": 90}, {"x": 960, "y": 90}, {"x": 1061, "y": 90}, {"x": 874, "y": 152}, {"x": 1046, "y": 152}, {"x": 859, "y": 340}, {"x": 960, "y": 340}, {"x": 1061, "y": 340}, {"x": 874, "y": 278}, {"x": 1046, "y": 278}, {"x": 960, "y": 305}, {"x": 960, "y": 215}], "aretes": [[0, 1], [1, 2], [0, 3], [2, 4], [3, 11], [4, 11], [5, 6], [6, 7], [5, 8], [7, 9], [8, 11], [9, 11], [11, 10]]}, "chapitre7": {"nom": "l'Enveloppe", "point_cle": "le sceau de la lettre", "niveaux": [{"x": 816, "y": 296}, {"x": 816, "y": 215}, {"x": 816, "y": 134}, {"x": 960, "y": 134}, {"x": 1104, "y": 134}, {"x": 1104, "y": 215}, {"x": 1104, "y": 296}, {"x": 960, "y": 296}, {"x": 888, "y": 180}, {"x": 1032, "y": 180}, {"x": 960, "y": 228}, {"x": 960, "y": 262}], "aretes": [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [2, 8], [8, 10], [4, 9], [9, 10], [10, 11]]}, "chapitre8": {"nom": "la Plume", "point_cle": "la pointe de la plume", "niveaux": [{"x": 910, "y": 346}, {"x": 928, "y": 292}, {"x": 871, "y": 268}, {"x": 951, "y": 242}, {"x": 1006, "y": 255}, {"x": 974, "y": 192}, {"x": 905, "y": 165}, {"x": 1039, "y": 209}, {"x": 999, "y": 142}, {"x": 943, "y": 109}, {"x": 1061, "y": 152}, {"x": 1025, "y": 90}], "aretes": [[0, 1], [1, 3], [3, 5], [5, 8], [8, 11], [1, 2], [3, 4], [5, 6], [5, 7], [8, 9], [8, 10]]}};
const W = 1280, H = 720;
const { ASTRES, AstreActor, drawAstre, EASE } = AstresRig;
const E = (n, t) => EASE[n](Math.max(0, Math.min(1, t)));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = t => Math.max(0, Math.min(1, t));
let rnd = 7; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;

/* ---------- décor partagé ---------- */
const STARS = Array.from({ length: 220 }, () => ({ x: R() * W, y: R() * H * .8, r: [.7, .9, 1.2, 1.6][Math.floor(R() * 4)], p: R() * 6.28 }));
// constellations de l'intro : 9 groupes autour de la Veilleuse
const CONS = Array.from({ length: 9 }, (_, i) => {
  const a = i / 9 * Math.PI * 2 + .3, d = 260 + R() * 160, cx = 640 + Math.cos(a) * d * 1.4, cy = 250 + Math.sin(a) * d * .55;
  const n = 4 + Math.floor(R() * 3), pts = [];
  for (let j = 0; j < n; j++) pts.push([cx + (R() - .5) * 150, cy + (R() - .5) * 90]);
  return { pts, d: Math.hypot(cx - 640, cy - 250) };
});
CONS.sort((a, b) => b.d - a.d); // extinction de la périphérie vers le centre
function star4(x, y, R1, r1) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r1 : R1; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
function sky(top = '#0B1026', bot = '#2A2260', starA = 1, t = 0, neb = '#3B2E6E') {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const n = ctx.createRadialGradient(900, 200, 10, 900, 200, 460); n.addColorStop(0, neb + 'AA'); n.addColorStop(1, neb + '00'); ctx.fillStyle = n; ctx.fillRect(0, 0, W, H);
  STARS.forEach(s => { ctx.globalAlpha = starA * (.4 + .4 * Math.sin(t / 900 + s.p)); ctx.fillStyle = '#9AA2D8'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
}
function clouds(t, y0 = 610, col1 = '#2A2A66', col2 = '#1E2050', col3 = '#141B3D') {
  [[y0, 70, col1, 6, 130], [y0 + 55, 55, col2, 12, 100], [y0 + 90, 30, col3, 18, 80]].forEach(([y, amp, c, sp, st], li) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-200, H);
    const off = (t / 1000 * sp) % (st * 2);
    for (let x = -200 - off, i = 0; x < W + 200; x += st, i++) ctx.quadraticCurveTo(x + st / 2, y - amp * (.6 + .5 * Math.sin(i * 1.7 + li)), x + st, y);
    ctx.lineTo(W + 200, H); ctx.fill();
  });
}
function veilleuseGlow(x, y, k, t) {
  const p = (Math.sin(t / 1300) + 1) / 2, r = 120 * (1 + p * .08);
  const g = ctx.createRadialGradient(x, y, 2, x, y, r); g.addColorStop(0, `rgba(255,233,194,${(.25 + p * .15) * k})`); g.addColorStop(.35, `rgba(255,233,194,${.1 * k})`); g.addColorStop(1, 'rgba(255,233,194,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = `rgba(255,233,194,${.35 * k})`; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
}
function constellation(c, lit, t, scale = 1) {
  ctx.strokeStyle = `rgba(255,228,92,${.35 * lit})`; ctx.lineWidth = 1.6; ctx.beginPath(); c.pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.stroke();
  c.pts.forEach((p, i) => {
    if (lit > .02) { const g = ctx.createRadialGradient(p[0], p[1], 1, p[0], p[1], 16 * scale); g.addColorStop(0, `rgba(255,246,224,${.8 * lit})`); g.addColorStop(1, 'rgba(255,246,224,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], 16 * scale, 0, 7); ctx.fill(); }
    ctx.fillStyle = lit > .5 ? '#FFF6E0' : '#4A5A8A'; // éteinte = cristal gris-bleu
    if (lit > .5) { ctx.beginPath(); ctx.arc(p[0], p[1], 3.2 * scale * (1 + .15 * Math.sin(t / 300 + i)), 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(p[0], p[1] - 6); ctx.lineTo(p[0] + 4, p[1]); ctx.lineTo(p[0], p[1] + 6); ctx.lineTo(p[0] - 4, p[1]); ctx.fill(); }
  });
}
function tower(x, y, s, glow) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (glow > 0) { const g = ctx.createRadialGradient(0, -90, 2, 0, -90, 80); g.addColorStop(0, `rgba(255,246,224,${.6 * glow})`); g.addColorStop(1, 'rgba(255,246,224,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -90, 80, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#8C93C9'; ctx.beginPath(); ctx.roundRect(-40, -150, 80, 150, 14); ctx.fill();
  ctx.fillStyle = '#6F78B8'; ctx.beginPath(); ctx.arc(0, -150, 50, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#FFF6E0'; ctx.globalAlpha = .4 + .6 * glow; ctx.beginPath(); ctx.roundRect(-14, -105, 28, 34, 12); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
}
function vignette(a = .55) { const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .9); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(5,8,20,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function interior(t, glow = 1, win = true) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#141B3D'); g.addColorStop(1, '#232A5C'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // planches de bois-nuit et fenêtre ronde
  ctx.fillStyle = '#1B2350'; for (let i = 0; i < 9; i++) ctx.fillRect(i * 150, 0, 4, H);
  if (win) { ctx.fillStyle = '#0B1026'; ctx.beginPath(); ctx.arc(980, 230, 110, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8C93C9'; ctx.lineWidth = 12; ctx.stroke(); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(870, 230); ctx.lineTo(1090, 230); ctx.moveTo(980, 120); ctx.lineTo(980, 340); ctx.stroke(); }
  ctx.fillStyle = '#141B3D'; ctx.fillRect(0, 560, W, 160);
  const lg = ctx.createRadialGradient(560, 470, 10, 560, 470, 420); lg.addColorStop(0, `rgba(255,230,168,${.28 * glow})`); lg.addColorStop(1, 'rgba(255,230,168,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
}
function armchair(x, y) { ctx.fillStyle = '#3B2E6E'; ctx.beginPath(); ctx.roundRect(x - 110, y - 210, 220, 220, 50); ctx.fill(); ctx.fillStyle = '#4A3A80'; ctx.beginPath(); ctx.roundRect(x - 130, y - 90, 60, 100, 28); ctx.roundRect(x + 70, y - 90, 60, 100, 28); ctx.fill(); ctx.fillStyle = '#2E2460'; ctx.fillRect(x - 70, y - 40, 140, 40); }
function telescope(x, y, ang, s = 1, orb = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#6F78B8'; ctx.beginPath(); ctx.moveTo(-50, 40); ctx.lineTo(50, 40); ctx.lineTo(20, -10); ctx.lineTo(-20, -10); ctx.fill();
  ctx.rotate(ang); ctx.fillStyle = '#B9A6FF'; ctx.beginPath(); ctx.roundRect(-26, -230, 52, 240, 24); ctx.fill();
  ctx.fillStyle = '#8C93C9'; ctx.fillRect(-30, -80, 60, 12); ctx.fillRect(-30, -190, 60, 12);
  if (orb > 0) { const g = ctx.createRadialGradient(0, -232, 2, 0, -232, 60); g.addColorStop(0, `rgba(255,246,224,${.9 * orb})`); g.addColorStop(1, 'rgba(255,246,224,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -232, 60, 0, 7); ctx.fill(); }
  ctx.restore();
}
// cerf-volant du chapitre 1 (mêmes proportions que la carte)
const KITE = (() => { const cx = 640, cy = 260, c = [[cx, cy - 150], [cx + 110, cy - 14], [cx, cy + 165], [cx - 110, cy - 14]], pts = [];
  for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; pts.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
  const r = p => { const x = p[0] - cx, y = p[1] - cy, A = -.3; return [cx + x * Math.cos(A) - y * Math.sin(A), cy + x * Math.sin(A) + y * Math.cos(A)]; };
  const P = pts.map(r), b = P[4]; P.push([b[0] - 50, b[1] + 58], [b[0] - 20, b[1] + 118], [b[0] - 78, b[1] + 165], [b[0] - 60, b[1] + 225]); return P; })();
function kite(lit, t, sway = 0, link = 1) {
  ctx.save(); ctx.translate(640, 260); ctx.rotate(Math.sin(t / 900) * .05 * sway); ctx.translate(-640 + Math.sin(t / 700) * 10 * sway, -260 + Math.cos(t / 800) * 6 * sway);
  const segs = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 4], [6, 2], [4, 8], [8, 9], [9, 10], [10, 11]];
  ctx.strokeStyle = 'rgba(255,228,92,.5)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  segs.forEach(([a, b], i) => { const k = clamp(link * segs.length - i); if (k <= 0) return; const A = KITE[a], B = KITE[b]; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(lerp(A[0], B[0], k), lerp(A[1], B[1], k)); ctx.stroke(); });
  KITE.forEach((p, i) => { const l = clamp(lit * 12 - i * .6);
    const g = ctx.createRadialGradient(p[0], p[1], 1, p[0], p[1], 26); g.addColorStop(0, `rgba(255,246,224,${.9 * l})`); g.addColorStop(1, 'rgba(255,228,92,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], 26, 0, 7); ctx.fill();
    ctx.fillStyle = l > .5 ? '#FFF6E0' : '#4A5A8A'; ctx.beginPath(); ctx.arc(p[0], p[1], l > .5 ? 5 : 3.5, 0, 7); ctx.fill(); });
  ctx.restore();
}
function baseSt(extra) { return Object.assign({ x: 0, y: 0, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, glow: 0, shake: 0, shakeX: 0, armL: 10, armR: 10, cheeks: 0, mouthScale: 1, alpha: 1, lookX: 0, lookY: 0, blink: 0, t: 0, eyes: 'open', mouth: 'smile', bicker: 0, duoRot: 0 }, extra); }
function spark(x, y, r = 5) { const g = ctx.createRadialGradient(x, y, 1, x, y, r * 4); g.addColorStop(0, 'rgba(255,246,224,1)'); g.addColorStop(1, 'rgba(255,246,224,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 7); ctx.fill(); }

/* ======================================================================
   Vignettes jalon 2 : réveils (R0) et fins des chapitres 2 à 8, final V1-V8
   d'après storyboard-jalon2-ch2-4.md et storyboard-jalon2-ch5-8-final.md
   ====================================================================== */
const { drawVeilleuse } = Veilleuse;
Object.assign(EASE, { 'Sine.in': t => 1 - Math.cos(t * Math.PI / 2), 'Sine.out': t => Math.sin(t * Math.PI / 2), 'Cubic.inOut': t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 });
const TINT = { 1: '#3B2E6E', 2: '#1E3A5C', 3: '#4A2758', 4: '#4E2A3A', 5: '#1E4A48', 6: '#3A3550', 7: '#2E4030', 8: '#2A3270' };
const KEY = { 1: 'pip', 2: 'bourdon', 3: 'jumelles', 4: 'volte', 5: 'mousse', 6: 'horloge', 7: 'grelot', 8: 'nuagelune' };
const ACT = {}; Object.values(KEY).forEach(k => ACT[k] = new AstreActor(k));
const NOW = () => performance.now();
const pose = (key, x, y, px, extra, t = NOW()) => drawAstre(ctx, ASTRES[key], baseSt(Object.assign({ x, y, t }, extra)), px);
const asleepSt = (t, ex) => Object.assign({ eyes: 'closed', mouth: 'o', mouthScale: .7 + Math.sin(t / 600) * .2, sy: 1 + Math.sin(t / 600) * .04, _zzz: true }, ex);
const live = (key, x, y, px, dt, ev) => { const a = ACT[key], n = NOW(); if (ev && !a.reaction) a.trigger(ev, n); a.update(n, dt); a.draw(ctx, x, y, px); };
function resetActors() { Object.values(ACT).forEach(a => { a.reaction = null; a.micro = null; }); }

/* ---------- constellations : ch.1 = cerf-volant, ch.2-8 = JSON du décor ---------- */
const CON = { 1: { nom: 'Cerf-Volant', pts: KITE, edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 4], [6, 2], [4, 8], [8, 9], [9, 10], [10, 11]], c: [640, 290] } };
for (let i = 2; i <= 8; i++) { const j = CONS_JSON['chapitre' + i]; CON[i] = { nom: j.nom, pts: j.niveaux.map(p => [p.x, p.y]), edges: j.aretes, c: [960, 215] }; }
// déformation « vivante » propre à chaque figure (a = 0..1 : intensité, t = ms)
function alive(ch, P, a, t, c) {
  const rot = (p, o, ang) => { const x = p[0] - o[0], y = p[1] - o[1]; return [o[0] + x * Math.cos(ang) - y * Math.sin(ang), o[1] + x * Math.sin(ang) + y * Math.cos(ang)]; };
  switch (ch) {
    case 1: return P.map(p => [p[0] + Math.sin(t / 700) * 8 * a, p[1] + Math.cos(t / 800) * 5 * a]);
    case 2: { const o = [c[0], c[1] - 170]; return P.map(p => rot(p, o, Math.sin(t / 1100) * .09 * a)); }      // hamac qui berce
    case 3: { const o = [c[0], c[1] - 210]; return P.map(p => rot(p, o, Math.sin(t / 750) * .22 * a)); }       // balançoire
    case 4: { const ph = t / 1000 * (1 + 5 * a) * a, cx = P[11][0]; return P.map(p => [cx + (p[0] - cx) * Math.cos(ph), p[1]]); } // toupie sur sa pointe
    case 5: return P.map(p => rot(p, P[11], t / 4000 * a));                                                    // coquille qui s'enroule
    case 6: { const flip = a * Math.min(1, Math.max(0, ((t % 5000) - 4000) / 700)); return P.map(p => rot(p, P[11], Math.PI * E('Cubic.inOut', flip))); } // sablier qui se retourne
    case 7: return P.map(p => [p[0], p[1] + Math.sin(t / 900 + p[0] / 60) * 3 * a]);
    case 8: return P.map(p => [p[0] + a * 40 + Math.sin(t / 500 + p[1] / 40) * 5 * a, p[1] - a * 25 + Math.sin(t / 700) * 4 * a]); // plume qui flotte
  }
  return P;
}
// dessine la figure du chapitre ch, recentrée en (cx,cy) à l'échelle k ; lit 0..1 dans l'ordre de jeu
function region(ch, cx, cy, k, lit, t, a = 0, col = 'rgba(255,228,92,') {
  const C = CON[ch]; let P = C.pts.map(p => [cx + (p[0] - C.c[0]) * k, cy + (p[1] - C.c[1]) * k]);
  P = alive(ch, P, a, t, [cx, cy]);
  const L = P.map((_, i) => clamp(lit * 13 - i));
  ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.2, 2.4 * k);
  C.edges.forEach(([i, j]) => { const l = Math.min(L[i], L[j]); ctx.strokeStyle = l > 0 ? col + (.5 * l) + ')' : 'rgba(74,90,138,.25)'; ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke(); });
  P.forEach((p, i) => { const l = L[i], r = (i === 11 ? 34 : 24) * k;
    if (l > 0) { const g = ctx.createRadialGradient(p[0], p[1], 1, p[0], p[1], r); g.addColorStop(0, `rgba(255,246,224,${.9 * l})`); g.addColorStop(1, 'rgba(255,228,92,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); }
    ctx.fillStyle = l > .5 ? '#FFF6E0' : '#4A5A8A';
    if (l > .5) { ctx.beginPath(); ctx.arc(p[0], p[1], (i === 11 ? 6.5 : 4.5) * k * (1 + .12 * Math.sin(t / 300 + i)), 0, 7); ctx.fill(); }
    else { const s = 5 * k; ctx.beginPath(); ctx.moveTo(p[0], p[1] - s); ctx.lineTo(p[0] + s * .7, p[1]); ctx.lineTo(p[0], p[1] + s); ctx.lineTo(p[0] - s * .7, p[1]); ctx.fill(); }
  });
  return P;
}
// carte du ciel : 8 régions autour de la Veilleuse ; la 8e (Plume) est la plus proche d'elle
const SLOT = { 1: [190, 210], 2: [400, 110], 3: [880, 110], 4: [1090, 210], 5: [1090, 450], 6: [880, 520], 7: [400, 520], 8: [640, 420] };
function skyMap(n, t, glow, o = {}) {
  if (!o.noSky) sky('#0B1026', o.bot || '#1A1745', .45 + n * .06, t, '#1B2350');
  for (let c = 1; c <= 8; c++) { const s = SLOT[c], lit = c <= n ? 1 : 0;
    if (lit) { const g = ctx.createRadialGradient(s[0], s[1], 10, s[0], s[1], 190); g.addColorStop(0, TINT[c] + 'CC'); g.addColorStop(1, TINT[c] + '00'); ctx.fillStyle = g; ctx.fillRect(s[0] - 190, s[1] - 190, 380, 380); }
    region(c, s[0], s[1], c === 1 ? .36 : .5, o.litAll != null ? o.litAll : lit, t, lit ? (o.alive ?? .5) : 0); }
  if (o.veil !== false) {
    const irr = o.tired ? .5 + .5 * (Math.sin(t / 1300) + .5 * Math.sin(t / 470 + 1)) / 1.5 : 1;
    veilleuseGlow(640, 290, glow * irr, t);
  }
}

/* ---------- décors réutilisés ---------- */
function board(t, ch) { // rappel du terrain in-game (R0)
  sky('#0B1026', TINT[ch], .7, t); ctx.fillStyle = 'rgba(27,35,80,.55)'; ctx.fillRect(0, 0, 200, H); ctx.fillRect(W - 200, 0, 200, H);
  for (let i = 0; i < 26; i++) { const x = 300 + (i % 7) * 115 + (Math.floor(i / 7) % 2) * 55, y = 230 + Math.floor(i / 7) * 95; if (Math.abs(x - 760) < 70 && Math.abs(y - 380) < 70) continue; ElementsDecor.crystal(ctx, x, y, i % 5 === 2 ? 'coeur' : 'std', .55); }
  telescope(640, 80, Math.PI, .35);
}
function crystalBreak(k, col, x = 760, y = 380, k0 = .15) { // cristal de l'Astre qui tremble puis éclate
  if (k < k0) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(k * 300) * .1 * (k / k0)); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(28, 0); ctx.lineTo(0, 40); ctx.lineTo(-28, 0); ctx.fill(); ctx.restore(); }
  else if (k < k0 + .12) { const d = (k - k0) / .12; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; spark(x + Math.cos(a) * d * 130, y + Math.sin(a) * d * 130, 3 * (1 - d) + 1); } }
}
function balcony(t, ch) { // balcon du phare, de nuit, avec la région du chapitre au loin
  sky('#0B1026', '#2A2260', .9, t); const g = ctx.createRadialGradient(900, 200, 10, 900, 200, 380); g.addColorStop(0, TINT[ch] + 'DD'); g.addColorStop(1, TINT[ch] + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  region(ch, 900, 210, .62, 1, t, .6);
  ctx.fillStyle = '#232A5C'; ctx.fillRect(0, 600, W, 120); ctx.fillStyle = '#8C93C9'; ctx.fillRect(0, 590, W, 14); for (let x = 20; x < W; x += 70) ctx.fillRect(x, 600, 8, 70);
}
function phare(t, ch, dt, o = {}) { // F5 commun : Pip et la Gardienne rechargent la lunette, les Astres réveillés autour
  const k = t / 4000, now = NOW(); interior(t, 1.1);
  telescope(940, 600, -.35, 1.1, clamp((k - .5) / .3));
  for (let c = 2; c <= ch; c++) { if (o.skip && o.skip.includes(c)) continue; const x = 120 + (c - 2) * 95, y = 520 + (c % 2) * 30; ctx.globalAlpha = .9; live(KEY[c], x, y, .8, dt); ctx.globalAlpha = 1; }
  const shrug = k < .35 ? Math.sin(clamp(k / .35) * Math.PI) : 0;
  Gardienne.drawGardienne(ctx, 640, 660, 3.4, { eyes: 'open', mouth: 'smile', lookX: k < .35 ? .7 : .9, shoulders: shrug, armR: k > .4 ? 95 : 10, lantern: k > .4 ? 'hand' : 'belt', lanternGlow: 1 });
  pose('pip', 820, 440 - shrug * 14, 1.4, { armL: 10 + shrug * 70, armR: 10 + shrug * 70, mouth: k < .35 ? 'flat' : 'grin', lookX: -.6, eyes: k > .4 ? 'happy' : 'open' });
  if (o.extra) o.extra(k, now);
  vignette(.5);
}
function carte(t, ch) { // F6 commun : retour carte, le chemin vers le chapitre suivant s'allume
  const k = t / 3000; sky('#0B1026', '#2A2260', .8, t); clouds(t); tower(170, 650, .65, 1);
  const a = SLOT[ch], b = SLOT[ch + 1] || [640, 290];
  for (let c = 1; c <= 8; c++) region(c, SLOT[c][0], SLOT[c][1], c === 1 ? .3 : .42, c <= ch ? 1 : 0, t, c <= ch ? .4 : 0);
  const L = E('Quad.inOut', k / .8); ctx.strokeStyle = 'rgba(255,169,138,.75)'; ctx.lineWidth = 3; ctx.setLineDash([3, 10]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(lerp(a[0], b[0], L), lerp(a[1], b[1], L)); ctx.stroke(); ctx.setLineDash([]);
  if (L > .95) spark(b[0], b[1], 6 + Math.sin(t / 120) * 2);
  veilleuseGlow(640, 290, .35 + ch * .05, t); vignette();
}
function teaserBg(t, ch, zoom = 1) { sky('#0B1026', '#141B3D', .35, t, '#1B2350'); const g = ctx.createRadialGradient(640, 330, 20, 640, 330, 420 * zoom); g.addColorStop(0, TINT[ch] + 'EE'); g.addColorStop(1, TINT[ch] + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function glassesFall(x, y, rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = '#1B1530'; [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(s * 16, 0, 13, 9, 0, 0, 7); ctx.fill(); }); ctx.fillRect(-6, -2, 12, 3); ctx.fillStyle = '#fff'; ctx.globalAlpha = .6; ctx.fillRect(-26, -5, 5, 3); ctx.fillRect(6, -5, 5, 3); ctx.restore(); }
function note(x, y, a) { ctx.fillStyle = `rgba(244,241,255,${a})`; ctx.beginPath(); ctx.ellipse(x, y, 6, 4.5, -.4, 0, 7); ctx.fill(); ctx.fillRect(x + 4, y - 22, 2, 22); ctx.fillRect(x + 4, y - 22, 9, 3); }
function envelope(x, y, s, rot, open = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.fillStyle = '#F4F1FF'; ctx.fillRect(-22, -14, 44, 28); ctx.strokeStyle = '#A9B0D6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-22, -14); ctx.lineTo(0, 2 - open * 30); ctx.lineTo(22, -14); ctx.stroke(); ctx.fillStyle = '#FFE9C2'; ctx.beginPath(); ctx.arc(0, 2, 5, 0, 7); ctx.fill(); ctx.restore(); }
function heart(x, y, s, a, col = '126,224,198') { ctx.fillStyle = `rgba(${col},${a})`; ctx.beginPath(); ctx.moveTo(x, y + 6 * s); ctx.bezierCurveTo(x - 10 * s, y - 2 * s, x - 6 * s, y - 10 * s, x, y - 4 * s); ctx.bezierCurveTo(x + 6 * s, y - 10 * s, x + 10 * s, y - 2 * s, x, y + 6 * s); ctx.fill(); }
const lineArt = (pts, a, col = '255,246,224', w = 3) => { ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.stroke(); };
function drawProgress(fn, k) { ctx.save(); ctx.globalAlpha = clamp(k); fn(); ctx.restore(); }

/* ---------- F1 commun : la constellation se rallume et prend vie ---------- */
function F1(ch, extra) {
  return { id: 'F1', dur: 6000, draw(t, dt) { const k = t / 6000;
    sky('#0B1026', '#141B3D', .5, t, '#1B2350'); const g = ctx.createRadialGradient(640, 320, 30, 640, 320, 520); g.addColorStop(0, TINT[ch] + 'FF'); g.addColorStop(1, TINT[ch] + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const P = region(ch, 640, 330, 1.45, E('Quad.out', (k - .04) / .5), t, E('Sine.inOut', (k - .5) / .3));
    if (extra) extra(k, t, P, dt);
    clouds(t, 660); vignette(); } };
}
// silhouette d'Astre « en étoiles » au point clé
function starSilhouette(key, x, y, px, a, ex) { ctx.save(); ctx.globalAlpha = a * .55; pose(key, x, y, px, Object.assign({ glow: 1, cheeks: 0 }, ex)); ctx.restore(); }

/* ====================== CHAPITRE 2 · Bourdon · le Hamac ====================== */
const CH2 = [
  { id: 'R0', dur: 5000, draw(t, dt) { const k = t / 5000, now = NOW(); board(t, 2); crystalBreak(k, '#FFA98A');
    if (k >= .15) {
      const jolt = k > .55 && k < .7 ? E('Back.out', (k - .55) / .08) : 0, awake = k > .55 && k < .85;
      pose('bourdon', k > .85 ? lerp(760, 110, E('Quad.inOut', (k - .85) / .15)) : 760, 390 - jolt * 40, 1.7, awake ? { eyes: k < .66 ? 'wide' : 'sleepy', mouth: k < .66 ? 'open' : 'baille', mouthScale: k < .66 ? 1 : 1.3, sy: 1 + jolt * .15, armL: 120 * jolt, armR: 120 * jolt, capY: -jolt * 90, capRot: jolt * 1.5, lookX: Math.sin(t / 200) * (k > .62 && k < .72 ? 1 : 0) } : asleepSt(t, { dy: Math.sin(t / 500) * 4 }));
      // Pip : tape la joue, puis siffle dans l'oreille
      const px = k < .25 ? lerp(560, 690, E('Quad.out', (k - .15) / .1)) : k < .55 ? 690 + (k > .4 ? 30 : 0) : lerp(720, 640, (k - .55) / .2);
      pose('pip', px, 360, 1.3, { armR: k > .25 && k < .4 ? 70 + Math.sin(t / 60) * 25 : 10, mouth: k > .42 && k < .55 ? 'o' : k > .6 ? 'grin' : 'smile', eyes: k > .55 && k < .7 ? 'wide' : 'open', lookX: 1, rot: k > .55 && k < .65 ? -12 : 0 });
      if (k > .42 && k < .55) for (let i = 0; i < 3; i++) { const b = ((t / 300) + i / 3) % 1; ctx.strokeStyle = `rgba(255,228,92,${1 - b})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(735, 340, 8 + b * 22, -.6, .6); ctx.stroke(); }
      if (k > .55 && k < .62) { ctx.strokeStyle = 'rgba(255,169,138,.8)'; ctx.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = i * .785, d = 70 + (k - .55) * 900; ctx.beginPath(); ctx.moveTo(760 + Math.cos(a) * d, 390 + Math.sin(a) * d); ctx.lineTo(760 + Math.cos(a) * (d + 20), 390 + Math.sin(a) * (d + 20)); ctx.stroke(); } } // « BWOMP »
    }
    vignette(); } },
  F1(2, (k, t, P) => { const kp = P[11]; if (k > .55) starSilhouette('bourdon', kp[0], kp[1] - 22, .9, clamp((k - .55) / .2), asleepSt(t)); }),
  { id: 'F2', dur: 6000, draw(t, dt) { const k = t / 6000, now = NOW(); balcony(t, 2);
    const lean = E('Sine.inOut', (k - .12) / .2);
    Gardienne.drawGardienne(ctx, 560, 640, 3.4, { facing: 'back', headTilt: k > .45 && k < .7 ? 14 : 0, armR: k > .45 && k < .68 ? 150 : 10, shoulders: k > .82 ? Math.abs(Math.sin(t / 140)) : 0, lantern: 'belt' });
    pose('bourdon', 680 - lean * 50, 520, 1.6, k < .12 ? { eyes: 'happy', mouth: 'wavy', cheeks: 1, lookY: -1 } : asleepSt(t, { rot: -lean * 18 }));
    const party = k > .65 ? 1 : 0, poke = k > .3 && k < .48;
    pose('pip', 820 + (poke ? -40 : 0) + party * Math.sin(t / 180) * 40, 470 - party * Math.abs(Math.sin(t / 160)) * 60, 1.4,
      { armL: party ? 150 + Math.sin(t / 90) * 20 : poke ? 10 : 10, armR: party ? 150 - Math.sin(t / 90) * 20 : poke ? 80 + Math.sin(t / 70) * 20 : 10, mouth: party ? 'grin' : poke ? 'open' : 'smile', eyes: party ? 'happy' : k > .45 && k < .65 ? 'wide' : 'open', lookX: -1, rot: party ? Math.sin(t / 180) * 15 : 0, sy: k > .45 && k < .6 ? .85 : 1 });
    if (party) for (let i = 0; i < 6; i++) { const b = ((t / 900) + i / 6) % 1; ctx.fillStyle = ['#FF5FA2', '#FFE45C', '#4FF0A8', '#6FCBFF'][i % 4]; ctx.globalAlpha = .5 * (1 - b); ctx.fillRect(820 + Math.sin(i * 2.1) * 90, 380 - b * 140, 6, 6); ctx.globalAlpha = 1; } // fête « en silence » : confettis muets
    vignette(); } },
  { id: 'F3', dur: 5000, draw(t, dt) { const k = t / 5000; skyMap(2, t, .55); const turn = E('Sine.inOut', (k - .3) / .35);
    pose('bourdon', 240, 600, 2.6, asleepSt(t, { rot: lerp(-14, 10, turn), mouth: turn > .6 ? 'smile' : 'o', cheeks: turn, lookX: turn })); vignette(); } },
  { id: 'F4', dur: 6000, draw(t) { const k = t / 6000; teaserBg(t, 3);
    region(3, 640, 330, 1.2, 0, t);
    // deux lueurs qui se disputent : l'une s'allume, l'autre l'éteint, de plus en plus vite
    const sp = 1 + k * 5, ph = Math.floor(t / 1000 * sp) % 2, flick = (t / 1000 * sp) % 1;
    [[560, 300, '143,227,255', 0], [720, 300, '255,155,208', 1]].forEach(([x, y, c, w]) => { const on = (ph === w ? 1 : .1) * (1 - (k > .7 ? Math.random() * .6 : 0));
      const g = ctx.createRadialGradient(x, y, 2, x, y, 70 + on * 30); g.addColorStop(0, `rgba(${c},${.9 * on})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 100, 0, 7); ctx.fill(); });
    if (flick < .2) { ctx.strokeStyle = 'rgba(244,241,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(600, 300); ctx.lineTo(680, 300); ctx.stroke(); }
    vignette(.65); } },
  { id: 'F5', dur: 4000, draw(t, dt) { phare(t, 2, dt, { skip: [2], extra: (k) => { // Bourdon ronfle sur la lanterne
    pose('bourdon', 600, 520, .9, asleepSt(t, { rot: 12 })); } }); } },
  { id: 'F6', dur: 3000, draw(t) { carte(t, 2); } },
];

/* ====================== CHAPITRE 3 · Twi & Nkl · la Balançoire ====================== */
const CH3 = [
  { id: 'R0', dur: 5000, draw(t, dt) { const k = t / 5000; board(t, 3); crystalBreak(k, '#8FE3FF', 700); crystalBreak(k, '#FF9BD0', 820);
    if (k >= .15) {
      const out = E('Back.out', (k - .15) / .12), point = k > .3 && k < .62, calm = k > .62;
      pose('jumelles', 760, 390 - out * 30, 1.7, { bicker: point ? 1 : 0, duoRot: point ? Math.sin(t / 90) * 8 : 0, armL: point ? 90 : calm ? 40 : 10, armR: point ? 90 : calm ? 40 : 10, mouth: point ? 'open' : calm ? (k > .78 ? 'grin' : 'o') : 'smile', eyes: point ? 'squint' : calm && k > .78 ? 'happy' : 'open', brow: point ? 'stern' : null, lookY: calm && k < .78 ? .8 : 0, cheeks: calm ? 1 : 0 });
      if (k > .55) Gardienne.drawGardienne(ctx, 470, 680, 2.4, { armR: k < .7 ? lerp(10, 80, E('Quad.out', (k - .55) / .1)) : 80, armL: k < .7 ? lerp(10, 80, E('Quad.out', (k - .55) / .1)) : 80, eyes: 'open', mouth: 'smile', lookX: .8, lantern: 'none' });
      if (calm) { spark(720, 440, 4); spark(800, 440, 4); }
      if (k > .85) { ctx.strokeStyle = 'rgba(244,241,255,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(735, 380); ctx.quadraticCurveTo(760, 420, 785, 380); ctx.stroke(); } // leur fil
    } vignette(); } },
  F1(3, (k, t, P) => { const kp = P[11]; if (k > .55) { const a = clamp((k - .55) / .2); ctx.save(); ctx.globalAlpha = a; spark(kp[0] - 14, kp[1] - 12, 5); spark(kp[0] + 14, kp[1] - 12, 5); ctx.restore(); } }),
  { id: 'F2', dur: 6000, draw(t, dt) { const k = t / 6000; balcony(t, 3);
    Gardienne.drawGardienne(ctx, 420, 640, 3.4, { facing: 'back', lantern: 'belt' });
    const grab = E('Back.out', (k - .4) / .15), wake = k > .35 && k < .5;
    pose('bourdon', 760, 520, 1.6, wake ? { eyes: 'squint', mouth: 'frown', brow: 'stern', armL: 120 - grab * 80, armR: 120 - grab * 80 } : asleepSt(t, { armL: k > .5 ? 40 : 10, armR: k > .5 ? 40 : 10 }));
    const bick = k < .4, jx = bick ? 760 + Math.sin(t / 260) * 120 : lerp(760 + Math.sin(t / 260) * 120, 760, grab), jy = bick ? 400 + Math.abs(Math.sin(t / 200)) * -20 : lerp(400, 505, grab);
    pose('jumelles', jx, jy, bick ? 1.2 : 1, { bicker: bick ? 1 : 0, duoRot: bick ? Math.sin(t / 80) * 10 : 0, mouth: bick ? 'open' : k > .7 ? 'smile' : 'o', eyes: bick ? 'squint' : k > .72 ? 'closed' : 'wide', armL: bick ? 90 : 10, armR: bick ? 90 : 10, cheeks: k > .7 ? 1 : 0 });
    const snick = k > .7; pose('pip', 1000, 470 + (snick ? Math.sin(t / 60) * 3 : 0), 1.3, { mouth: snick ? 'grin' : 'flat', eyes: snick ? 'happy' : 'open', armL: snick ? 60 : 10, armR: snick ? 60 : 10, lookX: -1 });
    vignette(); } },
  { id: 'F3', dur: 5000, draw(t) { const k = t / 5000; skyMap(3, t, .62); const p1 = E('Back.out', (k - .2) / .15), p2 = E('Back.out', (k - .45) / .15);
    pose('jumelles', 260, 600, 2.4, { armL: 10 + p2 * 130, armR: 10 + p1 * 130, lookX: .9, lookY: -.6, mouth: k > .6 ? 'grin' : 'o', eyes: k > .7 ? 'happy' : 'open', cheeks: k > .6 ? 1 : 0 }); vignette(); } },
  { id: 'F4', dur: 6000, draw(t) { const k = t / 6000; teaserBg(t, 4); region(4, 640, 330, 1.2, 0, t);
    // comète frimeuse : boucle, boucle, vrille... percute un nuage
    ctx.fillStyle = '#2A2A66'; [[930, 400, 70], [990, 380, 60], [1050, 405, 55]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
    if (k < .55) { const s = k / .55, x = lerp(120, 960, s), a = s * Math.PI * 6, y = 360 + Math.sin(a) * 110 * Math.sin(s * Math.PI), r = Math.cos(a) * 60 * Math.sin(s * Math.PI);
      for (let i = 0; i < 8; i++) { const ss = s - i * .012, xx = lerp(120, 960, ss), aa = ss * Math.PI * 6; spark(xx + Math.cos(aa) * 60 * Math.sin(ss * Math.PI) * 0, 360 + Math.sin(aa) * 110 * Math.sin(ss * Math.PI), 4 - i * .4); }
      pose('volte', x + r * 0, y, 1.1, { shades: true, mouth: 'grin', brow: 'cocky', rot: s * 900 }); }
    else { if (k < .6) { ctx.fillStyle = 'rgba(244,241,255,.5)'; ctx.beginPath(); ctx.arc(960, 390, 90 * (k - .55) / .05, 0, 7); ctx.fill(); }
      if (k > .68) glassesFall(960 + Math.sin(t / 300) * 20, lerp(430, 640, E('Sine.in', (k - .68) / .3)), Math.sin(t / 300) * .4); }
    vignette(.65); } },
  { id: 'F5', dur: 4000, draw(t, dt) { phare(t, 3, dt); } },
  { id: 'F6', dur: 3000, draw(t) { carte(t, 3); } },
];

/* ====================== CHAPITRE 4 · Volte · la Toupie ====================== */
const CH4 = [
  { id: 'R0', dur: 5000, draw(t, dt) { const k = t / 5000; board(t, 4); crystalBreak(k, '#FF6B4A');
    if (k >= .15) { const stuck = k < .45, free = E('Back.out', (k - .45) / .1), poseOn = k > .62;
      if (stuck) pose('volte', 774 + Math.sin(t / 50) * 6, 384, 1.6, { rot: -63, eyes: 'squint', mouth: 'wavy', armL: 80 + Math.sin(t / 70) * 30, armR: 80 - Math.sin(t / 70) * 30 });
      else pose('volte', 760, 360 - free * 30, 1.6, { rot: poseOn ? -8 : 0, shades: k > .55, brow: poseOn ? 'cocky' : null, mouth: poseOn ? 'grin' : 'flat', armL: poseOn ? 150 : k < .55 ? 120 + Math.sin(t / 60) * 20 : 10, armR: poseOn ? 20 : 10, eyes: 'open' });
      ctx.fillStyle = '#2A2A66'; [[740, 390, 50], [790, 380, 46], [760, 410, 44]].forEach(([x, y, r]) => { ctx.globalAlpha = stuck ? 1 : 1 - free * .6; ctx.beginPath(); ctx.arc(x, y + (stuck ? 10 : free * 60), stuck ? r * 1.4 : r, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
      if (!stuck && k < .55) for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(244,241,255,.5)'; ctx.beginPath(); ctx.arc(740 + i * 14, 330 + Math.sin(t / 90 + i) * 6, 4, 0, 7); ctx.fill(); } // brins de nuage dans les cheveux
      if (poseOn) { const c = Math.abs(Math.sin(t / 120)); pose('pip', 560, 400, 1.2, { armL: 60 + c * 40, armR: 60 + c * 40, mouth: 'grin', eyes: 'happy', lookX: 1 });
        pose('jumelles', 960, 420, 1.1, { mouth: 'grin', eyes: 'squint', armL: 60, armR: 60, lookX: -1, duoRot: Math.sin(t / 90) * 4 }); }
    } vignette(); } },
  F1(4, (k, t, P) => { const kp = P[11]; if (k > .6) for (let i = 0; i < 6; i++) { const b = ((t / 400) + i / 6) % 1, a = i * 1.05 + t / 300; spark(kp[0] + Math.cos(a) * b * 120, kp[1] - b * 30 + Math.sin(a) * b * 30, 3 * (1 - b)); } }),
  { id: 'F2', dur: 6000, draw(t, dt) { const k = t / 6000; balcony(t, 4);
    // Volte tourne, perd l'équilibre, rebondit sur Bourdon, atterrit sur la tête de la Gardienne
    const G = [520, 640]; Gardienne.drawGardienne(ctx, G[0], G[1], 3.4, { facing: 'back', lantern: 'belt', shoulders: k > .8 ? .4 : 0, headTilt: k > .7 ? Math.sin(t / 300) * 3 : 0 });
    const boing = k > .45 && k < .52 ? 1 - Math.abs((k - .485) / .035) : 0;
    pose('bourdon', 880, 540, 1.5, asleepSt(t, { sy: 1 - boing * .3, sx: 1 + boing * .2 }));
    let vx, vy, rot = 0, ex = {};
    if (k < .3) { vx = 700; vy = 440; rot = (k / .3) ** 2 * 1400; ex = { shades: true, brow: 'cocky', mouth: 'grin' }; }
    else if (k < .48) { const s = (k - .3) / .18; vx = lerp(700, 860, s) + Math.sin(s * 20) * 25; vy = lerp(440, 470, s); rot = 1400 + s * 900; ex = { eyes: 'spiral', mouth: 'wavy' }; }
    else if (k < .7) { const s = (k - .48) / .22; vx = lerp(860, G[0], s); vy = lerp(470, 398, s) - Math.sin(s * Math.PI) * 220; rot = 2300 + s * 720; ex = { eyes: 'wide', mouth: 'open' }; }
    else { vx = G[0]; vy = 398; rot = 0; ex = { shades: true, brow: 'cocky', mouth: 'grin', armL: 150, armR: k > .82 ? 60 + Math.sin(t / 150) * 30 : 150, sy: k < .74 ? .8 : 1 }; }
    pose('volte', vx, vy, 1.3, Object.assign({ rot }, ex));
    if (k > .75) { const c = Math.abs(Math.sin(t / 110)); pose('pip', 1060, 470, 1.2, { armL: 60 + c * 40, armR: 60 + c * 40, mouth: 'grin', eyes: 'happy', lookX: -1 }); pose('jumelles', 260, 480, 1.1, { armL: 60 + c * 40, armR: 60 + c * 40, mouth: 'grin', lookX: 1 }); }
    vignette(); } },
  { id: 'F3', dur: 5000, draw(t) { const k = t / 5000; skyMap(4, t, .95); const off = E('Quad.inOut', (k - .2) / .2), hush = k > .55 && k < .8;
    ['pip', 'bourdon', 'jumelles'].forEach((key, i) => pose(key, 900 + i * 120, 640, 1, key === 'bourdon' ? (hush ? { eyes: 'open', mouth: 'flat', lookY: -1 } : asleepSt(t)) : { mouth: hush ? 'flat' : 'smile', lookX: -.5, lookY: -1, t: hush ? 0 : NOW() }));
    pose('volte', 260, 600, 2.4, { shades: off < .5, mouth: k > .4 ? 'flat' : 'smile', armR: k < .4 ? 10 + Math.sin(off * Math.PI) * 120 : 10, lookX: .8, lookY: -.7, brow: k > .4 ? 'up' : 'cocky', t: hush ? 0 : NOW() });
    if (k > .4 && off >= 1) glassesFall(300, 690, .2); vignette(); } },
  { id: 'F4', dur: 6000, draw(t) { const k = t / 6000, z = 1 + E('Quad.inOut', k / .6) * .8;
    ctx.save(); ctx.translate(640, 330); ctx.scale(z, z); ctx.translate(-640, -330); teaserBg(t, 5); region(5, 640, 330, 1.1, 0, t);
    const star = [700, 320]; ctx.fillStyle = '#4A5A8A'; ctx.beginPath(); ctx.moveTo(star[0], star[1] - 22); ctx.lineTo(star[0] + 15, star[1]); ctx.lineTo(star[0], star[1] + 22); ctx.lineTo(star[0] - 15, star[1]); ctx.fill();
    const peek = k > .55 ? Math.max(0, Math.sin((k - .55) / .4 * Math.PI * 2)) : 0;
    if (peek > .05) { ctx.save(); ctx.beginPath(); ctx.rect(star[0] - 200, 0, 200 + 6, H); ctx.clip(); ctx.restore(); pose('mousse', star[0] + 6 + peek * 20, star[1], .5, { eyes: 'wide', mouth: 'o', fan: .2, lookX: -1, alpha: .9 }); }
    ctx.restore(); vignette(.7); } },
  { id: 'F5', dur: 4000, draw(t, dt) { phare(t, 4, dt); } },
  { id: 'F6', dur: 3000, draw(t) { carte(t, 4); } },
];

/* ====================== CHAPITRE 5 · Mousse · la Coquille ====================== */
const CH5 = [
  { id: 'R0', dur: 5000, draw(t, dt) { const k = t / 5000; board(t, 5); crystalBreak(k, '#7EE0C6');
    const look = k > .25 && k < .55; ['pip', 'jumelles', 'volte'].forEach((key, i) => pose(key, 600 + i * 160, 420 + (i % 2) * 30, 1.1, { lookX: look ? Math.sin(t / 300 + i) : .6, eyes: look ? 'open' : k > .55 ? 'wide' : 'open', mouth: look ? 'moue' : k > .55 ? 'o' : 'smile', rot: look ? Math.sin(t / 250 + i) * 10 : 0 }));
    Gardienne.drawGardienne(ctx, 330, 690, 2.6, { lantern: k > .7 ? 'none' : 'hand', armR: k > .7 ? 70 : 60, armL: k > .7 ? 70 : 10, eyes: 'open', mouth: 'smile', lookX: .5 });
    const found = k > .55, lx = 330 + 13 * 2.6 + Math.sin(60 * Math.PI / 180) * 25 * 2.6, ly = 690 + (-46 + Math.cos(60 * Math.PI / 180) * 25) * 2.6;
    if (!found) { ctx.globalAlpha = .6; pose('mousse', lx + 22, ly - 10, .45, { eyes: 'open', mouth: 'smile', fan: .6 }); ctx.globalAlpha = 1; }
    else if (k < .7) { const sc = (k - .55) / .15; for (let i = 0; i < 9; i++) { const a = i * .7; ctx.fillStyle = `rgba(126,224,198,${.6 * (1 - sc)})`; ctx.beginPath(); ctx.arc(lx + 22 + Math.cos(a) * sc * 60, ly - 10 + Math.sin(a) * sc * 40, 8, 0, 7); ctx.fill(); } pose('mousse', lx + 22, ly - 10, .55, { cheeks: 1, eyes: 'squint', mouth: 'wavy', fan: 1, alpha: 1 - sc }); }
    else if (k < .88) pose('mousse', 380, 455, .5, { cheeks: 1, eyes: 'happy', mouth: 'smile', fan: .3, sy: E('Back.out', (k - .7) / .1) });
    else { const s = E('Quad.in', (k - .88) / .12); pose('mousse', lerp(380, 120, s), lerp(455, 300, s), .5, { fan: 1, mouth: 'smile' }); }
    vignette(); } },
  F1(5, (k, t, P) => { const kp = P[11]; if (k > .5) { const out = clamp((k - .7) / .15); ctx.save(); ctx.globalAlpha = .3 + out * .7; const g = ctx.createRadialGradient(kp[0], kp[1], 1, kp[0], kp[1], 20 + out * 40); g.addColorStop(0, 'rgba(126,224,198,.9)'); g.addColorStop(1, 'rgba(126,224,198,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kp[0] + (1 - out) * 10, kp[1], 60, 0, 7); ctx.fill(); ctx.restore(); } }),
  { id: 'F2', dur: 6000, draw(t, dt) { const k = t / 6000; balcony(t, 5);
    Gardienne.drawGardienne(ctx, 420, 640, 3.4, { facing: 'back', lantern: 'belt' });
    const turned = k > .1, B = [820, 530];
    const wake = k > .62 && k < .74;
    pose('bourdon', B[0], B[1], 1.6, wake ? { eyes: 'sleepy', mouth: 'moue', lookY: -1, brow: 'up' } : asleepSt(t));
    ['pip', 'jumelles', 'volte'].forEach((key, i) => pose(key, 1000 + i * 90 - (i === 1 ? 0 : 0), 450 + (i % 2) * 40, 1, { lookX: turned ? (k < .45 ? -1 : -.5) : 0, mouth: turned && k < .45 ? 'grin' : 'smile', armL: turned && k < .45 ? 140 : 10, armR: turned && k < .45 ? 140 : 10 }));
    if (k < .3) pose('mousse', 640, 470, .9, { eyes: turned ? 'wide' : 'open', cheeks: turned ? 1 : 0, mouth: turned ? 'wavy' : 'smile', fan: turned ? .7 : 0, shake: turned ? 1 : 0 });
    else if (k < .5) { const s = (k - .3) / .2; for (let i = 0; i < 12; i++) { const a = i * .52, d = Math.sin(s * Math.PI) * 90; ctx.fillStyle = `rgba(126,224,198,${.6})`; ctx.beginPath(); ctx.arc(lerp(640, B[0], s) + Math.cos(a) * d, lerp(470, B[1] - 70, s) + Math.sin(a) * d * .6, 9, 0, 7); ctx.fill(); } }
    else { const cap = [B[0] + 10, B[1] - 82]; pose('mousse', cap[0], cap[1], .42, { eyes: 'happy', mouth: 'smile', cheeks: 1, armR: k > .78 ? 90 + Math.sin(t / 150) * 30 : 10, fan: 0 }); }
    vignette(); } },
  { id: 'F3', dur: 5000, draw(t) { const k = t / 5000; skyMap(5, t, 1.05);
    pose('bourdon', 260, 640, 2.4, asleepSt(t)); pose('mousse', 268, 446, 1, { eyes: 'open', mouth: k > .3 ? 'smile' : 'o', cheeks: 1, lookX: .9, lookY: -.8, armR: k > .3 && k < .45 ? 120 : 10 });
    if (k > .4) { const s = E('Sine.inOut', (k - .4) / .55); heart(lerp(300, 640, s), lerp(420, 300, s) - Math.sin(s * Math.PI) * 60, 1.4, .9 * (1 - s * .5)); } vignette(); } },
  { id: 'F4', dur: 6000, draw(t) { const k = t / 6000; teaserBg(t, 6); region(6, 640, 330, 1.1, 0, t);
    const tap = Math.sin(t / (110 - k * 60)) > .3, crossed = k > .7;
    pose('horloge', 640, 360, 1.7, { brow: 'stern', mouth: crossed ? 'moue' : 'flat', armL: crossed ? 100 : tap ? 70 : 55, armR: crossed ? 100 : 30, lookX: k > .3 && k < .5 ? -1 : 0, rot: crossed ? Math.sin(t / 400) * 3 : 0, eyes: k > .3 && k < .5 ? 'squint' : 'open' });
    for (let i = 0; i < 3; i++) { const b = ((t / (700 - k * 400)) + i / 3) % 1; ctx.fillStyle = `rgba(232,217,176,${.7 * (1 - b)})`; ctx.fillRect(700 + b * 40, 300 - b * 30 + i * 12, 10, 3); } // tic-tac
    vignette(.65); } },
  { id: 'F5', dur: 4000, draw(t, dt) { phare(t, 5, dt); } },
  { id: 'F6', dur: 3000, draw(t) { carte(t, 5); } },
];

/* ====================== CHAPITRE 6 · Horloge · le Sablier ====================== */
function notebook(x, y, k, t) { // carnet d'Horloge : croquis lumineux sans texte
  ctx.fillStyle = '#F4F1FF'; ctx.beginPath(); ctx.roundRect(x - 150, y - 100, 300, 200, 12); ctx.fill(); ctx.fillStyle = '#E8D9B0'; ctx.fillRect(x - 2, y - 100, 4, 200);
  const sp = k < .5 ? 1 : 1 - (k - .5); // page 1 : le ciel qui ralentit (étoile dont la traînée raccourcit)
  ctx.save(); ctx.beginPath(); ctx.rect(x - 150, y - 100, 150, 200); ctx.clip();
  for (let i = 0; i < 5; i++) { const a = t / 1000 * sp * (1 - i * .15); ctx.fillStyle = '#6F78B8'; ctx.beginPath(); ctx.arc(x - 75 + Math.cos(a + i) * (20 + i * 10), y + Math.sin(a + i) * (20 + i * 10), 3, 0, 7); ctx.fill(); }
  ctx.restore();
  // page 2 : la Veilleuse avec des cernes, flèche qui descend
  ctx.save(); ctx.translate(x + 75, y - 10); ctx.strokeStyle = '#6F78B8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-15, -2); ctx.lineTo(-5, -2); ctx.moveTo(5, -2); ctx.lineTo(15, -2); ctx.stroke();
  ctx.strokeStyle = '#B9A6FF'; ctx.beginPath(); ctx.arc(-10, 5, 6, .3, 2.8); ctx.moveTo(16, 5); ctx.arc(10, 5, 6, .3, 2.8); ctx.stroke();
  const ar = clamp((k - .3) / .4); ctx.strokeStyle = '#FF5FA2'; ctx.beginPath(); ctx.moveTo(42, -30); ctx.lineTo(42, -30 + ar * 70); ctx.lineTo(34, -40 + ar * 70); ctx.moveTo(42, -30 + ar * 70); ctx.lineTo(50, -40 + ar * 70); ctx.stroke();
  ctx.restore();
}
const CH6 = [
  { id: 'R0', dur: 5000, draw(t, dt) { const k = t / 5000; board(t, 6); crystalBreak(k, '#E8D9B0');
    if (k >= .15) { const review = k > .55, rx = review ? lerp(760, 1000, (k - .55) / .4) : 760;
      pose('horloge', rx, 360, 1.5, { brow: 'stern', mouth: k > .82 ? 'sigh' : 'flat', armL: k < .3 ? 90 + Math.sin(t / 80) * 20 : k < .45 ? 60 : 10, armR: k < .3 ? 60 : 10, lookX: k > .45 && k < .55 ? -1 : review ? -.3 : 0, eyes: k < .45 ? 'open' : 'squint', cuckoo: k > .4 && k < .48 ? 1 : 0 });
      Gardienne.drawGardienne(ctx, 380, 690, 2.4, { eyes: 'open', mouth: k > .45 && k < .55 ? 'o' : 'smile', lookX: .6, headTilt: k > .45 && k < .55 ? -6 : 0, lantern: 'belt' });
      if (review) { pose('pip', 820, 470, 1.1, { armR: 150, eyes: 'wide', mouth: 'flat', sy: 1.08, sx: .94 }); pose('bourdon', 960, 480, 1.1, asleepSt(t)); pose('volte', 1100, 470, 1, { shades: true, mouth: 'smile' }); }
    } vignette(); } },
  F1(6, (k, t, P) => { if (k > .55) { const kp = P[11]; for (let i = 0; i < 14; i++) { const b = ((t / 900) + i / 14) % 1; ctx.fillStyle = `rgba(255,228,92,${.9 * (1 - b)})`; ctx.beginPath(); ctx.arc(kp[0] + Math.sin(i * 7) * 4 * b, kp[1] + b * 120, 2.4, 0, 7); ctx.fill(); } } }),
  { id: 'F2', dur: 7000, draw(t, dt) { const k = t / 7000; balcony(t, 6);
    Gardienne.drawGardienne(ctx, 380, 640, 3.4, { facing: 'back', lantern: 'belt', armL: k > .7 ? 35 : 10 });
    notebook(760, 320, k, t);
    pose('horloge', 980, 470, 1.4, { brow: 'stern', mouth: 'flat', armL: 120, lookX: -1, rot: -6 });
    const worried = k > .55;
    [['pip', 560, 470], ['bourdon', 680, 540], ['jumelles', 1120, 520], ['volte', 820, 540], ['mousse', 690, 455]].forEach(([key, x, y]) => {
      if (key === 'pip' && k > .7) { x = lerp(560, 450, E('Quad.out', (k - .7) / .12)); y = lerp(470, 470, 1); }
      pose(key, x, y, key === 'mousse' ? .4 : 1.05, key === 'bourdon' && !worried ? asleepSt(t) : { brow: worried ? 'worried' : null, mouth: worried ? 'wavy' : 'o', lookX: worried ? Math.sin(t / 700 + x) : .5, lookY: worried ? 0 : -.6, armL: key === 'pip' && k > .7 ? 60 : 10, eyes: key === 'bourdon' ? 'sleepy' : 'open' }); });
    vignette(); } },
  { id: 'F3', dur: 5000, draw(t) { const k = t / 5000; skyMap(6, t, 1.1, { tired: true });
    pose('horloge', 260, 600, 2.3, { brow: k > .45 ? 'stern' : null, mouth: k > .45 ? 'frown' : 'flat', armL: 90, lookX: k % .3 < .15 ? .9 : 0, lookY: k % .3 < .15 ? -.7 : .4 });
    vignette(); } },
  { id: 'F4', dur: 5000, draw(t) { const k = t / 5000; teaserBg(t, 7); region(7, 640, 330, 1.1, 0, t);
    const pass = k < .5 ? (k < .25 ? k / .25 : 1 - (k - .25) / .25) : 0, hit = k > .45 && k < .5;
    if (k < .48) { const x = lerp(60, 1220, pass); for (let i = 0; i < 14; i++) { ctx.fillStyle = `rgba(168,240,106,${.7 - i * .05})`; ctx.beginPath(); ctx.arc(x - (k < .25 ? i : -i) * 16, 300 + Math.sin(t / 60 + i) * 4, 9 - i * .5, 0, 7); ctx.fill(); } pose('grelot', x, 300, .7, { rot: k < .25 ? 15 : -15, eyes: 'wide', mouth: 'open' }); }
    const fly = clamp((k - .48) / .3); if (k > .48) { const ex = 640 + fly * 60, ey = 300 - Math.sin(fly * Math.PI) * 140 + fly * 220; if (k < .85) envelope(ex, ey, 1.2, fly * 6); }
    if (k > .78) { const s = (k - .78) / .22, x = lerp(1220, -80, s); for (let i = 0; i < 14; i++) { ctx.fillStyle = `rgba(168,240,106,${.7 - i * .05})`; ctx.beginPath(); ctx.arc(x + i * 16, 520, 9 - i * .5, 0, 7); ctx.fill(); } pose('grelot', x, 520, .7, { rot: -15, eyes: 'wide', mouth: 'wavy' }); if (s > .3) envelope(x + 20, 545, 1, .3); }
    if (hit) { ctx.fillStyle = 'rgba(168,240,106,.4)'; ctx.beginPath(); ctx.arc(640, 300, 60, 0, 7); ctx.fill(); }
    vignette(.65); } },
  { id: 'F5', dur: 4000, draw(t, dt) { phare(t, 6, dt); } },
  { id: 'F6', dur: 3000, draw(t) { carte(t, 6); } },
];

/* ====================== CHAPITRE 7 · Grelot · l'Enveloppe ====================== */
const CH7 = [
  { id: 'R0', dur: 5000, draw(t, dt) { const k = t / 5000; board(t, 7); crystalBreak(k, '#A8F06A');
    Gardienne.drawGardienne(ctx, 640, 690, 2.4, { eyes: k > .55 && k < .75 ? 'wide' : 'open', mouth: 'smile', lookX: k < .55 ? Math.sin(t / 150) : 0, lantern: 'belt' });
    if (k >= .15) { let x, y, ex = {};
      if (k < .5) { const a = (k - .15) / .35 * Math.PI * 6; x = 640 + Math.cos(a) * 300; y = 420 + Math.sin(a) * 120; ex = { rot: a * 30, mouth: 'grin' }; for (let i = 1; i < 8; i++) { const b = a - i * .12; spark(640 + Math.cos(b) * 300, 420 + Math.sin(b) * 120, 4 - i * .4); } }
      else if (k < .85) { x = 760; y = 420; const open = k > .6 && k < .72; ex = { eyes: k > .72 ? 'wide' : 'open', mouth: k > .72 ? 'o' : 'smile', armR: open ? 90 : 10, armL: k > .72 && k < .8 ? 120 : 10, sx: k < .54 ? 1.2 : 1, sy: k < .54 ? .8 : 1 }; if (open) envelope(790, 470, .6, 0); }
      else { const s = E('Quad.in', (k - .85) / .15); x = lerp(760, 1300, s); y = 420; ex = { rot: 20 }; }
      pose('grelot', x, y, 1.3, ex); }
    vignette(); } },
  F1(7, (k, t, P) => { const kp = P[11]; if (k > .55) for (let i = 0; i < 24; i++) { const b = ((t / 2400) + i / 24) % 1 * clamp((k - .55) / .1); const a = i * 2.4; ctx.save(); ctx.globalAlpha = 1 - b; envelope(kp[0] + Math.cos(a) * b * 520, kp[1] - b * 300 + Math.sin(a) * b * 120, .35, Math.sin(t / 300 + i) * .5); ctx.restore(); } }),
  { id: 'F2', dur: 8000, draw(t, dt) { const k = t / 8000;
    if (k < .25) { balcony(t, 7); Gardienne.drawGardienne(ctx, 480, 640, 3.4, { facing: 'back', lantern: 'belt', armR: k > .15 ? 60 : 10 });
      pose('grelot', 700, 470, 1.4, { brow: 'worried', mouth: 'wavy', cheeks: 1, armR: k > .1 ? 80 : 10, lookX: -1, lookY: .4 }); if (k > .1) envelope(lerp(740, 640, (k - .1) / .15), 460, 1.2, -.2); }
    else if (k < .42) { // gros plan : le sceau à l'effigie de la Veilleuse
      sky('#0B1026', '#1A1745', .3, t); ctx.fillStyle = '#F4F1FF'; ctx.fillRect(240, 160, 800, 420); ctx.strokeStyle = '#A9B0D6'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(240, 160); ctx.lineTo(640, 400); ctx.lineTo(1040, 160); ctx.stroke();
      ctx.fillStyle = '#E8C88E'; ctx.beginPath(); ctx.arc(640, 400, 70, 0, 7); ctx.fill(); drawVeilleuse(ctx, 640, 400, .9, { state: 'endormie', t }); vignette(.5); }
    else { // la lettre ouverte : la Veilleuse seule qui veille, paupières qui tombent
      balcony(t, 7); ctx.fillStyle = '#F4F1FF'; ctx.beginPath(); ctx.roundRect(440, 120, 400, 300, 12); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(450, 130, 380, 280, 10); ctx.clip(); ctx.fillStyle = '#141B3D'; ctx.fillRect(450, 130, 380, 280);
      const lid = clamp((k - .48) / .3); drawAstre(ctx, ASTRES.veilleuse, baseSt({ x: 640, y: 270, t, eyes: lid > .85 ? 'closed' : 'open', lid: lid * .8, mouth: 'flat', glow: .6 }), 1); ctx.restore();
      Gardienne.drawGardienne(ctx, 640, 700, 3, { facing: 'back', armL: 60, armR: 60, lantern: 'belt' });
      pose('horloge', 1000, 480, 1.2, { mouth: 'flat', brow: 'stern', dy: k > .62 && k < .78 ? Math.abs(Math.sin(t / 150)) * 10 : 0, lookX: -.8 });
      const hug = E('Back.out', (k - .78) / .12);
      pose('grelot', 300, 500, 1.3, { brow: 'worried', mouth: 'frown', rot: 10, lookY: 1, eyes: k > .7 ? 'sleepy' : 'open' });
      pose('pip', lerp(160, 260, hug), 490, 1.2, { armL: 10 + hug * 80, armR: 10 + hug * 80, eyes: hug > .5 ? 'closed' : 'open', mouth: 'smile', lookX: 1 }); }
    vignette(); } },
  { id: 'F3', dur: 4000, draw(t) { skyMap(7, t, 1.15, { tired: true }); vignette(); } },
  { id: 'F4', dur: 6000, draw(t) { const k = t / 6000; teaserBg(t, 8); region(8, 640, 380, 1, 0, t);
    drawVeilleuse(ctx, 820, 250, 1, { state: 'endormie', t });
    ctx.fillStyle = '#2E3870'; ctx.beginPath(); ctx.ellipse(560, 450, 90, 30, 0, 0, 7); ctx.fill();
    const turn = k > .6; pose('nuagelune', 560, 400, 1.3, { eyes: turn ? 'open' : 'closed', mouth: turn ? 'smile' : 'o', lookX: turn ? -1 : 1, armR: turn ? 60 + Math.sin(t / 600) * 40 : 10 });
    if (!turn) for (let i = 0; i < 3; i++) { const b = ((t / 1600) + i / 3) % 1; note(600 + b * 140, 360 - b * 80, .8 * (1 - b)); }
    vignette(.65); } },
  { id: 'F5', dur: 4000, draw(t, dt) { phare(t, 7, dt); } },
  { id: 'F6', dur: 3000, draw(t) { carte(t, 7); } },
];

/* ====================== CHAPITRE 8 · Nuage-Lune · la Plume ====================== */
const CH8 = [
  { id: 'R0', dur: 5000, draw(t, dt) { const k = t / 5000; board(t, 8);
    if (k < .12) crystalBreak(k * 1.25, '#D6DCFF', 760, 380, .15); else {
      const bow = k > .35 && k < .55 ? Math.sin((k - .35) / .2 * Math.PI) : 0, point = k > .6 && k < .88;
      pose('nuagelune', 760, 380, 1.6, { eyes: k < .2 ? 'closed' : 'open', mouth: 'smile', rot: -bow * 25, armR: point ? 120 : bow > 0 ? 60 : 10, lookX: point ? 1 : -.6, lookY: point ? -.6 : 0 });
      Gardienne.drawGardienne(ctx, 420, 690, 2.4, { eyes: 'open', mouth: bow > 0 ? 'smile' : 'o', lookX: point ? 1 : .6, lantern: 'belt' });
      if (point) veilleuseGlow(1150, 120, .6, t); }
    vignette(); } },
  F1(8, (k, t, P) => { veilleuseGlow(1120, 160, .8, t); }),
  { id: 'F2', dur: 8000, draw(t, dt) { const k = t / 8000; balcony(t, 8);
    // dessins de plume dans l'air : la Veilleuse veille seule, les autres dorment, elle s'épuise
    const d1 = clamp(k / .3), d2 = clamp((k - .3) / .25), d3 = clamp((k - .55) / .2);
    ctx.save(); ctx.globalAlpha = .9; lineArt(Array.from({ length: 33 }, (_, i) => [640 + Math.cos(i / 32 * 6.28) * 46, 240 + Math.sin(i / 32 * 6.28) * 46]).slice(0, Math.ceil(33 * d1)), 1);
    if (d1 >= 1) { const ey = 236 + d3 * 4; lineArt([[624, ey], [634, ey]], 1); lineArt([[646, ey], [656, ey]], 1); if (d3 < .9) { lineArt([[625, 232], [633, 232 + d3 * 4]], .6); } }
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, x = 640 + Math.cos(a) * 170, y = 240 + Math.sin(a) * 90; if (d2 > i / 6) { lineArt(Array.from({ length: 13 }, (_, j) => [x + Math.cos(j / 12 * 6.28) * 14, y + Math.sin(j / 12 * 6.28) * 14]), .7); ctx.fillStyle = 'rgba(255,246,224,.7)'; ctx.font = '700 14px Nunito'; ctx.fillText('z', x + 12, y - 14 - Math.sin(t / 400 + i) * 4); } }
    ctx.restore();
    const px = 640 + Math.cos(t / 300) * 60 * (k < .75 ? 1 : 0), py = 240 + Math.sin(t / 200) * 50 * (k < .75 ? 1 : 0); spark(px, py, 4);
    pose('nuagelune', 640, 470, 1.4, { armR: 110 + Math.sin(t / 200) * 20, lookY: -1, mouth: 'flat', eyes: k > .75 ? 'closed' : 'open' });
    const look = k > .75; [['pip', 260, 480], ['jumelles', 400, 520], ['volte', 900, 520], ['mousse', 1010, 470], ['horloge', 1110, 520], ['grelot', 160, 540]].forEach(([key, x, y]) =>
      pose(key, x, y, key === 'mousse' ? .5 : 1, { lookX: look ? Math.sin(t / 500 + x) : (x < 640 ? .7 : -.7), lookY: look ? 0 : -.8, brow: look ? 'worried' : null, mouth: look ? 'wavy' : 'o', shades: false }));
    pose('bourdon', 520, 560, 1.3, { eyes: 'wide', mouth: 'o', lookY: -.8, brow: 'up' });
    vignette(); } },
  { id: 'F3', dur: 5000, draw(t, dt) { const k = t / 5000; interior(t, 1.2); armchair(640, 600);
    const up = E('Cubic.out', k / .3); Gardienne.drawGardienne(ctx, 640, lerp(600, 680, up), 3.2, { pose: up < .5 ? 'sit' : 'stand', eyes: 'open', mouth: k > .6 ? 'smile' : 'flat', lantern: k > .3 ? 'hand' : 'belt', armR: k > .3 ? 80 : 10, lanternGlow: 1.2 });
    const order = ['pip', 'bourdon', 'jumelles', 'volte', 'mousse', 'horloge', 'grelot', 'nuagelune'];
    const lan = [640 + (13 + Math.sin(80 * Math.PI / 180) * 25) * 3.2, 680 + (-46 + Math.cos(80 * Math.PI / 180) * 25) * 3.2];
    order.forEach((key, i) => { const a = clamp((k - .3 - i * .07) / .1); if (a <= 0) return; const tgt = i === 0 ? [lan[0], lan[1] - 55] : [640 + Math.cos(Math.PI + (i - 1) / 6 * Math.PI) * 330, 430 + Math.sin(Math.PI + (i - 1) / 6 * Math.PI) * 170 + 120];
      pose(key, lerp(i % 2 ? -100 : W + 100, tgt[0], E('Back.out', a)), tgt[1], i === 0 ? 1 : .95, { mouth: 'smile', eyes: key === 'bourdon' ? 'open' : 'open', lookX: tgt[0] < 640 ? .6 : -.6, glow: .3 }); });
    vignette(.5); } },
];

/* ====================== FINAL · le réveil de la Grande Veilleuse ====================== */
const MARGE = [['pip', 100, 150], ['bourdon', 100, 320], ['jumelles', 100, 490], ['volte', 100, 640], ['mousse', 1180, 150], ['horloge', 1180, 320], ['grelot', 1180, 490], ['nuagelune', 1180, 640]];
const HOLD = { pip: { sx: .82, sy: .82, eyes: 'squint', mouth: 'flat', armL: 60, armR: 60 }, bourdon: { cheeks: 1, mouth: 'puff', sx: 1.12, eyes: 'wide' }, jumelles: { armL: 40, armR: 40, mouth: 'flat', eyes: 'wide', duoRot: -6 }, volte: { shades: false, mouth: 'o', eyes: 'wide' }, mousse: { sx: .7, sy: .7, mouth: 'flat', eyes: 'squint' }, horloge: { t: 0, mouth: 'flat', eyes: 'open' }, grelot: { armL: 90, armR: 90, mouth: 'flat', eyes: 'wide' }, nuagelune: { eyes: 'closed', mouth: 'flat' } };
const GLINE = [[0, -150], [-22, -120], [-60, -40], [-80, 80], [80, 80], [60, -40], [22, -120], [0, -150]]; // la Gardienne en étoiles
function guardianCons(cx, cy, k, a, t) {
  const P = GLINE.map(p => [cx + p[0] * k, cy + p[1] * k]), L = [cx + 120 * k, cy - 10 * k];
  ctx.strokeStyle = `rgba(185,166,255,${.6 * a})`; ctx.lineWidth = 2.4; ctx.beginPath(); P.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 60 * k, cy - 40 * k); ctx.lineTo(L[0], L[1] - 30 * k); ctx.lineTo(L[0], L[1]); ctx.stroke();
  [...P.slice(0, 7), [cx, cy - 175 * k]].forEach((p, i) => { ctx.globalAlpha = a; spark(p[0], p[1], 3.5); ctx.globalAlpha = 1; });
  ctx.globalAlpha = a; spark(L[0], L[1] + 10 * k, 9 + Math.sin(t / 200) * 2); ctx.globalAlpha = 1;
}
const FINAL = [
  { id: 'V1', dur: 4000, draw(t) { const k = t / 4000; sky('#0B1026', '#1A1745', .5, t, '#1B2350');
    drawVeilleuse(ctx, 640, 330, 1.6, { state: 'endormie', t: t / 6 });
    const s = E('Sine.out', k / .7); spark(lerp(520, 640, s), lerp(120, 300, s), 6); ElementsDecor.crystal(ctx, 640, 315, 'coeur', 1, 1.6);
    MARGE.forEach(([key, x, y]) => pose(key, x, y, 1.1, Object.assign({ t: 0 }, HOLD[key])));
    const beat = k > .72 && k < .82 ? Math.sin((k - .72) / .1 * Math.PI) : 0; if (beat) { ctx.fillStyle = `rgba(255,246,224,${.25 * beat})`; ctx.fillRect(0, 0, W, H); }
    vignette(.7); } },
  { id: 'V2', dur: 6000, draw(t) { const k = t / 6000; sky('#0B1026', '#1A1745', .6, t);
    const w = E('Sine.inOut', (k - .1) / .5), yawn = Math.sin(clamp((k - .2) / .35) * Math.PI);
    drawVeilleuse(ctx, 640, 380, 3.2, { wake: w, yawn: yawn * .9, t, lookX: k > .65 ? Math.sin((k - .65) / .35 * Math.PI * 2) : 0 });
    MARGE.forEach(([key, x, y], i) => pose(key, x < 640 ? x + 60 : x - 60, y, 1.2, { eyes: k > .6 ? 'wide' : 'open', mouth: k > .6 ? 'o' : 'flat', lookX: x < 640 ? 1 : -1 }));
    vignette(.6); } },
  { id: 'V3', dur: 8000, draw(t) { const k = t / 8000, pulse = k > .15 && k < .3 ? Math.sin((k - .15) / .15 * Math.PI) : 0;
    skyMap(8, t, 1.6 + pulse * 2, { litAll: E('Quad.out', (k - .2) / .2), alive: clamp((k - .35) / .2), bot: '#2A2260' });
    drawVeilleuse(ctx, 640, 290, 1.1, { state: 'eveillee', t });
    if (pulse) { ctx.strokeStyle = `rgba(255,246,224,${pulse})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(640, 290, 60 + (k - .15) / .15 * 700, 0, 7); ctx.stroke(); }
    clouds(t); vignette(.4); } },
  { id: 'V4', dur: 6000, draw(t) { const k = t / 6000; sky('#0B1026', '#2A2260', 1, t); const lean = E('Sine.inOut', k / .5);
    drawVeilleuse(ctx, 900, 230, 2.2, { state: 'eveillee', t, lean: -lean * 18, lookX: -lean });
    clouds(t, 640); tower(260, 700, .9, 1); Gardienne.drawGardienne(ctx, 260, 520, .5, { eyes: 'open', mouth: 'smile', lookX: .6, lantern: 'hand', armR: 120, lanternGlow: 1.4 });
    if (k > .45) { const a = clamp((k - .45) / .2); const g = ctx.createLinearGradient(290, 480, 860, 260); g.addColorStop(0, `rgba(255,233,194,${.35 * a})`); g.addColorStop(1, 'rgba(255,233,194,0)'); ctx.strokeStyle = g; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(280, 480); ctx.lineTo(860, 270); ctx.stroke(); }
    vignette(.5); } },
  { id: 'V5', dur: 10000, draw(t, dt) { const k = t / 10000; skyMap(8, t, 1.6, { alive: .6, veil: false, bot: '#2A2260' });
    const yawn = k < .3 ? Math.sin(clamp((k - .05) / .25) * Math.PI) : 0, asleep = k > .82;
    drawVeilleuse(ctx, 640, 300, 2, { state: 'eveillee', t, yawn, cap: k > .62, asleep, wake: asleep ? 1 : 1 });
    const panic = k > .1 && k < .38, circle = E('Sine.inOut', (k - .45) / .2);
    MARGE.forEach(([key, x, y], i) => { const a = i / 8 * 6.28 - Math.PI / 2, cx = 640 + Math.cos(a) * 330, cy = 300 + Math.sin(a) * 200;
      const ex = panic ? { eyes: 'wide', mouth: 'open', armL: 150 + Math.sin(t / 60 + i) * 20, armR: 150 - Math.sin(t / 60 + i) * 20, shake: 1, dy: -Math.abs(Math.sin(t / 120 + i)) * 20 } : asleep ? { mouth: 'smile', eyes: 'happy', glow: .5 } : { mouth: 'smile' };
      if (key === 'horloge' && k > .65 && k < .85) Object.assign(ex, { armL: 100, cuckoo: Math.sin(t / 200) > 0 ? 1 : 0 });
      if (key === 'bourdon' && k > .38 && k < .65) return;
      pose(key, lerp(x, cx, circle), lerp(y, cy, circle), 1, ex); });
    if (k > .38 && k < .65) { const s = E('Sine.inOut', (k - .38) / .2); pose('bourdon', lerp(300, 560, s), lerp(500, 380, s), 1.2, { eyes: 'open', mouth: 'flat', brow: 'up', armL: 90, armR: 90, capY: -200, cheeks: .5 });
      ctx.fillStyle = '#D6DCFF'; ctx.beginPath(); ctx.roundRect(lerp(300, 560, s) - 30, lerp(500, 380, s) + 20, 60, 30, 12); ctx.fill(); } // oreiller
    vignette(.4); } },
  { id: 'V6', dur: 6000, draw(t) { const k = t / 6000; skyMap(8, t, 1.6, { alive: .6, veil: false, bot: '#2A2260' });
    drawVeilleuse(ctx, 640, 300, 1.4, { state: 'eveillee', t, cap: true, asleep: true });
    MARGE.forEach(([key], i) => { if (key === 'pip') return; const s = SLOT[i + 1] || SLOT[8]; pose(key, s[0], s[1] + 40, .6, { glow: .8, eyes: 'happy', mouth: 'smile' }); });
    pose('pip', 640, 640, 2.2, { glow: .6, armL: 0, armR: k > .4 ? 150 : 0, mouth: 'grin', eyes: 'open', sy: 1.06, sx: .96, meche: 'up' });
    vignette(.4); } },
  { id: 'V7', dur: 8000, draw(t) { const k = t / 8000; interior(t, .9); armchair(560, 600);
    ctx.save(); ctx.beginPath(); ctx.arc(980, 230, 104, 0, 7); ctx.clip(); sky('#0B1026', '#2A2260', 1, t); pose('pip', 980, 240, 1.2, { eyes: k > .82 && k < .9 ? 'closed' : 'open', mouth: 'grin', glow: .6, armR: k > .82 ? 90 : 10 }); ctx.restore();
    const close = clamp((k - .55) / .15);
    Gardienne.drawGardienne(ctx, 560, 600, 3.2, { pose: 'sit', eyes: close > .5 ? 'closed' : 'open', mouth: 'smile', headTilt: close * 10, breath: (Math.sin(t / 700) + 1) / 2, armL: 20, armR: 20, lanternGlow: .7 });
    pose('mousse', 450, 520, .7, { eyes: 'closed', mouth: 'smile', cheeks: 1 });
    const bl = E('Quad.out', (k - .25) / .25); if (k > .2) { const gx = lerp(1300, 760, bl); pose('grelot', gx, 400, 1.1, { eyes: k > .5 ? 'sleepy' : 'open', mouth: 'o' }); if (bl > .9) { ctx.fillStyle = '#B9A6FF'; ctx.globalAlpha = .9; ctx.beginPath(); ctx.roundRect(470, 470, 180, 90, 18); ctx.fill(); ctx.globalAlpha = 1; } else { ctx.fillStyle = '#B9A6FF'; ctx.fillRect(gx - 40, 440, 80, 40); } }
    vignette(.5); } },
  { id: 'V8', dur: 6000, draw(t) { const k = t / 6000, z = 1 - E('Sine.inOut', k / .4) * .25; sky('#0B1026', '#2A2260', 1, t);
    ctx.save(); ctx.translate(640 - 140 * (1 - z) * 4, 290); ctx.scale(z, z); ctx.translate(-640, -290); skyMap(8, t, 1.4, { alive: .5, noSky: true }); ctx.restore();
    guardianCons(1110, 470, .95, E('Quad.out', (k - .3) / .35), t);
    clouds(t); tower(170, 690, .45, 1); vignette(.35);
    ctx.fillStyle = `rgba(255,250,240,${clamp((k - .85) / .15)})`; ctx.fillRect(0, 0, W, H); } },
];
const SEQS = { 'Ch.2 Bourdon': CH2, 'Ch.3 Twi & Nkl': CH3, 'Ch.4 Volte': CH4, 'Ch.5 Mousse': CH5, 'Ch.6 Horloge': CH6, 'Ch.7 Grelot': CH7, 'Ch.8 Nuage-Lune': CH8, 'Final': FINAL };

    return { CH2, CH3, CH4, CH5, CH6, CH7, CH8, FINAL, resetActors };
  }
  global.VignettesJ2 = { create };
})(typeof window !== 'undefined' ? window : globalThis);
