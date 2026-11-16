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

def build(pts, imposed=(), walls=()):
    """pts : cercles libres ; imposed : [(x,y,kind)] ; walls : [(x,y,w,angle)] briques incassables."""
    pegs = []
    def ok(x, y):
        return 20 <= x <= W-20 and 100 <= y <= 570 and all(
            p.get('shape') == 'brick' or math.hypot(p['x']-x, p['y']-y) >= MIN_D for p in pegs)
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
        pegs.append({'x': round(x), 'y': round(y), 'shape': 'brick', 'w': w, 'h': 12, 'angle': ang, 'kind': 'wall'})
    return pegs

GUARDS = [(30, y) for y in (230, 330, 430, 530)] + [(850, y) for y in (230, 330, 430, 530)]

GUARD_IMP = [(x, y, 'common') for x, y in GUARDS]
GUARD_IMP_LIGHT = [(30, 300, 'common'), (30, 460, 'common'), (850, 300, 'common'), (850, 460, 'common')]

def level(id_, chapter, index, title, rhythm, orbs, hearts, commons, bonus, power, pegs, companion=None, locked=False):
    free = [p for p in pegs if 'kind' not in p]
    imposed_power = sum(1 for p in pegs if p.get('kind') == 'power')
    imposed_common = sum(1 for p in pegs if p.get('kind') == 'common')
    need = hearts + (commons - imposed_common) + bonus + (power - imposed_power)
    if len(free) < need:
        print(f'MANQUE {id_}: {len(free)} < {need}'); need = len(free)
    # retire l'excédent de façon régulière (garde la silhouette)
    extra = len(free) - need
    print(id_, 'surplus', extra)
    if extra:
        cand = [p for p in free if (p['x'], p['y']) not in GUARDS]
        drop = set(id(cand[int(i*len(cand)/extra)]) for i in range(extra))
        pegs = [p for p in pegs if id(p) not in drop]
    stars = [700*hearts, 1200*hearts]
    return {
        'format': 1, 'id': id_, 'chapter': chapter, 'index': index,
        'companion': companion, 'companionLocked': locked,
        'title': title, 'rhythm': rhythm, 'orbs': orbs,
        **({'guideBounces': 2} if id_ in ('pro-01', 'pro-02') else {}), 'stars': stars,
        'assign': {'hearts': hearts, 'power': power - imposed_power, 'bonus': bonus},
        'pegs': pegs, 'decor': [],
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
L.append(level('ch1-01', 1, 1, 'Pip montre le chemin', 'decouverte', 10, 20, 55, 1, 3, build(pts, imp), locked=True, **PIP))

# 1-2 découverte : un rideau d'étoiles cache la nuée, la trajectoire aide à viser les trous.
imp = [(440, 150, 'power'), (180, 240, 'power'), (700, 240, 'power')]
pts = line(120, 300, 760, 300, 24) + rows(100, 780, 360, 4, 46, 13) + arc(440, 120, 260, 30, 150, 15) + [(60, 560), (820, 560)]
L.append(level('ch1-02', 1, 2, 'Les rideaux d’étoiles', 'decouverte', 10, 20, 60, 1, 3, build(pts, imp + GUARD_IMP), locked=True, **PIP))

# 1-3 application : deux balances pleines reliées par un fléau.
pts = disc(240, 360, 140) + disc(640, 360, 140) + line(250, 190, 630, 190, 13) + line(440, 220, 440, 520, 9)
L.append(level('ch1-03', 1, 3, 'Les deux balances', 'application', 10, 22, 60, 1, 2, build(pts, GUARD_IMP), **PIP))

# 1-4 application : spirale serrée (lecture de trajectoire).
pts = spiral(440, 330, 30, 220, 2.4, 90) + arc(110, 380, 90, 20, 160, 9) + arc(770, 380, 90, 20, 160, 9) + arc(110, 380, 50, 30, 150, 5) + arc(770, 380, 50, 30, 150, 5) + [(440, 120), (300, 130), (580, 130)]
L.append(level('ch1-04', 1, 4, 'La spirale de Pip', 'application', 10, 22, 65, 1, 2, build(pts), **PIP))

# 1-5 application : coeurs nichés dans des coupes profondes, tir difficile sans Pip.
cups = []
for cx in (160, 440, 720):
    cups += arc(cx, 300, 125, 15, 165, 12) + disc(cx, 330, 90)
pts = cups + line(70, 180, 810, 180, 18)
L.append(level('ch1-05', 1, 5, 'Les trois coupes', 'application', 10, 23, 65, 1, 2, build(pts), **PIP))

# 1-6 respiration : nuée dense, le chaos est récompensé.
pts = rows(50, 830, 200, 6, 50, 19) + line(320, 150, 560, 150, 4)
L.append(level('ch1-06', 1, 6, 'Pluie de lucioles', 'respiration', 10, 20, 90, 1, 2, build(pts), **PIP))

# 1-7 combinaison : rampes incassables (élément du ch.1), premier contact simple.
walls = [(200, 470, 160, 20), (680, 470, 160, -20)]
pts = rows(70, 810, 180, 5, 44, 18) + arc(440, 460, 120, 200, 340, 12)
L.append(level('ch1-07', 1, 7, 'Les toboggans', 'combinaison', 10, 23, 65, 1, 2, build(pts, walls=walls), **PIP))

# 1-8 combinaison : entonnoir de rampes vers une lanterne centrale pleine.
walls = [(170, 300, 200, 30), (710, 300, 200, -30)]
pts = rows(60, 820, 160, 3, 36, 20) + disc(440, 400, 150) + line(60, 380, 200, 540, 6) + line(820, 380, 680, 540, 6)
L.append(level('ch1-08', 1, 8, 'L’entonnoir', 'combinaison', 10, 24, 65, 1, 2, build(pts, walls=walls), **PIP))

# 1-9 combinaison : zigzag de rampes, ricochets en cascade.
walls = [(250, 250, 180, 15), (630, 330, 180, -15), (250, 410, 180, 15), (630, 490, 180, -15)]
pts = line(60, 150, 820, 150, 20) + line(80, 200, 800, 200, 20) + [(440, 245)] + line(420, 270, 840, 270, 12) + line(40, 350, 460, 350, 12) \
    + line(420, 430, 840, 430, 12) + line(40, 520, 460, 520, 12) + line(520, 560, 840, 560, 9)
L.append(level('ch1-09', 1, 9, 'La cascade', 'combinaison', 10, 24, 70, 1, 2, build(pts, walls=walls), **PIP))

# 1-10 maîtrise : grande roue pleine, rampe sous le moyeu.
pts = arc(440, 300, 240, 5, 175, 22) + arc(440, 300, 195, 10, 170, 18) + arc(440, 300, 150, 12, 168, 14) + arc(440, 300, 105, 15, 165, 10) + arc(440, 300, 60, 20, 160, 6) + arc(440, 300, 240, 200, 340, 13) + line(440, 130, 440, 250, 4) + line(40, 260, 40, 560, 8) + line(840, 260, 840, 560, 8) + [(120, 150), (760, 150), (200, 130), (680, 130), (40, 200), (840, 200)]
L.append(level('ch1-10', 1, 10, 'La roue du phare', 'maitrise', 10, 25, 70, 1, 2, build(pts, walls=[(440, 560, 120, 0)]), **PIP))

# 1-11 maîtrise : voûte d'étoiles dense, deux coupes gardées par des rampes tournées vers le centre.
walls = [(330, 520, 120, -25), (550, 520, 120, 25)]
pts = rows(70, 810, 160, 4, 44, 18) + arc(150, 380, 110, 15, 165, 12) + arc(150, 390, 60, 20, 160, 7) \
    + arc(730, 380, 110, 15, 165, 12) + arc(730, 390, 60, 20, 160, 7) + arc(440, 330, 70, 0, 180, 9)
L.append(level('ch1-11', 1, 11, 'Les sœurs jumelles', 'maitrise', 10, 25, 75, 1, 2, build(pts, walls=walls), **PIP))

# 1-12 Grande Constellation : Pip lui-même, grande étoile à 5 branches, halo et rampes.
walls = [(150, 540, 140, 15), (730, 540, 140, -15)]
pts = star(440, 330, 240, 100, 5, 7) + arc(440, 290, 85, 15, 165, 9) + arc(440, 290, 45, 20, 160, 5) + arc(440, 380, 330, 30, 150, 22) + arc(440, 340, 300, 195, 345, 24) + rows(70, 810, 140, 1, 0, 6) + line(250, 575-10, 630, 575-10, 0) + line(340, 120, 540, 120, 0) + line(120, 140, 120, 140, 0) + [(380, 580-15), (500, 580-15), (300, 560), (580, 560), (100, 140), (780, 140), (240, 130), (640, 130), (160, 560), (720, 560), (440, 565), (60, 200), (820, 200)] \
    + line(40, 240, 40, 520, 9) + line(840, 240, 840, 520, 9)
L.append(level('ch1-12', 1, 12, 'Le réveil de Pip', 'grande-constellation', 12, 25, 80, 1, 2, build(pts, walls=walls), **PIP))

out = sys.argv[1] if len(sys.argv) > 1 else 'out'
os.makedirs(out, exist_ok=True)
for lv in L:
    json.dump(lv, open(f"{out}/{lv['id']}.json", 'w'), ensure_ascii=False, indent=2)
    n = len(lv['pegs']); print(lv['id'], 'pegs', n, 'walls', sum(1 for p in lv['pegs'] if p.get('kind') == 'wall'))
json.dump({'format': 1, 'levels': [lv['id'] for lv in L]}, open(f'{out}/index.json', 'w'), indent=2)
