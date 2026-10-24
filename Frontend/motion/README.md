# AlloAppart — Publicité motion design de lancement

Publicité de 20 s (1920 × 1080, 30 fps, 600 frames, en boucle) réalisée avec
[Remotion](https://www.remotion.dev). Le projet est **totalement isolé** du
frontend Next.js : il a son propre `package.json`, `node_modules` et `tsconfig`.

## Lancer

```bash
cd Frontend/motion
npm install
npm run studio        # prévisualisation interactive (Remotion Studio, navigateur)
npm run render        # export MP4 → out/alloappart-launch-1920x1080.mp4
npm run render:muet   # export sans audio
npm run still         # image de la scène finale → out/apercu.png
npm run audio         # régénère public/audio/soundtrack.wav (Python + numpy + scipy)
```

> Au premier `render`, Remotion télécharge automatiquement Chrome Headless Shell
> (≈ 100 Mo, une seule fois). Le rendu est ensuite 100 % hors-ligne : les polices
> sont embarquées dans `public/fonts`.

## Timeline (`src/config/timeline.ts`)

| Temps      | Frames    | Acte                                                         |
|------------|-----------|--------------------------------------------------------------|
| 0 → 4 s    | 0 → 120   | **Problème** — froid, instable, aucun doré                   |
| ~3,3 → 5 s | 100 → 160 | **Révélation** — balayage doré, halo, flash contrôlé         |
| 4 → 9 s    | 120 → 270 | **AlloAppart** — logo héros, « AlloAppart arrive. », AlloVérifié™ |
| 9 → 15 s   | 270 → 450 | **Fonctionnalités** — 4 cartes UI activées tour à tour       |
| 15 → 20 s  | 450 → 600 | **CTA** — slogan officiel, `alloappart.sn`, retour au bleu nuit (boucle) |

Tous les instants clés (et les points de synchro audio) sont des constantes :
décaler un acte = changer une valeur.

## Architecture

```
motion/
├── package.json / tsconfig.json / remotion.config.ts
├── public/
│   ├── audio/soundtrack.wav        bande-son générée (synchro image)
│   └── fonts/                      Poppins 500-700, Inter 400-800 (SIL OFL)
├── scripts/generate-soundtrack.py  synthèse audio procédurale
└── src/
    ├── index.ts / Root.tsx         enregistrement des compositions
    ├── AlloAppartAd.tsx            assemblage des calques
    ├── assets.ts                   LOGO.png + favicon.svg importés depuis Frontend/public (aucune copie)
    ├── config/                     brand.ts (couleurs exactes), timeline.ts, formats.ts
    ├── lib/                        anim (easing / springs), format (safe zone), fonts, warmth
    ├── components/                 Background, Logo, VerifiedBadge, CtaButton, GoldText, particules…
    └── scenes/                     Act1Problem, RevealTransition, Act2Reveal, Act3Features, Act4Cta
```

### Pourquoi pas Framer Motion ici ?
Framer Motion anime en temps réel (horloge du navigateur) : capturé image par
image, il produit des frames incohérentes. Remotion fournit des `spring()` et
`interpolate()` **déterministes à la frame** — mêmes physiques (overshoot,
stagger), rendu identique à chaque export. `lucide-react` est réutilisé tel quel.

## Déclinaisons 9:16 et 1:1
La mise en page est exprimée par rapport au centre de l'image et tient dans une
safe zone centrale de 1080 px de large. Pour produire une déclinaison :
1. ajuster les offsets du format dans `src/config/formats.ts` (`9x16` / `1x1` sont pré-remplis) ;
2. ajouter une `<Composition>` dans `src/Root.tsx` avec `format: '9x16'` et les dimensions de `FORMATS['9x16']`.

## Audio
`public/audio/soundtrack.wav` est entièrement synthétisée (aucun sample, aucun
droit tiers) : tension en acte 1, riser, impact à 4 s, puis musique chaleureuse
à 120 BPM calée sur l'image. Pour une campagne payante, on peut la remplacer par
une musique sous licence en gardant les points de synchro `AUDIO_CUES`.
