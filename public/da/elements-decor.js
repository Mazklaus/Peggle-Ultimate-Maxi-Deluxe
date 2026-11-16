/* ==========================================================================
   RICOCHET CÉLESTE · Éléments de décor (jalon 2) · rendu de référence
   Règle DA : un élément ne change JAMAIS la couleur ni la forme du cristal qu'il
   porte. Il ajoute un SUPPORT visible (rail, piste, anneau, onde, contour) dans
   des tons neutres (lavande #B9A6FF / blanc chaud #FFF6E0 / ardoise #3A4170).
   Canvas 2D, unités = pixels à 720p. Chaque fonction : draw(ctx, x, y, t, opts).
   ========================================================================== */
(function (global) {
  'use strict';
  const C = { coeur: '#FFB23F', coeurL: '#FFD98A', coeurD: '#C9781A', std: '#6FCBFF', stdL: '#BDE9FF', stdD: '#2F86C4',
    bonus: '#FF5FA2', pouv: '#4FF0A8', track: 'rgba(185,166,255,.45)', trackSoft: 'rgba(185,166,255,.22)', warm: '#FFF6E0',
    slate: '#3A4170', slateL: '#5A63A0', slateD: '#262C55', ink: '#1B2350' };

  /* --- cristaux (mêmes formes que la direction visuelle) --- */
  function crystal(ctx, x, y, kind = 'std', a = 1, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a;
    if (kind === 'coeur') { ctx.fillStyle = C.coeur; poly(ctx, [[0, -12], [9, 0], [0, 12], [-9, 0]]); ctx.fill(); ctx.fillStyle = C.coeurL; poly(ctx, [[0, -12], [9, 0], [0, 0]]); ctx.fill(); ctx.fillStyle = C.coeurD; poly(ctx, [[0, 12], [-9, 0], [0, 0]]); ctx.fill(); }
    else if (kind === 'bonus') { ctx.fillStyle = C.bonus; poly(ctx, [[0, -12], [3.5, -3.5], [12, 0], [3.5, 3.5], [0, 12], [-3.5, 3.5], [-12, 0], [-3.5, -3.5]]); ctx.fill(); }
    else if (kind === 'pouv') { ctx.fillStyle = C.pouv; poly(ctx, [0, 1, 2, 3, 4, 5].map(i => [Math.cos(i * Math.PI / 3 - Math.PI / 2) * 11, Math.sin(i * Math.PI / 3 - Math.PI / 2) * 11])); ctx.fill(); }
    else { ctx.fillStyle = C.std; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.fillStyle = C.stdL; ctx.globalAlpha = a * .55; ctx.beginPath(); ctx.arc(0, 0, 9, Math.PI, 0); ctx.fill(); }
    ctx.restore();
  }
  function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.closePath(); }

  /* 1. ROTATION : anneau-rail en pointillés + moyeu + chevrons de sens.
        Les cristaux restent droits (pas de rotation propre) pour garder la lecture. */
  function rotation(ctx, x, y, t, o = {}) {
    const r = o.r || 70, n = o.n || 6, speed = o.speed || .6, dir = o.dir || 1, kinds = o.kinds || ['std', 'coeur', 'std', 'std', 'coeur', 'std'];
    const a0 = dir * t / 1000 * speed;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = C.trackSoft; ctx.lineWidth = 2; ctx.setLineDash([2, 7]); ctx.lineDashOffset = -dir * t / 40; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    // chevrons de sens (3, toujours lisibles)
    ctx.strokeStyle = C.track; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const a = a0 + Math.PI / n + i * 2 * Math.PI / 3, px = Math.cos(a) * r, py = Math.sin(a) * r, tx = -Math.sin(a) * dir, ty = Math.cos(a) * dir, nx = Math.cos(a), ny = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(px - tx * 4 + nx * 4, py - ty * 4 + ny * 4); ctx.lineTo(px + tx * 3, py + ty * 3); ctx.lineTo(px - tx * 4 - nx * 4, py - ty * 4 - ny * 4); ctx.stroke(); }
    // moyeu
    ctx.fillStyle = C.slate; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.fillStyle = C.slateL; ctx.beginPath(); ctx.arc(-2, -2, 4, 0, 7); ctx.fill();
    for (let i = 0; i < n; i++) { const a = a0 + i * 2 * Math.PI / n; crystal(ctx, Math.cos(a) * r, Math.sin(a) * r, kinds[i % kinds.length]); }
    ctx.restore();
  }

  /* 2. ORBITE : un cristal satellite tourne autour d'un pivot-étoile, sur une ellipse tracée.
        Traînée courte derrière lui pour lire la vitesse. */
  function orbite(ctx, x, y, t, o = {}) {
    const rx = o.rx || 60, ry = o.ry || 36, speed = o.speed || 1.1, kind = o.kind || 'coeur';
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = C.trackSoft; ctx.lineWidth = 1.6; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.warm; ctx.globalAlpha = .9; poly(ctx, [[0, -7], [2, -2], [7, 0], [2, 2], [0, 7], [-2, 2], [-7, 0], [-2, -2]]); ctx.fill(); ctx.globalAlpha = 1;
    const a = t / 1000 * speed;
    const n = Math.max(1, Math.min(4, o.n || 1));   // 1 à 4 cristaux répartis sur l'anneau (repère LD : anneau 40-90 px)
    for (let j = 0; j < n; j++) { const aj = a + j * Math.PI * 2 / n;
      for (let i = 5; i >= 1; i--) { const b = aj - i * .09; ctx.fillStyle = `rgba(185,166,255,${.12 * (6 - i) / 5})`; ctx.beginPath(); ctx.arc(Math.cos(b) * rx, Math.sin(b) * ry, 7 - i, 0, 7); ctx.fill(); }
      crystal(ctx, Math.cos(aj) * rx, Math.sin(aj) * ry, Array.isArray(kind) ? kind[j % kind.length] : kind); }
    ctx.restore();
  }

  /* 3. PORTAILS : anneaux en paire, entrée et sortie identiques. Les paires se distinguent par
        le NOMBRE de petites étoiles autour (1, 2, 3), jamais par la couleur. Tourbillon qui aspire. */
  function portail(ctx, x, y, t, o = {}) {
    const pair = o.pair || 1, r = o.r || 18, flash = o.flash || 0;
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r); g.addColorStop(0, 'rgba(11,16,38,1)'); g.addColorStop(1, 'rgba(59,46,110,.9)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = C.track; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); const s = (t / 900 + i / 3) % 1; ctx.arc(0, 0, r * (1 - s) * .95, t / 300 + i * 2, t / 300 + i * 2 + 2.4); ctx.globalAlpha = s; ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.strokeStyle = C.warm; ctx.lineWidth = 3 + flash * 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    ctx.fillStyle = C.warm; for (let i = 0; i < pair; i++) { const a = -Math.PI / 2 + (i - (pair - 1) / 2) * .5; poly(ctx, [0, 1, 2, 3, 4, 5, 6, 7].map(k => { const rr = k % 2 ? 1.4 : 4; const b = k * Math.PI / 4; return [Math.cos(a) * (r + 8) + Math.cos(b) * rr, Math.sin(a) * (r + 8) + Math.sin(b) * rr]; })); ctx.fill(); }
    if (flash > 0) { ctx.globalAlpha = flash; const f = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2); f.addColorStop(0, 'rgba(255,246,224,.9)'); f.addColorStop(1, 'rgba(255,246,224,0)'); ctx.fillStyle = f; ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  /* 4. AIMANT (« Lentille d'attraction ») : petit astre-lentille neutre dont les ondes se
        resserrent vers le centre en continu = il attire. Le rayon d'effet est tracé en pointillé. */
  function aimant(ctx, x, y, t, o = {}) {
    const R = o.R || 80, pulse = o.pulse || 0;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = C.trackSoft; ctx.setLineDash([2, 8]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 3; i++) { const s = 1 - ((t / 1400 + i / 3) % 1); ctx.strokeStyle = `rgba(255,246,224,${.35 * (1 - s) + .05})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 14 + s * (R - 14), 0, 7); ctx.stroke(); }
    ctx.fillStyle = C.slate; ctx.beginPath(); ctx.arc(0, 0, 13 + pulse * 3, 0, 7); ctx.fill();
    ctx.fillStyle = C.warm; ctx.beginPath(); ctx.arc(0, 0, 6 + pulse * 2, 0, 7); ctx.fill();
    ctx.strokeStyle = C.slateL; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13 + pulse * 3, 0, 7); ctx.stroke();
    ctx.restore();
  }

  /* 5. RÉGÉNÉRANT : cristal normal avec une « graine » (petit point lavande) à l'intérieur.
        Brisé, il laisse son CONTOUR en pointillé qui se remplit comme une horloge, puis réapparaît
        avec un pop (Back.out). p = 0 (vient d'être brisé) .. 1 (reformé). */
  function regenerant(ctx, x, y, t, o = {}) {
    const kind = o.kind || 'std', p = o.p ?? 1;
    ctx.save(); ctx.translate(x, y);
    if (p >= 1) { crystal(ctx, 0, 0, kind); ctx.fillStyle = '#B9A6FF'; ctx.beginPath(); ctx.arc(0, 0, 2.6 + Math.sin(t / 300) * .6, 0, 7); ctx.fill(); }
    else {
      ctx.strokeStyle = C.track; ctx.lineWidth = 1.6; ctx.setLineDash([2, 4]);
      if (kind === 'coeur') { poly(ctx, [[0, -12], [9, 0], [0, 12], [-9, 0]]); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.strokeStyle = C.warm; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
      if (p > .85) { const s = (p - .85) / .15; crystal(ctx, 0, 0, kind, s, .6 + s * .4); }
    }
    ctx.restore();
  }

  /* 6. MUR (incassable, kind "wall") : ardoise mate, sans lueur, arête claire en haut.
        Formes : rond (r 9) ou barre arrondie (rampes, entonnoirs). Jamais brillant. */
  function mur(ctx, x, y, t, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.angle || 0);
    const w = o.w || 0, h = 12;
    ctx.fillStyle = C.slateD; ctx.beginPath(); w ? ctx.roundRect(-w / 2 + 1, -h / 2 + 2, w, h, 6) : ctx.arc(1, 2, 9, 0, 7); ctx.fill();
    ctx.fillStyle = C.slate; ctx.beginPath(); w ? ctx.roundRect(-w / 2, -h / 2, w, h, 6) : ctx.arc(0, 0, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = C.slateL; ctx.lineWidth = 2; ctx.beginPath(); if (w) { ctx.moveTo(-w / 2 + 6, -h / 2 + 1.5); ctx.lineTo(w / 2 - 6, -h / 2 + 1.5); } else ctx.arc(0, 0, 7, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
    ctx.restore();
  }

  global.ElementsDecor = { COLORS: C, crystal, rotation, orbite, portail, aimant, regenerant, mur };
})(typeof window !== 'undefined' ? window : globalThis);
