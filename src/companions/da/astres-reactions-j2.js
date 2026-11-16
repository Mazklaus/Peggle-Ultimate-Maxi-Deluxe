/* Copie de /mnt/project-files/da/astres/astres-reactions-j2.js (Directeur artistique), 2026-11-16. Ne pas modifier ici : resynchroniser depuis la DA. */
/* ==========================================================================
   RICOCHET CÉLESTE · Réactions complètes des 7 Astres (jalon 2)
   À charger APRÈS astres-rig.js. Alimente AstresRig.OVERRIDES.
   Source : fiches 02 à 08 du Narrative Designer (narrative/astres/).
   Chaque réaction est composée de « gestes » réutilisables (section 1) :
   même format de clés que le rig (t ms, valeur, ease Phaser).
   ========================================================================== */
(function (global) {
  'use strict';
  const { OVERRIDES } = global.AstresRig;

  /* ---------- 1. Gestes réutilisables ---------- */
  const k = (t, v, e) => [t, v, e || 'Sine.inOut'];
  const G = {
    hop: (t, h = 16, d = 360) => ({ dy: [k(t, 0), k(t + d * .45, -h, 'Quad.out'), k(t + d, 0, 'Bounce.out')] }),
    hops: (t, n, h = 14, per = 300) => ({ dy: Array.from({ length: n }).flatMap((_, i) => [k(t + i * per, 0), k(t + i * per + per * .45, -h, 'Quad.out'), k(t + (i + 1) * per, 0, 'Quad.in')]) }),
    heavyHops: (t, n, h = 12, per = 520) => ({ dy: Array.from({ length: n }).flatMap((_, i) => [k(t + i * per, 0), k(t + i * per + per * .5, -h, 'Quad.out'), k(t + (i + 1) * per, 0, 'Quad.in')]), shake: Array.from({ length: n }).flatMap((_, i) => [k(t + (i + 1) * per - 1, 0), k(t + (i + 1) * per, 3), k(t + (i + 1) * per + 150, 0)]) }),
    squash: (t, a = .2, d = 400) => ({ sy: [k(t, 1), k(t + 80, 1 - a, 'Quad.out'), k(t + 200, 1 + a * .6, 'Back.out'), k(t + d, 1, 'Elastic.out')], sx: [k(t, 1), k(t + 80, 1 + a, 'Quad.out'), k(t + 200, 1 - a * .4), k(t + d, 1, 'Elastic.out')] }),
    shrink: (t, s = .7, d = 250, hold = 0) => ({ sx: [k(t, 1), k(t + d, s, 'Quad.out'), k(t + d + hold, s), k(t + d * 2 + hold, 1, 'Back.out')], sy: [k(t, 1), k(t + d, s, 'Quad.out'), k(t + d + hold, s), k(t + d * 2 + hold, 1, 'Back.out')] }),
    grow: (t, s = 1.3, d = 300, hold = 0) => ({ sx: [k(t, 1), k(t + d, s, 'Elastic.out'), k(t + d + hold, s), k(t + d + hold + 300, 1, 'Back.out')], sy: [k(t, 1), k(t + d, s, 'Elastic.out'), k(t + d + hold, s), k(t + d + hold + 300, 1, 'Back.out')] }),
    flat: (t, d = 400, hold = 600) => ({ sy: [k(t, 1), k(t + d, .3, 'Quad.in'), k(t + d + hold, .3), k(t + d + hold + 150, 1.25, 'Back.out'), k(t + d + hold + 500, 1, 'Elastic.out')], sx: [k(t, 1), k(t + d, 1.6, 'Quad.in'), k(t + d + hold, 1.6), k(t + d + hold + 150, .85), k(t + d + hold + 500, 1, 'Elastic.out')] }),
    tuck: (t, d = 250, hold = 400) => ({ sy: [k(t, 1), k(t + d, .78, 'Quad.out'), k(t + d + hold, .8), k(t + d * 2 + hold, 1, 'Back.out')], sx: [k(t, 1), k(t + d, 1.1, 'Quad.out'), k(t + d + hold, 1.1), k(t + d * 2 + hold, 1, 'Back.out')] }),
    spin: (t, turns = 1, d = 500) => ({ rot: [k(t, 0), k(t + d, 360 * turns, 'Back.out'), k(t + d + 1, 0)] }),
    tilt: (t, a = 12, d = 250, hold = 400) => ({ rot: [k(t, 0), k(t + d, a, 'Back.out'), k(t + d + hold, a), k(t + d * 2 + hold, 0)] }),
    lieBack: (t, d = 300, hold = 900) => ({ rot: [k(t, 0), k(t + d, -95, 'Bounce.out'), k(t + d + hold, -95), k(t + d + hold + 300, 0, 'Back.out')], dy: [k(t, 0), k(t + d, 10), k(t + d + hold, 10), k(t + d + hold + 300, 0)] }),
    faceDown: (t, d = 300, hold = 700) => ({ rot: [k(t, 0), k(t + d, 90, 'Bounce.out'), k(t + d + hold, 90), k(t + d + hold + 300, 0, 'Back.out')], dy: [k(t, 0), k(t + d, 10), k(t + d + hold, 10), k(t + d + hold + 300, 0)] }),
    slide: (t, dx = 20, d = 250, hold = 400) => ({ dx: [k(t, 0), k(t + d, dx, 'Quad.out'), k(t + d + hold, dx), k(t + d * 2 + hold, 0, 'Back.out')] }),
    dash: (t, n = 2, w = 34, per = 260) => ({ dx: Array.from({ length: n }).flatMap((_, i) => [k(t + i * per, 0), k(t + i * per + per * .3, w, 'Quad.out'), k(t + i * per + per * .65, -w, 'Quad.inOut'), k(t + (i + 1) * per, 0, 'Quad.out')]) }),
    shake: (t, a = 1.5, d = 500) => ({ shake: [k(t, 0), k(t + 60, a), k(t + d - 80, a), k(t + d, 0)] }),
    glow: (t, v = 1, d = 200, hold = 600) => ({ glow: [k(t, 0), k(t + d, v), k(t + d + hold, v), k(t + d * 2 + hold, 0)] }),
    cheeks: (t, v = 1, d = 200, hold = 600) => ({ cheeks: [k(t, 0), k(t + d, v), k(t + d + hold, v), k(t + d * 2 + hold, 0)] }),
    arms: (t, a = 150, d = 150, hold = 500, back = 10) => ({ armL: [k(t, 10), k(t + d, a, 'Back.out'), k(t + d + hold, a), k(t + d * 2 + hold, back)], armR: [k(t, 10), k(t + d, a, 'Back.out'), k(t + d + hold, a), k(t + d * 2 + hold, back)] }),
    armR: (t, a = 140, d = 150, hold = 500) => ({ armR: [k(t, 10), k(t + d, a, 'Back.out'), k(t + d + hold, a), k(t + d * 2 + hold, 10)] }),
    armL: (t, a = 140, d = 150, hold = 500) => ({ armL: [k(t, 10), k(t + d, a, 'Back.out'), k(t + d + hold, a), k(t + d * 2 + hold, 10)] }),
    clap: (t, n = 4, per = 180) => { const a = [k(t, 10)]; for (let i = 0; i < n; i++) a.push(k(t + i * per + per * .5, 70), k(t + (i + 1) * per, 100)); a.push(k(t + n * per + 200, 10)); return { armL: a, armR: a.map(x => [...x]) }; },
    wave: (t, n = 4, per = 200, side = 'armR') => { const a = [k(t, 10)]; for (let i = 0; i < n; i++) a.push(k(t + i * per + per * .5, 160), k(t + (i + 1) * per, 120)); a.push(k(t + n * per + 200, 10)); return { [side]: a }; },
    fade: (t, v = .35, d = 200, hold = 600) => ({ alpha: [k(t, 1), k(t + d, v), k(t + d + hold, v), k(t + d * 2 + hold, 1)] }),
    fan: (t, v = 1, d = 200, hold = 600, from = .45) => ({ fan: [k(t, from), k(t + d, v, 'Back.out'), k(t + d + hold, v), k(t + d * 2 + hold, from)] }),
    cap: (t, d = 900) => ({ capY: [k(t, 0), k(t + 150, -50, 'Quad.out'), k(t + d * .75, -8, 'Bounce.out'), k(t + d, 0)], capRot: [k(t, 0), k(t + 300, -1.3), k(t + d, .2, 'Back.out')] }),
    cuckoo: (t, n = 3, per = 260) => ({ cuckoo: Array.from({ length: n }).flatMap((_, i) => [k(t + i * per, 0), k(t + i * per + 80, 1, 'Back.out'), k(t + i * per + 180, 1), k(t + (i + 1) * per, 0, 'Quad.in')]) }),
    sep: (t, v = 30, d = 200, hold = 600) => ({ duoSep: [k(t, 0), k(t + d, v, 'Back.out'), k(t + d + hold, v), k(t + d + hold + 250, -18, 'Quad.in'), k(t + d + hold + 450, 0, 'Bounce.out')] }),
    huddle: (t, d = 200, hold = 600) => ({ duoSep: [k(t, 0), k(t + d, -16, 'Quad.out'), k(t + d + hold, -16), k(t + d * 2 + hold, 0)] }),
    piston: (t, n = 4, h = 10, per = 260) => ({ duoDy: Array.from({ length: n }).flatMap((_, i) => [k(t + i * per, 0), k(t + i * per + per / 2, (i % 2 ? h : -h), 'Quad.out'), k(t + (i + 1) * per, 0)]) }),
    bicker: (t, n = 3, per = 400) => ({ bicker: Array.from({ length: n }).flatMap((_, i) => [k(t + i * per, 0), k(t + i * per + per / 2, 1), k(t + (i + 1) * per, 0)]) }),
    duoRot: (t, a = 15, d = 200, hold = 600) => ({ duoRot: [k(t, 0), k(t + d, a, 'Back.out'), k(t + d + hold, a), k(t + d * 2 + hold, 0)] }),
    look: (t, x, y, d = 200) => ({ lookX: [k(t, 0), k(t + d, x)], lookY: [k(t, 0), k(t + d, y)] }),
  };
  // fusion de plusieurs gestes (les clés d'une même propriété sont concaténées puis triées)
  function R(dur, parts, face, fx = [], opt = {}) {
    const tracks = {};
    parts.forEach(p => { for (const key in p) (tracks[key] = tracks[key] || []).push(...p[key]); });
    for (const key in tracks) tracks[key].sort((a, b) => a[0] - b[0]);
    return Object.assign({ dur, tracks, face, fx }, opt);
  }
  const F = (t, eyes, mouth, extra) => [t, Object.assign({ eyes, mouth }, extra || {})];

  /* ---------- 2. Réactions par Astre ---------- */
  Object.assign(OVERRIDES.bourdon = OVERRIDES.bourdon || {}, {
    tir_lance: [
      R(700, [G.squash(0, .08)], [F(0, 'sleepy', 'flat'), F(200, 'open', 'o')], [], { then: 'suivi' }),          // ouvre un œil
      R(800, [G.hop(0, 20, 400), G.cap(0, 700)], [F(0, 'wide', 'o', { brow: 'up' })], [[0, 'excl']], { then: 'suivi', wake: true }), // « hein ? quoi ? »
    ],
    suivi: [R(1800, [{ rot: [k(0, 0), k(500, 8, 'Back.out'), k(900, -3), k(1400, 4), k(1800, 0)] }], [F(0, 'sleepy', 'o')], [], { loop: true, track: true })], // inertie
    gros_coup: [
      R(1300, [G.hop(0, 34, 400), G.squash(400, .25, 500), G.cap(0, 900), G.arms(90, 170, 100, 700), G.shake(0, 3, 300)], [F(0, 'wide', 'o', { brow: 'up' }), F(700, 'happy', 'grin')], [[0, 'excl']], { wake: true }),
      R(1600, [G.clap(0, 4, 360)], [F(0, 'closed', 'smile')], [[200, 'note', 2]]), // applaudit lentement, fier
      R(1600, [G.lieBack(0, 400, 700), G.arms(400, 120, 200, 600)], [F(0, 'happy', 'tongue')], [[400, 'sparkle', 4]]), // roule sur le dos
    ],
    chaine_longue: [
      R(2000, [G.heavyHops(0, 3, 14, 520), G.arms(0, 160, 150, 1500), G.cap(0, 1600)], [F(0, 'happy', 'open')], [[0, 'burst', 10]], { wake: true }), // lourde danse
      R(2000, [G.lieBack(200, 400, 1200), G.cheeks(0, 1.2, 200, 1400)], [F(0, 'star', 'open'), F(600, 'closed', 'smile', { zzz: true })], [[700, 'zzz'], [1200, 'zzz']]), // s'évanouit de bonheur
    ],
    rate: [
      R(1400, [G.arms(0, 60, 150, 200), G.tuck(400, 300, 500)], [F(0, 'open', 'flat'), F(500, 'closed', 'smile', { zzz: true })], [[800, 'zzz']]), // « pas grave, dodo »
      R(1300, [G.arms(0, 150, 300, 500)], [F(0, 'closed', 'baille')], []), // bâille
    ],
    orbe_recupere: [
      R(1400, [G.shrink(0, .82, 600, 300)], [F(0, 'closed', 'o')], [[100, 'sigh'], [500, 'sigh']]), // soupir qui le dégonfle
      R(900, [{ rot: [k(0, 0), k(200, 6), k(500, 0)] }, G.arms(0, 80, 200, 400)], [F(0, 'sleepy', 'flat', { brow: 'stern' })], []), // « bon. »
    ],
    presque: [
      R(1300, [G.faceDown(0, 350, 700)], [F(0, 'wide', 'o'), F(350, 'closed', 'flat')], [[350, 'puff', 3]]), // pouf, face contre terre
      R(1200, [G.cap(0, 1200), G.tuck(0, 200, 700)], [F(0, 'closed', 'wavy')], []), // se cache sous le bonnet
    ],
    orbe_descend: [R(700, [G.tuck(0, 250, 2000)], [F(0, 'wide', 'wavy')], [], { hold: true, track: true })], // tortue
    dernier_coeur: [R(1400, [{ sy: [k(0, 1.08), k(1400, 1.08)], sx: [k(0, .95), k(700, 1.1), k(1400, .95)], cheeks: [k(0, .5), k(700, 1.6), k(1400, .5)] }], [F(0, 'wide', 'puff', { brow: 'up' })], [], { loop: true, track: true })],
    dernier_orbe: [R(1600, [{ armL: [k(0, 70), k(1600, 70)], armR: [k(0, 70), k(1600, 70)], rot: [k(0, -4), k(800, 4), k(1600, -4)] }], [F(0, 'open', 'wavy', { brow: 'worried' })], [[300, 'sweat']], { loop: true, track: true })],
    pouvoir_active: [R(1500, [G.hop(0, 40, 600), G.cap(0, 1100), G.squash(600, .3, 600), G.glow(0, 1.2, 150, 700)], [F(0, 'wide', 'open', { brow: 'up' }), F(900, 'wide', 'o')], [[100, 'ring'], [100, 'excl']], { wake: true })],
    final_ralenti: [R(1800, [G.grow(0, 1.1, 800, 1000)], [F(0, 'sleepy', 'o'), F(600, 'wide', 'o', { brow: 'up' })], [], { hold: true, track: true })],
    victoire: [R(2000, [G.heavyHops(0, 3, 16, 600), { rot: [k(0, -8), k(300, 8), k(600, -8), k(900, 8), k(1200, -8), k(1500, 8), k(2000, 0)] }, G.arms(0, 165, 100, 1700), G.cap(0, 1800)], [F(0, 'happy', 'open')], [[0, 'confetti', 14]], { loop: true, wake: true })],
    echec: [
      R(2200, [G.tuck(0, 400, 1100), G.hop(1500, 12, 500)], [F(0, 'closed', 'o', { zzz: true }), F(1500, 'open', 'smile')], [[300, 'zzz'], [900, 'zzz']]),
      R(2000, [G.shrink(0, .7, 400, 800), G.armR(1200, 100, 200, 400)], [F(0, 'closed', 'frown'), F(1200, 'open', 'smile')], []), // boule, puis tend l'oreiller
    ],
    inactivite: [R(2400, [G.tuck(0, 500, 1400)], [F(0, 'closed', 'o', { zzz: true })], [[400, 'zzz'], [1200, 'zzz'], [2000, 'zzz']])],
    sommeil: [R(2400, [{ shake: [k(0, 0), k(1100, 0), k(1200, 1.5), k(1500, 0)], sy: [k(0, .92), k(1200, 1), k(2400, .92)] }], [F(0, 'closed', 'o', { zzz: true })], [[600, 'zzz'], [1300, 'zzz']], { loop: true })], // ronfle si fort que le cadre tremble
    idle_long: [
      R(3600, [{ rot: [k(0, 0), k(1800, 25, 'Quad.in'), k(2300, 40, 'Quad.in'), k(2400, 0, 'Back.out')], dy: [k(0, 0), k(2300, 8), k(2400, -10, 'Quad.out'), k(2700, 0, 'Bounce.out')] }, G.look(2400, -1, 0), G.look(2900, 1, 0)], [F(0, 'closed', 'o'), F(2400, 'wide', 'flat', { brow: 'up' }), F(3000, 'open', 'smile')], [[2400, 'excl']]), // pique du nez
      R(3200, [{ sy: [k(0, 1), k(1400, 1.12, 'Quad.in'), k(1500, .75, 'Quad.out'), k(2200, 1, 'Elastic.out')], dx: [k(1400, 0), k(1600, -26, 'Quad.out'), k(2600, 0, 'Back.out')], rot: [k(1400, 0), k(1700, -360, 'Quad.out'), k(1701, 0)] }, G.cap(1450, 900)], [F(0, 'squint', 'wavy'), F(1400, 'closed', 'open'), F(2200, 'open', 'smile')], [[1450, 'puff', 4]]), // éternuement
      R(3400, [{ mouthScale: [k(0, 1), k(600, .6), k(900, 1), k(1200, .6), k(1500, 1), k(1800, .6), k(2100, 1)] }, G.armR(0, 90, 300, 400), G.cheeks(0, 1.2, 300, 2400)], [F(0, 'closed', 'puff'), F(2500, 'closed', 'o')], [[2600, 'sparkle', 1]]), // casse-croûte
    ],
  });

  Object.assign(OVERRIDES.jumelles = OVERRIDES.jumelles || {}, {
    tir_lance: [
      R(700, [G.sep(0, 16, 120, 300), G.arms(0, 120, 120, 300)], [F(0, 'open', 'open')], [[0, 'excl', 2]], { then: 'suivi' }), // « vas-y ! » en même temps
      R(800, [G.huddle(0, 200, 400)], [F(0, 'closed', 'wavy')], [], { then: 'suivi' }), // se tiennent la main
    ],
    suivi: [R(900, [G.huddle(0, 300, 300)], [F(0, 'wide', 'o')], [], { loop: true, track: true })], // épaule contre épaule
    gros_coup: [
      R(1100, [G.sep(0, -10, 150, 100), G.hop(250, 18, 400), G.arms(0, 120, 150, 500)], [F(0, 'happy', 'open')], [[150, 'sparkle', 6]]), // tape dans la main
      R(1300, [G.duoRot(0, -25, 200, 700), G.grow(0, 1.12, 300, 600), G.sep(0, 18, 200, 700)], [F(0, 'closed', 'grin', { brow: 'up' })], []), // chacune revendique
      R(1400, [G.piston(0, 4, 10, 300), G.arms(0, 140, 150, 900)], [F(0, 'happy', 'tongue')], [[100, 'note', 3]]), // pas de deux
    ],
    chaine_longue: [
      R(1500, [G.huddle(0, 200, 900), { duoSep: [k(0, 0), k(200, -40, 'Back.out'), k(1100, -40), k(1500, 0, 'Elastic.out')] }, G.glow(0, 1.2, 200, 900)], [F(0, 'closed', 'grin')], [[200, 'burst', 14]]), // câlin fusionnel
      R(1800, [G.spin(0, 3, 1200), G.huddle(0, 200, 1000)], [F(0, 'happy', 'open'), F(1200, 'spiral', 'wavy')], [[600, 'sparkle', 8]]), // ronde folle, étourdies
    ],
    rate: [
      R(1500, [G.bicker(0, 3, 400), G.duoRot(0, 15, 200, 1000), G.shake(0, 1, 1200)], [F(0, 'squint', 'open', { brow: 'stern' }), F(1200, 'closed', 'flat', { brow: null })], [[200, 'puff', 3]]), // dispute, tirent sur le fil
      R(1800, [{ duoRot: [k(0, 0), k(200, 160, 'Back.out'), k(1100, 160), k(1400, 0)] }], [F(0, 'closed', 'moue'), F(1200, 'happy', 'grin')], []), // dos à dos puis rient
    ],
    orbe_recupere: [R(900, [G.shrink(0, .9, 300, 200)], [F(0, 'closed', 'o'), F(500, 'open', 'smile')], [[100, 'sigh']])],
    presque: [
      R(1200, [G.bicker(0, 2, 300), G.squash(0, .2, 500)], [F(0, 'squint', 'open', { brow: 'stern' })], [[100, 'excl']]),
      R(1300, [G.faceDown(0, 300, 700)], [F(0, 'wide', 'o'), F(300, 'closed', 'flat')], []), // effondrées en miroir
    ],
    orbe_descend: [R(600, [G.huddle(0, 200, 3000)], [F(0, 'wide', 'wavy', { brow: 'worried' })], [], { hold: true, track: true })],
    dernier_coeur: [R(900, [{ duoSep: [k(0, -12), k(900, -12)], shake: [k(0, .9), k(900, .9)] }], [F(0, 'wide', 'wavy', { brow: 'worried' })], [], { loop: true, track: true })],
    dernier_orbe: [R(1200, [{ armL: [k(0, 150), k(1200, 150)], armR: [k(0, 150), k(1200, 150)], duoSep: [k(0, -8), k(1200, -8)] }], [F(0, 'closed', 'wavy')], [], { loop: true })],
    pouvoir_active: [R(1300, [G.sep(0, 40, 150, 800), G.glow(0, 1, 150, 700)], [F(0, 'wide', 'open', { brow: 'up' })], [[150, 'ring'], [400, 'sparkle', 6]])],
    final_ralenti: [R(1800, [G.huddle(0, 400, 1400), G.grow(0, 1.08, 600, 1200)], [F(0, 'wide', 'open')], [], { hold: true, track: true })],
    victoire: [R(1800, [G.spin(0, 1, 900), G.piston(900, 3, 12, 300), G.arms(0, 160, 150, 1400), G.glow(0, .8, 200, 1300)], [F(0, 'happy', 'open')], [[0, 'confetti', 16]], { loop: true })],
    echec: [
      R(2000, [G.flat(0, 400, 700), G.arms(1100, 150, 200, 600)], [F(0, 'closed', 'frown'), F(1100, 'open', 'grin')], []),
      R(2000, [G.bicker(0, 2, 400), G.huddle(800, 300, 800)], [F(0, 'squint', 'open', { brow: 'stern' }), F(800, 'closed', 'smile')], []), // dispute puis câlin
    ],
    inactivite: [R(1800, [G.bicker(0, 2, 400), G.slide(800, 12, 200, 500), G.armR(800, 120, 150, 400)], [F(0, 'squint', 'open', { brow: 'stern' }), F(800, 'open', 'open')], [[900, 'excl']])],
    sommeil: [R(2400, [G.huddle(0, 400, 2000)], [F(0, 'closed', 'o', { zzz: true })], [[300, 'zzz'], [1500, 'zzz']], { loop: true })],
    idle_long: [
      R(3600, [G.piston(0, 6, 6, 300), G.bicker(1800, 2, 400), { duoRot: [k(2600, 0), k(2800, 160, 'Back.out'), k(3600, 160)] }], [F(0, 'squint', 'flat'), F(1800, 'open', 'open', { brow: 'stern' }), F(2600, 'closed', 'moue')], [[1900, 'puff', 2]]), // pierre-feuille-ciseaux
      R(3000, [{ duoSep: [k(0, 0), k(900, 70, 'Quad.out'), k(1100, 72), k(1300, -24, 'Quad.in'), k(1500, 0, 'Bounce.out')] }, G.spin(1300, 2, 900)], [F(0, 'happy', 'tongue'), F(1100, 'wide', 'o'), F(1300, 'spiral', 'wavy'), F(2500, 'open', 'smile')], [[1300, 'sparkle', 5]]), // l'élastique
    ],
  });

  Object.assign(OVERRIDES.volte = OVERRIDES.volte || {}, {
    tir_lance: [
      R(500, [G.armR(0, 100, 80, 200), G.squash(0, .1, 300)], [F(0, 'squint', 'grin', { brow: 'cocky' })], [[80, 'sparkle', 1]], { then: 'suivi' }), // claque des doigts
      R(700, [G.arms(0, 90, 120, 400), G.tilt(0, -10, 150, 300)], [F(0, 'squint', 'grin', { brow: 'cocky' })], [], { then: 'suivi' }), // « pistolets »
    ],
    suivi: [R(1200, [{ dx: [k(0, 0), k(600, 6), k(1200, 0)] }], [F(0, 'open', 'smile', { brow: 'cocky' })], [], { loop: true, track: true })],
    gros_coup: [
      R(1300, [G.hop(0, 18, 400), G.arms(0, 160, 120, 800), G.glow(150, 1, 100, 300)], [F(0, 'squint', 'grin', { brow: 'cocky', shades: true })], [[200, 'sparkle', 6]]), // lunettes, pose « tching »
      R(1200, [G.armR(0, 100, 150, 700)], [F(0, 'squint', 'puff', { brow: 'cocky' })], [[400, 'puff', 2]]), // souffle sur ses doigts
      R(1200, [{ rot: [k(0, 0), k(300, 25, 'Back.out'), k(800, 25), k(1100, 0)] }, G.armL(0, 90, 200, 600)], [F(0, 'closed', 'smile', { brow: 'cocky' })], []), // révérence
    ],
    chaine_longue: [
      R(2000, [G.spin(0, 3, 1100), G.hops(0, 3, 26, 370), G.glow(0, 1, 200, 1300)], [F(0, 'closed', 'grin'), F(1100, 'wide', 'o', { brow: 'up' }), F(1500, 'squint', 'grin', { brow: 'cocky', shades: true })], [[1100, 'burst', 12]]), // 3 saltos réussis, s'étonne, frime
    ],
    rate: [
      R(1400, [G.tilt(0, -8, 200, 900), G.arms(0, 40, 200, 900)], [F(0, 'closed', 'puff', { brow: 'cocky' })], [[200, 'note', 2]]), // « je l'ai fait exprès », siffle
      R(1200, [G.armR(0, 150, 150, 300), G.armR(600, 150, 150, 200)], [F(0, 'open', 'wavy', { brow: 'worried' })], []), // se recoiffe nerveusement
      R(1300, [G.look(0, -1, -1, 250), G.tilt(0, -12, 250, 700)], [F(0, 'open', 'flat', { brow: 'cocky' })], []), // regarde ailleurs
    ],
    orbe_recupere: [R(900, [G.armR(0, 150, 100, 400), G.squash(100, .1, 400)], [F(0, 'squint', 'grin', { brow: 'cocky' })], [[100, 'sparkle', 2]])],
    presque: [
      R(1100, [G.shrink(0, .9, 100, 600)], [F(0, 'wide', 'o', { brow: 'up', shades: false })], [[0, 'excl']]), // lâche ses lunettes
      R(1200, [G.arms(0, 150, 120, 700)], [F(0, 'closed', 'wavy')], []), // se cache avec la queue
    ],
    orbe_descend: [R(700, [G.armR(0, 130, 200, 3000), G.tuck(0, 200, 3000)], [F(0, 'wide', 'wavy', { brow: 'worried' })], [], { hold: true, track: true })],
    dernier_coeur: [R(1200, [{ sy: [k(0, 1.04), k(1200, 1.04)] }], [F(0, 'open', 'flat', { brow: 'stern', shades: false })], [], { loop: true, track: true })],
    dernier_orbe: [R(1400, [{ armR: [k(0, 130), k(350, 145), k(700, 130), k(1050, 145), k(1400, 130)] }], [F(0, 'open', 'wavy', { brow: 'cocky' })], [[300, 'sweat']], { loop: true, track: true })],
    pouvoir_active: [R(1600, [G.hops(0, 4, 28, 400), G.glow(0, 1, 150, 1200)], [F(0, 'squint', 'grin', { brow: 'cocky', shades: true })], [[0, 'ring']])],
    final_ralenti: [R(1800, [{ rot: [k(0, 0), k(1800, 360, 'Sine.inOut')] }, G.hop(0, 20, 1800)], [F(0, 'closed', 'grin', { brow: 'cocky' })], [], { hold: true, track: true })],
    victoire: [R(2000, [G.spin(0, 2, 800), G.hops(0, 2, 26, 400), G.slide(1000, -14, 200, 500), G.arms(1000, 165, 150, 600)], [F(0, 'squint', 'open', { brow: 'cocky', shades: true })], [[0, 'confetti', 14], [800, 'sparkle', 8]], { loop: true })],
    echec: [
      R(2000, [G.lieBack(0, 300, 700), G.armR(1300, 120, 150, 400)], [F(0, 'closed', 'frown', { brow: 'worried' }), F(1300, 'squint', 'grin', { brow: 'cocky' })], []), // désespoir dramatique puis style
    ],
    inactivite: [R(1600, [{ sy: [k(0, 1), k(150, .94), k(300, 1), k(450, .94), k(600, 1), k(750, .94), k(900, 1)] }], [F(0, 'open', 'flat', { brow: 'cocky' })], [[100, 'note', 3]])],
    sommeil: [R(2400, [G.tilt(0, 20, 400, 1600)], [F(0, 'closed', 'smile', { shades: true })], [[600, 'zzz']], { loop: true })],
    idle_long: [
      R(3400, [G.spin(800, 1, 600), { dy: [k(0, 0), k(800, -30, 'Quad.out'), k(1400, 0, 'Quad.in')], rot: [k(1401, 0), k(1600, 80, 'Quad.out'), k(2400, 80), k(2700, 0, 'Back.out')], dx: [k(1400, 0), k(1700, 24, 'Quad.out'), k(2400, 24), k(2800, 0)] }], [F(0, 'squint', 'grin', { brow: 'cocky' }), F(1400, 'spiral', 'wavy'), F(2600, 'closed', 'smile', { brow: 'cocky' })], [[1400, 'puff', 3]]), // salto raté
      R(3000, [G.dash(0, 3, 30, 700), G.arms(0, 90, 150, 2400)], [F(0, 'squint', 'grin', { brow: 'cocky', shades: true })], []), // skate sur la queue
    ],
  });

  Object.assign(OVERRIDES.mousse = OVERRIDES.mousse || {}, {
    tir_lance: [
      R(800, [G.fan(0, 1, 150, 400)], [F(0, 'open', 'o')], [], { then: 'suivi' }), // derrière l'éventail
      R(700, [G.arms(0, 70, 150, 300)], [F(0, 'happy', 'smile')], [], { then: 'suivi' }), // joint les mains
    ],
    suivi: [R(1400, [{ sx: [k(0, 1), k(700, 1.12), k(1400, 1)], dx: [k(0, 0), k(700, 6), k(1400, 0)] }], [F(0, 'wide', 'o')], [], { loop: true, track: true })], // s'étire en filet vers l'orbe
    gros_coup: [
      R(1700, [G.clap(0, 4, 160), G.fan(700, 1, 150, 600, 0), G.cheeks(600, 1.5, 150, 800)], [F(0, 'happy', 'open'), F(700, 'closed', 'moue')], []), // applaudit, rosit, se cache
      R(1400, [G.hops(0, 3, 12, 280), G.fade(850, .3, 150, 300)], [F(0, 'happy', 'open')], [[850, 'sparkle', 6]]), // sautille et se disperse
      R(900, [G.armR(0, 110, 100, 400), G.squash(0, .08, 300)], [F(0, 'squint', 'grin')], []), // minuscule « ouais »
    ],
    chaine_longue: [
      R(1800, [G.fade(0, 0, 200, 500), G.grow(700, 1.2, 300, 400), G.cheeks(700, 2, 150, 800)], [F(0, 'star', 'open'), F(700, 'happy', 'grin')], [[0, 'burst', 16]]), // explose en petits cœurs
      R(1900, [G.dash(0, 2, 40, 500), G.spin(0, 2, 1000), G.fan(1100, 1, 150, 500, 0)], [F(0, 'happy', 'open'), F(1100, 'closed', 'moue')], []),
    ],
    rate: [
      R(1300, [G.armR(0, 90, 200, 600)], [F(0, 'open', 'smile', { brow: 'worried' })], []), // tapote le vide
      R(1600, [G.tuck(0, 300, 600)], [F(0, 'open', 'frown', { brow: 'worried' }), F(900, 'happy', 'smile')], []), // plus triste que toi, puis sourire courageux
    ],
    orbe_recupere: [R(1000, [G.grow(0, 1.12, 300, 200)], [F(0, 'closed', 'o')], [[100, 'sigh']])],
    presque: [
      R(1500, [G.fade(0, .15, 150, 600)], [F(0, 'wide', 'o')], []), // se disperse d'émotion
      R(1300, [G.fan(0, 1, 100, 900), G.shake(0, 1.2, 900)], [F(0, 'closed', 'wavy')], []),
    ],
    orbe_descend: [R(600, [G.shrink(0, .75, 200, 3000)], [F(0, 'wide', 'wavy', { brow: 'worried' })], [], { hold: true, track: true })],
    dernier_coeur: [R(1200, [{ sx: [k(0, .85), k(1200, .85)], sy: [k(0, .85), k(1200, .85)], alpha: [k(0, 1), k(1200, 1)] }], [F(0, 'wide', 'flat', { brow: 'stern' })], [], { loop: true, track: true })], // condensée, nette
    dernier_orbe: [R(1400, [{ fan: [k(0, .8), k(1400, .8)], sy: [k(0, .9), k(700, .94), k(1400, .9)] }], [F(0, 'open', 'wavy', { brow: 'worried' })], [], { loop: true, track: true })],
    pouvoir_active: [R(1500, [G.shrink(0, .8, 200, 100), G.grow(500, 1.25, 300, 400), G.arms(500, 100, 150, 600), G.glow(500, 1, 150, 600)], [F(0, 'closed', 'puff'), F(500, 'wide', 'open', { brow: 'up' })], [[500, 'ring']])],
    final_ralenti: [R(1800, [G.grow(0, 1.18, 1200, 600), { fan: [k(0, .45), k(800, 0, 'Quad.in')] }, G.glow(0, .8, 800, 800)], [F(0, 'wide', 'o')], [], { hold: true, track: true })],
    victoire: [R(2000, [G.slide(0, 18, 300, 600), G.arms(0, 120, 200, 500), G.cheeks(0, 2, 200, 1200), G.fan(1100, 1, 150, 500, 0)], [F(0, 'happy', 'grin'), F(1100, 'closed', 'moue')], [[200, 'sparkle', 8]], { loop: true })], // câlin vers la Gardienne puis se cache
    echec: [R(2000, [G.fade(0, .25, 400, 600), G.slide(1000, 10, 300, 400)], [F(0, 'closed', 'frown'), F(1000, 'open', 'smile')], [])],
    inactivite: [R(2200, [G.slide(0, 14, 600, 200), G.armR(600, 100, 100, 100), G.slide(1000, -10, 150, 400)], [F(0, 'open', 'o'), F(1000, 'wide', 'moue')], [])], // touche la vitre et s'enfuit
    sommeil: [R(2400, [G.shrink(0, .85, 400, 1600)], [F(0, 'closed', 'smile')], [[500, 'zzz']], { loop: true })],
    idle_long: [
      R(3600, [G.fade(0, 0, 300, 400), { dx: [k(0, 0), k(650, 30), k(1200, 30), k(1500, -24), k(2200, -24), k(2800, 0)] }, G.fade(1500, 0, 200, 400)], [F(0, 'open', 'o'), F(800, 'squint', 'smile'), F(2800, 'closed', 'moue')], []), // cache-cache
      R(3400, [G.look(0, .3, -1, 300), G.shake(800, .6, 1400), G.cheeks(500, 1.5, 300, 1800), G.armR(2400, 120, 150, 300)], [F(0, 'wide', 'o'), F(800, 'happy', 'smile')], [[2300, 'sparkle', 2]]), // le papillon
    ],
  });

  Object.assign(OVERRIDES.horloge = OVERRIDES.horloge || {}, {
    tir_lance: [
      R(500, [G.armR(0, 80, 90, 200)], [F(0, 'open', 'flat', { brow: 'hands' })], [[90, 'tick']], { then: 'suivi' }), // déclenche le chrono
      R(800, [G.tilt(0, 8, 200, 400)], [F(0, 'open', 'flat', { brow: 'stern' })], [], { then: 'suivi' }), // sceptique par-dessus les lunettes
    ],
    suivi: [R(1000, [{ rot: [k(0, 0), k(250, 4), k(500, 0), k(750, -4), k(1000, 0)] }], [F(0, 'open', 'flat', { brow: 'hands' })], [], { loop: true, track: true })], // cran par cran (quantifié)
    gros_coup: [
      R(1300, [G.cuckoo(0, 3, 300)], [F(0, 'closed', 'smile', { brow: 'hands' })], [[0, 'note', 3]]), // coucou x3, ne le renfonce pas
      R(1600, [G.clap(0, 6, 220), G.shake(900, 1, 600)], [F(0, 'open', 'smile'), F(900, 'wide', 'grin')], [[1000, 'tick', 3]]), // applaudit poliment puis se dérègle
    ],
    chaine_longue: [
      R(2000, [G.shake(0, 3, 600), G.fade(200, .2, 200, 400), G.squash(1000, .25, 700), G.cuckoo(1000, 3, 300)], [F(0, 'star', 'open'), F(1000, 'happy', 'grin')], [[200, 'burst', 16]]), // explose en rouages
      R(1800, [{ rot: [k(0, 0), k(300, 10), k(600, 0), k(900, -10), k(1200, 0), k(1500, 10), k(1800, 0)] }, G.dash(0, 2, 16, 900)], [F(0, 'closed', 'grin')], [[0, 'note', 4]]), // valse mécanique
    ],
    rate: [
      R(1400, [{ rot: [k(0, 0), k(200, -8), k(400, 8), k(600, -8), k(800, 0)] }, G.armR(800, 90, 150, 300)], [F(0, 'open', 'flat', { brow: 'stern' }), F(800, 'open', 'smile')], []),
      R(1300, [G.cuckoo(0, 1, 500)], [F(0, 'open', 'flat', { brow: 'stern' }), F(700, 'closed', 'flat')], [[700, 'sigh']]),
    ],
    orbe_recupere: [R(800, [{ rot: [k(0, 0), k(200, 6), k(400, 0)] }], [F(0, 'closed', 'smile', { brow: 'hands' })], [[0, 'tick']])],
    presque: [
      R(1300, [G.shake(0, 2, 700)], [F(0, 'wide', 'o', { brow: 'up' })], [[0, 'excl']]), // sa montre s'arrête, elle la secoue
      R(1100, [G.tilt(0, -6, 150, 600)], [F(0, 'squint', 'flat', { brow: 'stern' })], [[150, 'puff', 1]]), // « tsss »
    ],
    orbe_descend: [R(700, [G.armR(0, 75, 150, 3000)], [F(0, 'open', 'wavy', { brow: 'worried' })], [[200, 'tick', 2]], { hold: true, track: true })],
    dernier_coeur: [R(1600, [{ sy: [k(0, 1), k(1600, 1)] }], [F(0, 'open', 'flat', { brow: 'hands' })], [[0, 'tick'], [800, 'tick']], { loop: true, track: true })], // immobile, seul le tic-tac
    dernier_orbe: [R(1600, [{ armL: [k(0, 60), k(1600, 60)], armR: [k(0, 60), k(1600, 60)] }], [F(0, 'open', 'wavy', { brow: 'worried' })], [], { loop: true, track: true })],
    pouvoir_active: [R(1800, [G.armR(0, 150, 150, 1300), G.glow(150, 1, 200, 1100)], [F(0, 'closed', 'flat', { brow: 'hands' })], [[150, 'ring']])],
    final_ralenti: [R(1800, [{ rot: [k(0, 0), k(600, 6), k(1200, 0)] }], [F(0, 'closed', 'smile', { brow: 'hands' })], [], { hold: true, track: true })], // approuve : c'est son moment
    victoire: [R(2000, [G.cuckoo(0, 5, 300), G.hops(0, 2, 12, 500), G.arms(0, 150, 150, 1500)], [F(0, 'happy', 'open')], [[0, 'confetti', 12], [0, 'note', 4]], { loop: true })],
    echec: [R(2000, [G.shrink(0, .9, 300, 600), G.armR(1000, 90, 200, 500)], [F(0, 'open', 'frown', { brow: 'worried' }), F(1000, 'open', 'smile', { brow: 'hands' })], [[400, 'tick', 2]])],
    // inactivite : gardée du rig (tapote sa montre)
    sommeil: [R(2000, [{ rot: [k(0, 0), k(1000, 3), k(2000, 0)] }], [F(0, 'closed', 'flat')], [[0, 'tick'], [1000, 'tick']], { loop: true })],
    idle_long: [
      R(3200, [G.cuckoo(0, 1, 500), G.armR(500, 160, 100, 200), G.cuckoo(1100, 1, 500), G.armR(1600, 160, 100, 200), G.shake(1700, 1, 400)], [F(0, 'open', 'flat', { brow: 'stern' }), F(1700, 'squint', 'frown', { brow: 'stern' })], [[1700, 'puff', 2]]), // le coucou renfoncé
      R(3400, [G.arms(0, 160, 200, 200), G.arms(600, 160, 200, 200), G.arms(1200, 160, 200, 200), G.hop(1900, 10, 300)], [F(0, 'open', 'flat', { brow: 'hands' }), F(1900, 'wide', 'o'), F(2300, 'closed', 'smile')], [[1900, 'excl']]), // gym du matin, un ressort saute
    ],
  });

  Object.assign(OVERRIDES.grelot = OVERRIDES.grelot || {}, {
    tir_lance: [
      R(600, [G.tilt(0, 18, 120, 300), G.slide(0, 10, 120, 300)], [F(0, 'wide', 'grin')], [], { then: 'suivi' }), // part en avance
      R(700, [G.armR(0, 120, 80, 400), G.hop(300, 8, 300)], [F(0, 'open', 'open')], [], { then: 'suivi' }), // sonne le départ
    ],
    suivi: [R(500, [{ dy: [k(0, 0), k(250, -4), k(500, 0)] }], [F(0, 'wide', 'grin')], [], { loop: true, track: true })], // court sur place
    gros_coup: [
      R(1000, [G.dash(0, 3, 40, 300)], [F(0, 'happy', 'open')], [[0, 'sparkle', 6]]), // 3 tours de marge en un éclair
      R(1100, [G.shake(0, 2, 800), G.arms(0, 150, 100, 700)], [F(0, 'happy', 'tongue')], [[0, 'note', 4]]), // sonne toutes ses clochettes
      R(1400, [G.armR(0, 110, 100, 150), G.armR(400, 110, 100, 150), G.armR(800, 110, 100, 150)], [F(0, 'squint', 'grin')], []), // distribue des lettres
    ],
    chaine_longue: [
      R(1600, [G.dash(0, 4, 46, 280), G.glow(0, 1, 150, 1100)], [F(0, 'star', 'open')], [[0, 'burst', 12]]),
      R(1800, [G.spin(0, 3, 1000), G.shake(1000, 1, 600)], [F(0, 'happy', 'open'), F(1000, 'spiral', 'grin')], []), // s'emmêle dans sa traînée
    ],
    rate: [
      R(1200, [G.arms(0, 160, 80, 200), G.slide(400, -10, 200, 300)], [F(0, 'happy', 'open'), F(300, 'wide', 'o'), F(600, 'open', 'flat')], []), // avait célébré trop tôt
      R(900, [G.arms(0, 60, 100, 200), G.hop(400, 8, 300)], [F(0, 'open', 'smile', { brow: 'up' })], []), // « déjà la suite ! »
    ],
    orbe_recupere: [R(1000, [G.slide(0, 14, 300, 0), G.clap(300, 3, 150)], [F(0, 'open', 'grin')], [])], // arrive en retard pour applaudir
    presque: [
      R(1200, [G.slide(0, 22, 150, 300), G.arms(150, 150, 100, 600)], [F(0, 'wide', 'wavy', { brow: 'worried' })], [[150, 'puff', 3]]), // dérapage, fumée
      R(1100, [G.shrink(0, .92, 100, 700)], [F(0, 'wide', 'o')], []), // les clochettes se taisent
    ],
    orbe_descend: [R(400, [{ dy: [k(0, 0), k(100, -6), k(200, 0), k(300, -6), k(400, 0)] }], [F(0, 'wide', 'wavy', { brow: 'worried' })], [], { loop: true, track: true })],
    dernier_coeur: [R(1200, [{ sy: [k(0, 1), k(1200, 1)] }], [F(0, 'wide', 'flat', { brow: 'worried' })], [], { loop: true, track: true })], // ne bouge plus du tout
    dernier_orbe: [R(1200, [{ armL: [k(0, 30), k(1200, 30)], armR: [k(0, 30), k(1200, 30)] }], [F(0, 'open', 'wavy', { brow: 'worried' })], [], { loop: true, track: true })],
    pouvoir_active: [R(1400, [G.tuck(0, 150, 150), { dx: [k(300, 0), k(500, 60, 'Quad.in'), k(700, -40), k(1100, 0, 'Back.out')] }, G.glow(300, 1, 100, 600)], [F(0, 'squint', 'flat', { brow: 'stern' }), F(300, 'wide', 'grin'), F(1100, 'closed', 'open')], [[300, 'whoosh'], [1100, 'puff', 2]])],
    final_ralenti: [R(1800, [{ rot: [k(0, 0), k(1800, 4)] }], [F(0, 'wide', 'o', { brow: 'up' })], [], { hold: true, track: true })], // découvre la lenteur
    victoire: [R(1800, [G.dash(0, 3, 40, 350), G.arms(1050, 160, 150, 400)], [F(0, 'happy', 'open')], [[0, 'confetti', 14], [0, 'note', 3]], { loop: true })],
    echec: [R(1600, [G.slide(0, 18, 150, 100), G.lieBack(250, 200, 300), G.armR(950, 140, 100, 400)], [F(0, 'wide', 'o'), F(250, 'spiral', 'wavy'), F(950, 'open', 'grin', { brow: 'up' })], [[250, 'puff', 2]])],
    inactivite: [R(1400, [G.dash(0, 3, 22, 450)], [F(0, 'open', 'flat', { brow: 'stern' })], [[0, 'note', 2]])], // cent pas à toute vitesse
    sommeil: [R(800, [{ dy: [k(0, 0), k(200, -3), k(400, 0), k(600, -3), k(800, 0)] }], [F(0, 'closed', 'o')], [[0, 'zzz']], { loop: true })], // dort en courant sur place
    idle_long: [
      R(3200, [{ dx: [k(0, 0), k(300, 140, 'Quad.in'), k(1800, 140), k(2200, 0, 'Back.out')] }, G.shake(2200, 1, 300)], [F(0, 'wide', 'grin'), F(2200, 'spiral', 'grin'), F(2700, 'open', 'smile')], [[1200, 'excl'], [2200, 'puff', 3]]), // la livraison (sort du cadre)
      R(2400, [G.arms(0, 160, 100, 400), G.hops(0, 2, 10, 250)], [F(0, 'happy', 'open'), F(700, 'wide', 'o'), F(1100, 'closed', 'flat')], [[1100, 'puff', 1]]), // célèbre trop tôt, toussote
    ],
  });

  Object.assign(OVERRIDES.nuagelune = OVERRIDES.nuagelune || {}, {
    tir_lance: [
      R(900, [G.tilt(0, -8, 300, 300)], [F(0, 'open', 'o')], [[200, 'sigh']], { then: 'suivi' }), // souffle comme sur une bougie
      R(1000, [G.armR(0, 130, 250, 400)], [F(0, 'closed', 'smile')], [], { then: 'suivi' }), // chef d'orchestre
    ],
    suivi: [R(2000, [{ rot: [k(0, 0), k(1000, 5), k(2000, 0)] }], [F(0, 'wide', 'o')], [], { loop: true, track: true })],
    gros_coup: [
      R(1600, [G.clap(0, 3, 400)], [F(0, 'happy', 'smile', { mood: 'joy' })], [[0, 'note', 2]]),
      R(1400, [G.armR(0, 150, 300, 500)], [F(0, 'closed', 'wavy', { mood: 'joy' })], []), // essuie une larme
    ],
    chaine_longue: [R(2000, [G.lieBack(0, 500, 1000), G.cheeks(0, 1.4, 300, 1200)], [F(0, 'star', 'o', { mood: 'joy' }), F(500, 'closed', 'smile', { mood: 'joy' })], [[0, 'burst', 12], [600, 'note', 3]])], // s'évanouit de beauté
    rate: [
      R(1600, [G.tuck(0, 300, 700)], [F(0, 'open', 'smile', { mood: 'rain' })], []), // il pleut, il sourit quand même
      R(1600, [G.look(0, -1, -1, 300)], [F(0, 'closed', 'smile', { mood: null })], [[300, 'note', 1]]), // ne l'a pas vu, contemplait autre chose
    ],
    orbe_recupere: [R(1200, [G.armL(0, 70, 300, 500)], [F(0, 'closed', 'smile')], [[200, 'sigh']])],
    presque: [
      R(1300, [G.shrink(0, .94, 150, 700)], [F(0, 'wide', 'o', { mood: 'rain' })], []),
      R(1300, [G.look(0, 0, -1, 300)], [F(0, 'open', 'smile')], []), // lève les yeux au ciel, poétique
    ],
    orbe_descend: [R(800, [G.tuck(0, 300, 3000)], [F(0, 'open', 'wavy', { brow: 'worried', mood: 'rain' })], [], { hold: true, track: true })],
    dernier_coeur: [R(2000, [{ armL: [k(0, 70), k(2000, 70)], armR: [k(0, 70), k(2000, 70)], glow: [k(0, .3), k(1000, .6), k(2000, .3)] }], [F(0, 'closed', 'flat')], [], { loop: true })], // prie le ciel
    dernier_orbe: [R(1800, [{ armL: [k(0, 40), k(1800, 40)], armR: [k(0, 40), k(1800, 40)], sy: [k(0, .94), k(900, .97), k(1800, .94)] }], [F(0, 'open', 'wavy', { brow: 'worried' })], [], { loop: true, track: true })],
    pouvoir_active: [R(1600, [G.tilt(0, 25, 300, 800), G.armR(0, 40, 300, 800), G.glow(300, 1, 200, 700)], [F(0, 'wide', 'o', { mood: 'joy' })], [[300, 'ring']])], // repêche l'orbe avec sa plume
    final_ralenti: [R(1800, [G.hop(0, 14, 1800), G.glow(0, .8, 900, 900)], [F(0, 'wide', 'o', { brow: 'up' })], [[900, 'sparkle', 2]], { hold: true, track: true })], // se lève, larmes d'étoiles
    victoire: [R(2400, [{ rot: [k(0, -10), k(600, 10), k(1200, -10), k(1800, 10), k(2400, -10)] }, G.arms(0, 150, 300, 1600)], [F(0, 'happy', 'open', { mood: 'joy' })], [[0, 'confetti', 10], [0, 'note', 4]], { loop: true })],
    echec: [R(2200, [G.tuck(0, 300, 800), G.armR(1300, 110, 200, 500)], [F(0, 'open', 'frown', { mood: 'rain' }), F(1300, 'open', 'smile', { mood: 'joy' })], [])],
    inactivite: [R(2000, [G.tilt(0, 14, 400, 1000)], [F(0, 'happy', 'smile')], [[300, 'note', 2]])],
    sommeil: [R(3000, [{ dx: [k(0, 0), k(1500, 10), k(3000, 0)], rot: [k(0, 8), k(1500, 12), k(3000, 8)] }], [F(0, 'closed', 'smile')], [[800, 'zzz']], { loop: true })],
    idle_long: [
      R(3600, [G.hop(0, 10, 400), G.arms(400, 150, 300, 1200), { rot: [k(2000, 0), k(2300, 70, 'Quad.in'), k(2600, 70), k(3200, 0, 'Back.out')], dy: [k(2000, 0), k(2300, 20, 'Quad.in'), k(2700, 20), k(3200, 0)] }], [F(0, 'closed', 'open', { mood: 'joy' }), F(2000, 'wide', 'o', { mood: null }), F(2800, 'closed', 'smile')], [[500, 'note', 3]]), // le poème, tombe du nuage
      R(3200, [G.look(0, 1, .3, 300), { rot: [k(600, 0), k(800, 6), k(1000, 0), k(1200, 6), k(1400, 0)] }, G.armR(2400, 120, 150, 300)], [F(0, 'open', 'smile'), F(1500, 'happy', 'open')], [[1500, 'note', 1]]), // parle à une particule
    ],
  });


  /* ---------- 3. orbe_coincee / orbe_debloquee (fiches PENDANT, ajout du Narrative) ----------
     Le moteur envoie orbe_coincee quand l'orbe est bloquée (pose tenue jusqu'à la suite),
     puis orbe_debloquee au moment où elle repart. Priorité 8.5 (entre pouvoir_active et dernier_coeur). */
  const STUCK = {
    bourdon: { // ouvre un œil, soupire, long ronflement de tuba vers l'orbe ; se rendort content
      c: R(1200, [{ reach: [k(500, 0), k(700, 1, 'Quad.out'), k(1200, 1)] }, G.grow(500, 1.12, 300, 700)], [F(0, 'sleepy', 'flat'), F(250, 'sleepy', 'moue', { brow: 'up' }), F(500, 'closed', 'open')], [[300, 'puff', 1], [600, 'note', 2], [900, 'zzz', 1]], { hold: true, track: true }),
      d: R(1100, [G.squash(0, .1), G.tilt(200, 10, 250, 500)], [F(0, 'happy', 'smile', { zzz: true }), F(500, 'closed', 'o', { zzz: true })], [[400, 'zzz', 2]], { then: 'suivi' }),
    },
    jumelles: { // poussent chacune d'un côté (elles s'annulent), se regardent, poussent ensemble ; se tapent dans la main
      c: R(1200, [{ bicker: [k(0, 0), k(150, 1), k(550, 1), k(650, 0)] }, G.sep(0, 26, 150, 400), G.huddle(700, 150, 350), G.arms(700, 90, 120, 350, 90), G.shake(150, 1.4, 450)], [F(0, 'squint', 'flat', { brow: 'stern' }), F(550, 'wide', 'o'), F(700, 'squint', 'grin', { brow: 'stern' })], [[600, 'excl', 1]], { hold: true, track: true }),
      d: R(900, [G.huddle(0, 120, 300), G.arms(0, 160, 120, 300), G.hop(120, 14, 320)], [F(0, 'happy', 'grin')], [[200, 'sparkle', 3]], { then: 'suivi' }),
    },
    volte: { // claque sa queue comme un fouet « tchak » ; souffle sur le bout de sa queue comme sur un pistolet
      c: R(1000, [{ rot: [k(0, 0), k(250, -30, 'Quad.out'), k(380, 40, 'Back.out'), k(600, 0), k(1000, 0)] }, G.squash(380, .14), G.armR(0, 120, 150, 400)], [F(0, 'squint', 'flat', { brow: 'cocky' }), F(380, 'open', 'grin', { brow: 'cocky' })], [[380, 'whoosh', 2], [400, 'burst', 1]], { hold: true, track: true }),
      d: R(1100, [G.tilt(0, -25, 200, 600), G.armR(0, 160, 150, 600)], [F(0, 'open', 'o', { brow: 'cocky', shades: true }), F(700, 'happy', 'grin', { shades: true })], [[250, 'puff', 2]], { then: 'suivi' }),
    },
    mousse: { // regarde partout, gênée, tend un petit filet de brume et tire ; se cache derrière son éventail, fière
      c: R(1200, [{ lookX: [k(0, -1), k(200, 1), k(400, -1), k(600, .8)] }, { reach: [k(550, 0), k(800, 1, 'Quad.out'), k(1000, .85), k(1200, .95)] }, G.cheeks(0, 1, 200, 800), G.fade(0, .7, 200, 800)], [F(0, 'wide', 'wavy'), F(600, 'squint', 'moue')], [], { hold: true }),
      d: R(1000, [G.fan(0, 1, 150, 600), G.shrink(0, .85, 150, 500), G.cheeks(0, 1, 150, 600)], [F(0, 'happy', 'smile')], [[200, 'sparkle', 1]], { then: 'suivi' }),
    },
    horloge: { // chronomètre, tapote le cadran « inacceptable » ; ressort « boing » ; rajuste ses lunettes
      c: R(1200, [{ armL: [k(0, 10), k(150, 100), k(300, 80), k(420, 100), k(540, 80), k(660, 100), k(800, 10)] }, { reach: [k(800, 0), k(950, 1.15, 'Back.out'), k(1100, .9), k(1200, 1)] }, G.squash(800, .12)], [F(0, 'squint', 'flat', { brow: 'stern' }), F(800, 'wide', 'o')], [[150, 'tick', 1], [420, 'tick', 1], [660, 'tick', 1], [820, 'excl', 1]], { hold: true, track: true }),
      d: R(900, [{ reach: [k(0, 1), k(250, 0, 'Back.in')] }, G.armR(300, 120, 120, 250)], [F(0, 'open', 'flat', { brow: 'stern' }), F(500, 'open', 'smile')], [], { then: 'suivi' }),
    },
    grelot: { // trépigne à toute vitesse, roulement de clochettes « allez allez » ; elle repart déjà en avance
      c: R(1200, [G.hops(0, 8, 6, 140), G.shake(0, 1, 1200), G.arms(0, 140, 100, 900)], [F(0, 'wide', 'open', { brow: 'up' })], [[0, 'note', 1], [300, 'note', 1], [600, 'note', 1], [900, 'note', 1]], { hold: true, track: true }),
      d: R(900, [G.slide(0, 40, 150, 350), G.tilt(0, 18, 150, 350)], [F(0, 'happy', 'grin')], [[0, 'whoosh', 2]], { then: 'suivi' }),
    },
    nuagelune: { // ne s'en aperçoit pas tout de suite, puis chatouille l'orbe avec sa plume ; sourit, arpège de harpe
      c: R(1200, [{ lookY: [k(0, -1), k(500, -1), k(600, 0)] }, { reach: [k(600, 0), k(850, 1, 'Quad.out'), k(1200, 1)] }, G.armR(600, 90, 200, 400)], [F(0, 'closed', 'smile'), F(500, 'open', 'o'), F(700, 'open', 'smile')], [[0, 'note', 1]], { hold: true, track: true }),
      d: R(1100, [{ reach: [k(0, 1), k(300, 0)] }, G.tilt(200, -10, 250, 500)], [F(0, 'happy', 'smile')], [[200, 'note', 1], [400, 'note', 1], [600, 'note', 1]], { then: 'suivi' }),
    },
  };
  Object.keys(STUCK).forEach(key => Object.assign(OVERRIDES[key] = OVERRIDES[key] || {}, { orbe_coincee: [STUCK[key].c], orbe_debloquee: [STUCK[key].d] }));


  /* ---------- 4. Jalon 3 : variantes anti-répétition + duel (09-jalon3-variantes-et-duel.md) ----------
     orbe_coincee Vn est toujours suivie de orbe_debloquee Vn (appariement dans le rig : PAIR).
     prop : accessoire tenu au bout du bras droit (hammer, pompom, pillow, pen, stamp, umbrella, notebook, parcel). */
  const BASE = global.AstresRig.REACTIONS;
  const H = { hold: true, track: true }, S = { then: 'suivi' };
  const J3 = {
    pip: {
      c: [ // V2 le marteau (tape en rythme) · V3 les pompons
        R(1200, [{ armR: [k(0, 60), k(150, 150, 'Back.out'), k(300, 70, 'Quad.in'), k(450, 150), k(600, 70, 'Quad.in'), k(750, 150), k(900, 70, 'Quad.in'), k(1050, 150), k(1200, 70, 'Quad.in')] }, G.shake(300, .6, 900)], [F(0, 'squint', 'tongue', { brow: 'stern' })], [[300, 'sparkle', 1], [600, 'sparkle', 1], [900, 'sparkle', 1]], Object.assign({ prop: 'hammer' }, H)),
        R(1200, [G.hops(0, 4, 12, 300), { armL: [k(0, 10), k(150, 150), k(300, 110), k(450, 150), k(600, 110), k(750, 150), k(900, 110), k(1050, 150)], armR: [k(0, 10), k(150, 110), k(300, 150), k(450, 110), k(600, 150), k(750, 110), k(900, 150), k(1050, 110)] }], [F(0, 'happy', 'grin', { meche: 'antenna' })], [[0, 'note', 1], [600, 'note', 1]], Object.assign({ prop: 'pompom' }, H)),
      ],
      d: [
        R(1300, [{ propRot: [k(0, 0), k(250, -200, 'Quad.out'), k(450, -380, 'Quad.in')], propA: [k(450, 1), k(900, 1), k(1000, 0)], armR: [k(0, 150), k(250, 150)] }, G.squash(450, .3, 500)], [F(0, 'wide', 'o'), F(450, 'spiral', 'wavy'), F(950, 'happy', 'smile')], [[450, 'sparkle', 4]], Object.assign({ prop: 'hammer' }, S)),
        R(1200, [{ propA: [k(0, 1), k(200, 0)] }, G.spin(250, 1, 600), G.arms(250, 160, 120, 500), G.hop(250, 22, 500)], [F(0, 'wide', 'grin'), F(400, 'happy', 'grin')], [[100, 'confetti', 10]], Object.assign({ prop: 'pompom' }, S)),
      ],
      r: [ // V3 gardien de but · V4 le bisou
        R(1100, [G.lieBack(0, 200, 400), G.arms(0, 160, 100, 400), G.hop(700, 18, 400)], [F(0, 'squint', 'open'), F(700, 'happy', 'grin', { brow: 'up' })], [[700, 'sparkle', 3]]),
        R(1000, [G.armR(0, 100, 150, 300), G.tilt(0, -10, 150, 400), G.cheeks(200, 1, 150, 500)], [F(0, 'closed', 'moue'), F(400, 'happy', 'smile')], [[250, 'heart', 3]]),
      ],
    },
    bourdon: {
      c: [ // V2 le coussin · V3 le roulé
        R(1200, [{ armR: [k(0, 10), k(250, 160, 'Back.out'), k(350, 60), k(1200, 60)], propA: [k(0, 1), k(300, 1), k(320, 0)] }, { lookX: [k(400, -1), k(700, 1), k(1000, -1), k(1200, 0)] }], [F(0, 'sleepy', 'flat'), F(400, 'sleepy', 'moue', { brow: 'worried' })], [[300, 'whoosh', 1]], Object.assign({ prop: 'pillow' }, H)),
        R(1200, [{ rot: [k(0, 0), k(1200, 360, 'Linear')], dx: [k(0, 0), k(1200, 10)] }], [F(0, 'closed', 'o', { zzz: true })], [], Object.assign({ loop: false }, H)),
      ],
      d: [
        R(1200, [G.grow(0, 1.08, 300, 300), G.tilt(500, 10, 250, 400)], [F(0, 'closed', 'baille'), F(500, 'closed', 'smile', { zzz: true })], [[600, 'zzz', 2]], S),
        R(1500, [{ rot: [k(0, 360), k(700, 900, 'Linear'), k(701, 900), k(1500, 1080, 'Quad.out')], dx: [k(0, 10), k(700, 90, 'Quad.in'), k(701, -90), k(1500, 0, 'Quad.out')], alpha: [k(600, 1), k(700, 0), k(760, 0), k(860, 1)] }], [F(0, 'closed', 'o', { zzz: true })], [], S),
      ],
      r: [ // V3 le pouce · V4 la sieste méritée
        R(900, [G.armR(0, 150, 150, 400)], [F(0, 'closed', 'smile', { zzz: true })], []),
        R(1100, [G.tuck(0, 250, 600), G.tilt(0, 12, 250, 600)], [F(0, 'closed', 'o', { zzz: true })], [[200, 'zzz', 3]]),
      ],
    },
    jumelles: {
      c: [ // V2 le chifoumi (égalités) · V3 la pyramide
        R(1200, [G.piston(0, 6, 6, 200), G.arms(0, 70, 100, 1000, 70)], [F(0, 'squint', 'flat', { brow: 'stern' }), F(600, 'wide', 'o')], [[400, 'excl', 1], [1000, 'excl', 1]], H),
        R(1200, [{ duoSep: [k(0, 0), k(300, -44, 'Back.out'), k(1200, -44)], duoDy: [k(0, 0), k(300, 24, 'Back.out'), k(1200, 24)], duoRot: [k(300, 0), k(500, 8), k(700, -8), k(900, 8), k(1100, -8)] }, G.shake(300, .8, 900)], [F(0, 'wide', 'puff'), F(400, 'squint', 'puff')], [], H),
      ],
      d: [
        R(1100, [G.duoRot(0, 10, 150, 500), { lookX: [k(0, 0), k(200, 1), k(700, 1), k(900, 0)] }], [F(0, 'wide', 'o'), F(300, 'squint', 'moue', { brow: 'stern' })], [[300, 'excl', 2]], S),
        R(1300, [{ duoSep: [k(0, -44), k(250, 30, 'Bounce.out'), k(1000, 30), k(1300, 0)], duoDy: [k(0, 24), k(250, 0, 'Bounce.out')], duoRot: [k(0, 0), k(250, 40), k(1000, 40), k(1300, 0)] }, G.shake(300, 1.2, 700)], [F(0, 'wide', 'open'), F(300, 'happy', 'grin')], [[300, 'sparkle', 4]], S),
      ],
      r: [ // V3 la ola · V4 le compte
        R(1100, [{ armL: [k(0, 10), k(200, 160, 'Back.out'), k(400, 10), k(700, 160, 'Back.out'), k(1000, 10)], armR: [k(150, 10), k(350, 160, 'Back.out'), k(550, 10), k(700, 160, 'Back.out'), k(1000, 10)] }, G.hop(700, 14, 300)], [F(0, 'happy', 'grin')], [[700, 'sparkle', 2]]),
        R(1200, [G.arms(0, 150, 120, 500), G.bicker(500, 2, 300)], [F(0, 'open', 'smile'), F(500, 'squint', 'open', { brow: 'stern' })], [[600, 'excl', 1]]),
      ],
    },
    volte: {
      c: [ // V2 le lasso · V3 le regard qui tue
        R(1200, [{ armR: [k(0, 10), k(200, 170, 'Back.out'), k(1200, 170)], rot: [k(0, 0), k(300, -8), k(600, 8), k(900, -8), k(1200, 8)] }], [F(0, 'squint', 'grin', { brow: 'cocky', shades: true })], [[200, 'whoosh', 1], [500, 'whoosh', 1], [800, 'whoosh', 1]], H),
        R(1200, [G.slide(0, 8, 250, 900), G.shake(400, .5, 800)], [F(0, 'squint', 'flat', { brow: 'stern', shades: false })], [], H),
      ],
      d: [
        R(1200, [{ rot: [k(0, 0), k(150, -25, 'Quad.out'), k(400, 0, 'Back.out')], armR: [k(0, 170), k(150, 60), k(600, 160), k(1000, 160), k(1200, 10)] }, G.squash(150, .12)], [F(0, 'open', 'grin', { brow: 'cocky', shades: true })], [[150, 'burst', 2], [700, 'puff', 2]], S),
        R(900, [G.armR(0, 150, 150, 300)], [F(0, 'squint', 'grin', { brow: 'cocky', shades: true })], [[200, 'sparkle', 1]], S),
      ],
      r: [ // V3 le skate · V4 l'autographe
        R(1200, [{ dx: [k(0, 0), k(500, 30, 'Quad.out'), k(650, 26), k(1200, 0)], rot: [k(0, 0), k(500, -15), k(650, 18, 'Back.out'), k(1200, 0)] }, G.arms(0, 120, 150, 500)], [F(0, 'happy', 'grin', { shades: true })], [[550, 'puff', 3]]),
        R(1200, [{ armR: [k(0, 10), k(200, 110), k(350, 140), k(500, 100), k(650, 140), k(800, 120), k(1200, 10)] }], [F(0, 'squint', 'grin', { brow: 'cocky' })], [[800, 'sparkle', 2]], { prop: 'pen' }),
      ],
    },
    mousse: {
      c: [ // V2 le vent · V3 la prière
        R(1200, [G.grow(0, 1.25, 500, 700), { cheeks: [k(0, 0), k(1200, 1)] }, { reach: [k(300, 0), k(600, .7), k(1200, 1)] }], [F(0, 'squint', 'puff')], [], Object.assign({}, H)),
        R(1200, [G.arms(0, 60, 150, 1000, 60), G.tuck(0, 200, 900), G.shake(200, .7, 1000)], [F(0, 'closed', 'flat')], [], { hold: true }),
      ],
      d: [
        R(1100, [G.shrink(0, .8, 250, 200), G.fan(300, .9, 150, 400), G.cheeks(0, 1, 150, 600)], [F(0, 'closed', 'wavy'), F(400, 'squint', 'smile')], [[0, 'puff', 3]], S),
        R(1200, [G.fan(500, 1, 150, 400)], [F(0, 'squint', 'o'), F(300, 'wide', 'o'), F(500, 'happy', 'smile')], [[600, 'sparkle', 1]], S),
      ],
      r: [ // V3 le cœur de brume · V4 le soupir
        R(1100, [G.armR(0, 110, 200, 400), G.cheeks(0, 1, 200, 600), G.fan(700, 1, 150, 200)], [F(0, 'open', 'smile'), F(700, 'squint', 'smile')], [[250, 'heart', 1]]),
        R(1100, [G.fade(200, .4, 200, 300), { sx: [k(0, 1), k(300, 1.2), k(700, 1, 'Elastic.out')], sy: [k(0, 1), k(300, .85), k(700, 1, 'Elastic.out')] }], [F(0, 'closed', 'o'), F(700, 'open', 'smile')], [[200, 'puff', 4]]),
      ],
    },
    horloge: {
      c: [ // V2 le règlement · V3 la pendule
        R(1200, [{ armR: [k(0, 10), k(200, 80), k(1200, 80)], propRot: [k(200, 0), k(400, 6), k(600, -6), k(800, 6), k(1000, -6), k(1200, 6)] }, G.look(0, .3, .8)], [F(0, 'squint', 'flat', { brow: 'stern' })], [[300, 'tick', 1], [800, 'tick', 1]], Object.assign({ prop: 'notebook' }, H)),
        R(1200, [{ rot: [k(0, 0), k(200, 6), k(400, -9), k(600, 12), k(800, -15), k(1000, 18), k(1200, -20)] }], [F(0, 'open', 'flat', { brow: 'stern' })], [], H),
      ],
      d: [
        R(1000, [{ armR: [k(0, 80), k(150, 150, 'Back.out'), k(500, 150), k(700, 10)], propA: [k(0, 1), k(450, 1), k(500, 0)] }], [F(0, 'open', 'flat', { brow: 'stern' }), F(500, 'open', 'smile')], [[200, 'puff', 2]], Object.assign({ prop: 'notebook' }, S)),
        R(900, [{ rot: [k(0, -20), k(90, 0, 'Quad.out')] }, G.cuckoo(150, 1, 400)], [F(0, 'open', 'flat'), F(300, 'open', 'smile')], [[150, 'note', 1]], S),
      ],
      r: [ // V3 pile à l'heure · V4 le carillon
        R(1000, [G.armL(0, 90, 150, 400), { dy: [k(500, 0), k(600, 4), k(700, 0), k(800, 4), k(900, 0)] }], [F(0, 'squint', 'flat'), F(500, 'open', 'smile')], [[200, 'tick', 1]]),
        R(1100, [G.cuckoo(0, 3, 300)], [F(0, 'closed', 'smile')], [[0, 'note', 1], [300, 'note', 1], [600, 'note', 1]]),
      ],
    },
    grelot: {
      c: [ // V2 le facteur · V3 la course (recule)
        R(1200, [{ armR: [k(0, 10), k(100, 90), k(200, 70), k(300, 90), k(400, 70), k(500, 90), k(600, 70), k(700, 90), k(800, 70), k(900, 90), k(1000, 70), k(1100, 90)] }, G.shake(0, .6, 1200)], [F(0, 'wide', 'open', { brow: 'up' })], [[0, 'note', 1], [400, 'note', 1], [800, 'note', 1]], H),
        R(1200, [{ dx: [k(0, 0), k(1200, -28, 'Quad.out')], rot: [k(0, 0), k(300, -12)], sx: [k(0, 1), k(1200, 1.1)], sy: [k(0, 1), k(1200, .9)] }], [F(0, 'squint', 'grin', { brow: 'stern' })], [[600, 'sweat', 1]], H),
      ],
      d: [
        R(1100, [{ armR: [k(0, 90), k(200, 110), k(500, 110), k(700, 10)], propA: [k(0, 1), k(450, 1), k(550, 0)] }, G.slide(500, 50, 200, 200)], [F(0, 'happy', 'open'), F(500, 'happy', 'grin')], [[500, 'whoosh', 2]], Object.assign({ prop: 'parcel' }, S)),
        R(1300, [{ dx: [k(0, -28), k(300, 34, 'Quad.in'), k(500, 30, 'Back.out'), k(1300, 0)], rot: [k(0, -12), k(300, 20), k(600, 0)] }, G.shrink(700, .9, 200, 300)], [F(0, 'wide', 'open'), F(500, 'open', 'frown', { brow: 'worried' })], [[300, 'puff', 3]], S),
      ],
      r: [ // V3 en retard (essoufflée) · V4 le tampon
        R(1300, [G.slide(0, 16, 300, 0), G.clap(300, 4, 160), { sy: [k(0, 1), k(150, .9), k(300, 1.05), k(450, .9), k(600, 1)] }], [F(0, 'squint', 'open'), F(400, 'happy', 'grin')], [[0, 'sweat', 2]]),
        R(1000, [{ armR: [k(0, 10), k(200, 150, 'Back.out'), k(350, 60, 'Quad.in'), k(800, 60), k(1000, 10)] }, G.squash(350, .1)], [F(0, 'squint', 'flat'), F(350, 'happy', 'grin')], [[350, 'burst', 2]], { prop: 'stamp' }),
      ],
    },
    nuagelune: {
      c: [ // V2 la berceuse · V3 la pluie
        R(1200, [{ rot: [k(0, 0), k(300, 8), k(600, -8), k(900, 8), k(1200, -8)] }], [F(0, 'closed', 'o')], [[0, 'note', 1], [400, 'note', 1], [800, 'note', 1]], H),
        R(1200, [G.look(0, .4, .6)], [F(0, 'open', 'smile', { mood: 'rain' })], [], H),
      ],
      d: [
        R(1100, [G.armR(0, 60, 200, 600), G.cheeks(0, 1, 200, 600)], [F(0, 'happy', 'wavy')], [[200, 'heart', 1]], S),
        R(1300, [{ propOpen: [k(300, 1), k(900, 0)] }, G.armR(0, 130, 150, 700)], [F(0, 'happy', 'smile', { mood: 'joy' })], [[0, 'sparkle', 2]], Object.assign({ prop: 'umbrella' }, S)),
      ],
      r: [ // V3 le poème · V4 le hamac
        R(1200, [G.armR(0, 130, 200, 600), G.tilt(0, -6, 200, 600)], [F(0, 'closed', 'o')], [[100, 'note', 1], [400, 'note', 1], [700, 'note', 1]]),
        R(1200, [G.lieBack(0, 350, 500)], [F(0, 'closed', 'smile')], [[300, 'sigh', 1]]),
      ],
    },
  };
  // duel_avantage : taquine l'Astre adverse (le moteur pose target vers l'autre marge, ou flip pour J2)
  const TAUNT = {
    pip: R(1200, [G.look(0, 1, 0), G.tilt(0, 10, 150, 500), G.wave(700, 3, 120)], [F(0, 'squint', 'tongue'), F(700, 'happy', 'grin')], []),
    bourdon: R(1200, [G.look(0, 1, 0), G.grow(0, 1.08, 300, 300), G.tilt(600, 10, 200, 400)], [F(0, 'sleepy', 'baille'), F(600, 'closed', 'o', { zzz: true })], [[700, 'zzz', 1]]),
    jumelles: R(1100, [G.look(0, 1, 0), G.duoRot(0, 12, 150, 450), G.huddle(750, 100, 200), G.arms(750, 160, 100, 200)], [F(0, 'squint', 'tongue'), F(750, 'happy', 'grin')], [[800, 'sparkle', 2]]),
    volte: R(1200, [G.look(0, 1, 0), { armL: [k(0, 10), k(200, 70), k(600, 70), k(700, 10)], armR: [k(600, 10), k(800, 110, 'Back.out'), k(1100, 110), k(1200, 10)] }], [F(0, 'squint', 'smile', { brow: 'cocky', shades: true })], [[300, 'puff', 1]]),
    mousse: R(1100, [G.look(0, 1, 0), G.fan(0, .5, 150, 300), G.fan(600, 1, 100, 300, .5), G.cheeks(300, 1, 150, 500)], [F(0, 'squint', 'moue'), F(600, 'squint', 'smile')], [[350, 'heart', 1]]),
    horloge: R(1200, [G.look(0, 1, 0), { armL: [k(0, 10), k(150, 100), k(350, 80), k(500, 100), k(650, 80), k(800, 100), k(1100, 10)] }], [F(0, 'squint', 'smile', { brow: 'stern' })], [[350, 'tick', 1], [650, 'tick', 1]]),
    grelot: R(1200, [G.dash(0, 3, 30, 260), G.look(0, 1, 0)], [F(0, 'happy', 'grin')], [[800, 'note', 1]]),
    nuagelune: R(1200, [G.look(0, 1, 0), { rot: [k(700, 0), k(900, -25), k(1100, 0)] }, G.armR(700, 100, 150, 200)], [F(0, 'squint', 'smile', { mood: 'rain' }), F(700, 'closed', 'smile')], []),
  };
  // Astre taquiné : moue, bras croisés, puis se reconcentre (générique, même pour tous)
  BASE.duel_taquine = [R(1200, [{ armL: [k(0, 10), k(200, 70), k(800, 70), k(1000, 10)], armR: [k(0, 10), k(200, 70), k(800, 70), k(1000, 10)] }, G.look(0, -.6, .3), G.tilt(0, -6, 200, 600)], [F(0, 'squint', 'moue', { brow: 'stern' }), F(900, 'open', 'flat', { brow: null })], [[100, 'puff', 1]])];
  Object.keys(J3).forEach(key => {
    const O = OVERRIDES[key] = OVERRIDES[key] || {}, j = J3[key];
    O.orbe_coincee = [...(O.orbe_coincee || BASE.orbe_coincee), ...j.c];
    O.orbe_debloquee = [...(O.orbe_debloquee || BASE.orbe_debloquee), ...j.d];
    O.orbe_recupere = [...(O.orbe_recupere || BASE.orbe_recupere), ...j.r];
    O.duel_avantage = [TAUNT[key]];
  });
  OVERRIDES.bourdon.duel_taquine = [R(1300, [G.look(0, -.6, .3)], [F(0, 'sleepy', 'moue'), F(500, 'closed', 'o', { zzz: true })], [[600, 'zzz', 2]])]; // boude... en dormant

})(typeof window !== 'undefined' ? window : globalThis);
