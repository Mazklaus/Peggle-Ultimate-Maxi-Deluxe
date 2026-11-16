"""Génère les 16 niveaux du jalon 1 (prologue + chapitre 1) au format v1."""
import math, json, os, sys

W, H = 880, 656
MIN_D = 24  # un peu plus que les 22 px exigés

def arc(cx, cy, r, a0, a1, n):
    if n == 1: return [(cx + r*math.cos(math.radians(a0)), cy + r*math.sin(math.radians(a0)))]
    return [(cx + r*math.cos(math.radians(a0 + (a1-a0)*i/(n-1))), cy + r*math.sin(math.radians(a0 + (a1-a0)*i/(n-1)))) for i in range(n)]

def ring(cx, cy, r, n, phase=0):
    return [(cx + r*math.cos(math.radians(phase + 360*i/n)), cy + r*math.sin(math.radians(phase + 360*i/n))) for i in range(n)]

def line(x0, y0, x1, y1, n):
    if n == 0: return []
    if n == 1: return [(x0, y0)]
    return [(x0 + (x1-x0)*i/(n-1), y0 + (y1-y0)*i/(n-1)) for i in range(n)]

def rows(x0, x1, y0, nrows, dy, n, stagger=True):
    out = []
    for r in range(nrows):
        off = (x1-x0)/(n-1)/2 if (stagger and r % 2) else 0
        k = n - (1 if (stagger and r % 2) else 0)
        out += line(x0+off, y0+r*dy, x1-off if False else x0+off+(x1-x0)/(n-1)*(k-1), y0+r*dy, k)
    return out

def mirror(pts):
    return pts + [(W - x, y) for x, y in pts]

