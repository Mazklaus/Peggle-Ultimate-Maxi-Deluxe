"""Génère les 24 défis du jalon 3 : public/levels/def-<ch>-<n>.json + challenges.json.

Chaque défi reprend un niveau du chapitre (regles-modes-jalon3.md §1) avec un objectif
et parfois une contrainte. Valeurs calées au simulateur (chal.py) : 12 à 33 % de réussite
par essai, soit 3 à 8 essais. Décisions Game Designer du 2026-11-16 :
  score     : S calé pour ~20 % de réussite (le 3 étoiles x 1,2 était hors d'atteinte)
  pouvoir   : variante à 4 cristaux pouvoir, P = 3
  nettoyage : variante allégée (36 à 44 cristaux, 12 à 14 cœurs), 100 %
Défis chaine recalés sur la mesure du QA en jeu (meilleurs tirs à 20-30 rebonds ;
le simulateur surcompte d'environ 1,6x quand l'orbe roule).
Usage : python3 defis.py <dossier_niveaux>   (lit et écrit dans le même dossier)
"""
import json, sys, os

# (défi, niveau de base, objectif, valeur, contrainte, astre, variante, titre)
DEFIS = [
    ('def-1-1', 'ch1-05', 'score', 19000, None, None, None, 'Pluie de points'),
    ('def-1-2', 'ch1-09', 'chaine', 26, None, None, None, 'Longue traîne'),
    ('def-1-3', 'ch1-03', 'tir_unique', 6, 'sans_guide', None, None, "À l'œil nu"),
    ('def-2-1', 'ch2-07', 'score', 18000, None, None, None, 'Le grand bourdonnement'),
    ('def-2-2', 'ch2-10', 'chaine', 22, None, None, None, 'Ricochets en série'),
    ('def-2-3', 'ch2-04', 'economie', 4, 'astre_impose', 'volte', None, 'Volte en visite'),
    ('def-3-1', 'ch3-05', 'score', 19500, None, None, None, 'Double ration'),
    ('def-3-2', 'ch3-03', 'nettoyage', 100, None, None, 'leger:44:14', 'Place nette'),
    ('def-3-3', 'ch3-09', 'tir_unique', 6, 'orbes_reduits', None, None, 'Trois de moins'),
    ('def-4-1', 'ch4-04', 'score', 20500, None, None, None, 'Haute tension'),
    ('def-4-2', 'ch4-09', 'chaine', 30, None, None, None, 'Court-circuit'),
    ('def-4-3', 'ch4-07', 'economie', 4, 'chrono', None, None, 'Contre la montre'),
    ('def-5-1', 'ch5-05', 'score', 21000, None, None, None, 'Mousse dorée'),
    ('def-5-2', 'ch5-10', 'tir_unique', 7, None, None, None, 'Le grand coup'),
    ('def-5-3', 'ch5-08', 'chaine', 28, 'sans_receptacle', None, None, 'Sans filet'),
    ('def-6-1', 'ch6-03', 'score', 23000, None, None, None, "L'heure des comptes"),
    ('def-6-2', 'ch6-05', 'nettoyage', 100, None, None, 'leger', 'Grand ménage'),
    ('def-6-3', 'ch6-09', 'economie', 5, 'astre_impose', 'mousse', None, 'Mousse en visite'),
    ('def-7-1', 'ch7-04', 'score', 18500, None, None, None, 'Carillon'),
    ('def-7-2', 'ch7-10', 'tir_unique', 7, None, None, None, 'Coup de tonnerre'),
    ('def-7-3', 'ch7-08', 'pouvoir', 3, 'sans_guide', None, 'pouvoir4', 'Éclairs à l\'aveugle'),
    ('def-8-1', 'ch8-05', 'score', 18500, None, None, None, 'Nuit étoilée'),
    ('def-8-2', 'ch8-11', 'chaine', 28, None, None, None, 'Voie lactée'),
    ('def-8-3', 'ch8-07', 'tir_unique', 7, 'orbes_reduits', None, None, 'Lune maigre'),
]

def leger(lv, total=36, hearts=12):
    """Variante allégée : retire des cristaux libres de façon régulière (silhouette gardée)."""
    pegs = lv['pegs']; fixed = [p for p in pegs if 'kind' in p or 'group' in p]
    free = [p for p in pegs if p not in fixed]
    keep_n = max(0, total - len(fixed)); step = len(free) / keep_n if keep_n else 1
    keep = [free[int(i * step)] for i in range(keep_n)]
    lv['pegs'] = [p for p in pegs if p in fixed or p in keep]
    imposed = sum(1 for p in lv['pegs'] if p.get('kind') == 'heart')
    lv['assign']['hearts'] = max(0, hearts - imposed)
    lv['stars'] = [700 * hearts, 1200 * hearts]

def make(d, ch_id, base, goal, value, cons, astre, variant, title):
    lv = json.load(open(f'{d}/{base}.json'))
    c, n = ch_id.split('-')[1:]
    lv.update(id=ch_id, index=int(n), title=title)
    if variant and variant.startswith('leger'): leger(lv, *map(int, variant.split(':')[1:]))
    if variant == 'pouvoir4': lv['assign']['power'] = 4
    ch = {'goal': goal}
    if goal != 'nettoyage': ch['value'] = value
    if cons: ch['constraint'] = cons
    if astre: ch['astre'] = astre; lv['companion'] = astre; lv['companionLocked'] = True
    lv['challenge'] = ch
    return lv

if __name__ == '__main__':
    d = sys.argv[1]
    for row in DEFIS:
        lv = make(d, *row)
        json.dump(lv, open(f"{d}/{lv['id']}.json", 'w'), ensure_ascii=False, indent=2)
        print(lv['id'], lv['challenge'], len(lv['pegs']), 'pegs')
    json.dump({'format': 1, 'challenges': [r[0] for r in DEFIS]}, open(f'{d}/challenges.json', 'w'), indent=2)
