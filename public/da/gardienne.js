/* ==========================================================================
   RICOCHET CÉLESTE · La Gardienne (personnage joueur) · rig de référence
   Même principe que astres-rig.js : canvas 2D, parties articulables, 100 unités
   de haut, pieds en (0,0). Silencieuse : tout passe par la pose et le visage.
   ========================================================================== */
(function (global) {
  'use strict';
  const C = {
    coat: '#232A5C', coatLight: '#2E3870', coatShade: '#161C45', lining: '#B9A6FF',
    skin: '#F2D3C2', skinShade: '#DDB3A0', cheek: '#FF8FB1', hair: '#3B2E6E', hairLight: '#5A4A94',
    scarf: '#FFF6E0', scarfShade: '#E8D9B0', ink: '#1B2350', boots: '#141B3D',
    lanternFrame: '#8C93C9', lanternLight: '#FFF6E0', glow: '255,230,168',
  };
  /* st (toutes optionnelles) :
     facing : 'front' | 'back' · pose : 'stand' | 'sit'
     eyes   : open | closed | happy | wide | sleepy · mouth : smile | o | flat | open | grin
     armL, armR : angle en degrés (0 = le long du corps, 90 = horizontal, 170 = levé)
     lantern : 'hand' | 'belt' | 'none' · lanternGlow : 0..1.5
     headTilt (deg), bodyTilt (deg), breath (0..1), sy (squash global), lookX (-1..1)
     shoulders (0..1, épaules qui se soulèvent quand elle rit), blink (0..1) */
  function draw(ctx, x, y, px, st) {
    st = Object.assign({ facing: 'front', pose: 'stand', eyes: 'open', mouth: 'smile', armL: 8, armR: 8, lantern: 'belt', lanternGlow: 1, headTilt: 0, bodyTilt: 0, breath: 0, sy: 1, lookX: 0, shoulders: 0, blink: 0 }, st);
    const back = st.facing === 'back', sit = st.pose === 'sit';
    ctx.save(); ctx.translate(x, y); ctx.scale(px, px * st.sy);
    // ombre
    ctx.fillStyle = 'rgba(11,16,38,.45)'; ctx.beginPath(); ctx.ellipse(0, 0, 24, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(st.bodyTilt * Math.PI / 180);
    const b = 1 + st.breath * .03, sh = -st.shoulders * 3;
    if (sit) ctx.translate(0, 18);
    // halo de la lanterne (derrière)
    const lp = lanternPos(st);
    if (st.lantern !== 'none' && st.lanternGlow > 0) {
      const g = ctx.createRadialGradient(lp[0], lp[1], 2, lp[0], lp[1], 46 * st.lanternGlow);
      g.addColorStop(0, `rgba(${C.glow},${.55 * Math.min(1, st.lanternGlow)})`); g.addColorStop(1, `rgba(${C.glow},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lp[0], lp[1], 46 * st.lanternGlow, 0, Math.PI * 2); ctx.fill();
    }
    // bottes
    if (!sit) { ctx.fillStyle = C.boots; [-8, 8].forEach(fx => { ctx.beginPath(); ctx.ellipse(fx, -3, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); }); }
    // bras arrière (côté opposé quand de face : on dessine les deux derrière le manteau)
    // manteau : cloche
    ctx.save(); ctx.scale(b, b);
    ctx.fillStyle = C.coat; ctx.beginPath();
    ctx.moveTo(-12, -50 + sh); ctx.quadraticCurveTo(-20, -30, -27, -4); ctx.quadraticCurveTo(0, 2, 27, -4); ctx.quadraticCurveTo(20, -30, 12, -50 + sh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.coatLight; ctx.beginPath(); ctx.moveTo(-10, -48 + sh); ctx.quadraticCurveTo(-16, -30, -20, -6); ctx.lineTo(-12, -5); ctx.quadraticCurveTo(-9, -30, -6, -48 + sh); ctx.fill();
    if (!back) { // pans du manteau + doublure lavande + boutons-étoiles
      ctx.fillStyle = C.lining; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(-5, -3); ctx.lineTo(5, -3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.scarf; [-38, -30].forEach(by => { ctx.beginPath(); ctx.arc(0, by + sh * .5, 1.6, 0, Math.PI * 2); ctx.fill(); });
    } else { ctx.strokeStyle = C.coatShade; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(0, -4); ctx.stroke(); }
    ctx.restore();
    arm(ctx, -1, st.armL, sh, back);
    arm(ctx, 1, st.armR, sh, back);
    // écharpe
    ctx.fillStyle = C.scarf; ctx.beginPath(); ctx.ellipse(0, -50 + sh, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.scarfShade; ctx.beginPath(); ctx.moveTo(back ? -6 : 6, -48 + sh); ctx.quadraticCurveTo(back ? -12 : 12, -40, back ? -9 : 9, -32 + Math.sin(st.breath * 6) * 1); ctx.lineTo(back ? -4 : 4, -33); ctx.closePath(); ctx.fill();
    // tête
    ctx.save(); ctx.translate(0, -66 + sh); ctx.rotate(st.headTilt * Math.PI / 180);
    // cheveux arrière
    ctx.fillStyle = C.hair; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
    if (back) {
      ctx.fillStyle = C.hairLight; ctx.beginPath(); ctx.ellipse(-5, -7, 7, 4, -.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.hair; ctx.beginPath(); ctx.arc(0, -19, 5, 0, Math.PI * 2); ctx.fill(); // chignon
      ctx.fillStyle = '#FFE45C'; ctx.beginPath(); star(ctx, 5, -19, 3.4, 1.5); ctx.fill(); // épingle-étoile
    } else {
      ctx.fillStyle = C.skin; ctx.beginPath(); ctx.ellipse(st.lookX * 2, 3, 14, 13, 0, 0, Math.PI * 2); ctx.fill();
      // frange
      ctx.fillStyle = C.hair; ctx.beginPath(); ctx.moveTo(-16, -2); ctx.quadraticCurveTo(-10, -16, 0, -15); ctx.quadraticCurveTo(10, -16, 16, -2); ctx.quadraticCurveTo(8, -9, 2, -6); ctx.quadraticCurveTo(-6, -10, -16, -2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -19, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFE45C'; ctx.beginPath(); star(ctx, 5, -19, 3.4, 1.5); ctx.fill();
      face(ctx, st);
    }
    ctx.restore();
    ctx.restore();
  }
  function face(ctx, st) {
    const lx = st.lookX * 3, I = C.ink;
    ctx.fillStyle = C.cheek; ctx.globalAlpha = .4; [-8, 8].forEach(cx => { ctx.beginPath(); ctx.ellipse(cx + lx, 7, 3.2, 2, 0, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;
    ctx.strokeStyle = I; ctx.fillStyle = I; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    [-5.5, 5.5].forEach(ex => {
      ctx.beginPath();
      const e = st.blink > .5 ? 'closed' : st.eyes;
      if (e === 'closed') { ctx.arc(ex + lx, 2, 2.6, Math.PI * .15, Math.PI * .85); ctx.stroke(); }
      else if (e === 'happy') { ctx.arc(ex + lx, 3.5, 2.6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      else if (e === 'sleepy') { ctx.moveTo(ex + lx - 2.5, 3); ctx.lineTo(ex + lx + 2.5, 3); ctx.stroke(); }
      else { const r = e === 'wide' ? 2.6 : 2.1; ctx.ellipse(ex + lx, 3, r, r * 1.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + lx - .7, 2, .7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = I; }
    });
    ctx.beginPath();
    const m = st.mouth, my = 9.5;
    if (m === 'o') { ctx.ellipse(lx, my + .5, 1.5, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (m === 'flat') { ctx.moveTo(lx - 2.5, my); ctx.lineTo(lx + 2.5, my); ctx.stroke(); }
    else if (m === 'open' || m === 'grin') { ctx.moveTo(lx - 3.5, my - .5); ctx.quadraticCurveTo(lx, my + (m === 'open' ? 6 : 3.5), lx + 3.5, my - .5); ctx.closePath(); ctx.fill(); }
    else { ctx.arc(lx, my - 2.5, 3, Math.PI * .25, Math.PI * .75); ctx.stroke(); }
  }
  function arm(ctx, side, ang, sh, back) {
    ctx.save(); ctx.translate(side * 13, -46 + sh); ctx.rotate(-side * ang * Math.PI / 180);
    ctx.fillStyle = C.coatShade; ctx.beginPath(); ctx.ellipse(.8, 11.5, 5.4, 12.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = C.coatLight; ctx.beginPath(); ctx.ellipse(0, 11, 5, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, 23, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function lanternPos(st) {
    if (st.lantern === 'hand') { const a = st.armR * Math.PI / 180; return [13 + Math.sin(a) * 25, -46 + Math.cos(a) * 25]; }
    return [16, -22];
  }
  function drawLantern(ctx, x, y, px, glow, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(px, px);
    ctx.fillStyle = C.lanternFrame; ctx.fillRect(-5, -10, 10, 2); ctx.fillRect(-5, 6, 10, 2);
    ctx.beginPath(); ctx.arc(0, -12, 3, Math.PI, 0); ctx.strokeStyle = C.lanternFrame; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = C.lanternLight; ctx.globalAlpha = .6 + .4 * Math.min(1, glow); ctx.beginPath(); ctx.ellipse(0, -1, 4.2, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function star(ctx, x, y, R, r) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
  // la lanterne est dessinée au-dessus du corps : on enveloppe draw()
  function drawGardienne(ctx, x, y, px, st) {
    draw(ctx, x, y, px, st);
    st = Object.assign({ lantern: 'belt', armR: 8, lanternGlow: 1, sy: 1, pose: 'stand', bodyTilt: 0 }, st);
    if (st.lantern === 'none') return;
    const lp = lanternPos(st);
    ctx.save(); ctx.translate(x, y); ctx.scale(px, px * st.sy); ctx.rotate(st.bodyTilt * Math.PI / 180); if (st.pose === 'sit') ctx.translate(0, 18);
    drawLantern(ctx, lp[0], lp[1] + 8, 1, st.lanternGlow);
    ctx.restore();
  }
  global.Gardienne = { COLORS: C, drawGardienne, drawLantern };
})(typeof window !== 'undefined' ? window : globalThis);
