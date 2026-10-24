# Capture — film de lancement AlloAppart

Infrastructure de capture du prompt 02 (`Frontend/motion/capture/`). Lit les
décisions validées dans `../rapports/RAPPORT_00.md`, `PLAN_DEMO.md` et
`PLAN_CAPTURE.md` (y compris la correction de connexion du 24 octobre 2026).

## Vue d'ensemble

```
motion/
  demo/photos/credits.json        manifeste des photos de démo (source + licence + URL Cloudinary)
  scripts/
    provision-demo-accounts.mjs   crée/rafraîchit les 8 comptes Clerk de démo
    upload-demo-photos.mjs        envoie les photos sur Cloudinary (allo-appart/demo/)
    demo.mjs                      seed / clean (shell vers Backend/prisma, Backend/scripts)
    to-cfr.mjs                    conversion 30 i/s constants (ffmpeg fourni par Remotion)
  capture/
    playwright.config.ts          projet « mobile » : 390×844, échelle 3, tactile, sombre, fr-FR, Africa/Dakar
    auth.setup.ts                 connexion par compte de démo (voir § Connexion ci-dessous)
    lib/cursor.ts                 curseur de toucher simulé (onde, appui, déplacement progressif)
    lib/wait.ts                   attente « prêt », garde-fous (PayDunya, mode démo, erreurs page)
    scenes/test-clip.spec.ts      clip de test : Annonces mobile (défilement + ouverture)
    .credentials.env              (gitignoré) e-mails/mots de passe/clerkId des comptes de démo
  src/clips/ClipTest.tsx          composition Remotion du clip de test (9:16, 150 frames, 30 i/s)
```

## Connexion — méthode validée (pas de jeton Clerk)

Les sessions par jeton Clerk (`sign_in_token`) ne fonctionnent **pas** sur
les espaces connectés (rendu serveur, `ClerkAuthGuard`). La méthode
retenue est la connexion par le **vrai formulaire `/sign-in`** :

1. Les comptes de démo ont une adresse `demo-<rôle>+clerk_test@example.com`
   — en instance de développement Clerk, ce motif accepte le code de
   vérification fixe `424242` si une étape de code est présentée.
2. Chaque compte a un **vrai mot de passe généré** (jamais
   `skip_password_requirement`), provisionné par `scripts/provision-demo-accounts.mjs`
   (même mécanisme que `Frontend/rapports-mobile/tools/provision-test-accounts.mjs`).
3. `capture/auth.setup.ts` (`openAs(role)`) ouvre `/sign-in`, **attend
   `window.Clerk.loaded`** avant de toucher au formulaire (sinon Clerk
   réinitialise un champ rempli trop tôt), remplit e-mail + mot de passe,
   revérifie chaque champ, clique sur Connexion.
4. **Important** (constaté en testant le prompt 02) : une connexion par
   mot de passe réussie atterrit sur `/` (`SignInForm.tsx` fait
   `window.location.replace('/')`) — il n'y a **pas** de redirection
   automatique par rôle pour ce parcours (`/redirect` ne sert qu'au
   parcours Google OAuth, via `/sso-callback`). `openAs()` navigue donc
   lui-même vers l'espace du rôle une fois sur `/` (session déjà active).

Les mots de passe ne sont **jamais** affichés ni commités —
`capture/.credentials.env` est gitignoré.

## Démarrage pas à pas

### 1. Comptes de démo

```bash
cd Frontend/motion
npm install
node scripts/provision-demo-accounts.mjs
```

Écrit `capture/.credentials.env` (8 comptes — voir `PLAN_DEMO.md` § 1).

### 2. Base de démo

La base `allo_appart_demo` doit exister et être migrée :

```bash
cd Backend
DATABASE_URL="postgresql://allo:allo_secret@localhost:5433/allo_appart_demo" npx prisma migrate deploy
```

Puis, depuis `Frontend/motion` :

