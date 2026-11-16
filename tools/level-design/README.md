# Outils du Level Designer (hors build)

Scripts Python 3 (PIL pour `render.py`), utilisés pour concevoir et équilibrer les niveaux du jalon 1.

```
python3 levels.py out          # génère pro-01..04 et ch1-01..12 (format v1) dans out/
python3 render.py out sheet.png # planche de tous les niveaux
python3 sim.py out/*-*.json     # simulation de tirs : taux de victoire et scores (p50, p80)
python3 dead.py out/*-*.json    # angles morts : tirs de 8° à 172° qui ne touchent aucun cristal (viser <= 5 %)
```

`sim.py` est une approximation (pas Matter) : un joueur « correct » qui teste des angles et
vise les derniers cœurs au balayage, avec 1° d'imprécision, et le pouvoir de Pip (visée
parfaite pendant 2 tirs). Elle sert à comparer les niveaux entre eux, pas à prédire le
taux réel. Les fichiers de `public/levels/` passent ensuite par `serializeLevel`.
