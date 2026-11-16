/* ==========================================================================
   RICOCHET CÉLESTE · Vignettes du jalon 1 (Directeur artistique)
   Repris tel quel de vignettes-jalon1.html, sans le lecteur : la scène Phaser
   Cutscene appelle Vignettes.create(ctx) puis joue les plans (draw(t, dt)).
   Dépend de astres-rig.js et gardienne.js (globals AstresRig, Gardienne).
   ========================================================================== */
(function (global) {
  'use strict';
  function create(ctx) {
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

/* ---------- acteurs vivants ---------- */
const pip = new AstreActor('pip'), bourdon = new AstreActor('bourdon');

/* ---------- séquence A : intro ---------- */
const A = [
  { id: 'A1', dur: 6000, draw(t) { // ciel plein, la Veilleuse donne le rythme
    sky('#0B1026', '#232A5C', 1, t); const p = (Math.sin(t / 1300) + 1) / 2;
    veilleuseGlow(640, 250, 1.6, t); CONS.forEach(c => constellation(c, .75 + p * .25, t));
    clouds(t); tower(170, 690, .45, 1); vignette(); } },
  { id: 'A2', dur: 5000, draw(t) { // gros plan : elle bâille et s'endort
    sky('#0B1026', '#1A1745', .6, t); const k = t / 5000;
    const yawn = Math.sin(clamp((k - .25) / .4) * Math.PI);
    veilleuseGlow(640, 360, 3 * (1 - k * .5), t);
    drawAstre(ctx, ASTRES.veilleuse, baseSt({ x: 640, y: 380, t, sy: 1 + yawn * .12, sx: 1 - yawn * .06, eyes: k < .25 ? 'open' : k < .7 ? 'sleepy' : 'closed', mouth: yawn > .2 ? 'baille' : 'o', mouthScale: 1 + yawn, lid: k < .25 ? 0 : .3 + k * .7, sleepLid: 0, glow: 1 - k * .6 }), 3.2);
    vignette(.7); } },
  { id: 'A3', dur: 7000, draw(t) { // extinction en domino, sans drame
    sky('#0B1026', '#1E2050', 1 - t / 9000, t); veilleuseGlow(640, 250, 1.6 * (1 - E('Quad.out', t / 2500)) + .25, t);
    CONS.forEach((c, i) => constellation(c, 1 - E('Quad.inOut', (t - 600 - i * 650) / 450), t));
    clouds(t); tower(170, 690, .45, 1); vignette(); } },
  { id: 'A4', dur: 5000, draw(t) { // la Gardienne dort ; une étincelle lui chatouille le nez
    interior(t, .9); armchair(560, 600);
    const k = t / 5000, wake = k > .62, sneeze = clamp((k - .55) / .08);
    Gardienne.drawGardienne(ctx, 560, 600, 3.2, { pose: 'sit', eyes: wake ? (k > .75 ? 'open' : 'wide') : 'closed', mouth: k > .55 && k < .66 ? 'open' : 'o', headTilt: wake ? -6 : 14 - sneeze * 20, armL: 20, armR: 20, breath: (Math.sin(t / 700) + 1) / 2, sy: 1 - sneeze * .05 * (1 - clamp((k - .63) / .05)), lanternGlow: .9 });
    if (k < .58) { const s = E('Sine.inOut', k / .58); spark(lerp(980, 572, s), lerp(230, 378, s) + Math.sin(k * 40) * 14, 3); }
    vignette(.5); } },
  { id: 'A5', dur: 5000, draw(t) { // de dos, elle ouvre la coupole : ciel noir
    const k = t / 5000, open = E('Cubic.out', k / .5);
    sky('#0B1026', '#141B3D', .25, t, '#1B2350'); CONS.forEach(c => constellation(c, 0, t));
    ctx.fillStyle = '#232A5C'; ctx.fillRect(0, 0, W / 2 - open * 380, H); ctx.fillRect(W / 2 + open * 380, 0, W, H);
    ctx.fillStyle = '#141B3D'; ctx.fillRect(0, 560, W, 160);
    Gardienne.drawGardienne(ctx, 640, 640, 3.4, { facing: 'back', armL: k < .5 ? 150 : 10, armR: k < .5 ? 150 : 25, lantern: k < .5 ? 'belt' : 'hand', lanternGlow: .8 + Math.sin(t / 80) * .1, shoulders: Math.sin(t / 900) * .3 });
    if (k > .55) { const b = ((t - 2750) % 1600) / 1600; ctx.fillStyle = `rgba(244,241,255,${.35 * (1 - b)})`; ctx.beginPath(); ctx.arc(610 - b * 30, 380 - b * 30, 8 + b * 18, 0, 7); ctx.fill(); } // souffle
    vignette(.6); } },
  { id: 'A6', dur: 5000, draw(t) { // visage déterminé, puis la minuscule lueur au loin
    const k = t / 5000;
    if (k < .55) { interior(t, 1.2); Gardienne.drawGardienne(ctx, 640, 1300, 9, { eyes: k < .3 ? 'closed' : 'open', mouth: k < .3 ? 'o' : 'flat', headTilt: -3, breath: E('Sine.inOut', k / .3), lantern: 'none' }); vignette(.6); }
    else { const z = E('Quad.inOut', (k - .55) / .45); sky('#0B1026', '#141B3D', .3, t, '#1B2350'); CONS.forEach(c => constellation(c, 0, t)); veilleuseGlow(640, 250, .25 + z * .25, t); ctx.strokeStyle = `rgba(185,166,255,${.5 * z})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(640, 250, 40 - z * 10, 0, 7); ctx.stroke(); vignette(.7); }
  } },
  { id: 'A7', dur: 5000, draw(t) { // elle pivote la lunette-canon et charge une orbe
    const k = t / 5000; interior(t, 1, false); ctx.fillStyle = '#0B1026'; ctx.beginPath(); ctx.roundRect(700, -40, 440, 300, 40); ctx.fill(); // ouverture de la coupole
    STARS.slice(0, 50).forEach(s => { ctx.fillStyle = '#6F78B8'; ctx.fillRect(720 + (s.x % 400), s.y % 240, 1.5, 1.5); });
    telescope(720, 560, lerp(-.4, .45, E('Cubic.out', k / .5)), 1.3, clamp((k - .7) / .2));
    const reach = clamp((k - .5) / .2);
    Gardienne.drawGardienne(ctx, 480, 640, 3.2, { armR: 20 + reach * 90, armL: k < .5 ? 100 : 30, lantern: k < .5 ? 'belt' : 'hand', eyes: 'open', mouth: k > .75 ? 'smile' : 'flat', lookX: .8, lanternGlow: 1 + reach * .3 });
    if (k > .5 && k < .72) { const s = reach; spark(lerp(560, 640, s), lerp(520, 380, s), 5); }
    vignette(.5); } },
  { id: 'A8', dur: 3000, draw(t) { // tir, l'orbe part, fondu au blanc
    const k = t / 3000; sky('#0B1026', '#232A5C', .4, t, '#1B2350'); CONS.forEach(c => constellation(c, 0, t)); clouds(t); tower(240, 690, .7, 1);
    const s = E('Quad.in', k / .7); const ox = lerp(268, 760, s), oy = lerp(560, 200, s);
    for (let i = 0; i < 6; i++) spark(lerp(ox, 268, i * .05), lerp(oy, 560, i * .05), 4 - i * .5);
    ctx.fillStyle = `rgba(255,250,240,${clamp((k - .6) / .4)})`; ctx.fillRect(0, 0, W, H); } },
];

/* ---------- séquence B : fin du chapitre 1 ---------- */
const B = [
  { id: 'B0', dur: 5000, draw(t, dt) { // réveil de Pip (in-game)
    sky('#0B1026', '#2A2260', .8, t); clouds(t); const k = t / 5000;
    Gardienne.drawGardienne(ctx, 520, 640, 3, { eyes: k > .2 ? 'wide' : 'open', mouth: k > .2 ? 'o' : 'smile', lookX: k < .6 ? .8 : 0, lantern: 'belt' });
    if (k < .2) { ctx.save(); ctx.translate(760, 380); ctx.rotate(Math.sin(t / 50) * .1 * clamp(k / .2)); ctx.fillStyle = '#FFE45C'; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(28, 0); ctx.lineTo(0, 40); ctx.lineTo(-28, 0); ctx.fill(); ctx.restore(); }
    else {
      if (k < .3) for (let i = 0; i < 10; i++) { const a = i / 10 * 7, d = (k - .2) / .1 * 120; spark(760 + Math.cos(a) * d, 380 + Math.sin(a) * d, 3); }
      const orbit = clamp((k - .25) / .45), a = orbit * Math.PI * 4;
      let px = lerp(760, 520 + Math.cos(a) * 110, E('Quad.out', orbit * 3)), py = lerp(380, 470 + Math.sin(a) * 50, E('Quad.out', orbit * 3));
      if (k > .7) { const s = E('Back.out', (k - .7) / .15); px = lerp(px, 580, s); py = lerp(py, 560, s); }
      if (k > .88) { const s = E('Quad.in', (k - .88) / .12); px = lerp(580, -80, s); py = lerp(560, 300, s); }
      if (!pip.reaction && k > .3 && k < .7) pip.trigger('gros_coup', performance.now());
      pip.update(performance.now(), dt); pip.draw(ctx, px, py, 1.6);
    }
    vignette(); } },
  { id: 'B1', dur: 6000, draw(t) { // le cerf-volant se rallume et prend vie
    const k = t / 6000; sky('#0B1026', '#2A2260', .9, t); veilleuseGlow(1120, 120, .35, t);
    if (k < .12) spark(KITE[11][0], KITE[11][1], 8 * (1 + k * 20));
    kite(E('Quad.out', (k - .1) / .3), t, clamp((k - .45) / .2), E('Quad.inOut', (k - .2) / .3)); clouds(t); vignette(); } },
  { id: 'B2', dur: 5000, draw(t, dt) { // sur le balcon, de dos : Pip montre, elle rit
    const k = t / 5000; sky('#0B1026', '#2A2260', .9, t); kite(1, t, 1, 1);
    ctx.fillStyle = '#232A5C'; ctx.fillRect(0, 600, W, 120); ctx.fillStyle = '#8C93C9'; ctx.fillRect(0, 590, W, 14); for (let x = 20; x < W; x += 70) ctx.fillRect(x, 600, 8, 70);
    const laugh = k > .5 ? Math.abs(Math.sin(t / 140)) : 0;
    Gardienne.drawGardienne(ctx, 560, 640, 3.4, { facing: 'back', shoulders: laugh, lantern: 'belt' });
    const now = performance.now(); if (!pip.reaction) pip.trigger(Math.random() < .5 ? 'gros_coup' : 'inactivite', now);
    pip.update(now, dt); pip.draw(ctx, 760 + Math.sin(t / 400) * 30, 520, 1.5); vignette(); } },
  { id: 'B3', dur: 5000, draw(t) { // une petite partie du ciel rallumée, la Veilleuse un peu plus forte
    sky('#0B1026', '#141B3D', .35, t, '#1B2350');
    const g = ctx.createRadialGradient(300, 250, 20, 300, 250, 340); g.addColorStop(0, 'rgba(59,46,110,.9)'); g.addColorStop(1, 'rgba(59,46,110,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(300 - 640 * .5, 250 - 260 * .5); ctx.scale(.5, .5); kite(1, t, 1, 1); ctx.restore();
    CONS.slice(0, 5).forEach(c => { ctx.save(); ctx.translate(240, 0); constellation(c, 0, t); ctx.restore(); });
    veilleuseGlow(900, 200, .5 + .1 * Math.sin(t / 500), t); clouds(t); tower(150, 690, .45, 1); vignette(); } },
  { id: 'B4', dur: 6000, draw(t, dt) { // Pip remarque la lueur ; teaser de Bourdon qui ronfle
    const k = t / 6000, now = performance.now();
    sky('#0B1026', '#1A1745', .5, t, '#1B2350');
    const peach = ctx.createRadialGradient(1050, 300, 20, 1050, 300, 300); peach.addColorStop(0, 'rgba(255,169,138,.28)'); peach.addColorStop(1, 'rgba(255,169,138,0)'); ctx.fillStyle = peach; ctx.fillRect(0, 0, W, H);
    veilleuseGlow(820, 120, .5, t);
    if (k > .45) { ctx.globalAlpha = .55 * clamp((k - .45) / .15); bourdon.update(now, dt); bourdon.draw(ctx, 1050, 320, 1.4); ctx.globalAlpha = 1; }
    const st = baseSt({ x: 420, y: 470, t: now, eyes: k < .15 ? 'open' : 'wide', mouth: k < .15 ? 'smile' : 'o', meche: k > .15 ? 'antenna' : 'up', lookX: k < .45 ? .6 : 1, lookY: k < .45 ? -1 : -.2, armR: k < .15 ? 10 : 140, armL: 10, rot: k > .15 && k < .45 ? -6 : 6, dy: Math.sin(now / 300) * 3 });
    drawAstre(ctx, ASTRES.pip, st, 3.4); vignette(.5); } },
  { id: 'B5', dur: 5000, draw(t, dt) { // ils se regardent ; Pip mime le tir ; elle recharge
    const k = t / 5000, now = performance.now(); interior(t, 1.1);
    telescope(940, 600, -.35, 1.1, k > .6 ? clamp((k - .6) / .2) : 0);
    Gardienne.drawGardienne(ctx, 560, 650, 3.6, { eyes: k > .3 && k < .45 ? 'closed' : 'open', mouth: 'smile', headTilt: k > .3 && k < .45 ? 10 : 0, lookX: k < .3 ? .6 : k < .55 ? 0 : .9, armR: k > .55 ? 100 : 10, lantern: k > .55 ? 'hand' : 'belt' });
    if (k < .3 && !pip.reaction) pip.trigger('inactivite', now);
    pip.update(now, dt);
    const px = k < .8 ? 700 : lerp(700, 610, E('Back.out', (k - .8) / .15)), py = k < .8 ? 480 : lerp(480, 470, (k - .8) / .2);
    pip.draw(ctx, px, py, 1.4); vignette(.5); } },
  { id: 'B6', dur: 3000, draw(t) { // retour carte : le chemin vers le ch.2 s'allume
    const k = t / 3000; sky('#0B1026', '#2A2260', .8, t); clouds(t); tower(210, 640, .7, 1);
    ctx.save(); ctx.translate(960 - 640 * .55, 230 - 260 * .55); ctx.scale(.55, .55); kite(1, t, .5, 1); ctx.restore();
    const L = E('Quad.inOut', k / .8); ctx.strokeStyle = 'rgba(255,169,138,.7)'; ctx.lineWidth = 3; ctx.setLineDash([3, 10]); ctx.beginPath(); ctx.moveTo(900, 380); ctx.lineTo(lerp(900, 1180, L), lerp(380, 560, L)); ctx.stroke(); ctx.setLineDash([]);
    if (L > .95) spark(1180, 560, 6 + Math.sin(t / 120) * 2); vignette(); } },
];

    return { A, B };
  }
  global.Vignettes = { create };
})(typeof window !== 'undefined' ? window : globalThis);
