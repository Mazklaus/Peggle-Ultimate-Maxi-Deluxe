# Format JSON des niveaux — v1 (figé, Lead Prog + Level Designer + Tools Prog)

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
format     1 (obligatoire, pour migrer plus tard)
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
decor[]    réservé jalon 2 (rotations, orbites, portails, aimants, régénération) ; ignoré en v1
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
