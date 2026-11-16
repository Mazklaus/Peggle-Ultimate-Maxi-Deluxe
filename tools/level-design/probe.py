"""Sonde de défi : joue N parties d'un niveau sous une contrainte et donne,
pour chaque objectif, la valeur qui vise ~20 % de réussite (3 à 8 essais).
Usage : python3 probe.py <niveau.json> [contrainte|-] [compagnon|-] [runs]
"""
import json, random, sys
from sim import play
from chal import hearts_of

f = sys.argv[1]; cons = (sys.argv[2:3] or ['-'])[0]; comp = (sys.argv[3:4] or ['-'])[0]
runs = int((sys.argv[4:5] or [40])[0])
lv = json.load(open(f)); cons = None if cons == '-' else cons
if comp != '-': lv['companion'] = comp
rng = random.Random(11); R = []
for _ in range(runs):
    st = {}; won, score, _ = play(lv, rng=rng, constraint=cons, stats=st); R.append((won, score, st))
H = hearts_of(lv); S3 = 1200 * H
def r(pred): return sum(1 for x in R if pred(x)) / runs
out = {'level': f.split('/')[-1], 'constraint': cons, 'companion': lv.get('companion'), 'win': r(lambda x: x[0]),
       'score_S(1.2x3e)': round(S3 * 1.2), 'score_rate': r(lambda x: x[0] and x[1] >= S3 * 1.2),
       'score_p': sorted(x[1] for x in R if x[0])[-max(1, runs // 5):][:1],
       'score_20pct': (sorted((x[1] for x in R if x[0]), reverse=True) + [0]*runs)[runs // 5 - 1],
       'nettoyage': r(lambda x: x[0] and x[2]['all_clear'])}
out['tir_unique'] = {n: r(lambda x, n=n: x[2]['max_hearts'] >= n) for n in range(4, 10)}
out['economie'] = {k: r(lambda x, k=k: x[0] and x[2]['orbs_left'] >= k) for k in range(3, 8)}
out['pouvoir'] = {p: r(lambda x, p=p: x[0] and x[2]['powers'] >= p) for p in range(2, 6)}
out['chaine'] = {c: r(lambda x, c=c: x[2]['max_bounces'] >= c) for c in (40, 45, 50, 55, 60, 70, 80, 90)}
print(json.dumps(out, ensure_ascii=False), flush=True)
