# PLAN_CAPTURE — Captures de l'application pour les clips 9:16

Prompt 01 · 13 octobre 2026 · **Plan uniquement : aucun script écrit, rien d'installé ni d'exécuté.**
Entrées : `RAPPORT_00.md` (« Décisions validées »), `PLAN_DEMO.md`, lecture du code. Je n'ai rien observé à l'écran dans ce prompt.

Rappels des décisions :
- vertical 1080 × 1920 seulement ;
- thème sombre ;
- scènes 08 et 09 fusionnées (« Réserver et échanger ») ;
- admin non filmé ;
- arrêt avant PayDunya ;
- aucune mention de « Portefeuille » ni de « Clients » ;
- `/regions/dakar` non filmée ;
- **pas de faux UI**.

---

## 1. Cadrage mobile : (A) téléphone sur fond de marque ou (B) plein cadre

Contrainte forte : les zones sûres Reels/TikTok excluent **les 250 px du haut et les 400 px du bas**. Il reste une bande utile de **1 270 px** (de y = 250 à y = 1 520).

| Critère | (A) Viewport 390 × 844 capturé à l'échelle 3, dans un cadre de téléphone sur fond bleu nuit et or | (B) Plein cadre 1080 × 1920 (viewport 360 × 640 à l'échelle 3) |
|---|---|---|
| Netteté | Capture en 1170 × 2532, réduite à l'affichage : très nette | 1080 × 1920 natif : nette |
| Zones sûres | Tout l'écran du téléphone tient dans la bande utile | **La barre de navigation (haut) et les barres fixes (bas) tombent sous l'interface TikTok/Reels**, donc cachées |
| Lisibilité | Interface affichée à environ 1,25× : petite. **Compensée par des zooms de caméra** dans Remotion sur la zone d'action | Interface à 3× : très lisible |
| Format de téléphone | 390 × 844 = téléphone actuel courant ; mise en page mobile réelle | 360 × 640 = ancien petit téléphone : interface tassée, peu de contenu visible |
| Place pour les textes et la marque | Oui : titres au-dessus du téléphone, halo et particules autour | Seulement en surimpression sur l'interface |
| Cohérence avec la pub 16:9 et l'affiche | Forte : même fond, même or | Faible |

**Recommandation : (A)**, avec des **mouvements de caméra** (zoom, recadrage, léger travelling) pour la lisibilité.

**Gabarit proposé, à affiner au prompt 02 :**
- titre de scène entre y = 270 et y = 420 (Poppins, 2 lignes max, 8 mots par ligne max) ;
- écran du téléphone entre y ≈ 450 et y ≈ 1 500, soit environ 485 × 1 050 px ;
- cadre **générique** dessiné dans Remotion : rectangle arrondi, fin liseré or, sans encoche ni forme reconnaissable d'une marque de téléphone ;
- lors des zooms, le téléphone peut déborder sur les côtés, mais jamais sur les zones interdites.

**Deux téléphones côte à côte** (scène 08, messagerie en temps réel) : deux écrans d'environ 470 × 1 020 px tiennent dans 1 080 de large, avec un zoom alterné sur celui qui reçoit le message.

---

## 2. 30 images/seconde : vidéo + conversion, ou captures image par image

