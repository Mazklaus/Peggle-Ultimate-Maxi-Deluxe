"""Défis (jalon 3) : taux de réussite d'un défi au simulateur.

Usage : python3 chal.py public/levels/def-1-1.json [...]
Cible GD : un joueur correct réussit en 3 à 8 essais, soit un taux de 12 à 33 %.
"""
import json, random, sys
from sim import play

def hearts_of(level):
    return level['assign'].get('hearts', 0) + sum(1 for p in level['pegs'] if p.get('kind') == 'heart')

def success(level, ch, won, score, st):
    g, v = ch['goal'], ch.get('value')
    if g == 'score':      return won and score >= v           # points
    if g == 'nettoyage':  return won and st['all_clear']      # 100 % des cristaux
    if g == 'tir_unique': return st['max_hearts'] >= v        # cœurs en un tir
    if g == 'economie':   return won and st['orbs_left'] >= v # orbes restants
    if g == 'pouvoir':    return won and st['powers'] >= v    # activations du pouvoir
    if g == 'chaine':     return st['max_bounces'] >= v       # rebonds en un tir (murs + cristaux déjà allumés)
    raise ValueError(g)

def rate(level, runs=40, seed=7):
    ch = level['challenge']; lv = dict(level)
    if ch.get('astre'): lv['companion'] = ch['astre']  # contrainte astre_impose
    rng = random.Random(seed); ok = 0; wins = 0
    for _ in range(runs):
        st = {}
        won, score, _ = play(lv, rng=rng, constraint=ch.get('constraint'), stats=st, goal=ch['goal'])
        wins += won; ok += success(lv, ch, won, score, st)
    return ok / runs, wins / runs

if __name__ == '__main__':
    for f in sys.argv[1:]:
        lv = json.load(open(f)); r, w = rate(lv)
        tries = f'{1/r:.1f}' if r else 'inf'
        flag = 'OK' if 0.12 <= r <= 0.34 else ('TROP FACILE' if r > 0.34 else 'TROP DUR')
        print(f"{f.split('/')[-1]:14} {lv['challenge']}  réussite {r:.2f} (≈{tries} essais, victoire {w:.2f})  {flag}", flush=True)
