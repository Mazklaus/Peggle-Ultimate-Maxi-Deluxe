"""Cale orbes (10..13), puis cœurs (-2, -4 max), puis orbes 14-15, sur les fourchettes du Game Designer
(reglages-jalon2.md, section 3). Usage : python3 tune.py niveaux/*.json"""
import json, sys, sim
from multiprocessing import Pool

BANDS = {  # (min, max) pour ch.2-5 ; ch.6-8 : 5 points plus bas
    'decouverte': (0.85, 1.0), 'application': (0.60, 0.70), 'respiration': (0.85, 1.0),
    'combinaison': (0.50, 0.65), 'maitrise': (0.40, 0.55), 'grande-constellation': (0.35, 0.50)}
RUNS = 30


def band(lv):
    lo, hi = BANDS[lv['rhythm']]
    if lv['chapter'] >= 6:
        lo, hi = lo - 0.05, hi - 0.05
    return lo, hi


def rate(args):
    lv, orbs, hearts = args
    l = dict(lv); l['orbs'] = orbs; l['assign'] = dict(lv['assign'], hearts=hearts)
    return orbs, hearts, sim.evaluate(l, RUNS)['win']


def tune(path, pool):
    lv = json.load(open(path)); lo, hi = band(lv); h0 = lv['assign']['hearts']
    steps = [[(o, h0) for o in (10, 11, 12, 13)], [(13, h0 - 2), (13, h0 - 4)], [(14, h0 - 4), (15, h0 - 4)]]
    tried = []
    for step in steps:
        res = pool.map(rate, [(lv, o, h) for o, h in step]); tried += res
        ok = [r for r in res if lo <= r[2] <= hi]
        if ok:
            return path, min(ok, key=lambda r: (r[0], -r[1])), tried, (lo, hi)
        if any(r[2] > hi for r in res):  # on a dépassé : le plus proche de la fourchette
            return path, min(tried, key=lambda r: min(abs(r[2] - lo), abs(r[2] - hi))), tried, (lo, hi)
    return path, max(tried, key=lambda r: r[2]), tried, (lo, hi)


if __name__ == '__main__':
    with Pool() as pool:
        for f in sys.argv[1:]:
            path, best, res, b = tune(f, pool)
            print(path.split('/')[-1], 'cible', b, '->', 'orbes', best[0], 'coeurs', best[1],
                  'win', round(best[2], 2), '| essais', [(o, h, round(w, 2)) for o, h, w in res], flush=True)
