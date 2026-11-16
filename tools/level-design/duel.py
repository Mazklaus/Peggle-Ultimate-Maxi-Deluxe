"""Génère les 6 niveaux du duel local (jalon 3) : public/levels/duel-01..06.json.

Règles (regles-modes-jalon3.md §3) : niveaux symétriques, 10 orbes par joueur.
Pour que le terrain partagé reste lisible et juste, les cœurs et les cristaux
pouvoir sont imposés par paires miroir (axe x = 440). Seul le bonus est tiré.
Usage : python3 duel.py <dossier_sortie>
"""
import contextlib, io, json, math, os, sys
with contextlib.redirect_stdout(io.StringIO()):
    from levels import (W, arc, ring, line, rows, mirror, spiral, hexa, pyr, hole, thick, build,
                        level, rot, mag, GUARD_IMP_LIGHT)

def pair_kinds(pegs, hearts, power=2, rng_key=0):
    """Impose `hearts` cœurs et `power` cristaux pouvoir par paires miroir, répartis sur la hauteur."""
    def mate(q):
        return next((r for r in pegs if r is not q and 'kind' not in r and 'group' not in r
                     and abs(W - r['x'] - q['x']) <= 2 and abs(r['y'] - q['y']) <= 2), None)
    left = sorted((q for q in pegs if 'kind' not in q and 'group' not in q and q['x'] < 430 and mate(q)),
                  key=lambda q: (q['y'], q['x']))
    want = hearts // 2 + power // 2
    step = len(left) / want; picks = [left[int((i + 0.5) * step) % len(left)] for i in range(want)]
    for i, q in enumerate(picks):
        k = 'power' if i in (want // 3, (2 * want) // 3) and power else 'heart'
        if k == 'power': power -= 2
        m = mate(q); q['kind'] = m['kind'] = k
    return pegs

D = []
def duel(n, title, pts, hearts=20, commons=70, walls=(), groups=(), decor=()):
    pegs = pair_kinds(build(pts, GUARD_IMP_LIGHT, walls=walls, groups=groups), hearts)
    lv = level(f'duel-{n:02d}', 0, n, title, 'duel', 10, hearts, commons, 1, 2, pegs, sym=True, decor=decor)
    D.append(lv)

# 1 Le miroir : deux bols épais face à face, colonne centrale.
duel(1, 'Le miroir', mirror(thick(220, 300, 130, 3)) + line(440, 200, 440, 520, 8) + rows(80, 800, 130, 2, 40, 17) + mirror(rows(60, 380, 560, 1, 0, 8, False)))
# 2 Les deux ailes : arcs en ailes, rangées au centre.
duel(2, 'Les deux ailes', mirror(arc(440, 560, 380, 200, 260, 14) + arc(440, 560, 300, 205, 255, 10) + arc(440, 560, 220, 210, 250, 7))
     + rows(300, 580, 200, 4, 44, 7) + mirror(rows(50, 250, 470, 2, 44, 5)) + rows(80, 800, 130, 1, 0, 17))
# 3 La balance : anneau tournant au centre, pyramides latérales.
duel(3, 'La balance', mirror(pyr(160, 200, 6)) + hole(rows(60, 820, 520, 2, 40, 18), 440, 330, 150),
     groups=[('fleau', 440, 330, ring(440, 330, 110, 14) + ring(440, 330, 55, 7), None)], decor=[rot('fleau', 440, 330, 12)], hearts=24, commons=66)
# 4 Les deux spirales : spirales miroir (sens opposés), arche haute.
duel(4, 'Les deux spirales', mirror(spiral(230, 360, 30, 150, 1.6, 26)) + arc(440, 420, 300, 215, 325, 15) + rows(80, 800, 560, 1, 0, 18) + rows(140, 740, 110, 1, 0, 14) + line(440, 280, 440, 540, 6))
# 5 Le pont : arche, deux blocs de nid d'abeille.
duel(5, 'Le pont', arc(440, 560, 330, 195, 345, 22) + mirror(hexa(70, 300, 330, 540)) + line(440, 300, 440, 540, 6) + rows(100, 780, 130, 1, 0, 16))
# 6 Les deux aimants : aimants miroir, rangées décalées.
duel(6, 'Les deux aimants', mirror(ring(250, 330, 100, 14) + ring(250, 330, 150, 18)) + rows(80, 800, 150, 2, 40, 17) + line(440, 260, 440, 540, 7),
     decor=[mag('aimant-g', 250, 330, 110, 0.8), mag('aimant-d', 630, 330, 110, 0.8)], hearts=24, commons=66)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'out'
    os.makedirs(out, exist_ok=True)
    for lv in D:
        json.dump(lv, open(f"{out}/{lv['id']}.json", 'w'), ensure_ascii=False, indent=2)
        k = [p.get('kind') for p in lv['pegs']]
        print(lv['id'], 'pegs', len(k), 'coeurs', k.count('heart'), 'pouvoir', k.count('power'), 'assign', lv['assign'])
    json.dump({'format': 1, 'duel': [lv['id'] for lv in D]}, open(f'{out}/duel.json', 'w'), indent=2)