| Critère | ① Vidéo Playwright (`recordVideo`), puis conversion en **30 i/s constants** avec ffmpeg | ② Captures image par image (une capture d'écran par frame) |
|---|---|---|
| Fidélité au produit | Animations réelles de l'app en temps réel : transitions, Framer Motion, `flyTo` de la carte, message qui arrive par Soketi | Les animations de l'app ne suivent pas : chaque capture prend 50 à 150 ms. Il faudrait truquer l'horloge du navigateur, ce qui **casse la session Clerk** |
| Cadence | Variable à la source (images envoyées quand l'écran change), rendue constante par ffmpeg (`fps=30` : duplique ou retire des images, durée réelle conservée) | Parfaite par construction |
| Netteté | **À vérifier** : la vidéo Playwright est compressée (VP8). Un test de 5 s au prompt 02 doit confirmer la netteté du texte en 1170 × 2532 | Parfaite (PNG) |
| Complexité | Faible | Élevée pour l'interactif, faible pour un écran statique |
| Reproductibilité | Bonne (données et actions identiques, petites variations de rythme) | Totale |

**Recommandation : méthode mixte.**
- **① pour toutes les interactions** (taper, filtrer, écrire, envoyer, carte).
- **② sous une forme simple : des captures PNG haute définition de l'écran entier** (`fullPage`, 1170 px de large). Elles servent aux plans « caméra » : défilement d'une fiche, zoom sur le badge.
  - Le défilement et le zoom sont alors animés dans Remotion sur l'image réelle de l'interface. Ce n'est pas un faux UI : c'est le même pixel, déplacé.
  - Pas d'effet de survol pendant ces plans.

**Plan B si ① n'est pas assez net** : enregistrer soi-même le flux d'écran de Chrome par le protocole DevTools (`Page.startScreencast` en PNG, horodaté). Ce protocole est déjà disponible par Playwright, sans nouvelle bibliothèque. On encode ensuite ce flux avec ffmpeg en 30 i/s constants.

**Chaîne de traitement :**
1. **Brut** : `captures/NN/raw/*.webm`, plus `captures/NN/marks.json` (repères horodatés posés par le script : « filtre ouvert », « badge visible »…, mesurés depuis l'ouverture de la page, qui démarre la vidéo).
2. **Conversion** avec le ffmpeg fourni par Remotion (`npx remotion ffmpeg`, donc **aucune installation** de ffmpeg) :
   - `fps=30` ;
   - mise à l'échelle Lanczos ;
   - H.264 `crf` ≈ 14, `yuv420p` ;
   - **image clé toutes les 15 images** (recherche précise dans Remotion) ;
   - **sans audio**.
3. **Publication** dans `public/captures/NN/` (Remotion ne sert que `public/` via `staticFile`).
4. **Remotion** :
   - `<OffthreadVideo src={staticFile('captures/NN/video.mp4')} muted>` dans une `<Sequence>` ;
   - `startFrom` est calé sur `marks.json` (on coupe les temps de chargement) ;
   - `playbackRate` reste entre 1 et 1,25 au maximum, pour resserrer sans dénaturer ;
   - les PNG passent par `<Img>`.
5. **Rendu du clip** : `out/clips/clip-NN-nom.mp4`, 1080 × 1920, 30 i/s, H.264, `--muted`, 0,5 s d'image stable au début et à la fin.

---

## 3. Curseur simulé et gestes

- **Indicateur de toucher** plutôt qu'une flèche (on filme un téléphone) :
  - rond de 44 px CSS, blanc à 30 %, liseré or `#facc15` ;
  - **onde** dorée à chaque appui ;
  - léger rétrécissement pendant l'appui.
- Il est **injecté par le script de capture** (`addInitScript`) en calque `pointer-events: none`. **Aucune modification du code de l'application** : il n'existe que dans le navigateur de capture.
- **Mouvements** : déplacements en 20 à 30 pas avec accélération et décélération ; pause de 250 à 400 ms avant chaque appui (le spectateur doit voir où l'on va appuyer).
- **Défilement** : défilement progressif programmé (durée fixe, courbe douce), jamais de saut. Arrêts sur les éléments clés.
- **Saisie** : `keyboard.type` avec 60 à 90 ms par caractère (titre d'annonce, message).
- **Glissement du carrousel** (fiche) : geste de glissement simulé à la souris, avec le même indicateur.

---

## 4. Connexion par compte de démo (Clerk) — **révisé, méthode par jeton invalidée**

**Constat dans le code** : la connexion utilise un **formulaire maison** (`SignInForm.tsx`) et non les composants Clerk prêts à l'emploi. Le captcha (Turnstile) ne concerne que l'inscription. `e2e/flow.mjs` crée déjà ses utilisateurs par l'API Backend de Clerk.

**Méthode initialement recommandée (jeton de connexion, § 4 d'origine) : invalidée.** Constat fait pendant l'exécution du prompt 02 : les sessions par jeton Clerk (`sign_in_token`, stratégie `ticket`) ne fonctionnent pas sur les espaces connectés, dont le rendu passe par le serveur (`ClerkAuthGuard`, Server Components) — le jeton active une session côté client mais n'établit pas le cookie `__client` que Clerk exige pour le rafraîchissement silencieux côté serveur. C'est le même constat qui avait déjà fait basculer `Frontend/rapports-mobile/tools/clerk-session.mjs` du jeton vers le formulaire réel (voir son en-tête).

**Méthode validée : connexion par le vrai formulaire `/sign-in`, avec mot de passe.**
1. Chaque compte de démo a une adresse contenant **`+clerk_test@example.com`** (ex. `demo-bailleur+clerk_test@example.com`) — en instance de développement Clerk, ce motif accepte le **code de vérification fixe `424242`** si une étape de code est présentée. Combiné à un vrai mot de passe, la connexion aboutit en un seul passage par le formulaire, sans code à saisir manuellement dans le cas courant (mot de passe + e-mail suffisent au formulaire maison).
2. Les comptes sont provisionnés avec un **mot de passe réel généré** (jamais `skip_password_requirement`), par l'API Backend de Clerk — même mécanisme que `provision-test-accounts.mjs` (recherche par e-mail, création sinon, régénération du mot de passe sinon : idempotent, jamais de doublon).
   - Le mot de passe est stocké **uniquement** dans `Frontend/motion/capture/.credentials.env` (gitignoré), jamais affiché en sortie ni commité.
3. `auth.setup` (exécuté avant chaque série de captures) ouvre `/sign-in` dans un contexte Playwright neuf, **attend `window.Clerk.loaded`** avant de toucher au formulaire (sinon Clerk réinitialise un champ rempli trop tôt — cause déjà rencontrée et corrigée dans `clerk-session.mjs`), remplit e-mail puis mot de passe, revérifie la valeur de chaque champ après la saisie (un champ vidé est resaisi une fois), clique sur Connexion, et attend la redirection vers la route de contrôle du rôle (`/bailleur`, `/locataire`, `/agent`, …).
   - Il pose aussi : cookie `allo-theme=dark`, cookie `allo-locale=fr`, `aa_cookie_consent=1` dans le stockage local.
4. Il enregistre l'état du navigateur (`storageState`) dans `capture/.auth/<rôle>.json`.
   - Ce fichier contient une session : il ne doit jamais être partagé et il faut l'ajouter au `.gitignore` si `motion` est versionné.
   - Il est régénéré à chaque série : les sessions expirent.
5. Chaque scène ouvre un contexte neuf avec l'état du bon rôle.

**Alternative** (non retenue) : la bibliothèque `@clerk/testing`. Elle fait la même chose mais ajoute une dépendance : non justifié.

**Admin** : **aucune connexion admin**. Le code par e-mail n'est jamais nécessaire, et l'assignation de l'agent est représentée par un texte animé (décision).

**Visiteur** (05, 06, partie vitrine de 11) : contexte sans session, avec seulement le thème, la langue et le consentement cookies.

---

## 5. Éléments parasites

| Élément | Constat (code) | Traitement proposé |
|---|---|---|
| **Bandeau « Development mode » de Clerk** | Il n'apparaît que dans les composants Clerk prêts à l'emploi, et **aucun n'est utilisé** : connexion et inscription sont des formulaires maison. Correction du RAPPORT_00, qui le supposait visible. | La page `/sign-in` n'est **jamais filmée** (connexion par jeton, § 4). Contrôle visuel de tous les écrans filmés au prompt 02. Si un badge Clerk apparaissait quand même, on **recadre** ou on coupe, sans CSS injecté. |
| **Indicateurs de développement Next.js** | `devIndicators: false` déjà dans `next.config.ts`. Une erreur d'exécution afficherait le panneau d'erreur. | Le script **échoue** s'il voit une erreur dans la console ou ce panneau : on corrige la cause et on ne filme pas par-dessus. |
| **Bannière cookies** | `CookieConsentBanner` s'affiche si `aa_cookie_consent` est absent du stockage local. | On pose `aa_cookie_consent=1` avant le premier chargement. C'est l'état réel d'un visiteur qui l'a déjà acquittée, pas un masquage. |
| **Squelettes de chargement** | `PublicSkeletonOverlay` ne s'affiche que pendant un changement de langue. Les pages ont leurs propres états `animate-pulse`, et la première visite d'une route en `next dev` est lente (compilation). | Passe de **préchauffage** de toutes les routes avant d'enregistrer. Puis, avant chaque segment : réseau inactif, plus aucun `.animate-pulse`, images chargées, `document.fonts.ready`. Les temps morts sont coupés dans Remotion grâce à `marks.json`. |
| **Barres fixes mobiles** | Barre de prix et contact de la fiche (`ListingContactCard`, `fixed bottom-3 md:hidden`), navigation collante en haut. | **On les garde** : elles font partie de l'interface mobile réelle, et la barre « prix · Envoyer » est même un bon appel à l'action. Avec le cadrage (A), elles restent dans la bande sûre. Les arrêts de défilement sont choisis pour que la barre ne cache pas l'élément montré. **Pas de masquage par CSS.** |
| **Notifications temporaires** (toasts) | En bas à droite, après une action. | Gardés s'ils confirment une vraie action (« Annonce boostée »). Sinon, on attend leur disparition avant le segment suivant. |
| **PayDunya** | Ouvert dans un nouvel onglet, page tierce. | Jamais visité. **Filet de sécurité** : toute requête vers `*paydunya*` est bloquée dans le navigateur de capture, et le script échoue si un nouvel onglet s'ouvre. |
| **Liens externes** (WhatsApp, `tel:`, `sms:`) | Fiche vente, vitrine. | Montrés mais **jamais activés**. `wa.me` est bloqué par sécurité. |
| **Carte OpenStreetMap** | Tuiles `tile.openstreetmap.org`, attribution affichée. En thème sombre, les tuiles restent claires (aucun style sombre de carte dans le code). | Attribution **toujours visible** (licence) : on ne la recadre pas. Les tuiles sont enregistrées une fois dans une archive HAR, puis rejouées depuis le disque. On obtient des prises identiques, sans tuiles grises, et moins de charge sur les serveurs OSM (conforme à leur politique d'usage). Ce sont les tuiles réelles. |
| **Dates et chiffres** | Libellés relatifs (« il y a 2 h »), courbe des revenus calculée sur 6 mois glissants à partir de la date du jour, bouton « Démarrer » de la visite possible seulement à partir de l'heure prévue − 15 min. | **Re-seed juste avant chaque scène** (dates relatives à J). Fuseau `Africa/Dakar`, locale `fr-FR`. **On ne truque pas l'horloge du navigateur**, ce qui casserait la session Clerk. |
| **Compteurs** (cloche, vues de vitrine) | Données du seed. | Valeurs fixées par le seed. |
| **Mode démo** (`aa_demo_role`) | Simule un faux succès : faux UI. | Le script **vérifie l'absence** de `aa_demo_role` dans le stockage local et échoue sinon. |
| **Brouillon de publication** (`aa_listing_draft`) | Restauré automatiquement depuis le stockage local. | Contexte neuf à chaque prise, donc formulaire vide. |
| **Saisie automatique du navigateur** | E-mail personnel prérempli sur `/sign-in`. | Navigateur de capture neuf, sans profil ; `/sign-in` jamais filmée. |
| **Création réelle par erreur** | Valider Publier crée une annonce. | En scène 10, les requêtes `POST /listings` sont **bloquées** par le script : un clic accidentel échoue sans rien créer. |

---

## 6. Plan par scène

Durées issues des décisions : ≈ 70 s au total. Scènes 03, 04 et 13 : **animation pure en Remotion**, sans capture.

| Clip | Compte | Écrans et actions | Réel (capturé) | Animé (Remotion) | Méthode | Durée |
|---|---|---|---|---|---|---|
| **03** Problème | — | — | — | Reprise de l'acte 1 en 9:16 | — | 4 s |
| **04** Révélation | — | — | — | Acte 2, logo, badge AlloVérifié | — | 5 s |
| **05** Recherche et filtres | Visiteur | `/listings` → « À louer » → Région « Dakar » → Filtres → AlloVérifié → pastilles actives → 2 résultats vérifiés (L01, L12) | Tout l'écran | Titre, zoom sur les pastilles | ① | 7 s |
| **06** Fiche logement | Visiteur | `/listings/L01` : glisser 3 photos → caractéristiques → bloc AlloVérifié (date, notes) → carte (attribution visible) → barre de prix | Tout l'écran | Titre, zoom sur le badge | ① + PNG pour le défilement | 6 s |
| **07** Parcours AlloVérifié™ | Bailleur, puis agent | ① `/bailleur/verifications` : frise « Planifié » pour L02. ② Texte animé « Un agent AlloVérifié est assigné ». ③ `/agent/verifications` → mission L02 → **Démarrer** → 3 photos de visite → notes → **Terminer**. ④ `/bailleur/verifications` : « Vérifié ». ⑤ `/listings/L02` : badge | Écrans ①③④⑤ ; **actions réelles sur la base de démo** | Le texte de l'étape admin, les transitions | ① | 10 s |
| **08** Réserver et échanger | Locataire + bailleur (2 téléphones) | ① Fatou écrit dans le salon R1 « Super, je réserve maintenant ! », reçu **en direct** chez Moussa (Soketi). ② Fiche L01 : choix des dates, récapitulatif du prix. ③ Paiement : voir décision **C3**. ④ « Mes réservations » : réservation confirmée, boutons Reçu et Contrat | Tout le contenu des écrans | Texte « Paiement sécurisé avec PayDunya », mise en page à 2 téléphones | ① | 8 s |
| **10** Publier en 6 étapes | Bailleur | `/publier` : type et titre (saisie) → caractéristiques → localisation (choix « Thiès » → `flyTo`, appui sur la carte → région déduite) → prix → photos (3 envois) → **récapitulatif, sans valider** | Tout l'écran | Compteur d'étapes « 1/6 → 6/6 » en surimpression si utile | ① | 10 s |
| **11** Agence : vente directe | Visiteur, puis agence | ① `/agences/atlantique-horizon-immobilier` (vitrine). ② Fiche vente L21 : Appeler et WhatsApp, sans activer. ③ Connectée, `/publier` → bascule **Vente** → type Terrain | Tout l'écran | Titre | ① | 8 s |
| **12** Mes annonces et boost | Bailleur (voir **C4**) | `/bailleur/listings` : onglets Actives, Brouillons, Louées, Archivées → Voir → Booster : fenêtre avec prix et durée, **arrêt avant paiement**. L05 déjà boostée. (+ `/bailleur` revenus seulement si crédibles) | Tout l'écran | Titre | ① | 7 s |
| **13** Appel à l'action | — | — | — | Acte 4 (domaine à trancher : RAPPORT_00, question 7) | — | 5 s |

**Total** : 4 + 5 + 7 + 6 + 10 + 8 + 10 + 8 + 7 + 5 = **70 s**, plus 0,5 s de marge en début et en fin de chaque clip.

**Effets de bord des actions réelles** (07, 08, 10) :
- les envois de photos créent des fichiers Cloudinary : le script relève leurs identifiants et `demo:clean` les supprime ;
- les messages et changements de statut sont écrits dans la base de démo, puis remis à zéro par le re-seed suivant.

---

## 7. Reproductibilité

**Arborescence proposée** (tout dans `Frontend/motion`) :

```
motion/
  capture/
    playwright.config.ts      projet « mobile » : 390×844, échelle 3, tactile, sombre,
                              fr-FR, Africa/Dakar, 1 seul worker, 0 relance
    auth.setup.ts             sessions par rôle (§ 4)
    lib/                      curseur, défilement, attente « prêt », repères, blocages réseau
    scenes/scene-05.spec.ts … scene-12.spec.ts   (05, 06, 07, 08, 10, 11, 12)
    .auth/                    états de session (privés, régénérés)
  scripts/demo.mjs            sauvegarde / création de la base / reset / clean / bascule du backend
  scripts/to-cfr.mjs          conversion en 30 i/s constants
  captures/NN/raw/            vidéos brutes, PNG, marks.json, meta.json
  public/captures/NN/         vidéo convertie + PNG utilisés par Remotion
  src/clips/ClipNN*.tsx       une composition 1080×1920 par clip
  out/clips/clip-NN-nom.mp4   clips finaux
```

**Commandes** (une par scène) :

| Commande | Effet |
|---|---|
| `npm run demo:backup` / `demo:reset` / `demo:clean` | Opérations du plan de données |
| `npm run capture:auth` | Régénère les sessions |
| `npm run capture:05` | `demo:reset` → préchauffage → `scene-05.spec.ts` → `to-cfr` → copie dans `public/captures/05/` |
| `npm run render:05` | Rendu de `out/clips/clip-05-recherche.mp4` (muet) |

**Garanties** :
- chaque capture repart d'un **état de données identique** (re-seed) ;
- `meta.json` consigne, pour chaque prise :
  - le commit de l'application ;
  - l'empreinte du seed ;
  - la date J ;
  - les versions (Playwright, Remotion, navigateur) ;
- une relance écrase proprement `captures/NN/` ;
- versions figées.

**Dépendance** : `@playwright/test` en **1.62.1**, la même version que `Frontend/package.json`, ajoutée au `package.json` de `motion`. Cela réutilise les navigateurs déjà installés par le projet (présence à vérifier) et garde `motion` isolé. Aucune autre bibliothèque.

**Clips en sortie** (noms) :
- `clip-03-probleme`
- `clip-04-revelation`
- `clip-05-recherche`
- `clip-06-fiche`
- `clip-07-alloverifie`
- `clip-08-reserver-echanger`
- `clip-10-publier`
- `clip-11-agence-vente`
- `clip-12-mes-annonces`
- `clip-13-cta`

---

## 8. Vérification demandée par les décisions : tableaux de bord en thème sombre

**Non faite dans ce prompt**, et ce n'était pas possible proprement : aucun compte de démo n'existe encore, le seed est interdit ici, et je ne me connecte pas avec des identifiants.

**Ce que dit le code** :
- les pages filmées (`/bailleur`, `/bailleur/listings`, `/bailleur/verifications`, `/bailleur/boost`, `/agent`, `/agent/verifications[/id]`, `/locataire`, `/locataire/bookings`, `DashboardShell`) ont toutes de nombreuses variantes `dark:` (entre 16 et 54 par fichier) ;
- elles utilisent les jetons de thème (`bg-card`, `text-text`…) ;
- seules quelques pastilles d'icônes ont un fond blanc semi-transparent fixe (`bg-white/80`).

**Proposition** : en tout premier test de fumée du prompt 02, juste après le seed, capturer chaque tableau de bord en sombre et me les soumettre avant d'aller plus loin.

---

## 9. Décisions à valider (capture)

| # | Question | Proposition |
|---|---|---|
| C1 | Cadrage (A) téléphone sur fond de marque, avec zooms de caméra | **Oui** |
| C2 | Méthode mixte : vidéo Playwright → 30 i/s constants pour les interactions, PNG HD pour les plans de défilement ou de zoom ; plan B = flux d'écran par le protocole DevTools si le test de netteté échoue | **Oui** |
| C3 | Scène 08, moment du paiement. **(a)** Pas de clic sur « Réserver et payer » : coupure → texte « Paiement sécurisé avec PayDunya » → « Mes réservations » avec la réservation confirmée **déjà présente dans le seed** (L05, autres dates). **(b)** Activer le contournement de développement `PAYDUNYA_DEV_BYPASS` du backend de démo pour cette seule prise : le clic crée une vraie réservation, marquée payée sans PayDunya, puis la page de confirmation réelle s'affiche ; la coupure s'accompagne du même texte. Inconvénients de (b) : on raccourcit le vrai parcours, et la page de détail afficherait une référence « DEV-BYPASS » (à ne pas filmer). | **(a)**, plus sobre et sans contournement |
| C4 | Scène 12 : bailleur particulier (fenêtre de boost, arrêt avant paiement) ou agence PRO (boost **gratuit**, action réelle complète, sans paiement) ? | **Agence PRO** pour montrer un boost abouti. Sinon bailleur, avec arrêt à la fenêtre |
| C5 | Scène 07 : visite démarrée et terminée **en direct** par l'agent (actions réelles sur la base de démo, 3 photos envoyées sur Cloudinary), ou seulement montrer les états déjà présents dans le seed ? | **En direct** (plus fort et réel) |
| C6 | Scène 10 : envoyer réellement 3 photos à l'étape Photos (obligatoire pour atteindre le récapitulatif ; fichiers Cloudinary supprimés ensuite par `demo:clean`) | **Oui** |
| C7 | Backend de démo sur le **même port 4000** pendant les captures (frontend inchangé, redémarré à chaque bascule), sans e-mails, SMS ni notifications push | **Oui** |
| C8 | Ajouter `@playwright/test` 1.62.1 au `package.json` de `motion` | **Oui** |
| C9 | Tuiles OSM enregistrées une fois puis rejouées (HAR), attribution toujours visible | **Oui** |
| C10 | Versionner `Frontend/motion` (question 6 du RAPPORT_00, encore ouverte) avant que le prompt 02 y ajoute des scripts ; `.auth/` et `captures/*/raw` exclus | **Oui**, à trancher avant le prompt 02 |
| C11 | Domaine affiché dans la scène 13 (question 7 du RAPPORT_00, encore ouverte) | À trancher avant le clip 13 |

---

## Décisions validées

*Décisions de l'utilisateur, reçues après la livraison des plans (13 octobre 2026). Elles s'imposent au prompt 02 et aux suivants. Le même texte figure à la fin de PLAN_DEMO.md et de PLAN_CAPTURE.md.*

### 1. Seed dans `Backend/` (D2)

- **Autorisé au prompt 02** : uniquement **deux nouveaux fichiers**, `Backend/prisma/seed.demo.ts` et `Backend/scripts/demo-clean.ts`.
- **Aucun fichier existant modifié.**

### 2. Scène 08 — paiement (C3)

- **On ne clique pas sur « Réserver et payer ».**
- Coupure vers une réservation **déjà confirmée** dans le seed : la villa de Saly (L05).
- **Pas de contournement de paiement** : `PAYDUNYA_DEV_BYPASS` reste désactivé.

### 3. Mention et avis (D7, D8)

- Mention **« données de démonstration »**, en petit, sur les clips qui montrent le catalogue ou des chiffres.
- **Aucun avis inventé** (ni avis client, ni note d'agent).

### 4. Numéro de l'agence (D6)

- La décision reçue contient le texte « [TON NUMÉRO] » : **aucun numéro n'a été fourni**.
- **Point ouvert.** Le prompt 02 ne doit pas inventer de numéro et doit s'arrêter pour le demander si le numéro manque encore. Sinon, il laisse les champs téléphone et WhatsApp de l'agence vides et le signale.

### 5. Nom de l'agence fictive (D4)

- On garde **« Atlantique Horizon Immobilier »** pour l'instant.
- L'utilisateur vérifie de son côté qu'aucune agence réelle ne porte ce nom.

### 6. Scène 07 — vérification de L02 (remplace C5)

- La vérification de L02 est **faite par le seed**. Il n'y a **pas de visite démarrée ni terminée en direct** par l'agent pendant la capture.
- Elle est représentée par un **texte animé, sans écran admin**.
- **À préciser avant le prompt 07** : faut-il filmer les écrans du bailleur (frise de suivi) et de l'agent (mission) dans leur état fixe issu du seed, autour du texte animé, ou seulement le texte animé suivi du badge sur l'annonce ?

### 7. Scène 13

- **Aucun domaine affiché.** Le clip se termine sur le **logo et le slogan**.
- L'adresse sera ajoutée dans CapCut.

### 8. Versionnement de `Frontend/motion` (C10)

- Le dossier est **versionné**, en excluant `node_modules`, `out/` et les captures lourdes (`captures/*/raw`, vidéos de `public/captures`).
- Le dossier `capture/.auth/` est exclu aussi : il contient des sessions.
- **Point d'attention pour le prompt 02** : `/motion/` est aujourd'hui ignoré par `Frontend/.gitignore` (ligne 44). Le versionner oblige à **modifier ce fichier existant**, ce qui sort du point 1. Il faut donc une autorisation explicite pour cette seule ligne. Aucun commit sans accord.

### 9. Reste des plans validé

- Cadrage en téléphone sur fond de marque, avec zooms (C1).
- Méthode 30 i/s mixte : vidéo Playwright convertie en cadence fixe, PNG HD, plan B par le protocole DevTools (C2).
- Connexion par jeton Clerk (§ 4 de PLAN_CAPTURE).
- Bannière cookies acquittée par le stockage local.
- Barres fixes mobiles gardées.
- PayDunya bloqué dans le navigateur de capture.
- **Base de démo séparée** (D1) ; les autres propositions des tableaux D et C non contredites ci-dessus sont également validées.
- **Nom de la base à confirmer** : la décision écrit `alloappart_demo`, le plan proposait `allo_appart_demo`, sur le modèle de la base de dev `allo_appart`. Le garde-fou du seed (nom finissant par `_demo`) fonctionne avec les deux. Par défaut, le prompt 02 utilise `allo_appart_demo`, sauf indication contraire.

---

## Décisions validées (suite)

*Décisions complémentaires de l'utilisateur, 13 octobre 2026. Elles complètent et remplacent les points ouverts de la section précédente. Le même texte figure à la fin de PLAN_DEMO.md et de PLAN_CAPTURE.md.*

### 1. Numéro de l'agence (D6, point 4)

- Téléphone de l'agence de démo « Atlantique Horizon Immobilier » : **+221 33 832 69 72**.
- C'est le numéro fourni par l'utilisateur. Il est utilisé pour `agencyPhone`.
- Note pour le prompt 02 : c'est une ligne fixe (préfixe 33). Le bouton WhatsApp ne fonctionne que si ce numéro est enregistré sur WhatsApp (Business). Sinon, il faut laisser `agencyWhatsapp` vide : la fiche affichera alors « Appeler » seul en mobile, ce qui est le comportement réel.

### 2. Scène 07 (point 6)

La scène se filme dans cet ordre :

1. **Écran de demande AlloVérifié du bailleur** (`/bailleur/verifications`), dans son **état fixe** issu du seed.
2. **Texte animé** pour la visite et la validation.
3. **Badge AlloVérifié sur l'annonce** (L02).

**Aucun écran de l'agent de terrain**, et aucun écran admin.

Conséquence pour les données : l'écran du bailleur doit montrer L02 **avant** la visite (statut « Planifié »), alors que le badge exige la vérification terminée (DONE). Le prompt 02 prévoit donc deux états du seed, dans la même session de capture :
- un état « planifié » pour le plan 1 ;
- puis une étape `seed` qui termine V3, pour le plan 3.

Il ne s'agit que de données, aucun écran n'est inventé.

Le compte `demo-agent` reste nécessaire dans le seed : il porte les vérifications V1 à V3, mais il n'est plus filmé.

### 3. `Frontend/.gitignore` (point 8)

Au prompt 02, seules les modifications suivantes sont autorisées :
- **retirer uniquement la ligne `/motion/`** (ligne 44) de `Frontend/.gitignore`. Aucune autre modification de ce fichier ;
- **créer `Frontend/motion/.gitignore`**, qui ignore :
  - `node_modules/` ;
  - `out/` ;
  - les captures lourdes (`captures/*/raw/`, vidéos de `public/captures/`) ;
  - `capture/.auth/` (sessions, cf. section précédente, point 8).

Aucun commit ni push sans accord explicite.

### 4. Nom de la base de démo (point 9)

- **`allo_appart_demo`** (et non `alloappart_demo`).

---

## Décisions validées — correction de connexion (24 octobre 2026)

*Reçue pendant l'exécution du prompt 02. Remplace la méthode « jeton de connexion » du § 4 ci-dessus. Le même texte figure à la fin de PLAN_DEMO.md et de PLAN_CAPTURE.md.*

- **Constat** : les sessions par jeton Clerk ne fonctionnent pas sur les espaces connectés (rendu serveur).
- **Méthode validée** : connexion par le **vrai formulaire `/sign-in`**, avec des comptes de démo dont l'adresse contient **`+clerk_test`** (ex. `demo-bailleur+clerk_test@example.com`), qui acceptent le code `424242` en instance de développement, et un **mot de passe de test généré**, stocké uniquement dans un fichier local non versionné (`Frontend/motion/capture/.credentials.env`).
- `Frontend/rapports-mobile/tools/clerk-session.mjs` montre la méthode de référence (attendre `window.Clerk.loaded` avant de remplir le formulaire).
- Le reste des décisions ne change pas.
- **Rendu mobile** : l'application a désormais un mode « application » sous 768 px (barre de navigation du bas, feuilles du bas/BottomSheet, PWA). Toute capture à 390 × 844 doit montrer ce rendu réel.
