/* ==========================================================================
   RICOCHET CÉLESTE · La Grande Veilleuse · rendu de référence
   Dépend de astres-rig.js (forme de base ASTRES.veilleuse).
   États : 'endormie' (début du jeu) · 'fatiguee' (ch.6-7 : cernes, pulsation
   irrégulière) · 'eveillee' (final) · wake 0..1 interpole endormie -> éveillée.
   Options : cap (bonnet de Bourdon, fin du final), yawn 0..1 (bâillement),
   asleep (rendormie mais lumineuse, fin du final), lean (inclinaison en degrés).
   ========================================================================== */
(function (global) {
  'use strict';
  const { ASTRES, drawAstre } = global.AstresRig;
  const SLEEP = { color: '#E9D8B4', light: '#F6EBD2', shade: '#C9AF82' };   // lumière assoupie, un peu ternie
  const AWAKE = { color: '#FFF0D0', light: '#FFFFFF', shade: '#F2C98A' };   // lumière pleine
  const lerpC = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t).toString(16).padStart(2, '0')).join('');

  function pulse(t, state) {
    if (state === 'fatiguee') { const p = Math.sin(t / 1300) + .5 * Math.sin(t / 470 + 1); return Math.max(0, Math.min(1, (p + 1.5) / 3)); } // irrégulière
    return (Math.sin(t / 1300) + 1) / 2;
  }

  function drawVeilleuse(ctx, x, y, px, o) {
    o = Object.assign({ state: 'endormie', t: 0, wake: null, yawn: 0, cap: false, lookX: 0, asleep: false, lean: 0 }, o);
    ctx.save(); if (o.lean) { ctx.translate(x, y); ctx.rotate(o.lean * Math.PI / 180); ctx.translate(-x, -y); }
    const w = o.wake ?? (o.state === 'eveillee' ? 1 : 0);
    const p = pulse(o.t, o.state);
    const S = px * ASTRES.veilleuse.size;
    // halo + couronne de rayons (seulement éveillée)
    const haloR = 62 * S * (1 + p * .06 + w * .5);
    const g = ctx.createRadialGradient(x, y, 4, x, y, haloR);
    g.addColorStop(0, `rgba(255,240,208,${.35 + .25 * p + .3 * w})`); g.addColorStop(.4, `rgba(255,233,194,${.12 + .2 * w})`); g.addColorStop(1, 'rgba(255,233,194,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, haloR, 0, 7); ctx.fill();
    if (w > 0) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(o.t / 8000);
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, L = (i % 2 ? 30 : 48) * S * w; ctx.strokeStyle = `rgba(255,246,224,${.35 * w})`; ctx.lineWidth = (i % 2 ? 1.4 : 2.4) * S; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 54 * S, Math.sin(a) * 54 * S); ctx.lineTo(Math.cos(a) * (54 * S + L), Math.sin(a) * (54 * S + L)); ctx.stroke(); }
      ctx.restore();
    }
    // corps (forme du rig) avec couleur selon l'éveil
    const base = ASTRES.veilleuse;
    const d = Object.assign({}, base, {
      color: lerpC(SLEEP.color, AWAKE.color, w), light: lerpC(SLEEP.light, AWAKE.light, w), shade: lerpC(SLEEP.shade, AWAKE.shade, w),
      eyes: Object.assign({}, base.eyes, { lid: 0 }),
    });
    const sleeping = w < .5 || o.asleep;   // asleep : rendormie mais lumineuse (final)
    const st = { x, y, dx: 0, dy: 0, sx: 1 + p * .04 - o.yawn * .05, sy: 1 + p * .04 + o.yawn * .12, rot: 0, glow: 0, shake: 0, shakeX: 0, armL: 10, armR: 10,
      cheeks: w * .8, mouthScale: o.asleep ? 1 + o.yawn : sleeping ? .55 + p * .25 + o.yawn : 1, alpha: 1, lookX: o.lookX, lookY: 0, blink: 0, t: o.t,
      eyes: o.yawn > .3 ? 'closed' : sleeping ? 'closed' : (w < .8 ? 'sleepy' : 'open'), mouth: o.yawn > .2 ? 'baille' : o.asleep ? 'smile' : sleeping ? 'o' : 'smile', lid: 0, sleepLid: 0 };
    drawAstre(ctx, d, st, px);
    const s = px * base.size, ey = y + base.eyes.y * s, gap = base.eyes.gap * s;
    // cernes (fatiguée)
    if (o.state === 'fatiguee' && w < .5) { ctx.strokeStyle = 'rgba(111,120,184,.55)'; ctx.lineWidth = 1.6 * s; [-1, 1].forEach(k => { ctx.beginPath(); ctx.arc(x + k * gap, ey + 4 * s, 5 * s, Math.PI * .15, Math.PI * .85); ctx.stroke(); }); }
    // ronflement : petite bulle de lumière
    if (sleeping && o.yawn < .2) { const b = p; ctx.strokeStyle = 'rgba(255,246,224,.7)'; ctx.fillStyle = 'rgba(255,246,224,.2)'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.arc(x + 16 * s, y + 10 * s, (2 + b * 7) * s, 0, 7); ctx.fill(); ctx.stroke(); }
    // bonnet de Bourdon (offert à la fin du final)
    if (o.cap) {
      ctx.save(); ctx.translate(x - 4 * s, y - 40 * s); ctx.rotate(.3); ctx.scale(s * .9, s * .9);
      ctx.fillStyle = '#6F78B8'; ctx.beginPath(); ctx.moveTo(-30, 6); ctx.quadraticCurveTo(-6, -40, 34, -18); ctx.quadraticCurveTo(10, -6, 30, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#D6DCFF'; ctx.fillRect(-32, 2, 64, 8); ctx.beginPath(); ctx.arc(36, -18, 6, 0, 7); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }
  global.Veilleuse = { drawVeilleuse };
})(typeof window !== 'undefined' ? window : globalThis);
