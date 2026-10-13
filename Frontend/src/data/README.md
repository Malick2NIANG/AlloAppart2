# Contours des régions du Sénégal (`senegal-regions.json`)

## Source

- Jeu de données : **geoBoundaries** — Sénégal, niveau administratif ADM1 (régions)
- URL de la métadonnée API : https://www.geoboundaries.org/api/current/gbOpen/SEN/ADM1/
- URL de téléchargement utilisée (géométrie simplifiée fournie par geoBoundaries) :
  https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SEN/ADM1/geoBoundaries-SEN-ADM1_simplified.geojson
- Date de téléchargement : 2026-10-13

## Licence

D'après la métadonnée officielle de ce jeu de données précis (champ `boundaryLicense` de l'API geoBoundaries) :

> **Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)**
> Source : data.humdata.org/dataset/senegal-administrative-boundaries

Attention : la documentation générale du programme **gbOpen** de geoBoundaries annonce souvent une licence CC BY 4.0 par défaut, mais la métadonnée spécifique à ce jeu de données Sénégal indique CC BY 3.0 IGO (dataset source : OCHA/HDX). C'est cette licence spécifique qui s'applique ici.

**Attribution requise :**
> Contours administratifs : geoBoundaries (CC BY 3.0 IGO), via data.humdata.org — Senegal Administrative Boundaries.

## Traitement appliqué

1. Téléchargement du GeoJSON ADM1 simplifié (14 features, un par région).
2. Propriétés réduites à `{ "name": "<nom de la région>" }` uniquement (suppression de `shapeISO`, `shapeID`, `shapeGroup`, `shapeType`). Noms normalisés avec accents : `Saint Louis` → `Saint-Louis`, `Thies` → `Thiès`, `Sedhiou` → `Sédhiou`, `Kedougou` → `Kédougou` (les 10 autres noms étaient déjà corrects).
3. Simplification géométrique avec mapshaper :
   ```
   npx mapshaper normalized.geojson -simplify 70% keep-shapes -o format=geojson precision=0.0001 senegal-regions.json
   ```
   Taux retenu après vérification point-dans-polygone (14 chefs-lieux + points supplémentaires
   dans Dakar, dont Almadies à la pointe de la presqu'île du Cap-Vert) : à 10 %, la pointe sud de
   la presqu'île de Dakar était tronquée (le polygone Dakar n'avait plus que 9 sommets, contre 40+
   à 70 %), faisant échouer la détection pour les points les plus à l'ouest (Almadies). 70 % est le
   premier taux testé (après 10 %, 50 %) où tous les points de contrôle tombent dans la bonne région.
4. Résultat écrit à l'identique dans `Frontend/src/data/senegal-regions.json` et `Backend/src/listings/data/senegal-regions.json`.

## Résultat

- 14 features, une par région du Sénégal.
- Taille finale : **70 462 octets** (~68,8 Ko), bien en dessous de la limite de 400 Ko.