def star(cx, cy, r_out, r_in, branches, per_edge, phase=-90):
    verts = []
    for i in range(branches*2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(phase + 180*i/branches)
        verts.append((cx + r*math.cos(a), cy + r*math.sin(a)))
    out = []
    for i in range(len(verts)):
        (x0, y0), (x1, y1) = verts[i], verts[(i+1) % len(verts)]
        out += line(x0, y0, x1, y1, per_edge+1)[:-1]
    return out

def spiral(cx, cy, r0, r1, turns, n, phase=0):
    return [(cx + (r0+(r1-r0)*i/(n-1))*math.cos(math.radians(phase+360*turns*i/(n-1))),
             cy + (r0+(r1-r0)*i/(n-1))*math.sin(math.radians(phase+360*turns*i/(n-1)))) for i in range(n)]

def build(pts, imposed=(), walls=(), groups=()):
    """pts : cercles libres ; imposed : [(x,y,kind)] ; walls : [(x,y,w,angle)] briques incassables ;
    groups : [(id, cx, cy, pts, kind|None)] pegs d'un groupe tournant (rotate/orbit) autour de (cx, cy)."""
    pegs = []
    rings = []  # (cx, cy, rayon) parcourus par les pegs des groupes
    for gid, cx, cy, gpts, gkind in groups:
        for x, y in gpts:
            x, y = round(x), round(y); r = math.hypot(x-cx, y-cy)
            if cy - r < 100 or cy + r > 570 or cx - r < 20 or cx + r > W-20: raise SystemExit(f'groupe {gid} sort de la zone')
            if all(math.hypot(p['x']-x, p['y']-y) >= MIN_D for p in pegs):
                q = {'x': x, 'y': y, 'group': gid}
                if gkind: q['kind'] = gkind
                pegs.append(q); rings.append((cx, cy, r))
    def ok(x, y):
        return 20 <= x <= W-20 and 100 <= y <= 570 and all(
            p.get('shape') == 'brick' or math.hypot(p['x']-x, p['y']-y) >= MIN_D for p in pegs) and all(
            abs(math.hypot(x-cx, y-cy) - r) >= MIN_D for cx, cy, r in rings)
    for x, y, k in imposed:
        if ok(x, y): pegs.append({'x': round(x), 'y': round(y), 'kind': k})
        else: raise SystemExit(f'imposé refusé {x},{y}')
    for x, y in pts:
        x, y = round(x), round(y)
        if ok(x, y): pegs.append({'x': x, 'y': y})
    def seg_d(px, py, x, y, w, ang):
        c, s_ = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        t = max(-w/2, min(w/2, (px-x)*c + (py-y)*s_))
        return math.hypot(px - (x + t*c), py - (y + t*s_))
    pegs = [p for p in pegs if all(seg_d(p['x'], p['y'], x, y, w, a) >= 26 for x, y, w, a in walls)]
    for x, y, w, ang in walls:
        if min(abs(ang) % 90, 90 - abs(ang) % 90) < 8: raise SystemExit(f'mur trop plat ({ang}°) : 8° minimum par rapport à l\'horizontale et à la verticale')
        pegs.append({'x': round(x), 'y': round(y), 'shape': 'brick', 'w': w, 'h': 12, 'angle': ang, 'kind': 'wall'})
    return pegs

GUARDS = [(30, y) for y in (230, 330, 430, 530)] + [(850, y) for y in (230, 330, 430, 530)]

GUARD_IMP = [(x, y, 'common') for x, y in GUARDS]
GUARD_IMP_LIGHT = [(30, 300, 'common'), (30, 460, 'common'), (850, 300, 'common'), (850, 460, 'common')]

def level(id_, chapter, index, title, rhythm, orbs, hearts, commons, bonus, power, pegs, companion=None, locked=False, sym=False, decor=(), orbs_note=None, clusters=()):
    # clusters : centres de grappes de cœurs imposés (règle GD respiration : cœurs groupés, pas isolés)
    if clusters:
        per = hearts // len(clusters)
        for k, (cx, cy) in enumerate(clusters):
            n = per + (1 if k < hearts - per*len(clusters) else 0)
            cand = sorted((p for p in pegs if 'kind' not in p and 'group' not in p and p.get('shape') != 'brick'),
                          key=lambda p: math.hypot(p['x']-cx, p['y']-cy))
            for p in cand[:n]: p['kind'] = 'heart'
    imposed_heart = sum(1 for p in pegs if p.get('kind') == 'heart')
    free = [p for p in pegs if 'kind' not in p]
    trim_free = [p for p in free if 'group' not in p]
    imposed_power = sum(1 for p in pegs if p.get('kind') == 'power')
    imposed_common = sum(1 for p in pegs if p.get('kind') == 'common')
    need = (hearts - imposed_heart) + (commons - imposed_common) + bonus + (power - imposed_power)
    if len(free) < need:
        print(f'MANQUE {id_}: {len(free)} < {need}'); need = len(free)
    # retire l'excédent de façon régulière (garde la silhouette)
    extra = len(free) - need
    print(id_, 'surplus', extra)
    if extra:
        cand = [p for p in trim_free if (p['x'], p['y']) not in GUARDS]
        if sym:
            # retrait par paires miroir (axe x = 440) pour garder la symétrie
            def mate(q): return next((r for r in cand if r is not q and abs(880 - r['x'] - q['x']) <= 2 and abs(r['y'] - q['y']) <= 2), None)
            left = [q for q in cand if q['x'] < 438 and mate(q)]
            centre = [q for q in cand if abs(q['x'] - 440) <= 2]
            drop = set()
            for i in range(extra // 2):
                q = left[int(i*len(left)/(extra//2))]; drop |= {id(q), id(mate(q))}
            if extra % 2: drop.add(id(centre[len(centre)//2]))
        else:
            drop = set(id(cand[int(i*len(cand)/extra)]) for i in range(extra))
        pegs = [p for p in pegs if id(p) not in drop]
    stars = [700*hearts, 1200*hearts]
    return {
        'format': 2 if decor else 1, 'id': id_, 'chapter': chapter, 'index': index,
        'companion': companion, 'companionLocked': locked,
        'title': title, 'rhythm': rhythm, 'orbs': orbs,
        **({'guideBounces': 2} if id_ in ('pro-01', 'pro-02') else {}), 'stars': stars,
        'assign': {'hearts': hearts - imposed_heart, 'power': power - imposed_power, 'bonus': bonus},
        'pegs': pegs, 'decor': list(decor),
    }


L = []
def disc(cx, cy, r, step=44):
    """Disque rempli d'anneaux concentriques espacés de ~step."""
    out = [(cx, cy)]; k = 1
    while k*step <= r:
        rr = k*step; n = max(6, int(2*math.pi*rr/step)); out += ring(cx, cy, rr, n, phase=15*k); k += 1
    return out

# ---------- PROLOGUE (sans Astre) ----------
# P1 viser + tirer : une arche douce, facile à toucher partout.
pts = arc(440, 140, 300, 25, 155, 24) + arc(440, 150, 240, 30, 150, 16)
L.append(level('pro-01', 0, 1, 'Première lueur', 'tutoriel', 10, 10, 34, 0, 0, build(pts, GUARD_IMP_LIGHT)))

# P2 réceptacle : deux bols sur les côtés, l'orbe roule vers le couloir central et le réceptacle.
pts = arc(230, 180, 180, 15, 165, 17) + arc(230, 200, 120, 20, 160, 11) + arc(650, 180, 180, 15, 165, 17) + arc(650, 200, 120, 20, 160, 11) \
    + line(410, 180, 470, 180, 3)
L.append(level('pro-02', 0, 2, 'Le panier des étoiles', 'tutoriel', 13, 12, 40, 0, 0, build(pts, GUARD_IMP)))

# P3 bonus : trois lanternes en bol, le bonus saute de l'une à l'autre.
pts = []
for cx, cy in ((230, 200), (650, 200), (440, 360)):
    pts += arc(cx, cy, 150, 15, 165, 15) + arc(cx, cy + 10, 95, 25, 155, 9)
L.append(level('pro-03', 0, 3, 'Trois lanternes', 'tutoriel', 13, 14, 50, 1, 0, build(pts, GUARD_IMP)))

# P4 multiplicateur : vagues d'arches emboîtées, première vraie constellation.
pts = arc(440, 110, 380, 20, 160, 34) + arc(440, 120, 300, 25, 155, 25) + arc(440, 130, 220, 30, 150, 18) + arc(440, 140, 140, 35, 145, 10)
L.append(level('pro-04', 0, 4, 'Le ciel s’éveille', 'tutoriel', 13, 15, 60, 1, 0, build(pts, GUARD_IMP)))

# ---------- CHAPITRE 1 : Pip ----------
PIP = dict(companion='pip')
# 1-1 découverte : pouvoir près du canon, constellation simple en V.
imp = [(380, 150, 'power'), (500, 150, 'power'), (440, 200, 'power')]
pts = line(80, 180, 440, 520, 16) + line(800, 180, 440, 520, 16)[:-1] + line(140, 160, 400, 460, 12) + line(740, 160, 480, 460, 12) \
    + rows(250, 630, 260, 2, 46, 8) + rows(80, 800, 560, 1, 0, 14)
L.append(level('ch1-01', 1, 1, 'Pip montre le chemin', 'decouverte', 13, 20, 55, 1, 3, build(pts, imp), locked=True, **PIP))

# 1-2 découverte : un rideau d'étoiles cache la nuée, la trajectoire aide à viser les trous.
imp = [(440, 150, 'power'), (180, 240, 'power'), (700, 240, 'power')]
pts = line(120, 300, 760, 300, 24) + rows(100, 780, 360, 4, 46, 13) + arc(440, 120, 260, 30, 150, 15) + [(60, 560), (820, 560)]
L.append(level('ch1-02', 1, 2, 'Les rideaux d’étoiles', 'decouverte', 13, 20, 60, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **PIP))

# 1-3 application : deux balances pleines reliées par un fléau.
pts = disc(240, 360, 140) + disc(640, 360, 140) + line(250, 190, 630, 190, 13) + line(440, 220, 440, 520, 9)
L.append(level('ch1-03', 1, 3, 'Les deux balances', 'application', 12, 22, 60, 1, 2, build(pts, GUARD_IMP), **PIP))

# 1-4 application : spirale serrée (lecture de trajectoire).
pts = spiral(440, 330, 30, 220, 2.4, 90) + arc(110, 380, 90, 20, 160, 9) + arc(770, 380, 90, 20, 160, 9) + arc(110, 380, 50, 30, 150, 5) + arc(770, 380, 50, 30, 150, 5) + [(440, 120), (300, 130), (580, 130)]
L.append(level('ch1-04', 1, 4, 'La spirale de Pip', 'application', 12, 22, 65, 1, 2, build(pts), **PIP))

# 1-5 application : coeurs nichés dans des coupes profondes, tir difficile sans Pip.
cups = []
for cx in (160, 440, 720):
    cups += arc(cx, 300, 125, 15, 165, 12) + disc(cx, 330, 90)
pts = cups + line(70, 180, 810, 180, 18)
L.append(level('ch1-05', 1, 5, 'Les trois coupes', 'application', 12, 23, 65, 1, 2, build(pts), **PIP))

# 1-6 respiration : nuée dense, le chaos est récompensé.
pts = rows(50, 830, 200, 6, 50, 19) + line(320, 150, 560, 150, 4)
L.append(level('ch1-06', 1, 6, 'Pluie de lucioles', 'respiration', 15, 16, 75, 1, 2, build(pts), **PIP, clusters=[(200, 260), (680, 260), (320, 420), (560, 420)]))

# 1-7 combinaison : rampes incassables (élément du ch.1), premier contact simple.
walls = [(200, 470, 160, 20), (680, 470, 160, -20)]
pts = rows(70, 810, 180, 5, 44, 18) + arc(440, 460, 120, 200, 340, 12)
L.append(level('ch1-07', 1, 7, 'Les toboggans', 'combinaison', 12, 23, 65, 1, 2, build(pts, walls=walls), **PIP))

# 1-8 combinaison : entonnoir de rampes vers une lanterne centrale pleine.
walls = [(170, 300, 200, 30), (710, 300, 200, -30)]
pts = rows(60, 820, 160, 3, 36, 20) + disc(440, 400, 150) + line(60, 380, 200, 540, 6) + line(820, 380, 680, 540, 6)
L.append(level('ch1-08', 1, 8, 'L’entonnoir', 'combinaison', 12, 24, 65, 1, 2, build(pts, walls=walls), **PIP))

# 1-9 combinaison : zigzag de rampes, ricochets en cascade.
walls = [(250, 250, 180, 15), (630, 330, 180, -15), (250, 410, 180, 15), (630, 490, 180, -15)]
pts = line(60, 150, 820, 150, 20) + line(80, 200, 800, 200, 20) + [(440, 245)] + line(420, 270, 840, 270, 12) + line(40, 350, 460, 350, 12) \
    + line(420, 430, 840, 430, 12) + line(40, 520, 460, 520, 12) + line(520, 560, 840, 560, 9)
L.append(level('ch1-09', 1, 9, 'La cascade', 'combinaison', 12, 24, 70, 1, 2, build(pts, walls=walls), **PIP))

# 1-10 maîtrise : grande roue pleine, rampe sous le moyeu.
pts = arc(440, 300, 240, 5, 175, 22) + arc(440, 300, 195, 10, 170, 18) + arc(440, 300, 150, 12, 168, 14) + arc(440, 300, 105, 15, 165, 10) + arc(440, 300, 60, 20, 160, 6) + arc(440, 300, 240, 200, 340, 13) + line(440, 130, 440, 250, 4) + line(40, 260, 40, 560, 8) + line(840, 260, 840, 560, 8) + [(120, 150), (760, 150), (200, 130), (680, 130), (40, 200), (840, 200)]
L.append(level('ch1-10', 1, 10, 'La roue du phare', 'maitrise', 12, 25, 70, 1, 2, build(pts, walls=[(412, 562, 62, -12), (468, 562, 62, 12)]), sym=True, **PIP))

# 1-11 maîtrise : voûte d'étoiles dense, deux coupes gardées par des rampes tournées vers le centre.
walls = [(330, 520, 120, -25), (550, 520, 120, 25)]
pts = rows(70, 810, 160, 4, 44, 18) + arc(150, 380, 110, 15, 165, 12) + arc(150, 390, 60, 20, 160, 7) \
    + arc(730, 380, 110, 15, 165, 12) + arc(730, 390, 60, 20, 160, 7) + arc(440, 330, 70, 0, 180, 9)
L.append(level('ch1-11', 1, 11, 'Les sœurs jumelles', 'maitrise', 12, 25, 75, 1, 2, build(pts, walls=walls), **PIP))

# 1-12 Grande Constellation : Pip lui-même, grande étoile à 5 branches, halo et rampes.
walls = [(150, 540, 140, 15), (730, 540, 140, -15)]
pts = star(440, 330, 240, 100, 5, 7) + arc(440, 290, 85, 15, 165, 9) + arc(440, 290, 45, 20, 160, 5) + arc(440, 380, 330, 30, 150, 22) + arc(440, 340, 300, 195, 345, 24) + rows(70, 810, 140, 1, 0, 6) + line(250, 575-10, 630, 575-10, 0) + line(340, 120, 540, 120, 0) + line(120, 140, 120, 140, 0) + [(380, 580-15), (500, 580-15), (300, 560), (580, 560), (100, 140), (780, 140), (240, 130), (640, 130), (160, 560), (720, 560), (440, 565), (60, 200), (820, 200)] \
    + line(40, 240, 40, 520, 9) + line(840, 240, 840, 520, 9)
L.append(level('ch1-12', 1, 12, 'Le réveil de Pip', 'grande-constellation', 13, 25, 80, 1, 2, build(pts, walls=walls), **PIP))


# ---------- CHAPITRE 2 : Bourdon (onde de choc), élément : rotation (niveaux 7+) ----------
BOU = dict(companion='bourdon')
def rot(gid, cx, cy, period, d=1): return {'id': gid, 'type': 'rotate', 'cx': cx, 'cy': cy, 'periodS': period, 'dir': d}
def hexa(x0, x1, y0, y1, step=46):
    out = []; r = 0; y = y0
    while y <= y1:
        off = step/2 if r % 2 else 0; x = x0 + off
        while x <= x1: out.append((x, y)); x += step
        y += step*0.87; r += 1
    return out

# 2-1 découverte : trois bols, un cristal pouvoir au cœur de chacun (l'onde de choc les vide).
imp = [(200, 300, 'power'), (680, 300, 'power'), (440, 420, 'power')]
pts = []
for cx, cy in ((200, 230), (680, 230), (440, 350)):
    pts += arc(cx, cy, 130, 15, 165, 13) + arc(cx, cy + 10, 85, 25, 155, 8)
pts += line(60, 140, 260, 140, 5) + line(620, 140, 820, 140, 5)
L.append(level('ch2-01', 2, 1, 'Bourdon se réveille', 'decouverte', 14, 16, 59, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **BOU))

# 2-2 découverte : nuées denses, les cristaux pouvoir au milieu des nuées.
imp = [(220, 300, 'power'), (660, 300, 'power'), (440, 200, 'power')]
pts = hexa(110, 330, 230, 400, 40) + hexa(550, 770, 230, 400, 40) + hexa(330, 550, 140, 260, 40) + arc(440, 380, 130, 20, 160, 9)
L.append(level('ch2-02', 2, 2, 'La ruche s’agite', 'decouverte', 15, 16, 64, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **BOU))

# 2-3 application : quatre bols en carré.
pts = []
for cx, cy in ((240, 170), (640, 170), (240, 360), (640, 360)):
    pts += arc(cx, cy, 120, 15, 165, 12) + arc(cx, cy + 10, 75, 25, 155, 7)
pts += line(440, 160, 440, 520, 7) + [(385, 270), (495, 270), (385, 450), (495, 450)]  # angles morts (QA)
L.append(level('ch2-03', 2, 3, 'Les quatre alvéoles', 'application', 14, 18, 64, 1, 2, build(pts, GUARD_IMP), **BOU))

# 2-4 application : lignes en zigzag et rampes.
walls = [(150, 470, 150, 20), (730, 470, 150, -20)]
pts = line(60, 160, 440, 260, 11) + line(820, 160, 440, 260, 11)[:-1] + line(60, 300, 440, 400, 11) + line(820, 300, 440, 400, 11)[:-1] \
    + rows(260, 620, 470, 2, 44, 9) + line(300, 140, 580, 140, 7) + line(60, 230, 400, 320, 9)[1:-1] + line(820, 230, 480, 320, 9)[1:-1] + [(440, 330), (440, 560)]
L.append(level('ch2-04', 2, 4, 'Le vol en zigzag', 'application', 12, 22, 65, 1, 2, build(pts, GUARD_IMP, walls=walls), **BOU))

# 2-5 application : grande ruche hexagonale.
pts = hexa(110, 770, 170, 470, 56)
L.append(level('ch2-05', 2, 5, 'La grande ruche', 'application', 13, 19, 69, 1, 2, build(pts, GUARD_IMP), **BOU))

# 2-6 respiration : pluie de pollen dense.
pts = rows(50, 830, 190, 7, 46, 19)
L.append(level('ch2-06', 2, 6, 'Pluie de pollen', 'respiration', 13, 16, 75, 1, 2, build(pts), **BOU, clusters=[(180, 300), (700, 300), (440, 250), (440, 430)]))

# 2-7 combinaison : première roue qui tourne, au centre, entourée de nuées fixes.
pts = rows(60, 820, 150, 2, 44, 18) + arc(150, 380, 110, 15, 165, 11) + arc(730, 380, 110, 15, 165, 11) + rows(260, 620, 540, 1, 0, 9)
g = [('roue', 440, 350, ring(440, 350, 110, 14) + ring(440, 350, 55, 7, phase=25), None)]
L.append(level('ch2-07', 2, 7, 'La première roue', 'combinaison', 12, 23, 65, 1, 2, build(pts, GUARD_IMP, groups=g), decor=[rot('roue', 440, 350, 14)], **BOU))

# 2-8 combinaison : deux roues qui tournent en sens contraire.
pts = rows(60, 820, 150, 2, 44, 18) + line(440, 230, 440, 520, 7) + rows(80, 800, 550, 1, 0, 16)
g = [('g', 230, 360, ring(230, 360, 120, 15) + ring(230, 360, 60, 7), None), ('d', 650, 360, ring(650, 360, 120, 15) + ring(650, 360, 60, 7), None)]
L.append(level('ch2-08', 2, 8, 'Les engrenages', 'combinaison', 12, 24, 70, 1, 2, build(pts, GUARD_IMP, groups=g), decor=[rot('g', 230, 360, 14), rot('d', 650, 360, 14, -1)], **BOU))

# 2-9 combinaison : moulin (croix tournante) au centre, bols de chaque côté.
spokes = []
for k in range(4):
    a = math.radians(45 + 90*k); spokes += [(440 + r*math.cos(a), 340 + r*math.sin(a)) for r in (40, 75, 110, 145)]
pts = arc(120, 250, 110, 15, 165, 11) + arc(760, 250, 110, 15, 165, 11) + arc(120, 430, 100, 15, 165, 10) + arc(760, 430, 100, 15, 165, 10) + line(240, 140, 640, 140, 10) + rows(250, 630, 540, 1, 0, 9) + line(60, 140, 180, 140, 4) + line(700, 140, 820, 140, 4) + arc(120, 260, 60, 30, 150, 5) + arc(760, 260, 60, 30, 150, 5)
g = [('moulin', 440, 340, spokes + [(440, 340)], None)]
L.append(level('ch2-09', 2, 9, 'Le moulin à miel', 'combinaison', 14, 20, 74, 1, 2, build(pts, GUARD_IMP, groups=g), decor=[rot('moulin', 440, 340, 12)], **BOU))

# 2-10 maîtrise : grande roue double (anneaux contraires), bols latéraux.
pts = arc(100, 300, 90, 15, 165, 9) + arc(780, 300, 90, 15, 165, 9) + arc(100, 470, 80, 15, 165, 8) + arc(780, 470, 80, 15, 165, 8) + line(260, 130, 620, 130, 9) + line(60, 140, 200, 140, 4) + line(680, 140, 820, 140, 4) + rows(300, 580, 560, 1, 0, 7) + arc(100, 310, 45, 30, 150, 4) + arc(780, 310, 45, 30, 150, 4)
g = [('ext', 440, 360, ring(440, 360, 155, 20), None), ('int', 440, 360, ring(440, 360, 95, 12) + ring(440, 360, 40, 5), None)]
L.append(level('ch2-10', 2, 10, 'La roue du rucher', 'maitrise', 13, 25, 70, 1, 2, build(pts, GUARD_IMP, groups=g), decor=[rot('ext', 440, 360, 16), rot('int', 440, 360, 12, -1)], **BOU))

# 2-11 maîtrise : trois fleurs tournantes et une voûte fixe.
pts = rows(60, 820, 150, 2, 44, 18) + rows(60, 820, 550, 1, 0, 18)
g = []; dec = []
for k, (cx, cy) in enumerate(((180, 360), (440, 330), (700, 360))):
    gid = f'fleur{k+1}'; g.append((gid, cx, cy, ring(cx, cy, 95, 12) + ring(cx, cy, 45, 6, phase=30) + [(cx, cy)], None)); dec.append(rot(gid, cx, cy, 14, 1 if k % 2 == 0 else -1))
L.append(level('ch2-11', 2, 11, 'Le jardin de Bourdon', 'maitrise', 13, 25, 75, 1, 2, build(pts, GUARD_IMP, groups=g), decor=dec, **BOU))

# 2-12 Grande Constellation : le Grand Hamac, une longue arche fixe tendue entre deux roues.
walls = [(330, 545, 120, 12), (550, 545, 120, -12)]
pts = arc(440, 40, 400, 35, 145, 26) + arc(440, 60, 330, 40, 140, 20) + rows(300, 580, 160, 2, 44, 7) + line(40, 470, 40, 560, 3) + line(840, 470, 840, 560, 3) + rows(90, 330, 430, 2, 44, 6) + rows(550, 790, 430, 2, 44, 6) + [(440, 560)]
g = [('gauche', 160, 220, ring(160, 220, 100, 13) + ring(160, 220, 50, 6), None), ('droite', 720, 220, ring(720, 220, 100, 13) + ring(720, 220, 50, 6), None)]
L.append(level('ch2-12', 2, 12, 'Le Grand Hamac', 'grande-constellation', 12, 25, 80, 1, 2, build(pts, groups=g, walls=walls), decor=[rot('gauche', 160, 220, 14), rot('droite', 720, 220, 14, -1)], **BOU))


# ---------- CHAPITRE 3 : Twi & Nkl (orbe scindé), élément : orbite (niveaux 7+) ----------
TWI = dict(companion='jumelles')
def orb(gid, cx, cy, r, period, d=1): return {'id': gid, 'type': 'orbit', 'cx': cx, 'cy': cy, 'rx': r, 'ry': r, 'periodS': period, 'dir': d}
def moons(prefix, cx, cy, r, n, period, d=1, phase=0):
    """Une orbite de n pegs (1 à 4) : renvoie (groupe pour build, entrée decor)."""
    return (prefix, cx, cy, ring(cx, cy, r, n, phase=phase), None), orb(prefix, cx, cy, r, period, d)

# 3-1 découverte : deux bols jumeaux, un cristal pouvoir au centre de chacun et un au milieu.
imp = [(250, 300, 'power'), (630, 300, 'power'), (440, 200, 'power')]
pts = mirror(arc(250, 220, 150, 15, 165, 15) + arc(250, 230, 100, 25, 155, 10) + arc(250, 240, 50, 35, 145, 5)) + rows(200, 680, 470, 2, 44, 12)
L.append(level('ch3-01', 3, 1, 'Twi et Nkl arrivent', 'decouverte', 15, 16, 59, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **TWI))

# 3-2 découverte : deux nuées en miroir, les pouvoirs entre les deux.
imp = [(440, 230, 'power'), (440, 330, 'power'), (440, 430, 'power')]
pts = mirror(hexa(90, 360, 190, 470, 46) + [(395, 280), (395, 380), (395, 480)])
L.append(level('ch3-02', 3, 2, 'Le miroir', 'decouverte', 15, 16, 64, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **TWI))

# 3-3 application : deux spirales jumelles.
pts = spiral(240, 340, 25, 160, 2.2, 54) + spiral(640, 340, 25, 160, 2.2, 54, phase=180) + line(440, 250, 440, 520, 4)
L.append(level('ch3-03', 3, 3, 'Les spirales sœurs', 'application', 13, 21, 62, 1, 2, build(pts, GUARD_IMP), **TWI))

# 3-4 application : deux cascades de bols et rampes.
walls = [(440, 300, 120, 30), (440, 470, 120, -30)]
pts = []
for cx in (190, 690):
    pts += arc(cx, 150, 120, 15, 165, 12) + arc(cx, 300, 110, 15, 165, 11) + arc(cx, 440, 100, 15, 165, 10)
pts += line(330, 160, 550, 160, 6) + rows(110, 770, 565, 1, 0, 16)
L.append(level('ch3-04', 3, 4, 'Les deux cascades', 'application', 13, 21, 67, 1, 2, build(pts, GUARD_IMP, walls=walls), **TWI))

# 3-5 application : voûte en miroir, couloir central.
pts = mirror(rows(60, 380, 170, 7, 46, 8)) + line(440, 200, 440, 500, 6)
L.append(level('ch3-05', 3, 5, 'Les deux voûtes', 'application', 13, 20, 69, 1, 2, build(pts, GUARD_IMP), **TWI))

# 3-6 respiration : nuée dense.
pts = rows(50, 830, 190, 7, 46, 19)
L.append(level('ch3-06', 3, 6, 'Pluie d’étincelles', 'respiration', 13, 16, 75, 1, 2, build(pts), **TWI, clusters=[(240, 240), (640, 240), (240, 420), (640, 420)]))

# 3-7 combinaison : premières lunes, deux pegs tournent autour de chaque bol.
g = []; dec = []
pts = rows(60, 820, 150, 2, 44, 18) + rows(100, 780, 545, 1, 0, 18)
for k, cx in enumerate((220, 660)):
    pts += arc(cx, 290, 70, 20, 160, 7) + arc(cx, 300, 30, 40, 140, 3)
    gg, dd = moons(f'lune{k+1}', cx, 330, 90, 2, 6, 1 if k == 0 else -1); g.append(gg); dec.append(dd)
pts += arc(440, 400, 90, 20, 160, 8)
L.append(level('ch3-07', 3, 7, 'Les premières lunes', 'combinaison', 13, 20, 66, 1, 2, build(pts, GUARD_IMP, groups=g), decor=dec, **TWI))

# 3-8 combinaison : trois petites planètes et leurs lunes.
g = []; dec = []; pts = rows(60, 820, 150, 2, 44, 18) + rows(120, 760, 550, 1, 0, 14) + rows(100, 780, 480, 1, 0, 12)
for k, (cx, cy) in enumerate(((180, 340), (440, 300), (700, 340))):
    pts += disc(cx, cy, 50, 30)
    gg, dd = moons(f'p{k+1}', cx, cy, 90, 2 if k == 1 else 3, 7, 1 if k % 2 == 0 else -1, phase=30*k); g.append(gg); dec.append(dd)
L.append(level('ch3-08', 3, 8, 'Les trois planètes', 'combinaison', 15, 21, 69, 1, 2, build(pts, GUARD_IMP, groups=g), decor=dec, **TWI))

# 3-9 combinaison : une rangée de six lunes au-dessus d'une nuée.
g = []; dec = []; pts = rows(60, 820, 400, 4, 44, 18) + line(80, 125, 800, 125, 17)
for k, cx in enumerate((140, 260, 380, 500, 620, 740)):
    pts += [(cx, 230)]
    gg, dd = moons(f'm{k+1}', cx, 230, 50, 1, 4 + (k % 3), 1 if k % 2 == 0 else -1, phase=90*k); g.append(gg); dec.append(dd)
L.append(level('ch3-09', 3, 9, 'La ronde des lunes', 'combinaison', 14, 21, 74, 1, 2, build(pts, GUARD_IMP, groups=g), decor=dec, **TWI))

# 3-10 maîtrise : voûte dense et quatre lunes qui portent peut-être un cœur.
g = []; dec = []; pts = rows(60, 820, 150, 3, 44, 18) + arc(150, 430, 110, 15, 165, 11) + arc(730, 430, 110, 15, 165, 11) + arc(440, 470, 100, 15, 165, 10)
for k, (cx, cy) in enumerate(((240, 330), (640, 330))):
    pts += ring(cx, cy, 35, 5)
    gg, dd = moons(f'o{k+1}', cx, cy, 85, 2, 5, 1 if k == 0 else -1); g.append(gg); dec.append(dd)
L.append(level('ch3-10', 3, 10, 'Les gardiennes', 'maitrise', 13, 24, 72, 1, 2, build(pts, GUARD_IMP, groups=g), decor=dec, **TWI))

# 3-11 maîtrise : deux anneaux fixes, des lunes qui tournent à l'intérieur.
g = []; dec = []; pts = line(100, 150, 780, 150, 18) + rows(80, 800, 550, 1, 0, 17)
for k, cx in enumerate((250, 630)):
    pts += ring(cx, 340, 150, 26) + [(cx, 340)]
    for j, (r, n, per) in enumerate(((90, 3, 6), (50, 1, 4))):
        gg, dd = moons(f'a{k+1}{j}', cx, 340, r, n, per, 1 if (k + j) % 2 == 0 else -1); g.append(gg); dec.append(dd)
L.append(level('ch3-11', 3, 11, 'Les sœurs lunaires', 'maitrise', 13, 22, 79, 1, 2, build(pts, GUARD_IMP, groups=g), decor=dec, **TWI))

# 3-12 Grande Constellation : la Balançoire, une longue poutre inclinée et des lunes à chaque bout.
walls = [(440, 400, 160, 10)]
g = []; dec = []
pts = line(80, 300, 800, 380, 26) + rows(80, 800, 120, 2, 40, 18) + arc(250, 170, 90, 20, 160, 9) + arc(630, 200, 90, 20, 160, 9) + rows(80, 800, 540, 2, 30, 18)
for k, (cx, cy, r) in enumerate(((180, 420, 60), (700, 450, 50))):
    gg, dd = moons(f'b{k+1}', cx, cy, r, 3, 6, 1 if k == 0 else -1); g.append(gg); dec.append(dd)
L.append(level('ch3-12', 3, 12, 'La Balançoire', 'grande-constellation', 14, 22, 84, 1, 2, build(pts, groups=g, walls=walls), decor=dec, **TWI))

# ---------- CHAPITRE 4 : Volte (rebond fou), élément : aimants (niveaux 7+) ----------
# Règle GD : niveaux d'application et de maîtrise denses (Volte ne sert que dans la masse).
VOL = dict(companion='volte')
def mag(gid, x, y, r=120, s=1.2): return {'id': gid, 'type': 'magnet', 'x': x, 'y': y, 'radius': r, 'strength': s}
def pyr(cx, y0, n, step=44, dy=40):
    """Triangle pointe en haut : n rangées de 1 à n cristaux."""
    return [(cx + (i - k/2)*step, y0 + k*dy) for k in range(n) for i in range(k+1)]
def hole(pts, x, y, r=40): return [(a, b) for a, b in pts if math.hypot(a-x, b-y) >= r]

# 4-1 découverte : une ruche au centre, trois pouvoirs dedans.
imp = [(300, 300, 'power'), (580, 300, 'power'), (440, 400, 'power')]
pts = hexa(160, 720, 200, 470, 46)
L.append(level('ch4-01', 4, 1, 'Volte bondit', 'decouverte', 13, 18, 57, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **VOL))

# 4-2 découverte : deux pyramides, les pouvoirs à leur sommet et entre elles.
imp = [(240, 200, 'power'), (640, 200, 'power'), (440, 400, 'power')]
pts = mirror(pyr(240, 200, 8)) + line(440, 200, 440, 330, 3)
L.append(level('ch4-02', 4, 2, 'Les trampolines', 'decouverte', 15, 16, 64, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **VOL))

# 4-3 application (dense) : la ruche pleine largeur.
pts = hexa(70, 810, 215, 450, 46)
L.append(level('ch4-03', 4, 3, 'La grande ruche', 'application', 13, 24, 65, 1, 2, build(pts, GUARD_IMP), **VOL))

# 4-4 application (dense) : quatre grappes serrées.
pts = hexa(100, 780, 450, 545, 44) + [(440, 160)]
for cx in (180, 440, 700): pts += arc(cx, 230, 115, 15, 165, 12) + arc(cx, 230, 75, 25, 155, 8)
L.append(level('ch4-04', 4, 4, 'Les nids', 'application', 13, 20, 69, 1, 2, build(pts, GUARD_IMP), **VOL))

# 4-5 application (dense) : nuée et deux rampes qui renvoient dedans.
walls = [(200, 540, 150, 22), (680, 540, 150, -22)]
pts = rows(70, 810, 200, 6, 40, 18)
L.append(level('ch4-05', 4, 5, 'Le mur aux rebonds', 'application', 13, 24, 70, 1, 2, build(pts, GUARD_IMP, walls=walls), **VOL))

# 4-6 respiration : pluie serrée.
pts = rows(50, 830, 190, 7, 42, 19)
L.append(level('ch4-06', 4, 6, 'Averse d’étoiles', 'respiration', 14, 16, 75, 1, 2, build(pts), **VOL, clusters=[(150, 300), (730, 300), (440, 220), (440, 400)]))

# 4-7 combinaison : le premier aimant, au centre d'une couronne.
pts = hole(ring(440, 340, 150, 24) + ring(440, 340, 200, 26) + rows(70, 810, 130, 1, 0, 18) + rows(90, 790, 560, 1, 0, 16) + arc(130, 400, 80, 15, 165, 7) + arc(750, 400, 80, 15, 165, 7), 440, 340)
L.append(level('ch4-07', 4, 7, 'Le premier aimant', 'combinaison', 15, 21, 74, 1, 2, build(pts, GUARD_IMP), decor=[mag('aimant', 440, 340)], **VOL))

# 4-8 combinaison : deux aimants hauts qui rabattent l'orbe vers la nuée.
pts = hole(hole(arc(220, 250, 105, 190, 350, 10) + arc(660, 250, 105, 190, 350, 10) + rows(70, 810, 390, 5, 42, 18) + line(440, 150, 440, 300, 4), 220, 250), 660, 250)
L.append(level('ch4-08', 4, 8, 'Les deux pôles', 'combinaison', 13, 23, 72, 1, 2, build(pts, GUARD_IMP), decor=[mag('pole1', 220, 250), mag('pole2', 660, 250, s=1.2)], **VOL))

# 4-9 combinaison : un aimant bas qui aspire l'orbe dans un bol serré.
pts = hole(arc(440, 450, 150, 200, 340, 13) + arc(440, 450, 110, 0, 180, 11) + rows(70, 810, 170, 3, 42, 19) + arc(150, 430, 90, 15, 165, 8) + arc(730, 430, 90, 15, 165, 8), 440, 450, 60)
L.append(level('ch4-09', 4, 9, 'Le puits', 'combinaison', 13, 25, 75, 1, 2, build(pts, GUARD_IMP), decor=[mag('puits', 440, 450, 130, 1.3)], **VOL))

# 4-10 maîtrise (dense) : nuée serrée, deux aimants dans les coins hauts qui dévient.
pts = hole(hole(hexa(70, 810, 300, 545, 44), 150, 220, 50), 730, 220, 50)
L.append(level('ch4-10', 4, 10, 'Les déviations', 'maitrise', 13, 22, 79, 1, 2, build(pts, GUARD_IMP), decor=[mag('coin1', 150, 220, 110), mag('coin2', 730, 220, 110)], **VOL))

# 4-11 maîtrise (dense) : l'œil, un aimant au cœur d'une nuée en anneau.
pts = hole(hexa(80, 800, 230, 500, 44), 440, 350, 70)
L.append(level('ch4-11', 4, 11, 'L’œil de Volte', 'maitrise', 13, 24, 82, 1, 2, build(pts, GUARD_IMP), decor=[mag('oeil', 440, 350, 130, 1.3)], **VOL))

# 4-12 Grande Constellation : la Forge, deux aimants et deux poutres au-dessus d'une nuée.
walls = [(280, 320, 140, 18), (600, 320, 140, -18)]
pts = hole(hole(rows(70, 810, 140, 2, 40, 18) + arc(440, 240, 90, 20, 160, 10) + arc(250, 400, 140, 15, 165, 14) + arc(250, 400, 95, 25, 155, 10)
               + arc(630, 400, 140, 15, 165, 14) + arc(630, 400, 95, 25, 155, 10) + line(440, 400, 440, 560, 4) + rows(80, 800, 570, 1, 0, 18), 130, 220, 50), 750, 220, 50)
L.append(level('ch4-12', 4, 12, 'La Forge', 'grande-constellation', 15, 22, 82, 1, 2, build(pts, GUARD_IMP_LIGHT, walls=walls), decor=[mag('forge1', 130, 220, 100), mag('forge2', 750, 220, 100)], **VOL))

# ---------- CHAPITRE 5 : Mousse (aimant à cœurs), élément : portails (niveaux 7+) ----------
MOU = dict(companion='mousse')
def portal(gid, a, b): return {'id': gid, 'type': 'portal', 'a': {'x': a[0], 'y': a[1]}, 'b': {'x': b[0], 'y': b[1]}}
def holes(pts, centres, r=45):
    for x, y in centres: pts = hole(pts, x, y, r)
    return pts

# 5-1 découverte : trois bols étagés, un pouvoir au fond de chacun.
imp = [(220, 300, 'power'), (660, 300, 'power'), (440, 460, 'power')]
pts = arc(220, 200, 120, 15, 165, 13) + arc(660, 200, 120, 15, 165, 13) + arc(440, 360, 130, 15, 165, 14) + arc(220, 200, 75, 30, 150, 7) + arc(660, 200, 75, 30, 150, 7) + arc(440, 360, 85, 30, 150, 8) + rows(100, 780, 160, 1, 0, 10)
L.append(level('ch5-01', 5, 1, 'Mousse renifle', 'decouverte', 15, 16, 59, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **MOU))

# 5-2 découverte : trois corolles ouvertes (bols), un pouvoir au fond de chacune.
imp = [(440, 360, 'power'), (200, 450, 'power'), (680, 450, 'power')]
pts = arc(440, 250, 150, 15, 165, 15) + arc(440, 250, 100, 25, 155, 10) + arc(200, 380, 110, 15, 165, 12) + arc(680, 380, 110, 15, 165, 12) + arc(200, 380, 65, 30, 150, 6) + arc(680, 380, 65, 30, 150, 6) + rows(120, 760, 150, 1, 0, 10) + rows(100, 780, 565, 1, 0, 14)
L.append(level('ch5-02', 5, 2, 'La fleur de Mousse', 'decouverte', 15, 16, 64, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **MOU))

# 5-3 application : un bouquet de trois fleurs.
pts = star(200, 280, 130, 65, 5, 5) + star(680, 280, 130, 65, 5, 5) + star(440, 430, 130, 65, 5, 5) + [(200, 280), (680, 280), (440, 430)] + rows(330, 550, 170, 1, 0, 6)
L.append(level('ch5-03', 5, 3, 'Le bouquet', 'application', 15, 20, 69, 1, 2, build(pts, GUARD_IMP), **MOU))

# 5-4 application : terrasses inclinées entre deux rampes.
walls = [(440, 250, 160, 15), (440, 430, 160, -15)]
pts = line(60, 180, 340, 230, 10) + line(540, 230, 820, 180, 10) + line(60, 330, 340, 290, 10) + line(540, 290, 820, 330, 10) + line(60, 420, 340, 470, 10) + line(540, 470, 820, 420, 10) + rows(80, 800, 530, 2, 32, 17)
L.append(level('ch5-04', 5, 4, 'Les terrasses', 'application', 14, 20, 69, 1, 2, build(pts, GUARD_IMP, walls=walls), **MOU))

# 5-5 application : le sablier.
pts = [(440 + (i - k/2)*44, 160 + (7-k)*36) for k in range(1, 8) for i in range(k+1)] + pyr(440, 380, 6, 44, 36) + arc(160, 230, 110, 15, 165, 12) + arc(720, 230, 110, 15, 165, 12) + arc(160, 440, 100, 15, 165, 11) + arc(720, 440, 100, 15, 165, 11)
L.append(level('ch5-05', 5, 5, 'Le sablier', 'application', 15, 20, 74, 1, 2, build(pts, GUARD_IMP), **MOU))

# 5-6 respiration : prairie.
pts = rows(50, 830, 190, 7, 42, 19)
L.append(level('ch5-06', 5, 6, 'La prairie', 'respiration', 15, 16, 75, 1, 2, build(pts), **MOU, clusters=[(300, 250), (580, 250), (160, 400), (720, 400)]))

# 5-7 combinaison : la première porte, qui mène au-dessus d'un nid ouvert.
A, B = (230, 240), (650, 400)
pts = holes(rows(70, 810, 140, 2, 40, 18) + arc(230, 240, 110, 200, 340, 9) + arc(650, 400, 75, 15, 165, 8) + arc(650, 400, 125, 10, 170, 14) + arc(230, 450, 110, 15, 165, 12) + line(440, 260, 440, 520, 5) + rows(80, 800, 568, 1, 0, 18), [A, B])
L.append(level('ch5-07', 5, 7, 'La première porte', 'combinaison', 15, 21, 74, 1, 2, build(pts, GUARD_IMP), decor=[portal('porte', A, B)], **MOU))

# 5-8 combinaison : deux portes croisées.
A1, B1, A2, B2 = (130, 250), (720, 480), (750, 250), (160, 480)
pts = holes(rows(70, 810, 140, 2, 40, 18) + arc(440, 260, 120, 15, 165, 13) + ring(720, 480, 70, 10) + ring(160, 480, 70, 10) + hexa(300, 580, 420, 560, 44), [A1, B1, A2, B2])
L.append(level('ch5-08', 5, 8, 'Les portes croisées', 'combinaison', 13, 21, 74, 1, 2, build(pts, GUARD_IMP_LIGHT), decor=[portal('croix1', A1, B1), portal('croix2', A2, B2)], **MOU))

# 5-9 combinaison : le puits du bas renvoie l'orbe tout en haut, de l'autre côté.
A, B = (300, 545), (600, 130)
pts = holes(rows(70, 810, 200, 3, 42, 19) + arc(300, 545, 80, 190, 350, 8) + arc(620, 430, 110, 15, 165, 12) + arc(620, 430, 65, 30, 150, 6) + arc(160, 420, 80, 15, 165, 8) + arc(160, 420, 45, 40, 140, 3) + rows(450, 790, 565, 1, 0, 8), [A, B])
L.append(level('ch5-09', 5, 9, 'Le puits et l’étoile', 'combinaison', 14, 21, 79, 1, 2, build(pts, GUARD_IMP), decor=[portal('puits', A, B)], **MOU))

# 5-10 maîtrise : une ruche que deux portes traversent.
A1, B1, A2, B2 = (90, 200), (560, 470), (790, 200), (320, 470)
pts = holes(hexa(70, 810, 290, 545, 44) + rows(200, 680, 160, 1, 0, 12), [A1, B1, A2, B2])
L.append(level('ch5-10', 5, 10, 'La ruche aux portes', 'maitrise', 13, 26, 75, 1, 2, build(pts, GUARD_IMP_LIGHT), decor=[portal('r1', A1, B1), portal('r2', A2, B2)], **MOU))

# 5-11 maîtrise : deux jardins ouverts par le haut, et leurs portes.
A1, B1, A2, B2 = (440, 220), (220, 400), (440, 470), (660, 400)
pts = holes(arc(220, 400, 130, -25, 205, 22) + arc(660, 400, 130, -25, 205, 22) + arc(220, 400, 70, 0, 180, 7) + arc(660, 400, 70, 0, 180, 7) + rows(70, 810, 150, 2, 40, 18) + line(440, 280, 440, 400, 3) + rows(80, 800, 568, 1, 0, 18), [A1, B1, A2, B2])
L.append(level('ch5-11', 5, 11, 'Les jardins', 'maitrise', 14, 22, 84, 1, 2, build(pts, GUARD_IMP), decor=[portal('j1', A1, B1), portal('j2', A2, B2)], **MOU))

# 5-12 Grande Constellation : la Serre, deux portes et deux vitres inclinées.
walls = [(260, 330, 150, 20), (620, 330, 150, -20)]
A1, B1, A2, B2 = (100, 330), (600, 500), (780, 330), (280, 500)
pts = holes(rows(70, 810, 140, 3, 40, 18) + star(440, 300, 110, 55, 5, 5) + arc(280, 470, 110, 15, 165, 12) + arc(600, 470, 110, 15, 165, 12) + arc(280, 470, 65, 30, 150, 6) + arc(600, 470, 65, 30, 150, 6) + rows(80, 800, 570, 1, 0, 18), [A1, B1, A2, B2])
L.append(level('ch5-12', 5, 12, 'La Serre', 'grande-constellation', 14, 22, 83, 1, 2, build(pts, GUARD_IMP_LIGHT, walls=walls), decor=[portal('serre1', A1, B1), portal('serre2', A2, B2)], **MOU))

# ---------- CHAPITRE 6 : Horloge (ralenti du temps), élément : régénération (niveaux 7+) ----------
# Règle GD : application et maîtrise denses (l'Horloge ne sert que dans la masse).
HOR = dict(companion='horloge')
def thick(cx, cy, r, layers=3, gap=40):
    """Bol épais : arcs concentriques (dense mais l'orbe y roule)."""
    out = []
    for k in range(layers):
        rr = r - k*gap
        if rr >= 30: out += arc(cx, cy, rr, 10, 170, max(3, int(math.pi*rr*160/180/32)))
    return out
def regen(gid, shots=2): return {'id': gid, 'type': 'regen', 'shots': shots}
def tag_regen(pegs, gid, test, cap=15):
    """Marque comme régénérants (communs) les cristaux ronds libres qui vérifient test(x, y), 15 au plus."""
    n = 0
    for p in pegs:
        if n < cap and p.get('shape') != 'brick' and 'kind' not in p and 'group' not in p and test(p['x'], p['y']):
            p['group'] = gid; p['kind'] = 'common'; n += 1
    return pegs

# 6-1 découverte : le cadran, pouvoirs à 12 h, 4 h et 8 h.
imp = [(440, 200, 'power'), (550, 400, 'power'), (330, 400, 'power')]
pts = arc(440, 340, 170, -30, 210, 26) + ring(440, 340, 110, 18) + [(440, 340)] + rows(120, 760, 150, 1, 0, 10) + rows(100, 780, 560, 1, 0, 12) + mirror(line(140, 260, 200, 380, 4))
L.append(level('ch6-01', 6, 1, 'L’Horloge s’éveille', 'decouverte', 14, 16, 59, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **HOR))

# 6-2 découverte : le pendule.
imp = [(440, 300, 'power'), (300, 470, 'power'), (580, 470, 'power')]
pts = line(440, 140, 440, 300, 5) + arc(440, 160, 330, 50, 130, 22) + arc(440, 160, 260, 55, 125, 15) + rows(100, 780, 200, 1, 0, 14) + arc(440, 160, 395, 58, 122, 20) + arc(130, 330, 90, 15, 165, 9) + arc(750, 330, 90, 15, 165, 9) + rows(100, 780, 565, 1, 0, 12)
L.append(level('ch6-02', 6, 2, 'Le pendule', 'decouverte', 14, 16, 64, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **HOR))

# 6-3 application (dense) : les engrenages, trois disques serrés qui se touchent.
pts = thick(230, 250, 140) + thick(650, 250, 140) + thick(440, 420, 120) + rows(330, 550, 170, 1, 0, 6) + rows(80, 800, 565, 1, 0, 18)
L.append(level('ch6-03', 6, 3, 'Les engrenages', 'application', 14, 21, 69, 1, 2, build(pts, GUARD_IMP), **HOR))

# 6-4 application (dense) : la ruche du temps.
pts = hexa(70, 810, 230, 460, 46)
L.append(level('ch6-04', 6, 4, 'La ruche du temps', 'application', 13, 25, 65, 1, 2, build(pts, GUARD_IMP), **HOR))

# 6-5 application (dense) : nuée sous deux rampes.
walls = [(220, 230, 150, 20), (660, 230, 150, -20)]
pts = rows(70, 810, 340, 3, 42, 18) + line(330, 170, 550, 170, 6) + thick(440, 330, 90, 2) + arc(440, 150, 400, 40, 140, 22) + rows(100, 780, 565, 1, 0, 14)
L.append(level('ch6-05', 6, 5, 'Sous les aiguilles', 'application', 13, 23, 72, 1, 2, build(pts, GUARD_IMP, walls=walls), **HOR))

# 6-6 respiration : la pluie lente.
pts = arc(440, 130, 380, 25, 155, 32) + arc(440, 130, 310, 30, 150, 25) + arc(440, 130, 240, 35, 145, 18) + rows(60, 820, 150, 1, 0, 19) + arc(110, 280, 70, 15, 165, 7) + arc(770, 280, 70, 15, 165, 7) + rows(80, 800, 568, 1, 0, 18)
L.append(level('ch6-06', 6, 6, 'Pluie lente', 'respiration', 14, 16, 75, 1, 2, build(pts), **HOR, clusters=[(440, 500), (200, 380), (680, 380), (440, 290)]))

# 6-7 combinaison : la première rangée qui repousse (au-dessus d'un bol).
pts = rows(70, 810, 160, 1, 0, 18) + arc(110, 330, 70, 15, 165, 7) + arc(770, 330, 70, 15, 165, 7) + arc(440, 250, 300, 30, 150, 22) + arc(440, 250, 230, 35, 145, 16) + rows(90, 790, 560, 1, 0, 16) + arc(440, 330, 90, 15, 165, 9)
L.append(level('ch6-07', 6, 7, 'Ce qui repousse', 'combinaison', 14, 22, 72, 1, 2,
               tag_regen(build(pts, GUARD_IMP), 'pousse', lambda x, y: y < 170), decor=[regen('pousse')], **HOR))

# 6-8 combinaison : deux haies qui repoussent devant des nids.
pts = line(110, 280, 330, 280, 6) + line(550, 280, 770, 280, 6) + arc(220, 380, 110, 15, 165, 12) + arc(660, 380, 110, 15, 165, 12) + arc(220, 380, 65, 30, 150, 6) + arc(660, 380, 65, 30, 150, 6) + rows(70, 810, 160, 2, 40, 18) + rows(120, 760, 565, 1, 0, 15) + line(440, 300, 440, 500, 4)
L.append(level('ch6-08', 6, 8, 'Les haies', 'combinaison', 15, 22, 74, 1, 2,
               tag_regen(build(pts, GUARD_IMP), 'haie', lambda x, y: abs(y - 280) < 3), decor=[regen('haie')], **HOR))

# 6-9 combinaison : couronne qui repousse autour d'un cœur de nuée.
pts = ring(440, 360, 180, 30) + thick(440, 330, 120) + rows(70, 810, 140, 1, 0, 18) + rows(80, 800, 568, 1, 0, 18) + arc(110, 470, 70, 15, 165, 7) + arc(770, 470, 70, 15, 165, 7)
L.append(level('ch6-09', 6, 9, 'La couronne', 'combinaison', 15, 22, 79, 1, 2,
               tag_regen(build(pts, GUARD_IMP), 'couronne', lambda x, y: abs(math.hypot(x - 440, y - 360) - 180) < 3), decor=[regen('couronne')], **HOR))

# 6-10 maîtrise (dense) : ruche dont la bordure du haut repousse.
pts = hexa(70, 810, 300, 545, 46)
L.append(level('ch6-10', 6, 10, 'Le temps têtu', 'maitrise', 14, 23, 79, 1, 2,
               tag_regen(build(pts, GUARD_IMP), 'bord', lambda x, y: y < 315), decor=[regen('bord')], **HOR))

# 6-11 maîtrise (dense) : deux engrenages denses et leurs dents qui repoussent.
pts = thick(260, 330, 135) + thick(620, 330, 135) + ring(260, 350, 175, 14) + ring(620, 350, 175, 14) + rows(70, 810, 130, 2, 36, 18) + rows(80, 800, 568, 1, 0, 18)
L.append(level('ch6-11', 6, 11, 'Les rouages', 'maitrise', 15, 23, 84, 1, 2,
               tag_regen(build(pts, GUARD_IMP_LIGHT), 'dents', lambda x, y: min(abs(math.hypot(x - 260, y - 350) - 175), abs(math.hypot(x - 620, y - 350) - 175)) < 3), decor=[regen('dents')], **HOR))

# 6-12 Grande Constellation : le Grand Cadran.
walls = [(300, 240, 120, 25), (580, 240, 120, -25)]
pts = thick(210, 320, 130, 2) + thick(670, 320, 130, 2) + arc(440, 380, 110, 15, 165, 12) + arc(440, 380, 65, 30, 150, 6) + rows(70, 810, 140, 1, 0, 18) + rows(80, 800, 568, 1, 0, 18) + arc(110, 420, 70, 15, 165, 7) + arc(770, 420, 70, 15, 165, 7)
L.append(level('ch6-12', 6, 12, 'Le Grand Cadran', 'grande-constellation', 14, 23, 78, 1, 2,
               tag_regen(build(pts, GUARD_IMP_LIGHT, walls=walls), 'cadran', lambda x, y: abs(math.hypot(x - 440, y - 380) - 110) < 3), decor=[regen('cadran')], **HOR))

# ---------- CHAPITRE 7 : Grelot (orbe éclair), élément : combinaisons de deux (niveaux 7+) ----------
# 7-3 à 7-5 rappellent un élément connu, seul ; les combinaisons arrivent à 7-7.
GRE = dict(companion='grelot')
def rays(angles, r0, r1, n):
    """Rayons issus du canon : l'éclair du Grelot les perce en ligne droite."""
    return [p for a in angles for p in line(440 + r0*math.cos(math.radians(a)), r0*math.sin(math.radians(a)), 440 + r1*math.cos(math.radians(a)), r1*math.sin(math.radians(a)), n)]

# 7-1 découverte : les rayons, un pouvoir au bout de trois d'entre eux.
imp = [(440 + 420*math.cos(math.radians(a)), 420*math.sin(math.radians(a)), 'power') for a in (70, 90, 110)]
pts = rays((70, 90, 110), 170, 380, 8) + thick(170, 250, 120, 2) + thick(710, 250, 120, 2) + arc(150, 470, 90, 15, 165, 9) + arc(730, 470, 90, 15, 165, 9) + rows(220, 660, 565, 1, 0, 10)
L.append(level('ch7-01', 7, 1, 'Grelot tinte', 'decouverte', 14, 16, 59, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **GRE))

# 7-2 découverte : les cloches, trois bols épais.
imp = [(200, 340, 'power'), (680, 340, 'power'), (440, 470, 'power')]
pts = thick(200, 230, 130) + thick(680, 230, 130) + thick(440, 360, 130) + rows(100, 780, 150, 1, 0, 13)
L.append(level('ch7-02', 7, 2, 'Les cloches', 'decouverte', 13, 20, 60, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **GRE))

# 7-3 application (rappel : roue) : une roue lente entre deux bols.
pts = rows(60, 820, 150, 2, 44, 18) + thick(150, 400, 110, 2) + thick(730, 400, 110, 2) + rows(260, 620, 560, 1, 0, 9)
g = [('roue', 440, 360, ring(440, 360, 120, 16) + ring(440, 360, 60, 8, phase=20), None)]
L.append(level('ch7-03', 7, 3, 'Souvenir de roue', 'application', 12, 24, 65, 1, 2, build(pts, GUARD_IMP, groups=g), decor=[rot('roue', 440, 360, 15)], **GRE))

# 7-4 application (rappel : orbites) : deux lunes autour de deux bols.
g = []; dec = []
pts = rows(60, 820, 150, 2, 44, 18) + rows(100, 780, 560, 1, 0, 16) + line(440, 230, 440, 480, 5)
for k, cx in enumerate((230, 650)):
    pts += thick(cx, 330, 55, 1) + arc(cx, 330, 135, 15, 165, 13)
    gg, dd = moons(f'lune{k+1}', cx, 330, 90, 3, 6, 1 if k == 0 else -1); g.append(gg); dec.append(dd)
L.append(level('ch7-04', 7, 4, 'Souvenir de lunes', 'application', 13, 22, 67, 1, 2, build(pts, GUARD_IMP, groups=g), decor=dec, **GRE))

# 7-5 application (rappel : aimant) : un aimant au-dessus d'un champ de bols.
pts = hole(rows(60, 820, 150, 2, 40, 18) + thick(200, 380, 120) + thick(680, 380, 120) + thick(440, 440, 100, 2) + rows(100, 780, 565, 1, 0, 16), 440, 280, 45)
L.append(level('ch7-05', 7, 5, 'Souvenir d’aimant', 'application', 13, 21, 74, 1, 2, build(pts, GUARD_IMP), decor=[mag('aimant', 440, 280, 120, 1.2)], **GRE))

# 7-6 respiration : grands bols et pluie.
pts = arc(440, 150, 360, 22, 158, 32) + arc(440, 150, 290, 28, 152, 24) + arc(200, 220, 100, 15, 165, 10) + arc(680, 220, 100, 15, 165, 10) + arc(440, 260, 110, 15, 165, 11) + rows(60, 820, 140, 1, 0, 19) + rows(80, 800, 568, 1, 0, 18)
L.append(level('ch7-06', 7, 6, 'Carillon', 'respiration', 13, 16, 75, 1, 2, build(pts), **GRE, clusters=[(440, 500), (160, 330), (720, 330), (440, 370)]))

# 7-7 combinaison : roue + aimant (l'aimant au centre de la roue).
pts = hole(rows(60, 820, 150, 2, 44, 18) + thick(130, 420, 90, 2) + thick(750, 420, 90, 2) + rows(240, 640, 565, 1, 0, 9), 440, 350, 45)
g = [('roue', 440, 350, ring(440, 350, 130, 18) + ring(440, 350, 85, 12, phase=15), None)]
L.append(level('ch7-07', 7, 7, 'La roue aimantée', 'combinaison', 13, 24, 72, 1, 2, build(pts, GUARD_IMP, groups=g), decor=[rot('roue', 440, 350, 14), mag('coeur', 440, 350, 100, 1.2)], **GRE))

# 7-8 combinaison : orbites + portail (la porte mène entre deux lunes).
A, B = (120, 230), (440, 400)
g = []; dec = []
pts = holes(rows(200, 820, 150, 3, 40, 15) + thick(440, 400, 130, 2) + rows(100, 780, 565, 1, 0, 16) + arc(140, 420, 80, 15, 165, 8) + arc(740, 440, 80, 15, 165, 8), [A, B])
for k, cx in enumerate((250, 630)):
    gg, dd = moons(f'lune{k+1}', cx, 300, 70, 2, 5, 1 if k == 0 else -1); g.append(gg); dec.append(dd)
pts += thick(630, 300, 50, 1)
L.append(level('ch7-08', 7, 8, 'La porte des lunes', 'combinaison', 13, 24, 69, 1, 2, build(pts, GUARD_IMP_LIGHT, groups=g), decor=dec + [portal('porte', A, B)], **GRE))

# 7-9 combinaison : portail + régénération (la haie qui repousse cache la porte).
A, B = (440, 300), (760, 470)
pts = holes(rows(60, 820, 150, 3, 36, 18) + line(330, 260, 550, 260, 6) + thick(200, 400, 120) + thick(680, 380, 100, 2) + rows(100, 780, 565, 1, 0, 16), [A, B])
L.append(level('ch7-09', 7, 9, 'La porte cachée', 'combinaison', 14, 22, 79, 1, 2,
               tag_regen(build(pts, GUARD_IMP), 'haie', lambda x, y: abs(y - 260) < 3), decor=[regen('haie'), portal('porte', A, B)], **GRE))

# 7-10 maîtrise : aimants + orbites.
g = []; dec = [mag('m1', 220, 260, 110, 1.2), mag('m2', 660, 260, 110, 1.2)]
pts = holes(rows(60, 820, 140, 1, 0, 18) + hexa(80, 800, 400, 545, 44) + line(440, 200, 440, 330, 3), [(220, 260), (660, 260)])
for k, cx in enumerate((220, 660)):
    gg, dd = moons(f'lune{k+1}', cx, 260, 80, 3, 6, 1 if k == 0 else -1); g.append(gg); dec.append(dd)
L.append(level('ch7-10', 7, 10, 'Les lunes aimantées', 'maitrise', 13, 27, 71, 1, 2, build(pts, GUARD_IMP, groups=g), decor=dec, **GRE))

# 7-11 maîtrise : roues + régénération.
pts = rows(60, 820, 150, 2, 40, 18) + line(440, 230, 440, 500, 6) + rows(80, 800, 565, 1, 0, 18)
g = [('g', 230, 370, ring(230, 370, 125, 16) + ring(230, 370, 65, 8), None), ('d', 650, 370, ring(650, 370, 125, 16) + ring(650, 370, 65, 8), None)]
L.append(level('ch7-11', 7, 11, 'Le carillon têtu', 'maitrise', 14, 23, 84, 1, 2,
               tag_regen(build(pts, GUARD_IMP, groups=g), 'haut', lambda x, y: y < 160), decor=[rot('g', 230, 370, 15), rot('d', 650, 370, 15, -1), regen('haut')], **GRE))

# 7-12 Grande Constellation : le Beffroi, roue + portails, deux auvents.
walls = [(190, 260, 140, 20), (690, 260, 140, -20)]
A1, B1, A2, B2 = (80, 400), (590, 520), (800, 400), (290, 520)
pts = holes(rows(60, 820, 140, 3, 38, 18) + thick(290, 440, 110, 2) + thick(590, 440, 110, 2) + rows(80, 800, 568, 1, 0, 18), [A1, B1, A2, B2])
g = [('beffroi', 440, 300, ring(440, 300, 90, 12) + ring(440, 300, 45, 6), None)]
L.append(level('ch7-12', 7, 12, 'Le Beffroi', 'grande-constellation', 13, 27, 79, 1, 2, build(pts, GUARD_IMP_LIGHT, walls=walls, groups=g), decor=[rot('beffroi', 440, 300, 12), portal('b1', A1, B1), portal('b2', A2, B2)], **GRE))

# ---------- CHAPITRE 8 : Nuage-Lune (seconde chance), élément : synthèse (jusqu'à 3 éléments, niveaux 7+) ----------
NUA = dict(companion='nuage-lune')

# 8-1 découverte : trois nuages (bols épais), un pouvoir au fond de chacun.
imp = [(200, 330, 'power'), (680, 330, 'power'), (440, 460, 'power')]
pts = thick(200, 220, 120, 2) + thick(680, 220, 120, 2) + thick(440, 350, 120, 2) + rows(100, 780, 150, 1, 0, 12) + rows(100, 780, 565, 1, 0, 14)
L.append(level('ch8-01', 8, 1, 'Nuage-Lune flotte', 'decouverte', 14, 16, 59, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **NUA))

# 8-2 découverte : le croissant de lune.
imp = [(440, 480, 'power'), (250, 380, 'power'), (630, 380, 'power')]
pts = arc(440, 180, 300, 20, 160, 26) + arc(440, 150, 230, 25, 155, 18) + rows(140, 740, 150, 1, 0, 10) + arc(440, 250, 80, 15, 165, 8) + arc(110, 340, 80, 15, 165, 8) + arc(770, 340, 80, 15, 165, 8) + rows(120, 760, 565, 1, 0, 12)
L.append(level('ch8-02', 8, 2, 'Le croissant', 'decouverte', 13, 18, 62, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **NUA))

# 8-3 application : la roue des nuages (rappel roue).
pts = rows(60, 820, 150, 2, 44, 18) + thick(140, 420, 100, 2) + thick(740, 420, 100, 2) + rows(240, 640, 565, 1, 0, 9)
g = [('roue', 440, 360, ring(440, 360, 115, 16) + ring(440, 360, 60, 8, phase=22), None)]
L.append(level('ch8-03', 8, 3, 'La roue des nuages', 'application', 13, 25, 65, 1, 2, build(pts, GUARD_IMP, groups=g), decor=[rot('roue', 440, 360, 16)], **NUA))

# 8-4 application : portail et aimant.
A, B = (100, 250), (600, 330)
pts = holes(rows(200, 820, 150, 3, 40, 15) + thick(600, 430, 100, 2) + thick(250, 400, 120, 2) + rows(100, 780, 565, 1, 0, 16) + arc(790, 420, 60, 15, 165, 6), [A, B, (440, 260)])
L.append(level('ch8-04', 8, 4, 'La porte aimantée', 'application', 14, 21, 72, 1, 2, build(pts, GUARD_IMP_LIGHT), decor=[portal('porte', A, B), mag('aimant', 440, 260, 110, 1.2)], **NUA))

# 8-5 application : lunes et régénération.
g = []; dec = [regen('voile')]
pts = rows(60, 820, 150, 2, 40, 18) + line(140, 260, 740, 260, 14) + rows(100, 780, 565, 1, 0, 16)
for k, cx in enumerate((230, 650)):
    pts += thick(cx, 380, 50, 1) + arc(cx, 380, 130, 15, 165, 13)
    gg, dd = moons(f'lune{k+1}', cx, 380, 80, 2, 6, 1 if k == 0 else -1); g.append(gg); dec.append(dd)
L.append(level('ch8-05', 8, 5, 'Le voile des lunes', 'application', 13, 23, 72, 1, 2,
               tag_regen(build(pts, GUARD_IMP, groups=g), 'voile', lambda x, y: abs(y - 260) < 3), decor=dec, **NUA))

# 8-6 respiration : ciel de traîne (cœurs en grappes, règle GD).
pts = rows(50, 830, 190, 7, 44, 19)
L.append(level('ch8-06', 8, 6, 'Ciel de traîne', 'respiration', 15, 16, 75, 1, 2, build(pts), **NUA, clusters=[(200, 260), (680, 260), (330, 420), (550, 420)]))

# 8-7 synthèse : roue + aimant + portail.
A, B = (90, 220), (790, 220)
pts = holes(rows(160, 720, 150, 3, 36, 13) + thick(140, 440, 90, 2) + thick(740, 440, 90, 2) + rows(240, 640, 565, 1, 0, 9), [A, B, (440, 360)])
g = [('roue', 440, 360, ring(440, 360, 130, 18) + ring(440, 360, 85, 12, phase=15), None)]
L.append(level('ch8-07', 8, 7, 'Les trois veilleuses', 'combinaison', 13, 26, 69, 1, 2, build(pts, GUARD_IMP_LIGHT, groups=g),
               decor=[rot('roue', 440, 360, 15), mag('coeur', 440, 360, 100, 1.2), portal('porte', A, B)], **NUA))

# 8-8 synthèse : lunes + régénération + portail.
A, B = (440, 230), (440, 470)
g = []; dec = [regen('haie'), portal('porte', A, B)]
pts = holes(rows(60, 820, 150, 2, 40, 18) + line(100, 300, 330, 300, 6) + line(550, 300, 780, 300, 6) + thick(440, 470, 100, 2) + rows(80, 800, 568, 1, 0, 18), [A, B])
for k, cx in enumerate((210, 670)):
    pts += arc(cx, 420, 110, 15, 165, 11)
    gg, dd = moons(f'lune{k+1}', cx, 420, 60, 2, 5, 1 if k == 0 else -1); g.append(gg); dec.append(dd)
L.append(level('ch8-08', 8, 8, 'Le passage des lunes', 'combinaison', 14, 22, 74, 1, 2,
               tag_regen(build(pts, GUARD_IMP, groups=g), 'haie', lambda x, y: abs(y - 300) < 3), decor=dec, **NUA))

# 8-9 synthèse : trois aimants autour d'une roue.
M = [(160, 300), (720, 300), (440, 500)]
pts = holes(rows(60, 820, 150, 2, 40, 18) + arc(160, 300, 100, 200, 340, 7) + arc(720, 300, 100, 200, 340, 7) + rows(100, 780, 568, 1, 0, 16) + arc(150, 460, 80, 15, 165, 8) + arc(730, 460, 80, 15, 165, 8), M)
g = [('roue', 440, 330, ring(440, 330, 110, 15) + ring(440, 330, 55, 7), None)]
L.append(level('ch8-09', 8, 9, 'Le triangle d’aimants', 'combinaison', 14, 22, 78, 1, 2, build(pts, GUARD_IMP_LIGHT, groups=g),
               decor=[rot('roue', 440, 330, 14), mag('m1', 160, 300, 100, 1.1), mag('m2', 720, 300, 100, 1.1), mag('m3', 440, 500, 90, 1.1)], **NUA))

# 8-10 maîtrise : roue + lunes + régénération.
g = [('roue', 440, 330, ring(440, 330, 120, 16) + ring(440, 330, 60, 8), None)]; dec = [rot('roue', 440, 330, 15), regen('bas')]
pts = rows(60, 820, 150, 2, 40, 18) + rows(80, 800, 530, 2, 34, 18)
for k, cx in enumerate((130, 750)):
    gg, dd = moons(f'lune{k+1}', cx, 340, 70, 3, 6, 1 if k == 0 else -1); g.append(gg); dec.append(dd)
    pts += thick(cx, 340, 40, 1)
L.append(level('ch8-10', 8, 10, 'La veille têtue', 'maitrise', 12, 27, 75, 1, 2,
               tag_regen(build(pts, GUARD_IMP_LIGHT, groups=g), 'bas', lambda x, y: y > 520 and abs(x - 440) < 200), decor=dec, **NUA))

# 8-11 maîtrise : deux portes, deux aimants, une haie qui repousse.
A1, B1, A2, B2 = (90, 220), (600, 460), (790, 220), (280, 460)
M = [(250, 300), (630, 300)]
pts = holes(rows(160, 720, 150, 3, 36, 14) + line(330, 380, 550, 380, 6) + thick(280, 440, 110, 3, 34) + thick(600, 440, 110, 3, 34) + arc(80, 440, 50, 15, 165, 5) + arc(800, 440, 50, 15, 165, 5) + rows(80, 800, 568, 1, 0, 18), [A1, B1, A2, B2] + M)
L.append(level('ch8-11', 8, 11, 'Les passages du ciel', 'maitrise', 13, 27, 75, 1, 2,
               tag_regen(build(pts, GUARD_IMP_LIGHT), 'haie', lambda x, y: abs(y - 380) < 3),
               decor=[portal('p1', A1, B1), portal('p2', A2, B2), mag('m1', 250, 300, 100, 1.1), mag('m2', 630, 300, 100, 1.1), regen('haie')], **NUA))

# 8-12 Grande Constellation : la Grande Veilleuse, roue + lunes + aimant, deux auvents.
walls = [(170, 250, 130, 20), (710, 250, 130, -20)]
g = [('veilleuse', 440, 340, ring(440, 340, 120, 16) + ring(440, 340, 65, 9), None)]; dec = [rot('veilleuse', 440, 340, 16), mag('coeur', 440, 340, 50, 1.0)]
pts = hole(rows(60, 820, 140, 2, 40, 18) + thick(150, 460, 100, 2) + thick(730, 460, 100, 2) + rows(80, 800, 568, 1, 0, 18), 440, 340, 30)
for k, cx in enumerate((150, 730)):
    gg, dd = moons(f'lune{k+1}', cx, 360, 60, 2, 6, 1 if k == 0 else -1); g.append(gg); dec.append(dd)
L.append(level('ch8-12', 8, 12, 'La Grande Veilleuse', 'grande-constellation', 13, 28, 77, 1, 2, build(pts, GUARD_IMP_LIGHT, walls=walls, groups=g), decor=dec, **NUA))

out = sys.argv[1] if len(sys.argv) > 1 else 'out'
os.makedirs(out, exist_ok=True)
for lv in L:
    json.dump(lv, open(f"{out}/{lv['id']}.json", 'w'), ensure_ascii=False, indent=2)
    n = len(lv['pegs']); print(lv['id'], 'pegs', n, 'walls', sum(1 for p in lv['pegs'] if p.get('kind') == 'wall'))
json.dump({'format': 1, 'levels': [lv['id'] for lv in L]}, open(f'{out}/index.json', 'w'), indent=2)
