/* ==========================================================================
   RICOCHET CÉLESTE · Rig de référence des Astres (Directeur artistique)
   --------------------------------------------------------------------------
   Référence VISUELLE et d'ANIMATION, pas du code de production.
   Canvas 2D pur, sans dépendance. Portage Phaser 3 conseillé :
     - soit dessiner chaque frame dans une Phaser CanvasTexture avec drawAstre(),
     - soit reconstruire les parties en Phaser.GameObjects.Graphics/Container
       (corps, bras, yeux, paupières, bouche = un objet chacun) et rejouer les
       mêmes clés avec this.tweens.add / this.tweens.chain (mêmes noms d'ease).
   Unités : un Astre est dessiné dans une boîte de 100 x 100 unités centrée
   sur (0,0). En jeu (loge UI 152x220 px, réf. 1280x720) : px = 1.5, l'Astre
   fait ~120 px de haut, pieds en bas de la loge. Victoire/échec : px = 2.2.
   Carte : px = 0.9. Lisible de 0.6 à 1.6x (vérifié sur la planche).
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- Palette (cf. direction-visuelle.md) ---------- */
  const INK = '#1B2350';          // yeux, bouche (jamais de noir pur)
  const WHITE = '#FFF6E0';
  const CHEEK = '#FF8FB1';

  /* ---------- Ease : mêmes noms que Phaser 3 ---------- */
  const EASE = {
    'Linear': t => t,
    'Quad.in': t => t * t,
    'Quad.out': t => 1 - (1 - t) * (1 - t),
    'Quad.inOut': t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    'Cubic.out': t => 1 - Math.pow(1 - t, 3),
    'Sine.inOut': t => -(Math.cos(Math.PI * t) - 1) / 2,
    'Back.out': t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    'Back.in': t => { const c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
    'Elastic.out': t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1,
    'Bounce.out': t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; },
  };

  /* ======================================================================
     1. DESIGN DES ASTRES
     shape  : forme du corps
     tempo  : vitesse de jeu des animations (1 = normal)
     amp    : amplitude des mouvements
     arms   : petits bras « moufles » (longueur, épaisseur) — articulables
     ====================================================================== */
  const ASTRES = {
    pip: {
      nom: 'Pip', color: '#FFE45C', light: '#FFF6B8', shade: '#E0B92E',
      shape: { type: 'star', n: 5, rOut: 38, rIn: 29, round: 11 }, meche: true,
      size: .82, tempo: 1.45, amp: 1.25,
      eyes: { y: -2, gap: 10, rx: 5, ry: 7 }, mouthY: 11, arms: { len: 12, w: 6, y: 6, x: 22 },
      idle: { bob: 5, bobMs: 650, blinkMin: 1800, blinkMax: 3200, fidget: true },
      voix: 'piccolo / sifflet vif',
    },
    bourdon: {
      nom: 'Bourdon', color: '#FFA98A', light: '#FFD3C2', shade: '#D9785A',
      shape: { type: 'ball', r: 40, bumps: 6, bumpR: 6, wide: 1.18 }, nightcap: true,
      size: .95, tempo: .6, amp: .8,
      eyes: { y: -4, gap: 13, rx: 5, ry: 6, lid: .55 }, mouthY: 14, arms: { len: 10, w: 8, y: 14, x: 36 },
      idle: { bob: 3, bobMs: 2200, blinkMin: 4000, blinkMax: 7000, sleep: true },
      voix: 'tuba / basson',
    },
    jumelles: {
      nom: 'Twi & Nkl', duo: [
        { color: '#8FE3FF', light: '#D4F5FF', shade: '#4FB6DE', dx: -24, phase: 0, look: 1, hair: 'frange' },
        { color: '#FF9BD0', light: '#FFD3EA', shade: '#DE5FA0', dx: 24, phase: .5, look: -1, hair: 'couette' },
      ], thread: true,
      shape: { type: 'ball', r: 21, bumps: 5, bumpR: 4 },
      size: 1, tempo: 1.15, amp: 1,
      eyes: { y: -1, gap: 6, rx: 3, ry: 4.5 }, mouthY: 7, arms: { len: 8, w: 4.5, y: 4, x: 12 },
      idle: { bob: 4, bobMs: 900, blinkMin: 2000, blinkMax: 3500, bicker: true },
      voix: 'deux clarinettes en canon',
    },
    volte: {
      nom: 'Volte', color: '#FF6B4A', light: '#FFB3A0', shade: '#D2452A',
      shape: { type: 'comet', r: 26, tail: 6 }, shades: true,
      size: 1, tempo: 1.2, amp: 1.3,
      eyes: { y: -3, gap: 9, rx: 4.5, ry: 6, brow: 'cocky' }, mouthY: 9, arms: { len: 11, w: 5, y: 6, x: 22 },
      idle: { bob: 4, bobMs: 800, blinkMin: 2500, blinkMax: 4000, trick: true },
      voix: 'trompette bouchée',
    },
    mousse: {
      nom: 'Mousse', color: '#7EE0C6', light: '#C4F5E7', shade: '#46B39A', alpha: .92,
      shape: { type: 'cloud', r: 30 }, fan: true,
      size: 1, tempo: .85, amp: .7,
      eyes: { y: -2, gap: 9, rx: 4, ry: 5.5 }, mouthY: 9, arms: { len: 7, w: 5, y: 8, x: 26 },
      idle: { bob: 2, bobMs: 1600, blinkMin: 1500, blinkMax: 2600, shy: true },
      voix: 'harmonica de verre',
    },
    horloge: {
      nom: 'Horloge', color: '#E8D9B0', light: '#FFF4D6', shade: '#B9A574',
      shape: { type: 'star', n: 4, rOut: 42, rIn: 34, round: 12, lean: .785 }, clock: true, mech: true, cuckoo: true,
      size: 1, tempo: .9, amp: .7,
      eyes: { y: -3, gap: 9, rx: 3.6, ry: 4.6, glasses: true, brow: 'hands' }, mouthY: 10, arms: { len: 12, w: 5, y: 8, x: 34 },
      idle: { bob: 1.5, bobMs: 1000, blinkMin: 3000, blinkMax: 5000, tick: true },
      voix: 'célesta + tic-tac (woodblock)',
    },
    grelot: {
      nom: 'Grelot', color: '#A8F06A', light: '#D9FFB8', shade: '#72BD36',
      shape: { type: 'star', n: 5, rOut: 36, rIn: 20, round: 6, lean: .18, stretchX: 1.25 }, bell: true, speed: true,
      size: .95, tempo: 1.35, amp: 1.1,
      eyes: { y: -2, gap: 9, rx: 4.5, ry: 6 }, mouthY: 10, arms: { len: 11, w: 5, y: 6, x: 20 },
      idle: { bob: 3, bobMs: 500, blinkMin: 2000, blinkMax: 3000, pace: true },
      voix: 'clochettes / glockenspiel',
    },
    nuagelune: {
      nom: 'Nuage-Lune', color: '#D6DCFF', light: '#F2F4FF', shade: '#9EA8E0',
      shape: { type: 'crescent', r: 38 }, seatCloud: true,
      size: 1.05, tempo: .7, amp: .8,
      eyes: { y: -2, gap: 0, rx: 4.5, ry: 6, lid: .35, dx: -24, single: true }, mouthY: 13, mouthDx: -22, arms: { len: 10, w: 5, y: 10, x: 26 },
      idle: { bob: 4, bobMs: 2400, blinkMin: 3500, blinkMax: 6000, dream: true },
      voix: 'harpe + voix de tête',
    },
    veilleuse: {
      nom: 'Grande Veilleuse', color: '#FFE9C2', light: '#FFFFFF', shade: '#E8C88E',
      shape: { type: 'star', n: 8, rOut: 46, rIn: 34, round: 10 },
      size: 1.6, tempo: .4, amp: .5, noArms: true,
      eyes: { y: 0, gap: 14, rx: 6, ry: 6, lid: 1 }, mouthY: 14, arms: null,
      idle: { bob: 2, bobMs: 4000, blinkMin: 99999, blinkMax: 99999, breathe: true },
      voix: 'choeur doux, cordes legato',
    },
  };

  /* ======================================================================
     2. FORMES
     ====================================================================== */
  function roundedPoly(ctx, pts, r) {
    const n = pts.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(pts[n - 1], pts[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = mid(p, pts[(i + 1) % n]);
      ctx.arcTo(p[0], p[1], q[0], q[1], r);
    }
    ctx.closePath();
  }
  function starPts(n, rOut, rIn, lean) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n + (lean || 0);
      const r = i % 2 ? rIn : rOut;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }
  function bodyPath(ctx, s) {
    ctx.beginPath();
    if (s.wide || s.stretchX) { ctx.save(); ctx.scale(s.wide || s.stretchX, 1); }
    if (s.type === 'star') roundedPoly(ctx, starPts(s.n, s.rOut, s.rIn, s.lean), s.round);
    else if (s.type === 'ball') {
      ctx.arc(0, 0, s.r, 0, Math.PI * 2);
      for (let i = 0; i < s.bumps; i++) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / s.bumps;
        ctx.moveTo(Math.cos(a) * (s.r + 2) + s.bumpR, Math.sin(a) * (s.r + 2));
        ctx.arc(Math.cos(a) * (s.r + 2), Math.sin(a) * (s.r + 2), s.bumpR, 0, Math.PI * 2);
      }
    } else if (s.type === 'comet') {
      ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    } else if (s.type === 'cloud') {
      [[0, -6, s.r * .8], [-18, 4, s.r * .62], [18, 4, s.r * .62], [-8, 12, s.r * .6], [10, 12, s.r * .6]]
        .forEach(([x, y, r]) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); });
    } else if (s.type === 'crescent') {
      // croissant = grand disque moins un disque décalé à droite (intersection calculée)
      const r1 = s.r, cx2 = s.r * .58, cy2 = -s.r * .22, r2 = s.r * .8, dd = Math.hypot(cx2, cy2);
      const a = (r1 * r1 - r2 * r2 + dd * dd) / (2 * dd), h = Math.sqrt(r1 * r1 - a * a), ux = cx2 / dd, uy = cy2 / dd;
      const P1 = [a * ux - h * uy, a * uy + h * ux], P2 = [a * ux + h * uy, a * uy - h * ux];
      const t1 = Math.atan2(P1[1], P1[0]), t2 = Math.atan2(P2[1], P2[0]);
      const f1 = Math.atan2(P1[1] - cy2, P1[0] - cx2), f2 = Math.atan2(P2[1] - cy2, P2[0] - cx2);
      ctx.arc(0, 0, r1, t1, t2, false);
      ctx.arc(cx2, cy2, r2, f2, f1, true);
      ctx.closePath();
    }
    if (s.wide || s.stretchX) ctx.restore();
  }

  /* ======================================================================
     3. VISAGE : yeux + paupières + sourcils + bouche
     Yeux   : open | wide | happy | closed | sleepy | star | worried | squint | spiral-free (PEGI 3 : pas d'yeux en croix)
     Bouche : smile | grin | open | o | frown | wavy | flat | puff | tongue
     ====================================================================== */
  function drawEye(ctx, x, y, e, st, side) {
    const rx = e.rx, ry = e.ry;
    const lx = st.lookX * rx * .45, ly = st.lookY * ry * .4;
    ctx.save(); ctx.translate(x, y);
    const k = st.eyes;
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 2.4;
    if (k === 'happy') { ctx.beginPath(); ctx.arc(0, ry * .3, rx * 1.05, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else if (k === 'closed') { ctx.beginPath(); ctx.arc(0, -ry * .2, rx, Math.PI * .15, Math.PI * .85); ctx.stroke(); }
    else if (k === 'spiral') { ctx.lineWidth = 1.6; ctx.beginPath(); for (let a = 0; a < 12; a += .3) { const r = a / 12 * rx * 1.2; ctx.lineTo(Math.cos(a + (st.t || 0) / 80 * side) * r, Math.sin(a + (st.t || 0) / 80 * side) * r); } ctx.stroke(); }
    else if (k === 'squint') { ctx.beginPath(); ctx.moveTo(-rx, -2 * side); ctx.lineTo(rx * .8, 0); ctx.lineTo(-rx, 2 * side); ctx.stroke(); }
    else if (k === 'star') {
      ctx.fillStyle = WHITE; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); roundedPoly(ctx, starPts(5, rx * 1.5, rx * .65), 1); ctx.fill(); ctx.stroke();
    } else {
      const big = k === 'wide' ? 1.3 : 1;
      ctx.beginPath(); ctx.ellipse(lx, ly, rx * big, ry * big, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = WHITE;
      ctx.beginPath(); ctx.arc(lx - rx * .3, ly - ry * .35, rx * .38 * big, 0, Math.PI * 2); ctx.fill();
      // paupière (blink + sommeil) : rectangle couleur corps qui descend
      let lid = Math.max(st.blink, k === 'sleepy' ? .55 : 0, st.lid || 0);
      if (lid > 0) {
        ctx.fillStyle = st._bodyColor;
        ctx.fillRect(-rx * 1.6, -ry * 1.6, rx * 3.2, ry * 3.2 * lid * .5 + ry * .2 * lid);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
        const yl = -ry * 1.6 + ry * 3.2 * lid * .5 + ry * .2 * lid;
        ctx.beginPath(); ctx.moveTo(-rx * 1.05, yl); ctx.lineTo(rx * 1.05, yl); ctx.stroke();
      }
    }
    // sourcils
    const brow = st.brow;
    if (brow) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath();
      const by = -ry * 1.55;
      if (brow === 'worried') { ctx.moveTo(-rx * side, by + 1); ctx.lineTo(rx * side, by - 3); }
      else if (brow === 'stern') { ctx.moveTo(-rx * side, by - 2); ctx.lineTo(rx * side, by + 2); }
      else if (brow === 'cocky') { if (side < 0) { ctx.moveTo(-rx, by - 3); ctx.quadraticCurveTo(0, by - 6, rx, by - 2); } else { ctx.moveTo(-rx, by); ctx.lineTo(rx, by); } }
      else if (brow === 'hands') { const a = (st.handA || 0) * side; ctx.lineWidth = 2.2; ctx.moveTo(0, by); ctx.lineTo(Math.cos(a - .2 * side) * rx * 1.4 * side, by + Math.sin(a - .2 * side) * rx * 1.4); }
      else if (brow === 'up') { ctx.moveTo(-rx, by - 3); ctx.quadraticCurveTo(0, by - 6, rx, by - 3); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawMouth(ctx, x, y, m, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    switch (m) {
      case 'smile': ctx.arc(0, -3, 5, Math.PI * .2, Math.PI * .8); ctx.stroke(); break;
      case 'grin': ctx.arc(0, -2, 6.5, Math.PI * .1, Math.PI * .9); ctx.stroke(); break;
      case 'open': case 'tongue':
        ctx.moveTo(-7, -1); ctx.quadraticCurveTo(0, 0, 7, -1); ctx.quadraticCurveTo(0, 13, -7, -1); ctx.fill();
        ctx.fillStyle = CHEEK; ctx.beginPath(); ctx.ellipse(0, 5, 3.6, 2.2, 0, 0, Math.PI * 2); ctx.fill(); break;
      case 'o': ctx.ellipse(0, 1, 3, 4, 0, 0, Math.PI * 2); ctx.fill(); break;
      case 'frown': ctx.arc(0, 5, 5, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); break;
      case 'wavy': ctx.moveTo(-6, 0); for (let i = 1; i <= 6; i++) ctx.lineTo(-6 + i * 2, i % 2 ? -1.6 : 1.6); ctx.stroke(); break;
      case 'flat': ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke(); break;
      case 'moue': ctx.moveTo(-4, 1); ctx.quadraticCurveTo(0, -3, 4, 1); ctx.stroke(); break;
      case 'baille': ctx.ellipse(0, 3, 4, 6, 0, 0, Math.PI * 2); ctx.fill(); break;
      case 'puff': ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.stroke(); break;
      default: ctx.arc(0, -3, 5, Math.PI * .2, Math.PI * .8); ctx.stroke();
    }
    ctx.restore();
  }

  /* ======================================================================
     4. DESSIN D'UN ASTRE (une frame)
     st = état courant : { x,y, sx,sy, rot, lookX,lookY, eyes, mouth, brow,
                           blink, lid, armL, armR, glow, cheeks, alpha }
     armL / armR : angle des bras en degrés (0 = pendants, 90 = horizontaux,
                   160 = levés au ciel)
     ====================================================================== */
  function drawSingle(ctx, d, look, st) {
    const s = d.shape;
    st._bodyColor = look.color;
    // traînée de la comète (Volte) — derrière le corps
    if (s.type === 'comet') {
      for (let i = s.tail; i >= 1; i--) {
        ctx.fillStyle = i % 2 ? look.light : look.color; ctx.globalAlpha = .25 + .15 * (s.tail - i);
        ctx.beginPath(); ctx.arc(s.r * .55 * i + 6, -s.r * .35 * i * .5, s.r * (1 - i * .13), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // mèche-humeur de Pip : up (content) | down (déçu) | curl (panique) | antenna (pouvoir)
    if (d.meche) {
      const m = st.meche || 'up', w = Math.sin((st.t || 0) / 160) * 4;
      ctx.save(); ctx.translate(0, -34); ctx.strokeStyle = look.color; ctx.lineCap = 'round'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(0, 4);
      if (m === 'up') ctx.quadraticCurveTo(6 + w, -10, 2 + w, -22);
      else if (m === 'down') ctx.quadraticCurveTo(14, -8, 20 + w * .3, 4);
      else if (m === 'curl') { for (let a = 0; a < 4 * Math.PI; a += .3) ctx.lineTo(Math.sin(a) * 6, -a * 1.8); }
      else if (m === 'antenna') ctx.lineTo(0, -24);
      ctx.stroke();
      if (m === 'antenna') { const on = Math.sin((st.t || 0) / 120) > 0; ctx.fillStyle = on ? '#4FF0A8' : look.light; ctx.beginPath(); ctx.arc(0, -26, 5, 0, Math.PI * 2); ctx.fill(); }
      if (m === 'up') { ctx.fillStyle = look.light; ctx.beginPath(); ctx.arc(2 + w, -22, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    // bras (derrière le corps)
    if (d.arms) {
      const a = d.arms;
      [[-1, st.armL], [1, st.armR]].forEach(([side, ang]) => {
        ctx.save(); ctx.translate(a.x * side, a.y);
        ctx.rotate(side * (ang * Math.PI / 180));
        ctx.fillStyle = look.shade;
        ctx.beginPath(); ctx.ellipse(0, a.len * .55, a.w * .6, a.len * .65, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = look.color;
        ctx.beginPath(); ctx.arc(0, a.len, a.w * .85, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    }
    // corps : ombre propre (décalée) + couleur + reflet
    ctx.save(); ctx.translate(2, 3); ctx.fillStyle = look.shade; bodyPath(ctx, s); ctx.fill(); ctx.restore();
    ctx.fillStyle = look.color; bodyPath(ctx, s); ctx.fill();
    ctx.save(); bodyPath(ctx, s); ctx.clip();
    ctx.fillStyle = look.light; ctx.globalAlpha = .7;
    ctx.beginPath(); ctx.ellipse(-10, -16, 14, 8, -.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
    // accessoires
    if (d.clock) { // visage-cadran d'Horloge (12 graduations) + montre à gousset
      ctx.fillStyle = '#FFF4D6'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = look.shade; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 21, Math.sin(a) * 21); ctx.lineTo(Math.cos(a) * (i % 3 ? 23 : 19), Math.sin(a) * (i % 3 ? 23 : 19)); ctx.stroke(); }
      const t = st.clockT || 0; ctx.save(); ctx.translate(30, 26); ctx.fillStyle = '#FFE45C'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(t) * 4.5, -Math.cos(t) * 4.5); ctx.stroke(); ctx.restore();
      st.handA = st.handA ?? 0;
    }
    if (d.nightcap) { // bonnet de nuit de Bourdon : tombe sur les yeux en dormant, s'envole au sursaut
      ctx.save(); ctx.translate(st.capX || 0, -30 + (st.capY || 0) + (st._zzz ? 8 : 0)); ctx.rotate((st._zzz ? .35 : .15) + (st.capRot || 0));
      ctx.fillStyle = '#6F78B8'; ctx.beginPath(); ctx.moveTo(-30, 6); ctx.quadraticCurveTo(-6, -40, 34, -18); ctx.quadraticCurveTo(10, -6, 30, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#D6DCFF'; ctx.fillRect(-32, 2, 64, 8); ctx.beginPath(); ctx.arc(36, -18, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (d.speed) { // traînée de vitesse de Grelot + clochettes aux branches + sacoche
      ctx.strokeStyle = look.light; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.globalAlpha = .6;
      [-10, 0, 10].forEach((y, i) => { ctx.beginPath(); ctx.moveTo(-48 - i * 4 + Math.sin((st.t || 0) / 60 + i) * 3, y); ctx.lineTo(-62 - i * 6, y); ctx.stroke(); }); ctx.globalAlpha = 1;
      ctx.fillStyle = '#B9A574'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-34, 8, 18, 14, 4) : ctx.rect(-34, 8, 18, 14); ctx.fill();
    }
    if (d.seatCloud) { // nuage-humeur sous Nuage-Lune : pluie (triste) / arc-en-ciel (joie)
      ctx.save(); ctx.translate(-4, 40);
      if (st.mood === 'joy') { ['#FF5FA2', '#FFE45C', '#4FF0A8', '#6FCBFF'].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 6, 30 - i * 3, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }); }
      ctx.fillStyle = '#F2F4FF'; [[-16, 0, 11], [0, -4, 14], [16, 0, 11]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
      if (st.mood === 'rain') { ctx.strokeStyle = '#8FE3FF'; ctx.lineWidth = 1.6; for (let i = 0; i < 4; i++) { const yy = ((st.t || 0) / 6 + i * 9) % 22; ctx.beginPath(); ctx.moveTo(-12 + i * 8, 10 + yy); ctx.lineTo(-13 + i * 8, 14 + yy); ctx.stroke(); } }
      ctx.restore();
    }
    if (look.hair === 'frange') { ctx.fillStyle = look.shade; ctx.fillRect(-12, -22, 24, 6); }
    if (look.hair === 'couette') { ctx.strokeStyle = look.shade; ctx.lineWidth = 3; ctx.beginPath(); for (let a = 0; a < 3 * Math.PI; a += .3) ctx.lineTo(14 + Math.cos(a) * 4 + a, -20 - a * 1.6 + Math.sin(a) * 3); ctx.stroke(); }
    if (d.bell) { // clochette sous Grelot
      ctx.save(); ctx.translate(0, 30); ctx.rotate(Math.sin(st.bellT || 0) * .5);
      ctx.fillStyle = '#FFE45C'; ctx.beginPath(); ctx.moveTo(-6, 8); ctx.quadraticCurveTo(-6, -2, 0, -2); ctx.quadraticCurveTo(6, -2, 6, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 9, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // visage
    const e = d.eyes, edx = e.dx || 0;
    if (st.cheeks > 0) {
      ctx.fillStyle = CHEEK; ctx.globalAlpha = .45 * st.cheeks;
      [-1, 1].forEach(sd => { ctx.beginPath(); ctx.ellipse(edx + sd * (e.gap + 5), e.y + e.ry + 3, 4.5 * st.cheeks, 2.8, 0, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
    }
    const lk = { ...st, lookX: st.lookX * (look.look || 1) ** 0, lid: Math.max(st.lid || 0, (e.lid || 0) * (st.sleepLid ?? 1)) };
    if (!e.single) drawEye(ctx, edx - e.gap, e.y, e, lk, -1);
    drawEye(ctx, edx + e.gap, e.y, e, lk, 1);
    if (e.glasses) { ctx.strokeStyle = INK; ctx.lineWidth = 1.4; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(edx + sd * e.gap, e.y + 3, e.rx * 1.7, 0, Math.PI * 2); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(-e.gap + e.rx * 1.7, e.y + 3); ctx.lineTo(e.gap - e.rx * 1.7, e.y + 3); ctx.stroke(); }
    if (d.shades && st.shades) { ctx.fillStyle = INK; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.ellipse(edx + sd * e.gap, e.y + 1, e.rx * 1.8, e.ry * 1.1, 0, 0, Math.PI * 2); ctx.fill(); }); ctx.fillRect(-e.gap, e.y - 1, e.gap * 2, 2); ctx.fillStyle = WHITE; ctx.globalAlpha = .6; ctx.fillRect(edx - e.gap - 4, e.y - 3, 3, 2); ctx.globalAlpha = 1; }
    if (e.monocle) { ctx.strokeStyle = '#B9A574'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(edx + e.gap, e.y, e.rx * 1.9, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(edx + e.gap + e.rx * 1.9, e.y); ctx.quadraticCurveTo(edx + e.gap + 14, e.y + 14, edx + e.gap + 8, e.y + 22); ctx.stroke(); }
    drawMouth(ctx, (d.mouthDx || 0), d.mouthY, st.mouth, st.mouthScale || 1);
    if (d.fan && st.fan > 0) { // feuille-éventail de Mousse : 0 = baissée, 1 = cache le visage
      ctx.save(); ctx.translate(16 - st.fan * 12, 30 - st.fan * 32); ctx.rotate(-.5 + st.fan * .3 + Math.sin((st.t || 0) / 120) * .08 * st.fan);
      ctx.fillStyle = '#C4F5E7'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#46B39A'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 22); ctx.stroke(); ctx.restore();
    }
    if (d.cuckoo && st.cuckoo > 0) { // coucou d'Horloge qui sort du sommet
      ctx.save(); ctx.translate(0, -40 - st.cuckoo * 18);
      ctx.fillStyle = '#FF9BD0'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFB23F'; ctx.beginPath(); ctx.moveTo(7, -1); ctx.lineTo(13, 1); ctx.lineTo(7, 3); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(3, -2, 1.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  function drawAstre(ctx, d, st, px) {
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.scale(px * d.size, px * d.size);
    // halo (pouvoir, euphorie)
    if (st.glow > 0) {
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 70);
      g.addColorStop(0, `rgba(255,246,224,${.55 * st.glow})`); g.addColorStop(1, 'rgba(255,246,224,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
    }
    // ombre portée au sol (donne le poids et lit les sauts)
    ctx.fillStyle = 'rgba(11,16,38,.45)';
    const lift = Math.max(0, -st.dy) / 40;
    ctx.beginPath(); ctx.ellipse(0, 52, 26 * (1 - lift * .4), 5 * (1 - lift * .4), 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(st.dx + st.shakeX, st.dy);
    // squash & stretch depuis la base (pivot en bas du corps)
    ctx.translate(0, 40); ctx.rotate(st.rot * Math.PI / 180); ctx.scale(st.sx, st.sy); ctx.translate(0, -40);
    ctx.globalAlpha = (d.alpha || 1) * st.alpha;
    if (d.duo && d.thread) { // fil de lumière élastique entre Twi et Nkl
      const b = st.bicker ? Math.sin(st.bicker * Math.PI) * 8 : 0, sep = 48 + 2 * b + (st.duoSep || 0);
      ctx.strokeStyle = 'rgba(255,246,224,.75)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-sep / 2 + 10, 14); ctx.quadraticCurveTo(0, 14 + Math.max(0, 30 - sep * .4), sep / 2 - 10, 14); ctx.stroke();
    }
    if (d.duo) {
      d.duo.forEach((m, i) => {
        ctx.save();
        const ph = (st.t || 0) / 900 * Math.PI * 2 + m.phase * Math.PI * 2;
        const bump = st.bicker ? Math.sin(st.bicker * Math.PI) * 8 * (i ? -1 : 1) : 0;
        ctx.translate(m.dx + Math.sign(m.dx) * (st.duoSep || 0) / 2 + bump, Math.sin(ph) * 3 + (i ? 1 : -1) * (st.duoDy || 0));
        ctx.rotate((i ? -1 : 1) * (st.duoRot || 0) * Math.PI / 180);
        drawSingle(ctx, d, m, { ...st, lookX: st.lookX + (st.duoLook ? m.look * .8 : 0) });
        ctx.restore();
      });
    } else drawSingle(ctx, d, d, st);
    if (d.nightcap && st._zzz) { // bulle de nez
      const b = (Math.sin((st.t || 0) / d.idle.bobMs * Math.PI * 2) + 1) / 2; ctx.strokeStyle = 'rgba(214,220,255,.8)'; ctx.fillStyle = 'rgba(214,220,255,.25)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(10 + b * 6, 8, 3 + b * 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (st.orbY !== undefined && st.orbY > -900) { // mini-orbe des idles (jongleur)
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(st.orbX || 0, st.orbY, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* ======================================================================
     5. RÉACTIONS
     Chaque réaction = des pistes de clés {t(ms), valeur, ease}.
     Propriétés animables (neutre entre parenthèses) :
       dx(0) dy(0) sx(1) sy(1) rot(0) glow(0) shake(0) armL(10) armR(10)
       cheeks(0) mouthScale(1) bicker(0) duoRot(0)
     face : changements de visage à un instant t {eyes, mouth, brow}
     fx   : particules à un instant t
     loop : la réaction boucle jusqu'au prochain événement
     hold : visage gardé à la fin (sinon retour à l'attente)
     ====================================================================== */
  const R = {}; // R[event] = [variante, variante, ...]
  const k = (t, v, ease) => [t, v, ease || 'Sine.inOut'];

  R.tir_lance = [
    { dur: 520, tracks: { sy: [k(0, 1), k(90, .78, 'Quad.out'), k(220, 1.18, 'Back.out'), k(520, 1)], sx: [k(0, 1), k(90, 1.18, 'Quad.out'), k(220, .88), k(520, 1)], dy: [k(90, 0), k(240, -14, 'Quad.out'), k(520, 0, 'Bounce.out')], armR: [k(0, 10), k(160, 150, 'Back.out'), k(520, 40)] },
      face: [[0, { eyes: 'squint', mouth: 'flat' }], [180, { eyes: 'wide', mouth: 'o' }]], fx: [[200, 'whoosh']], then: 'suivi' },
    { dur: 480, tracks: { rot: [k(0, 0), k(120, -12, 'Quad.out'), k(300, 8), k(480, 0)], armL: [k(0, 10), k(120, 120, 'Back.out'), k(480, 30)], armR: [k(0, 10), k(120, 120, 'Back.out'), k(480, 30)] },
      face: [[0, { eyes: 'open', mouth: 'grin', brow: 'up' }]], fx: [], then: 'suivi' },
  ];
  // Pendant le vol : l'Astre suit l'orbe des yeux (lookX/lookY pilotés par la position de l'orbe)
  R.suivi = [
    { dur: 1400, loop: true, tracks: { dy: [k(0, 0), k(700, -3), k(1400, 0)], sx: [k(0, 1), k(700, 1.03), k(1400, 1)], armL: [k(0, 30), k(700, 45), k(1400, 30)], armR: [k(0, 30), k(700, 45), k(1400, 30)] },
      face: [[0, { eyes: 'wide', mouth: 'o', brow: 'up' }]], track: true },
  ];
  // Micro-réactions PENDANT le tir (proposées en plus du plan) : à chaque cristal touché
  R.cristal_touche = [
    { dur: 220, micro: true, tracks: { sy: [k(0, 1), k(70, .9, 'Quad.out'), k(220, 1, 'Back.out')], sx: [k(0, 1), k(70, 1.08, 'Quad.out'), k(220, 1, 'Back.out')] }, face: [[0, { mouth: 'grin' }]], fx: [] },
  ];
  R.coeur_touche = [
    { dur: 360, micro: true, tracks: { dy: [k(0, 0), k(120, -10, 'Quad.out'), k(360, 0, 'Bounce.out')], armL: [k(0, 30), k(120, 140, 'Back.out'), k(360, 40)], armR: [k(0, 30), k(120, 140, 'Back.out'), k(360, 40)] }, face: [[0, { eyes: 'happy', mouth: 'open' }]], fx: [[60, 'sparkle', 3]] },
  ];
  R.gros_coup = [
    { dur: 1100, tracks: { dy: [k(0, 0), k(180, -26, 'Quad.out'), k(360, 0, 'Quad.in'), k(520, -16, 'Quad.out'), k(680, 0, 'Bounce.out')], sy: [k(0, 1), k(60, .8), k(180, 1.15), k(360, .85), k(440, 1.1), k(680, .92), k(900, 1, 'Elastic.out')], sx: [k(0, 1), k(60, 1.2), k(180, .9), k(360, 1.15), k(440, .95), k(680, 1.06), k(900, 1, 'Elastic.out')], armL: [k(0, 10), k(150, 165, 'Back.out'), k(900, 150), k(1100, 10)], armR: [k(0, 10), k(150, 165, 'Back.out'), k(900, 150), k(1100, 10)], cheeks: [k(0, 0), k(200, 1), k(1100, .6)] },
      face: [[0, { meche: 'up', eyes: 'happy', mouth: 'open' }]], fx: [[180, 'sparkle', 8], [520, 'sparkle', 5]] },
    { dur: 900, tracks: { rot: [k(0, 0), k(500, 360, 'Back.out'), k(501, 0)], dy: [k(0, 0), k(250, -22, 'Quad.out'), k(500, 0, 'Bounce.out')], armL: [k(0, 10), k(100, 90), k(500, 90), k(900, 10)], armR: [k(0, 10), k(100, 90), k(500, 90), k(900, 10)] },
      face: [[0, { eyes: 'closed', mouth: 'grin' }], [500, { eyes: 'happy', mouth: 'open' }]], fx: [[480, 'sparkle', 8]] },
    { dur: 1000, tracks: { armL: [k(0, 10), k(100, 70), k(200, 100), k(300, 70), k(400, 100), k(500, 70), k(600, 100), k(1000, 10)], armR: [k(0, 10), k(100, 70), k(200, 100), k(300, 70), k(400, 100), k(500, 70), k(600, 100), k(1000, 10)], sy: [k(0, 1), k(100, 1.08), k(200, .95), k(300, 1.08), k(400, .95), k(500, 1.08), k(600, 1)], cheeks: [k(0, 0), k(150, 1), k(1000, .5)] },
      face: [[0, { eyes: 'happy', mouth: 'tongue' }]], fx: [[100, 'note', 3]] }, // applaudit
  ];
  R.chaine_longue = [
    { dur: 1500, tracks: { sx: [k(0, 1), k(120, 1.3, 'Back.out'), k(1200, 1.25), k(1500, 1, 'Elastic.out')], sy: [k(0, 1), k(120, 1.3, 'Back.out'), k(1200, 1.25), k(1500, 1, 'Elastic.out')], rot: [k(0, 0), k(800, 720, 'Cubic.out'), k(801, 0)], shake: [k(0, 0), k(100, 2), k(1100, 2), k(1300, 0)], glow: [k(0, 0), k(150, 1), k(1200, 1), k(1500, 0)], armL: [k(0, 10), k(100, 160), k(1500, 10)], armR: [k(0, 10), k(100, 160), k(1500, 10)], cheeks: [k(0, 1), k(1500, 1)] },
      face: [[0, { eyes: 'star', mouth: 'open' }]], fx: [[100, 'burst', 16], [700, 'sparkle', 10]] },
    { dur: 1400, tracks: { dy: [k(0, 0), k(150, -30, 'Quad.out'), k(300, 0, 'Quad.in'), k(450, -30, 'Quad.out'), k(600, 0, 'Quad.in'), k(750, -30, 'Quad.out'), k(1000, 0, 'Bounce.out')], glow: [k(0, 0), k(100, 1), k(1100, 1), k(1400, 0)], armL: [k(0, 160), k(1400, 10)], armR: [k(0, 160), k(1400, 10)], sy: [k(0, 1), k(300, .8), k(320, 1.2), k(600, .8), k(620, 1.2), k(1000, 1, 'Elastic.out')] },
      face: [[0, { eyes: 'star', mouth: 'tongue' }]], fx: [[150, 'burst', 10], [450, 'burst', 10], [750, 'burst', 10]] },
  ];
  R.chaine_longue.push({ dur: 1800, // « Effondré de joie » : tombe sur le dos, yeux spirale, bras qui gigotent
    tracks: { rot: [k(0, 0), k(300, -95, 'Bounce.out'), k(1400, -95), k(1700, 0, 'Back.out')], dy: [k(0, 0), k(300, 10), k(1400, 10), k(1700, 0)], armL: [k(300, 120), k(400, 170), k(500, 120), k(600, 170), k(700, 120), k(800, 170), k(900, 120), k(1000, 170), k(1400, 120), k(1800, 10)], armR: [k(300, 170), k(400, 120), k(500, 170), k(600, 120), k(700, 170), k(800, 120), k(900, 170), k(1000, 120), k(1400, 170), k(1800, 10)], glow: [k(0, 1), k(1800, 0)], cheeks: [k(0, 1.3), k(1800, .5)] },
    face: [[0, { eyes: 'spiral', mouth: 'tongue', meche: 'curl' }], [1500, { eyes: 'happy', mouth: 'grin', meche: 'up' }]], fx: [[300, 'burst', 14], [800, 'sparkle', 6]] });
  R.rate = [
    { dur: 1300, tracks: { sy: [k(0, 1), k(400, .82, 'Quad.out'), k(1000, .84), k(1300, 1, 'Back.out')], sx: [k(0, 1), k(400, 1.12, 'Quad.out'), k(1000, 1.1), k(1300, 1, 'Back.out')], dy: [k(0, 0), k(400, 6), k(1000, 6), k(1300, 0)], armL: [k(0, 10), k(400, 0), k(1300, 10)], armR: [k(0, 10), k(400, 0), k(1300, 10)] },
      face: [[0, { meche: 'down', eyes: 'open', mouth: 'frown', brow: 'worried' }], [900, { eyes: 'closed', mouth: 'flat' }]], fx: [[700, 'sigh']] }, // dégonflé + soupir
    { dur: 1200, tracks: { rot: [k(0, 0), k(250, -14, 'Back.out'), k(900, -14), k(1200, 0)], armR: [k(0, 10), k(250, 145, 'Back.out'), k(900, 145), k(1200, 10)] },
      face: [[0, { eyes: 'closed', mouth: 'wavy' }]], fx: [] }, // main sur le front
    { dur: 1100, tracks: { dx: [k(0, 0), k(150, -4), k(300, 4), k(450, -4), k(600, 0)], sy: [k(0, 1), k(600, .9), k(1100, 1, 'Back.out')] },
      face: [[0, { eyes: 'open', mouth: 'flat', brow: 'stern' }], [600, { eyes: 'open', mouth: 'smile' }]], fx: [] }, // « bof » puis haussement
  ];
  R.orbe_recupere = [
    { dur: 700, tracks: { dy: [k(0, 0), k(150, -10, 'Quad.out'), k(350, 0, 'Bounce.out')], rot: [k(0, 0), k(150, 10), k(500, 0)], armR: [k(0, 10), k(150, 130, 'Back.out'), k(500, 130), k(700, 10)] },
      face: [[0, { eyes: 'squint', mouth: 'grin' }], [500, { eyes: 'open', mouth: 'smile' }]], fx: [[150, 'sparkle', 3]] }, // clin d'œil
    { dur: 600, tracks: { sy: [k(0, 1), k(100, .85), k(250, 1.1, 'Back.out'), k(600, 1)], armL: [k(0, 10), k(150, 90), k(600, 10)], armR: [k(0, 10), k(150, 90), k(600, 10)] },
      face: [[0, { eyes: 'happy', mouth: 'grin' }]], fx: [] },
  ];
  R.pouvoir_active = [
    { dur: 1300, tracks: { sx: [k(0, 1), k(150, .8, 'Quad.in'), k(450, 1.4, 'Elastic.out'), k(1100, 1.3), k(1300, 1)], sy: [k(0, 1), k(150, .8, 'Quad.in'), k(450, 1.4, 'Elastic.out'), k(1100, 1.3), k(1300, 1)], glow: [k(0, 0), k(150, .2), k(450, 1.2), k(1100, 1), k(1300, 0)], armL: [k(0, 10), k(150, 0), k(450, 120, 'Back.out'), k(1300, 10)], armR: [k(0, 10), k(150, 0), k(450, 120, 'Back.out'), k(1300, 10)] },
      face: [[0, { meche: 'antenna', eyes: 'closed', mouth: 'puff' }], [450, { eyes: 'wide', mouth: 'open', brow: 'up' }]], fx: [[450, 'ring'], [450, 'burst', 12]] },
  ];
  R.presque = [
    { dur: 1100, tracks: { sx: [k(0, 1), k(80, .82, 'Quad.out'), k(800, .84), k(1100, 1, 'Back.out')], sy: [k(0, 1), k(80, 1.15, 'Quad.out'), k(800, 1.12), k(1100, 1, 'Back.out')], shake: [k(0, 0), k(80, 1.5), k(600, 1.5), k(700, 0)], armL: [k(0, 10), k(80, 150, 'Back.out'), k(800, 150), k(1100, 10)], armR: [k(0, 10), k(80, 150, 'Back.out'), k(800, 150), k(1100, 10)] },
      face: [[0, { meche: 'curl', eyes: 'wide', mouth: 'o', brow: 'worried' }], [700, { eyes: 'closed', mouth: 'wavy' }]], fx: [[0, 'sweat']] }, // mains sur les joues
    { dur: 1000, tracks: { dy: [k(0, 0), k(120, -8, 'Quad.out'), k(300, 0)], rot: [k(120, 0), k(400, 20, 'Back.out'), k(800, 20), k(1000, 0)] },
      face: [[0, { eyes: 'wide', mouth: 'o' }], [400, { eyes: 'squint', mouth: 'wavy' }]], fx: [] },
  ];
  R.dernier_coeur = [ // tension en boucle : sur la pointe, tremble, yeux rivés sur le cœur
    { dur: 900, loop: true, tracks: { sy: [k(0, 1.06), k(450, 1.1), k(900, 1.06)], sx: [k(0, .95), k(450, .92), k(900, .95)], shake: [k(0, .8), k(900, .8)], armL: [k(0, 60), k(450, 70), k(900, 60)], armR: [k(0, 60), k(450, 70), k(900, 60)] },
      face: [[0, { eyes: 'wide', mouth: 'wavy', brow: 'worried' }]], track: true },
  ];
  R.dernier_orbe = [
    { dur: 1600, loop: true, tracks: { dx: [k(0, 0), k(400, -3), k(1200, 3), k(1600, 0)], armL: [k(0, 20), k(800, 35), k(1600, 20)], armR: [k(0, 120), k(400, 140), k(800, 120), k(1200, 140), k(1600, 120)] },
      face: [[0, { meche: 'curl', eyes: 'open', mouth: 'wavy', brow: 'worried' }]], fx: [[200, 'sweat']], track: true }, // ronge sa moufle
  ];
  R.final_ralenti = [ // retient son souffle, joues gonflées, tout au ralenti
    { dur: 1800, hold: true, tracks: { sx: [k(0, 1), k(300, 1.18, 'Quad.out'), k(1800, 1.22)], sy: [k(0, 1), k(300, .92, 'Quad.out'), k(1800, .9)], cheeks: [k(0, 0), k(300, 1.6)], mouthScale: [k(0, 1), k(300, .6)], armL: [k(0, 10), k(300, 100), k(1800, 110)], armR: [k(0, 10), k(300, 100), k(1800, 110)] },
      face: [[0, { eyes: 'wide', mouth: 'puff', brow: 'up' }]], track: true },
  ];
  R.victoire = [
    { dur: 1600, loop: true, tracks: { dy: [k(0, 0), k(250, -30, 'Quad.out'), k(500, 0, 'Quad.in'), k(800, -18, 'Quad.out'), k(1100, 0, 'Bounce.out'), k(1600, 0)], rot: [k(500, 0), k(800, 360, 'Cubic.out'), k(801, 0)], sy: [k(0, .85), k(120, 1.15), k(500, .85), k(620, 1.1), k(1100, .9), k(1300, 1, 'Elastic.out')], armL: [k(0, 165), k(250, 140), k(500, 165), k(800, 120), k(1100, 165)], armR: [k(0, 165), k(250, 140), k(500, 165), k(800, 120), k(1100, 165)], glow: [k(0, .6), k(800, 1), k(1600, .6)], cheeks: [k(0, 1), k(1600, 1)] },
      face: [[0, { eyes: 'star', mouth: 'open' }], [800, { eyes: 'happy', mouth: 'tongue' }]], fx: [[0, 'confetti', 14], [800, 'sparkle', 8]] },
  ];
  R.echec = [ // jamais triste longtemps : s'assoit, soupire, puis rebondit « Encore ! »
    { dur: 1900, tracks: { sy: [k(0, 1), k(350, .75, 'Quad.out'), k(1200, .78), k(1350, 1.2, 'Back.out'), k(1900, 1)], sx: [k(0, 1), k(350, 1.18, 'Quad.out'), k(1200, 1.15), k(1350, .9), k(1900, 1)], dy: [k(1200, 0), k(1450, -18, 'Quad.out'), k(1900, 0, 'Bounce.out')], armL: [k(0, 10), k(350, 0), k(1300, 0), k(1450, 160, 'Back.out'), k(1900, 30)], armR: [k(0, 10), k(350, 0), k(1300, 0), k(1450, 100, 'Back.out'), k(1900, 30)] },
      face: [[0, { eyes: 'open', mouth: 'frown', brow: 'worried' }], [700, { eyes: 'closed', mouth: 'flat' }], [1300, { eyes: 'open', mouth: 'grin', brow: 'up' }]], fx: [[700, 'sigh']] },
  ];
  R.echec.push({ dur: 2000, // « Flaque » : fond en flaque, un œil ouvert, se reforme d'un coup
    tracks: { sy: [k(0, 1), k(500, .28, 'Quad.in'), k(1300, .28), k(1450, 1.3, 'Back.out'), k(2000, 1, 'Elastic.out')], sx: [k(0, 1), k(500, 1.7, 'Quad.in'), k(1300, 1.7), k(1450, .85), k(2000, 1, 'Elastic.out')], armL: [k(0, 10), k(500, 90), k(1300, 90), k(1500, 165, 'Back.out'), k(2000, 30)], armR: [k(0, 10), k(500, 90), k(1300, 90), k(1500, 60), k(2000, 30)] },
    face: [[0, { eyes: 'open', mouth: 'frown', brow: 'worried', meche: 'down' }], [500, { eyes: 'sleepy', mouth: 'flat' }], [1400, { eyes: 'open', mouth: 'grin', brow: 'up', meche: 'up' }]], fx: [[1450, 'sparkle', 6]] });
  R.inactivite = [ // Pip : impatient, s'agite pour attirer l'attention vers le canon
    { dur: 1600, tracks: { dy: [k(0, 0), k(120, -12, 'Quad.out'), k(260, 0, 'Bounce.out'), k(380, -12, 'Quad.out'), k(520, 0, 'Bounce.out')], armR: [k(0, 10), k(150, 160), k(300, 120), k(450, 160), k(600, 120), k(750, 160), k(1000, 10)], rot: [k(0, 0), k(300, -8), k(600, 8), k(900, 0)] },
      face: [[0, { eyes: 'open', mouth: 'open', brow: 'up' }]], fx: [[100, 'excl']] },
    { dur: 1400, tracks: { dx: [k(0, 0), k(200, -6), k(400, 0)], sy: [k(0, 1), k(100, .95), k(200, 1), k(300, .95), k(400, 1), k(500, .95), k(600, 1)], armL: [k(0, 10), k(200, 90), k(1200, 90), k(1400, 10)] },
      face: [[0, { eyes: 'open', mouth: 'flat', brow: 'stern' }], [700, { eyes: 'squint', mouth: 'flat' }]], fx: [] }, // tape du pied
  ];

  // Tension pendant le vol (signaux continus proposés par le Narrative Designer)
  R.orbe_descend = [
    { dur: 700, hold: true, tracks: { sy: [k(0, 1), k(200, .84, 'Quad.out')], sx: [k(0, 1), k(200, 1.1, 'Quad.out')], shake: [k(0, 0), k(200, .8)], armR: [k(0, 30), k(200, 130, 'Back.out'), k(450, 115), k(700, 130)] },
      face: [[0, { eyes: 'wide', mouth: 'wavy', brow: 'worried', meche: 'curl' }]], track: true },
  ];
  R.orbe_proche_coeur = [
    { dur: 550, then: 'suivi', tracks: { dx: [k(0, 0), k(120, -8, 'Quad.out'), k(550, 0)], sy: [k(0, 1), k(120, 1.15, 'Back.out'), k(550, 1)], armL: [k(0, 30), k(120, 150, 'Back.out'), k(550, 40)], armR: [k(0, 30), k(120, 150, 'Back.out'), k(550, 40)] },
      face: [[0, { eyes: 'wide', mouth: 'o', brow: 'up' }]], fx: [[0, 'excl']], track: true },
  ];
  // Idles longs comiques (toutes les 12 à 20 s) — Pip
  R.idle_long = [
    { dur: 4200, // L1 « La mouche » : suit une poussière, louche, la gobe, tousse une étincelle
      tracks: { lookX: [k(0, -1), k(800, 1), k(1400, -.5), k(2000, .2)], lookY: [k(0, -1), k(800, -.4), k(1400, -1), k(2000, 0)], rot: [k(0, -8), k(800, 8), k(1400, -6), k(2000, 0), k(2200, 12, 'Back.out'), k(2600, 0)], dy: [k(2000, 0), k(2200, -14, 'Quad.out'), k(2500, 0, 'Bounce.out')], armR: [k(1900, 10), k(2150, 160, 'Back.out'), k(2500, 10)], sy: [k(2600, 1), k(2800, .85), k(2950, 1.15), k(3100, .9), k(3250, 1.1), k(3600, 1)] },
      face: [[0, { eyes: 'open', mouth: 'o' }], [2150, { eyes: 'squint', mouth: 'open' }], [2500, { eyes: 'wide', mouth: 'puff' }], [2800, { eyes: 'closed', mouth: 'open' }], [3600, { eyes: 'happy', mouth: 'grin' }]], fx: [[2900, 'puff', 2], [3150, 'sparkle', 2]] },
    { dur: 4000, // L2 « Le jongleur raté »
      tracks: { orbY: [k(0, -40), k(300, -95, 'Quad.out'), k(600, -40, 'Quad.in'), k(850, -95, 'Quad.out'), k(1100, -40, 'Quad.in'), k(1300, -110, 'Quad.out'), k(1600, -45, 'Quad.in'), k(1601, -1000), k(4000, -1000)], orbX: [k(0, 18), k(600, -18), k(1100, 18), k(1300, 30), k(1600, 0)], armL: [k(0, 60), k(300, 110), k(600, 60), k(1100, 110), k(1300, 60)], armR: [k(0, 110), k(300, 60), k(600, 110), k(1100, 60), k(1300, 110), k(1600, 20)], lookY: [k(0, -1), k(1600, -1), k(1700, 0)], sy: [k(1550, 1), k(1650, .6, 'Quad.out'), k(2100, .65), k(2500, 1, 'Elastic.out')], sx: [k(1550, 1), k(1650, 1.35, 'Quad.out'), k(2100, 1.3), k(2500, 1, 'Elastic.out')], rot: [k(2500, 0), k(2700, -10), k(2900, 10), k(3100, 0)] },
      face: [[0, { eyes: 'open', mouth: 'tongue', brow: 'up' }], [1600, { eyes: 'spiral', mouth: 'wavy', brow: null }], [2700, { eyes: 'closed', mouth: 'flat' }], [3200, { eyes: 'happy', mouth: 'grin' }]], fx: [[1650, 'sparkle', 5]] },
    { dur: 3800, // L3 « L'entraînement » : pompes, s'effondre, bombe le torse
      tracks: { sy: [k(0, 1), k(200, .7), k(400, 1), k(600, .7), k(800, 1), k(950, .7), k(1100, 1), k(1220, .7), k(1340, 1), k(1700, .7), k(2300, .45, 'Quad.in'), k(2900, .45), k(3100, 1.2, 'Back.out'), k(3800, 1)], sx: [k(2300, 1), k(2400, 1.4), k(2900, 1.4), k(3100, .95), k(3800, 1)], armL: [k(0, 90), k(2300, 90), k(2400, 80), k(2900, 80), k(3100, 60), k(3800, 10)], armR: [k(0, 90), k(2300, 90), k(2400, 80), k(2900, 80), k(3100, 60), k(3800, 10)], cheeks: [k(0, 0), k(1700, 1.4), k(3800, 0)] },
      face: [[0, { eyes: 'squint', mouth: 'flat', brow: 'stern' }], [1500, { eyes: 'closed', mouth: 'open' }], [2300, { eyes: 'closed', mouth: 'flat' }], [3000, { eyes: 'open', mouth: 'grin', brow: 'up' }]], fx: [[1600, 'sweat'], [2000, 'sweat']] },
  ];
  R.sommeil = [ // 30 s d'inactivité : s'endort assis, mèche tombante
    { dur: 2400, loop: true, tracks: { sy: [k(0, .9), k(1200, .95), k(2400, .9)], sx: [k(0, 1.08), k(1200, 1.04), k(2400, 1.08)], dy: [k(0, 4), k(2400, 4)], rot: [k(0, 6), k(2400, 6)], mouthScale: [k(0, .7), k(1200, 1), k(2400, .7)] },
      face: [[0, { eyes: 'closed', mouth: 'o', meche: 'down' }]], fx: [[300, 'zzz'], [1500, 'zzz']] },
  ];

  /* ---- Priorités (00-regles-communes.md) : une réaction plus basse n'interrompt pas une plus haute ---- */
  const PRIO = { victoire: 13, echec: 13, final_ralenti: 12, presque: 11, gros_coup: 10, chaine_longue: 10, pouvoir_active: 9, dernier_coeur: 8, dernier_orbe: 7, orbe_recupere: 6, rate: 5, orbe_proche_coeur: 4, orbe_descend: 4, tir_lance: 3, suivi: 2, inactivite: 1, idle_long: 0, sommeil: 0 };

  /* ---- Surcharges de personnalité (gags propres à chaque Astre) ---- */
  const OVERRIDES = {
    bourdon: {
      gros_coup: [{ dur: 1300, tracks: { capY: [k(0, 0), k(150, -50, 'Quad.out'), k(700, -10, 'Bounce.out'), k(900, 0)], capRot: [k(0, 0), k(300, -1.2), k(900, 0, 'Back.out')], dy: [k(0, 0), k(90, -34, 'Quad.out'), k(400, 0, 'Bounce.out')], sx: [k(0, 1), k(90, .8), k(400, 1.2), k(800, 1, 'Elastic.out')], sy: [k(0, 1), k(90, 1.3), k(400, .8), k(800, 1, 'Elastic.out')], shake: [k(0, 3), k(300, 0)], armL: [k(0, 0), k(90, 170, 'Back.out'), k(1000, 120), k(1300, 10)], armR: [k(0, 0), k(90, 170, 'Back.out'), k(1000, 120), k(1300, 10)] },
        face: [[0, { eyes: 'wide', mouth: 'o', brow: 'up' }], [700, { eyes: 'happy', mouth: 'grin' }]], fx: [[0, 'excl']], wake: true }], // sursaute
    },
    horloge: {
      inactivite: [{ dur: 2000, tracks: { armR: [k(0, 10), k(200, 75), k(1800, 75), k(2000, 10)], armL: [k(0, 10), k(300, 60), k(500, 75), k(700, 60), k(900, 75), k(1100, 60), k(1300, 75), k(2000, 10)], rot: [k(0, 0), k(400, -6), k(1600, -6), k(2000, 0)] },
        face: [[0, { eyes: 'open', mouth: 'flat', brow: 'stern' }]], fx: [[300, 'tick', 4]] }], // tapote sa montre
    },
    jumelles: {
      rate: [{ dur: 1500, tracks: { bicker: [k(0, 0), k(200, 1), k(400, 0), k(600, 1), k(800, 0), k(1000, 1), k(1200, 0)], duoRot: [k(0, 0), k(200, 15), k(1200, 15), k(1500, 0)], shake: [k(0, 1), k(1200, 1), k(1300, 0)] },
        face: [[0, { eyes: 'squint', mouth: 'open', brow: 'stern' }], [1200, { eyes: 'closed', mouth: 'flat', brow: null }]], fx: [[200, 'puff', 3]] }], // se chamaillent
    },
    mousse: {
      gros_coup: [{ dur: 1200, tracks: { dx: [k(0, 0), k(150, 22, 'Quad.out'), k(700, 22), k(1000, 0, 'Back.out')], sx: [k(0, 1), k(150, .7), k(700, .7), k(1000, 1, 'Elastic.out')], alpha: [k(0, 1), k(150, .5), k(700, .5), k(1000, 1)] },
        face: [[0, { eyes: 'wide', mouth: 'o' }], [700, { eyes: 'happy', mouth: 'smile' }]], fx: [[800, 'sparkle', 3]] }], // se cache puis ressort, ravie
    },
    volte: {
      orbe_recupere: [{ dur: 900, tracks: { rot: [k(0, 0), k(500, -360, 'Back.out'), k(501, 0)], dy: [k(0, 0), k(250, -24, 'Quad.out'), k(500, 0, 'Bounce.out')], armR: [k(500, 10), k(650, 120, 'Back.out'), k(900, 120)] },
        face: [[0, { eyes: 'closed', mouth: 'grin', brow: 'cocky' }], [600, { eyes: 'squint', mouth: 'grin', brow: 'cocky' }]], fx: [[500, 'sparkle', 4]] }], // salto + pose de frimeur
    },
  };

  /* ---- Boucles d'attente (idle) par personnalité ---- */
  function idleState(d, t, st) {
    const id = d.idle, tp = d.tempo;
    const ph = t / id.bobMs * Math.PI * 2;
    st.dy += Math.sin(ph) * id.bob * -1;
    st.sy *= 1 + Math.sin(ph) * .025; st.sx *= 1 - Math.sin(ph) * .02;
    if (id.fidget) { st.rot += Math.sin(t / 310) * 4; st.armR += (Math.sin(t / 180) > .7 ? 40 : 0); st.lookX = Math.sin(t / 1300) * .9; }
    if (id.sleep) { st.eyes = 'closed'; st.mouth = 'o'; st.mouthScale = .7 + Math.sin(ph) * .2; st.sy *= 1 + Math.sin(ph) * .04; st._zzz = true; }
    if (id.bicker) { st.duoLook = Math.sin(t / 2000) > .6; }
    if (id.trick) { const c = (t % 6000) / 6000; if (c > .85) st.rot += (c - .85) / .15 * 360; st.brow = 'cocky'; }
    if (id.shy) { const c = Math.sin(t / 2500); st.dx += c > .5 ? 8 : 0; st.lookX = c > .5 ? -1 : .3; }
    if (id.tick) { st.clockT = Math.floor(t / 1000) * Math.PI / 30 * 5; st.handA = Math.floor(t / 1000) % 2 ? .1 : -.1; }
    if (id.pace) { st.dx += Math.sin(t / 700) * 6; st.rot += Math.cos(t / 700) * 5; st.bellT = t / 90; }
    if (id.dream) { st.rot += Math.sin(t / 1800) * 6; st.mouth = 'smile'; st._notes = true; }
    if (id.breathe) { const b = (Math.sin(t / 1300) + 1) / 2; st.sx *= 1 + b * .05; st.sy *= 1 + b * .05; st.glow = .3 + b * .5; st.mouth = 'o'; st.mouthScale = .6; }
    return st;
  }

  /* ======================================================================
     6. CONTRÔLEUR : un Astre vivant
     ====================================================================== */
  class AstreActor {
    constructor(key) {
      this.key = key; this.d = ASTRES[key];
      this.reaction = null; this.rStart = 0; this.last = {};
      this.nextBlink = 1000; this.blinkT = -1;
      this.fx = []; this.target = null; // target = {x,y} position de l'orbe, normalisée -1..1
      this.face = { eyes: 'open', mouth: 'smile', brow: this.d.eyes.brow || null };
    }
    pick(ev) {
      const list = (OVERRIDES[this.key] && OVERRIDES[this.key][ev]) || R[ev];
      if (!list) return null;
      let i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && i === this.last[ev]) i = (i + 1) % list.length; // jamais deux fois la même variante
      this.last[ev] = i; return list[i];
    }
    trigger(ev, now) {
      if (ev === 'cristal_touche' || ev === 'coeur_touche') this.exc = Math.min(1, (this.exc || 0) + (ev === 'coeur_touche' ? .2 : .12));
      const cur = this.reaction;
      if (cur && !cur.micro && (PRIO[ev] ?? 0) < (PRIO[this.rEv] ?? 0) && !cur.loop && !cur.hold && PRIO[ev] !== undefined) return;
      const r = this.pick(ev); if (!r) return;
      if (r.micro && this.reaction && !this.reaction.micro) { this.micro = { r, start: now }; return; }
      this.reaction = r; this.rStart = now; this.rEv = ev;
      this.firedFx = new Set();
      if (r.wake) this.awake = now;
    }
    sample(r, el, base) {
      const out = {};
      const tp = this.d.tempo, ampK = this.d.amp;
      for (const p in r.tracks) {
        const keys = r.tracks[p];
        let v = keys[0][1];
        if (el >= keys[keys.length - 1][0]) v = keys[keys.length - 1][1];
        else for (let i = 0; i < keys.length - 1; i++) {
          const a = keys[i], b = keys[i + 1];
          if (el >= a[0] && el < b[0]) { v = a[1] + (b[1] - a[1]) * EASE[b[2]]((el - a[0]) / (b[0] - a[0])); break; }
        }
        // amplitude selon la personnalité (positions, pas les angles des bras)
        if (p === 'dy' || p === 'dx' || p === 'shake') v *= ampK;
        if (p === 'sx' || p === 'sy') v = 1 + (v - 1) * ampK;
        out[p] = v;
      }
      return out;
    }
    update(now, dt) {
      const d = this.d;
      const st = { x: 0, y: 0, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, glow: 0, shake: 0, shakeX: 0, armL: 10, armR: 10, cheeks: 0, mouthScale: 1, alpha: 1, lookX: 0, lookY: 0, blink: 0, t: now, bicker: 0, duoRot: 0, fan: d.fan ? .45 : 0, ...this.face };
      let inReaction = false;
      if (this.reaction) {
        const r = this.reaction;
        let el = (now - this.rStart) * d.tempo;
        if (d.mech) el = Math.floor(el / 90) * 90; // mouvements saccadés d'horloge
        if (r.loop) el = el % r.dur;
        if (!r.loop && !r.hold && el > r.dur) {
          const nxt = r.then; this.reaction = null;
          if (nxt) this.trigger(nxt, now);
        } else {
          if (r.hold) el = Math.min(el, r.dur);
          Object.assign(st, this.sample(r, el));
          let f = null; for (const [t, v] of r.face) if (el >= t) f = v;
          if (f) { st.eyes = f.eyes || st.eyes; st.mouth = f.mouth || st.mouth; if ('brow' in f) st.brow = f.brow; if (f.meche) st.meche = f.meche; if ('shades' in f) st.shades = f.shades; if ('mood' in f) st.mood = f.mood; if (f.zzz) st._zzz = true; }
          (r.fx || []).forEach(([t, type, n], i) => {
            const key = (r.loop ? Math.floor((now - this.rStart) * d.tempo / r.dur) : 0) + ':' + i;
            if (el >= t && !this.firedFx.has(key)) { this.firedFx.add(key); this.emit(type, n || 1); }
          });
          inReaction = true;
          const joy = ['gros_coup', 'chaine_longue', 'victoire', 'coeur_touche'].includes(this.rEv), sad = ['rate', 'echec'].includes(this.rEv);
          if (d.shades && joy) st.shades = true;                  // Volte sort ses lunettes
          if (d.seatCloud) st.mood = joy ? 'joy' : sad ? 'rain' : null; // nuage-humeur de Nuage-Lune
          if (r.track && this.target) {
            st.lookX = this.target.x; st.lookY = this.target.y;
            st.rot += this.target.x * 12;                 // se penche vers l'orbe (corps entier)
            st.sy *= 1 - this.target.y * .08; st.sx *= 1 + this.target.y * .05; // s'étire quand l'orbe monte
            const e = this.exc || 0;                       // jauge d'excitation : amplitude du vol
            if (e > .05) { st.dy -= Math.abs(Math.sin(now / (190 - e * 90))) * e * 22 * d.amp; st.glow = Math.max(st.glow, e * .8); st.cheeks = Math.max(st.cheeks, e); }
            if (e > .7 && Math.random() < dt / 120) this.emit('sparkle', 1);
          }
        }
      }
      if (!inReaction) {
        idleState(d, now, st);
        if (d.idle.sleep && this.awake && now - this.awake < 6000) { st.eyes = 'open'; st._zzz = false; st.mouth = 'smile'; }
        if (st._zzz && Math.random() < dt / 1400) this.emit('zzz', 1);
        if (st._notes && Math.random() < dt / 1800) this.emit('note', 1);
        if (d.idle.tick) st.clockT = now / 400;
        if (d.idle.pace) st.bellT = now / 90;
      } else {
        if (d.idle.tick) st.clockT = now / 400;
        if (d.bell) st.bellT = now / 60;
      }
      // micro-réaction superposée
      if (this.micro) {
        const el = (now - this.micro.start) * d.tempo;
        if (el > this.micro.r.dur) this.micro = null;
        else { const m = this.sample(this.micro.r, el); for (const p in m) { if (p === 'sx' || p === 'sy') st[p] *= m[p]; else st[p] += m[p] - (p.startsWith('arm') ? 30 : 0); } }
      }
      this.exc = Math.max(0, (this.exc || 0) - dt / 4000); // la jauge redescend doucement
      // clignement (toujours, sauf yeux déjà fermés/joyeux)
      if (now > this.nextBlink) { this.blinkT = now; this.nextBlink = now + d.idle.blinkMin + Math.random() * (d.idle.blinkMax - d.idle.blinkMin); }
      const be = now - this.blinkT; if (be >= 0 && be < 140) st.blink = Math.sin(be / 140 * Math.PI);
      if (st.shake) st.shakeX = (Math.random() * 2 - 1) * st.shake;
      // particules
      this.fx = this.fx.filter(p => (p.life -= dt) > 0);
      this.fx.forEach(p => { p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += (p.g || 0) * dt / 16; p.rot += (p.vr || 0); });
      this.st = st; return st;
    }
    emit(type, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
        const base = { type, x: 0, y: -10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 700, max: 700, rot: 0, vr: 0 };
        if (type === 'burst') { base.vx *= 2.2; base.vy *= 2.2; base.life = base.max = 600; }
        if (type === 'confetti') { base.vy = -3 - Math.random() * 3; base.vx = (Math.random() - .5) * 5; base.g = .18; base.life = base.max = 1200; base.vr = .2; base.c = ['#FFB23F', '#6FCBFF', '#FF5FA2', '#4FF0A8', '#FFF6E0'][i % 5]; }
        if (type === 'zzz') { Object.assign(base, { x: 26, y: -40, vx: .35, vy: -.5, life: 1800, max: 1800 }); }
        if (type === 'note') { Object.assign(base, { x: 24, y: -36, vx: .4, vy: -.6, life: 1500, max: 1500 }); }
        if (type === 'sweat') { Object.assign(base, { x: 30, y: -30, vx: .3, vy: 0, g: .08, life: 900, max: 900 }); }
        if (type === 'sigh') { Object.assign(base, { x: 10, y: 14, vx: .8, vy: .2, life: 900, max: 900 }); }
        if (type === 'excl' || type === 'tick') { Object.assign(base, { x: 30 + i * 6, y: -52, vx: 0, vy: -.25, life: 800, max: 800 }); }
        if (type === 'ring') { Object.assign(base, { x: 0, y: 0, vx: 0, vy: 0, life: 600, max: 600 }); }
        if (type === 'whoosh') { Object.assign(base, { x: 0, y: -50, vx: 0, vy: -2, life: 400, max: 400 }); }
        if (type === 'puff') { base.y = -20; }
        this.fx.push(base);
      }
    }
    draw(ctx, x, y, px) {
      const st = this.st; if (!st) return;
      st.x = x; st.y = y;
      drawAstre(ctx, this.d, st, px);
      const sc = px * this.d.size;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      this.fx.forEach(p => drawFx(ctx, p));
      ctx.restore();
    }
  }

  function drawFx(ctx, p) {
    const a = p.life / p.max;
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.5); ctx.translate(p.x * 10, p.y + (p.type === 'zzz' || p.type === 'note' ? 0 : 0));
    switch (p.type) {
      case 'sparkle': case 'burst':
        ctx.translate(p.x * 2, 0); ctx.fillStyle = WHITE; ctx.beginPath(); roundedPoly(ctx, starPts(4, 6 * a + 2, 1.5), .5); ctx.fill(); break;
      case 'confetti': ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-2.5, -1.5, 5, 3); break;
      case 'zzz': ctx.fillStyle = '#D6DCFF'; ctx.font = '600 12px Fredoka, sans-serif'; ctx.fillText('z', 0, 0); break;
      case 'note': ctx.fillStyle = '#D6DCFF'; ctx.font = '14px sans-serif'; ctx.fillText('♪', 0, 0); break;
      case 'sweat': ctx.fillStyle = '#8FE3FF'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(4, 1, 0, 3); ctx.quadraticCurveTo(-4, 1, 0, -5); ctx.fill(); break;
      case 'sigh': ctx.fillStyle = 'rgba(244,241,255,.6)'; ctx.beginPath(); ctx.arc(0, 0, 4 + (1 - a) * 5, 0, Math.PI * 2); ctx.fill(); break;
      case 'puff': ctx.fillStyle = 'rgba(244,241,255,.7)'; ctx.beginPath(); ctx.arc(0, 0, 3 + (1 - a) * 4, 0, Math.PI * 2); ctx.fill(); break;
      case 'excl': ctx.fillStyle = '#FFF6E0'; ctx.font = '700 18px Fredoka, sans-serif'; ctx.fillText('!', 0, 0); break;
      case 'tick': ctx.fillStyle = '#E8D9B0'; ctx.font = '700 9px Nunito, sans-serif'; ctx.fillText('tic', 0, 0); break;
      case 'ring': ctx.strokeStyle = '#4FF0A8'; ctx.lineWidth = 3 * a; ctx.beginPath(); ctx.arc(-p.x * 10, 0, 30 + (1 - a) * 40, 0, Math.PI * 2); ctx.stroke(); break;
      case 'whoosh': ctx.strokeStyle = 'rgba(255,246,224,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, 10); ctx.moveTo(8, 0); ctx.lineTo(8, 10); ctx.stroke(); break;
    }
    ctx.restore();
  }

  global.AstresRig = { ASTRES, REACTIONS: R, OVERRIDES, PRIO, EASE, AstreActor, drawAstre };
})(typeof window !== 'undefined' ? window : globalThis);