```bash
npm run demo:photos   # une fois — envoie les photos du lot réduit sur Cloudinary
npm run demo:seed     # lot réduit : 9 annonces (L01, L02, L12, L18-L23), 8 comptes, 3 vérifications
```

Pour la scène 07 (deux états de la vérification V3 — planifié puis
terminé, dans la même session de capture) :

```bash
npm run demo:seed:finish-v3   # bascule V3 (L02) en DONE
npm run demo:seed             # revient à SCHEDULED
```

Nettoyage complet (base + comptes Clerk) :

```bash
npm run demo:clean
```

### 3. Bascule du Backend sur la base de démo

**Non automatisée** (dépend de la façon dont chacun lance son Backend
localement). Depuis `Backend/`, sur le **même port 4000**, sans SMTP,
Twilio ni OneSignal (aucun e-mail/SMS/push pendant les captures) :

```bash
DATABASE_URL="postgresql://allo:allo_secret@localhost:5433/allo_appart_demo" \
SMTP_HOST= SMTP_USER= SMTP_PASS= TWILIO_ACCOUNT_SID= TWILIO_AUTH_TOKEN= \
ONESIGNAL_APP_ID= ONESIGNAL_API_KEY= \
npx nest start
```

**Important** : utiliser `nest start` (pas `nest start --watch`). En mode
watch, toute modification de fichier dans `Backend/` fait redémarrer le
process Nest, qui relit alors `Backend/.env` depuis le disque et **perd
la surcharge `DATABASE_URL` passée en ligne de commande** — le backend
repasse silencieusement sur la base de développement sans message
d'erreur (piège rencontré et documenté ici pendant le prompt 02).

Le Frontend n'a besoin d'aucun changement (même port 4000).

### 4. Capture

```bash
npm run capture:test    # capture/scenes/test-clip.spec.ts → captures/test/raw/*.webm + marks.json
node scripts/to-cfr.mjs captures/test/raw/<fichier>.webm public/captures/test/video.mp4
npm run render:test     # out/clips/clip-test-annonces.mp4 (1080×1920, 30 i/s, 5 s, H.264, muet)
```

## Point technique : ffmpeg fourni par Remotion

Le ffmpeg embarqué par `@remotion/cli` (`npx remotion ffmpeg`) est une
**build minimale** : seul un sous-ensemble de filtres y est compilé (pas
de filtre `fps`, pas de filtre `select`). Constaté en testant ce prompt :

- cadence constante : utiliser l'option de sortie **`-r 30`** (muxer),
  pas le filtre `-vf fps=30` (`No option name near '30'`) ;
- extraction d'une image à un instant donné : utiliser **`-ss <t> -vframes 1`**,
  pas `-vf select=eq(n\,N)`.

Par ailleurs, la vidéo brute de `context.recordVideo` (Playwright) est
**déjà à cadence constante** (25 i/s constants dans nos tests) — à la
différence de ce que supposait `PLAN_CAPTURE.md` § 2 (« cadence variable
à la source »), qui décrivait plutôt le flux DevTools `Page.startScreencast`
(plan B). `scripts/to-cfr.mjs` convertit malgré tout vers 30 i/s pour
respecter la règle commune à tous les clips.

## Netteté

Vérifiée visuellement sur le clip de test rendu (texte des cartes
d'annonces, montants, libellés de la barre de navigation du bas —
lisibles à l'écran). Le plan B (flux DevTools `Page.startScreencast`,
PLAN_CAPTURE.md § 2) n'a pas été nécessaire.

## Limites connues (prompt 02)

- Seules 9 annonces sur 23 sont seedées (celles filmées en gros plan :
  L01, L02, L12, L18-L23) — voir `demo/photos/credits.json`
  `_pending_curation` pour la liste des annonces restant à curer avant
  les scènes qui montrent le catalogue (05, 06, 11, 12).
- Les séries photo de L18/L19/L20/L22/L23 viennent de plusieurs
  photographes (pas un seul reportage par bien) — compromis du lot
  réduit, à corriger si possible lors de la curation complète.
