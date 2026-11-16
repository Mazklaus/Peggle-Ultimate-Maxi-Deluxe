# Format JSON des niveaux — v1 et v2 (Lead Prog + Level Designer + Tools Prog)

La v2 (jalon 2) ajoute les éléments de décor animés : voir la section « v2 : décor » en bas.

Un fichier par niveau : `public/levels/<id>.json`, plus un index `public/levels/index.json`.
Coordonnées en pixels **dans la zone de jeu** 880 × 656 (maquette UI : zone 4:3 de la base 1280×720),
origine en haut à gauche de la zone. Le canon est en (440, 0), le réceptacle en bas.

```json
{
  "format": 1,
  "id": "ch1-03",
  "chapter": 1,
  "index": 3,
  "companion": "pip",
  "companionLocked": true,
  "title": "Premiers rebonds",
  "rhythm": "decouverte",
  "orbs": 10,
  "stars": [12000, 30000],
  "assign": { "hearts": 20, "power": 2, "bonus": 1 },
  "pegs": [
    { "x": 120, "y": 200 },
    { "x": 160, "y": 200, "kind": "heart" },
    { "x": 300, "y": 320, "shape": "brick", "w": 40, "h": 12, "angle": 30 }
  ],
  "decor": []
}
```

```
format     1, ou 2 si le niveau utilise du décor (voir v2)
id         unique, "pro-01".."pro-04", "ch1-01".."ch8-12", "def-..", "duel-.."
chapter    0 = prologue, 1..8
index      1..12 dans le chapitre
companion  "pip" | "bourdon" | "jumelles" | "volte" | "mousse" | "horloge" | "grelot" | "nuage-lune" | null
           null = pas de compagnon (prologue) ; sinon compagnon imposé ou proposé par défaut
companionLocked  true = Astre imposé (niveaux de découverte) ; défaut false
title      nom interne facultatif, jamais affiché
rhythm     facultatif : tutoriel | decouverte | application | respiration | combinaison | maitrise | grande-constellation
orbs       stock de départ (défaut 10)
stars      [score 2 étoiles, score 3 étoiles] ; 1 étoile = niveau fini
assign     tirage au hasard à chaque partie parmi les pegs sans "kind" :
           hearts = nb de cristaux-cœurs, power = nb de cristaux pouvoir,
           bonus = nb de bonus mobiles (se déplace à chaque tir)
pegs[]     x, y obligatoires
           shape  "circle" (défaut, r = 10) | "brick" (w, h, angle en degrés)
           r      rayon pour circle (défaut 10)
           kind   absent = tirage via assign ; sinon "heart" | "common" | "power" | "wall" (placement imposé)
           wall = incassable : jamais allumé ni retiré, jamais tiré par assign
           group  (v2) id d'un élément de decor[] ; x, y = position à t = 0
decor[]    v1 : toujours vide ; v2 : éléments animés (voir plus bas)
```

`index.json` :

```json
{ "format": 1, "levels": ["pro-01", "pro-02", "pro-03", "pro-04", "ch1-01"] }
```

Règles de validation (le chargeur refuse le niveau avec un message clair) :

```
- pegs dans la zone : x 0..880, y 80..600 (canon au-dessus, réceptacle en dessous)
- écart minimal de 22 px entre centres de deux cercles
- kinds imposés + assign <= nombre de pegs
- au moins 1 cœur (imposé ou tiré)
- stars croissantes
```

Test depuis l'éditeur : l'éditeur écrit le JSON dans `localStorage["ricochet:test-level"]` puis ouvre `./?test`.
Champs inconnus : ignorés à la lecture.

## v2 : décor (jalon 2)

Pourquoi un nouveau numéro : une build v1 ignore les champs inconnus. Elle chargerait un niveau à décor
sans erreur, mais figé. En v2, une build trop ancienne refuse le niveau avec un message clair.

```
lecture       format 1 et 2 acceptés (un v1 = un v2 sans decor ni group)
écriture      format 2 si decor non vide ou au moins un peg avec group, sinon format 1
```

```json
"decor": [
  { "id": "roue",   "type": "rotate", "cx": 440, "cy": 330, "periodS": 8, "dir": 1 },
  { "id": "lune",   "type": "orbit",  "cx": 220, "cy": 300, "rx": 60, "ry": 60, "periodS": 4, "dir": -1 },
  { "id": "aim1",   "type": "magnet", "x": 440, "y": 380, "radius": 110, "strength": 1 },
  { "id": "p1",     "type": "portal", "a": { "x": 120, "y": 520 }, "b": { "x": 760, "y": 160 } },
  { "id": "regen1", "type": "regen",  "shots": 2 }
]
```

```
rotate  cx, cy, periodS (8..18), dir (1 horaire, -1 anti) : les pegs du groupe tournent autour du centre
orbit   cx, cy, rx, ry (40..90), periodS (4..8), dir : 1 à 4 pegs sur l'anneau
magnet  x, y, radius, strength (1 = réglage Game Designer) : attire l'orbe, aucun peg dans le groupe
portal  a, b (r = 18) : l'orbe entre en a et ressort en b avec la même vitesse (et inversement)
regen   shots : un cristal du groupe brisé réapparaît après N tirs (jamais un cœur)
```

Validation v2, en plus des règles v1 :

```
- id de decor unique ; tout "group" désigne un id existant
- magnet sans peg ; orbit : 1 à 4 pegs ; regen jamais sur un peg kind "heart"
- pegs d'un rotate / orbit dans la zone sur tout le tour
- 22 px minimum entre deux pegs d'un même groupe
- un élément ne change jamais la couleur ni la forme d'un cristal (règle DA) : il ajoute un support visible
```
