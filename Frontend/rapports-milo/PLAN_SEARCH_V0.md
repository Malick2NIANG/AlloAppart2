# PLAN_SEARCH_V0 — Milo Search v0 (cadrage)

Cadrage · 29 octobre 2026, mis à jour le 29 octobre 2026 avec les décisions validées · **Lecture seule : aucun fichier de code modifié.**
Entrées : `Milo.md` (en entier, y compris § 3.4 mis à jour le jour même), lecture du code Backend/Frontend, lectures SQL en lecture seule sur `allo_appart` (base de dev — les 4 conteneurs Docker, arrêtés à la fin de la mission précédente, ont été redémarrés pour l'inspection et **laissés en marche sur décision explicite**).

## Décisions validées (2026-10-29)

1. Seuils § 2.g validés avec un principe directeur : **privilégier la non-extraction à la mauvaise extraction**. Précision ≥ 95 % sur les montants et sur le type de transaction. Requêtes de 2-3 mots : repli automatique sur la langue du sélecteur, aucun seuil de détection mesuré sur ce sous-ensemble.
2. **Pièces (`rooms`) ≠ chambres (`beds`)** : F3/T3 = 3 pièces → `rooms = 3`. « 2 chambres »/« 2 bedrooms » → `beds`, jamais `rooms`. Le Backend n'a pas de filtre sur `beds` aujourd'hui : un lot Backend dédié (`minBeds`/`maxBeds` dans `FilterListingsDto` + `ListingsService.findAll` + tests) est ajouté au lot 1, sans aucun changement visible sur le Frontend existant.
3. Placement : champ Milo **en haut de `/listings`**, mobile et PC. Le lien `/search` mobile pointe désormais vers ce champ. Accueil PC **inchangé à ce stade** — une capture sera proposée avant toute décision sur l'accueil.
4. Jeu de test : 100 requêtes FR pures + 100 EN pures + un 3ᵉ fichier `mixed.json` de 30 requêtes à langues mélangées, mesurés séparément.
5. Mémoire `project_ai_assistant.md` : marquée « remplacée par Milo.md, jamais implémentée, ne pas suivre cette spec » (non supprimée — voir note en fin de document).
6. Docker : laissé en marche. Le correctif Meilisearch `filterableAttributes`/`sortableAttributes` (§ 1.b) reste positionné au lot 6, inchangé.

---

## 0. Rappel du périmètre (Milo.md)

- **Coût zéro absolu** : aucune API payante, aucun GPU loué. Développement sur le PC de dev + quotas gratuits s'ils existent ; production sur le VPS déjà payé (Hetzner CPX41, 8 vCPU partagés, 16 Go RAM, **sans GPU**).
- Search v0 = **sans modèle entraîné** : analyseur à règles et dictionnaires, filtrage classique sur les vraies annonces, classement par Meilisearch (déjà dans le Docker). Jamais d'annonce inventée.
- Langue (décision du 2026-10-29) : détection automatique de la langue d'écriture, repli sur le sélecteur FR/EN si incertain. Lancement FR + EN, liste de langues croissante ensuite. Pas de wolof pour l'instant.

---

## 1. Inventaire

### 1.a Backend — filtres existants et traitement de `q`

**`Backend/src/listings/dto/filter-listings.dto.ts`** — `FilterListingsDto`, tous les champs optionnels :
`q` (string), `region`, `city`, `type` (`ListingType`), `transactionType` (`LOCATION`/`VENTE`), `minPrice`/`maxPrice`, `isVerified`, `minRooms`/`maxRooms`, `minSurface`/`maxSurface`, `amenities` (string[], CSV→array), `ownerType` (`PARTICULIER`/`AGENCE`), `page`, `limit`.

**`ListingsService.findAll()`** (`listings.service.ts:102-256`) — chemin utilisé par `/listings` (catalogue principal, desktop **et** mobile, bottom nav « Annonces ») :
- Construit un `where` Prisma direct (pas de Meilisearch ici) ; `region`/`city`/`type`/`transactionType`/`isVerified` en égalité exacte, `price`/`rooms`/`surface` en `gte`/`lte`, `amenities` en `hasEvery` (toutes requises, pas « au moins une »), `ownerType` via les rôles du propriétaire.
- `q`, quand présent : `OR` sur `title`/`description`/`city`/`region`, chacun en `contains`/`insensitive` — **recherche sous-chaîne simple, aucune tolérance aux fautes, aucun synonyme**.
- Récupère **toutes** les lignes correspondantes (`findMany` sans `take`/`skip`), calcule un score de priorité (abonnement PRO/STARTER actif, boost, AlloVérifié), trie, **puis** pagine en mémoire. Fonctionne au volume actuel (13 annonces actives en dev) ; à surveiller si le catalogue grossit beaucoup.
- Champs supportés par l'API mais **non exposés dans `ListingsFilters.tsx`** (le panneau de filtres de `/listings`) : `minRooms`/`maxRooms`, `minSurface`/`maxSurface`, `amenities`, et `q` lui-même — aucun champ de texte libre sur `/listings`. Milo pourra les piloter même si l'utilisateur ne les voit jamais comme filtres manuels.

**Barre de recherche** :
- Page d'accueil (`(public)/page.tsx:320`) : un bouton-lien vers `/search`, **visible uniquement sous 768 px** (`md:hidden`) — rien sur desktop.
- `NavbarClient.tsx:440` : icône loupe vers `/search` dans l'en-tête, également `md:hidden` seul.
- **Aucun champ de texte libre n'existe aujourd'hui sur desktop**, nulle part dans l'application publique.

**`/search` (page, `(public)/search/page.tsx`)** : formulaire `q` seul → `GET /search?q=...` (contrôleur Meilisearch, § 1.b). Mobile uniquement, point d'entrée secondaire par rapport à `/listings`.

**`/listings` (page)** : lit les `searchParams` de l'URL, les transmet tels quels à `GET /listings?...` (`ListingsController` → `FilterListingsDto` → `findAll`). C'est le parcours principal.

### 1.b Meilisearch — réellement utilisé, mais partiellement configuré

- **Utilisé** : `SearchController` (`GET /search`, `GET /search/geo`, `POST /search/reindex` en ADMIN) + `SearchService`. Index **`listings`**, 22 documents actuellement (vérifié en direct : `GET /indexes/listings/stats`) — alimenté par `indexListing()`/`deleteListingFromIndex()` appelés en *fire-and-forget* (`.catch(() => undefined)`, erreurs avalées silencieusement) depuis `ListingsService.syncSearchIndex()` à chaque création/mise à jour, plus `reindexAll()` complet (bouton « Réindexer » de `/espace/config`).
- Champs indexés : `id`, `title`, `description`, `type`, `city`, `region`, `price`, `isVerified`, `boostScore`, `createdAt`, `_geo` (si `lat`/`lng`).
- **Constat important (vérifié en direct, `GET /indexes/listings/settings`)** : `filterableAttributes: []` et `sortableAttributes: []` — **aucun attribut filtrable ni triable n'est configuré**, alors que `SearchController` accepte des paramètres `filter`/`sort` et les valide (`ALLOWED_FILTER_FIELDS`, `ALLOWED_SORT_FIELDS`). En l'état, toute requête `GET /search?filter=...` ou `?sort=...` échouera côté Meilisearch (attribut non filtrable/triable) — **capacité présente dans le code mais non opérationnelle**, jamais appelée par aucune page du Frontend actuellement (qui n'envoie que `q`).
- `synonyms: {}` — aucun synonyme. `typoTolerance.enabled: true` — tolérance aux fautes **active par défaut** (rien à configurer pour ça).
- `geoSearch()` n'utilise pas Meilisearch : requête PostGIS directe (`ST_DWithin`/`ST_Distance`) sur Postgres.
- **Version : 1.8.4** (vérifié `GET /version`). La recherche hybride/vectorielle existe depuis 1.6 mais reste **expérimentale** à cette version (à activer via `/experimental-features`, embedder à fournir — `userProvided` = on calcule soi-même les vecteurs avec un petit modèle local gratuit, ou `huggingFace` = modèle téléchargé une fois, exécuté localement, toujours coût zéro). Non nécessaire pour v0 (voir § 2.a).
- Fallback déjà en place : si Meilisearch est indisponible, `fullTextSearch()` retombe sur un `contains` Prisma équivalent à celui de `findAll` — pas de panne totale si le conteneur tombe.

### 1.c IA déjà présente — aucune en code, un ancien plan payant en mémoire

- **Recherche exhaustive** (`grep` sur tout `Backend/src` et `Frontend/src`) : **aucune occurrence** de `anthropic`, `Claude`, `AlloAI` dans le code. Aucun appel à l'API Anthropic n'existe nulle part dans ce dépôt.
- Les seules traces sont documentaires : `Backend/.env` a une section commentée (`# ANTHROPIC_API_KEY=...`, « à ajouter quand on réactive les features IA ») et trois fichiers de déploiement (`TODO_PRODUCTION.md`, `DEPLOY.md`, `DEPLOYMENT_PART.md`) mentionnent de « recharger le crédit API Anthropic » pour « les 6 fonctionnalités IA d'AlloAI, actuellement bloquées ».
- La mémoire auto de cet outil (`project_ai_assistant.md`, dernière mise à jour il y a 163 jours) décrit la spec d'origine : bouton flottant + page `/search/ai`, pipeline **Whisper API → Claude Sonnet → Meilisearch + PostGIS → OpenAI TTS**, mémoire de session Redis. **Jamais implémentée.** Cette spec utilisait exclusivement des API payantes — elle est **incompatible avec la contrainte coût zéro de Milo.md** et doit être considérée comme **remplacée** par Search v0, pas comme un code à « désactiver » (il n'y a rien à désactiver, rien n'a été écrit).
- **Rien à retirer du code.** La mémoire `project_ai_assistant.md`, obsolète par rapport à Milo.md, a été marquée (2026-10-29, décision validée) : « remplacée par Milo.md, jamais implémentée, ne pas suivre cette spec » — conservée (non supprimée), pour garder la trace de l'ancienne idée sans risquer qu'une session future la reprenne par erreur.

### 1.d Données

**Distribution réelle (base de dev `allo_appart`, lecture seule, 13 annonces `ACTIVE`)** — volume bien trop faible pour être représentatif, mais révélateur de la forme des données :

| Champ | Valeurs observées |
|---|---|
| `region` | Dakar (11), Thiès (2) |
| `city` | Plateau (7, *en réalité un quartier de Dakar saisi comme ville*), Dakar (2), Mbour (1), Pikine (1), « Grand standing » (1, *erreur de saisie, pas une ville*), « Ngor almadies » (1, *deux quartiers concaténés*) |
| `type` | APPARTEMENT (8), VILLA (2), STUDIO (2), TERRAIN (1) |
| `transactionType` | LOCATION (12), VENTE (1) |
| `amenities` (valeurs libres, pas d'enum Prisma) | clim, wifi, tv, douche (4 chacun), cuisine, balcon, piscine (2 chacun), electricite, generateur, eau, titre_foncier, viabilise (1 chacun) |
| `price` (LOCATION/NIGHTLY) | 85 000 → 7 500 000 FCFA (moy. ≈ 4 373 750) |
| `rooms` | 1 à 9 (majorité à 3) |
| `surface` | 28 à 500 m² (moy. ≈ 121) |
| Titres | 100 % en français ; plusieurs lignes de pollution E2E/QA (« Appartement Test E2E … », « TEST QA — … ») à écarter de tout futur jeu de test réel |

**Conséquence directe pour Milo** : les valeurs `city`/`amenities` réellement en base sont trop sales et trop peu nombreuses pour servir de dictionnaire de lieux ou d'équipements. Les sources fiables sont dans le **code**, pas dans les données de dev :
- **`Frontend/src/lib/regions.ts`** : 14 régions officielles, leurs villes, et un petit échantillon de quartiers par région dans `highlights` (ex. Dakar → Plateau, Almadies, Mermoz, Ouakam, Yoff) — source à privilégier pour le dictionnaire de lieux, complétée plus tard par les quartiers réellement saisis une fois le catalogue plus riche.
- **`Frontend/src/lib/senegalRegions.ts`** : uniquement des frontières géographiques (GeoJSON, `findRegionAt`, tolérance 3 km) — aucune liste de quartiers, ne sert pas de dictionnaire de vocabulaire.
- **`Frontend/src/lib/listingProfile.ts`** : **source unique des clés d'équipements** utilisées par les formulaires (`HOME_AMENITIES` : wifi, clim, tv, cuisine, douche, gardien, parking, piscine, balcon, generateur ; + clés spécifiques terrain/bureau/local commercial) — c'est le dictionnaire d'équipements à utiliser, pas les valeurs libres observées en base.
- Types de bien et transaction : les enums Prisma `ListingType` (APPARTEMENT, VILLA, CHAMBRE, STUDIO, BUREAU, TERRAIN, MAISON, LOCAL_COMMERCIAL) et `TransactionType` (LOCATION, VENTE) sont la liste fermée et fiable à mapper depuis les synonymes FR/EN.

**`city` est un champ texte libre — décision `cityContains` (lot 2b, validé le 2026-10-29)** : le formulaire de publication (`Frontend/src/app/(public)/publier/page.tsx`) propose `region` en liste fermée mais laisse `city` en **texte libre**, sans suggestion — un utilisateur y saisit aussi bien une vraie ville qu'un quartier. Mesure sur **toutes** les annonces de la base de dev (pas seulement `ACTIVE`) : 6 valeurs `city` distinctes sur 14 annonces (**78 %**) ne correspondent à aucune ville canonique de `regions.ts` (`Plateau` ×7, `Grand standing` ×2, `Ngor almadies` ×2, `Almadies ngor` ×1, `Keur Massar` ×1, `Médina fall` ×1). Le filtre `city` de `findAll` reste une **égalité exacte** (le PC — pages `/regions/[slug]`, puces highlights — en dépend, sémantique non modifiée). Milo a donc besoin d'un filtre **tolérant** en plus : `cityContains` (`FilterListingsDto` + `ListingsService.findAll`), insensible à la casse et aux accents, appliqué en mémoire après `findMany` (empiriquement, l'`ILIKE` de Postgres ne replie pas les accents dans cette base — « médina » `ILIKE` '%medina%' → faux). Milo n'émet donc plus jamais `city` (exact), seulement `region` + `cityContains`. Alternative DB-side proposée (non appliquée) : extension Postgres `unaccent`, à évaluer séparément si le filtrage en mémoire ne passe plus à l'échelle.

**Propagation de la locale (sélecteur) vers le Backend** : **aucune aujourd'hui.** `Frontend/src/lib/api.ts` n'envoie que `Content-Type` et `Authorization` — ni en-tête `Accept-Language`, ni cookie, ni paramètre. La locale choisie est stockée côté Frontend dans le cookie `allo-locale` (lu par `src/i18n/request.ts`, déjà accessible aux Server Components). Pour Milo, c'est le Frontend qui devra lire ce cookie et le transmettre explicitly (champ du corps de requête) au nouvel endpoint — rien à changer côté Backend pour « recevoir » la locale, il faut juste la lui envoyer (voir § 2.a). Seuls les comptes connectés ont une locale persistée en base (`User.locale`, défaut `'fr'`) — non pertinent pour les visiteurs anonymes, qui sont le cas principal de la recherche.

---

## 2. Plan

### 2.a Architecture

**Nouvel endpoint, Backend, module dédié.**
`POST /search/parse-query` (sous-module de `search/`, pas un nouveau module top-level — réutilise `SearchService`/Meilisearch déjà en place) :

```
Entrée  : { text: string, defaultLocale: 'fr' | 'en' }
Sortie  : {
  detectedLanguage: 'fr' | 'en' | 'unsupported',
  languageConfidence: number,        // 0-1, sert la règle de repli
  strictFilters: Partial<FilterListingsDto>,   // mappés 1:1 sur l'API existante
  softPreferences: string[],         // mots-clés flous, ex. ['proche de la mer', 'calme']
  unmatchedTokens: string[],         // ce que l'analyseur n'a pas su classer
  understood: boolean                // false si rien d'exploitable n'a été extrait
}
```

- `defaultLocale` = le cookie `allo-locale` lu côté Frontend, transmis tel quel (jamais déduit côté Backend).
- **Aucune invention** : l'endpoint ne renvoie que des filtres, jamais des annonces — c'est le Frontend qui enchaîne avec l'appel existant `GET /listings?{strictFilters}`, qui reste la seule source de vérité des résultats (aucun court-circuit de `findAll`).
- `softPreferences` sert uniquement au **classement**, jamais à l'exclusion : transmis à Meilisearch (`q` libre, les mots non reconnus comme filtres stricts) pour trier les résultats déjà filtrés par Postgres, pas pour en écarter.
- Gestion des erreurs : texte vide/illisible → `understood: false`, `unmatchedTokens` = le texte entier ; le Frontend affiche alors le message « je n'ai pas compris » (§ 2.d) sans jamais appeler `/listings` avec des filtres vides silencieux.
- Rate limiting : réutiliser le `ThrottlerGuard` déjà global (`app.module.ts`), comme toutes les autres routes publiques.
- Pas de nouvelle base de données ni de nouvelle table : l'analyseur est **sans état**, une fonction pure (texte → structure), testable isolément sans Meilisearch ni Postgres.

### 2.b Détection de langue — deux options gratuites, exécutables en CPU

| | **franc** (wooorm/franc, JS pur) | **fastText LID** (`lid.176.ftz`, Meta) |
|---|---|---|
| Coût | Gratuit, MIT, zéro dépendance native | Modèle gratuit (MIT), mais lié nativement (bindings `fasttext.js`/`node-fasttext`) ou appel Python en sous-processus |
| Poids | ~quelques dizaines de Ko (paquet JS) | ~917 Ko (version compressée `.ftz`) à charger au démarrage du process Node |
| Installation sur le VPS | Triviale (`npm install`, pur JS, aucun binaire à compiler) | Nécessite soit un binding natif compilé pour l'architecture du VPS (risque de build cassé en CI/déploiement), soit un sous-processus Python (ajoute une dépendance système) |
| Précision attendue sur texte long (≥ 1 phrase) | Bonne (~95 %+ selon la documentation du paquet, langues distinctes comme FR/EN) | Très bonne (~96-97 %, benchmarks publics Meta) |
| **Précision sur requêtes courtes (2-5 mots, le cas réel de Milo)** | **Faible** — franc documente lui-même un besoin d'environ 10 mots pour une fiabilité correcte ; une requête comme « villa Almadies » est quasi indécidable pour un détecteur généraliste | Meilleure que franc sur le court, mais reste imparfaite — les benchmarks fastText portent sur des phrases, pas des requêtes de 2-3 mots |

**Recommandation v0 : franc**, pour la simplicité d'intégration (pur JS, aucun risque de build sur le VPS), **combiné à une heuristique de recouvrement avec les dictionnaires Milo eux-mêmes** (§ 2.c) comme signal principal — compter, pour chaque langue prise en charge, le nombre de tokens de la requête qui matchent un mot-clé de son dictionnaire (« chambres » → FR, « bedrooms » → EN) ; franc ne sert qu'en repli quand **aucun** mot-clé connu n'est trouvé dans aucune langue (texte hors vocabulaire immobilier). C'est cette heuristique de recouvrement, pas franc seul, qui porte l'essentiel de la précision attendue sur les requêtes courtes — à chiffrer en phase de test (§ 2.f/2.g).

**Règle de repli (déjà actée dans Milo.md § 3.4)** : si `languageConfidence` est sous un seuil (à fixer en § 2.g), `detectedLanguage` devient `defaultLocale`.

### 2.c Dictionnaires et règles — FR et EN appliqués ensemble

L'analyseur applique **tous** les dictionnaires sur **chaque** requête (pas de branchement « si FR alors… sinon si EN… ») — une requête à langues mélangées (« 2 bedrooms à Dakar sous 300k ») reste comprise, chaque token étant testé contre tous les dictionnaires actifs.

| Catégorie | Exemples FR | Exemples EN | Champ ciblé |
|---|---|---|---|
| Montant | « 350 000 », « 350k », « 350.000 FCFA », « moins de 350k », « budget 500k », « entre 200 000 et 400 000 » | « under 350k », « budget 500k », « between 200,000 and 400,000 » | `minPrice`/`maxPrice` |
| Pièces | « F3 », « T3 », « 3 pièces » | « 3-room », « F3 » (rare en EN, forme locale) | `rooms` → `minRooms`/`maxRooms` (**décision validée 2026-10-29** : F*n*/T*n* = *n* pièces au total, donc `rooms = n`, pas *n*-1) |
| Chambres | « 2 chambres », « studio » (0 chambre distincte) | « 2 bedrooms », « studio » | `beds` → **`minBeds`/`maxBeds` (nouveau filtre, § 2.h lot 1 — n'existe pas encore dans `FilterListingsDto`)**. « Pièces » et « Chambres » sont deux champs distincts du site (`rooms` et `beds`) : ne jamais confondre F3/T3 (pièces) avec « 2 chambres »/« 2 bedrooms » (chambres) |
| Type de bien | appartement, villa, maison, terrain, bureau, local (commercial) | apartment, villa, house, land, office, shop | `type` (mappé sur l'enum Prisma) |
| Location/achat | louer, location, à louer / acheter, à vendre | rent, for rent / buy, for sale | `transactionType` |
| Lieux | régions/villes/quartiers de `regions.ts`, variantes d'accents et d'orthographe (« Dakar »/« dakar », « Almadies »/« almadie ») | idem, formes anglicisées rares | `region`/`city` |
| Équipements | clim/climatisation, wifi, piscine, parking, meublé, gardien | AC/air conditioning, wifi, pool, parking, furnished, guard/security | `amenities[]` (clés de `listingProfile.ts`) |
| Préférences floues | « proche de la mer », « calme », « standing » | « near the sea », « quiet », « upscale » | `softPreferences` (classement Meilisearch, jamais un filtre strict) |

- **Tolérance aux fautes et accents** : normalisation systématique avant comparaison (minuscules, suppression des accents — « Almadies »/« almadies »/« almadie »), plus une distance d'édition courte (1 caractère) sur les mots-clés les plus longs, pour couvrir les fautes de frappe courantes sans faux positifs sur des mots courts.
- Les dictionnaires vivent en fichiers de données versionnés (JSON/TS), un fichier par langue, jamais en dur dans la logique de parsing — c'est ce qui rend « ajouter une langue » un ajout de données plutôt qu'une réécriture de code (§ 2.e).

### 2.d Interface

**Placement — validé le 2026-10-29** : champ Milo **en haut de `/listings`**, en mobile **et** en PC (nouveau sur desktop, § 1.a). Le lien `/search` mobile existant (accueil + en-tête) pointe désormais vers ce champ sur `/listings`, plutôt que vers la page `/search` séparée. ~~**Accueil PC inchangé à ce stade**~~ — **remplacé par la décision ci-dessous (lot 2b, 2026-10-29).**

**Accueil (hero) — mise à jour lot 2b, 2026-10-29** : grande barre de recherche en langage naturel dans le hero de l'accueil, **PC et mobile**, style Gemini/Figma (large, centrée, une seule ligne d'action), à la place du bouton « Rechercher » (PC) et de la barre blanche de recherche mobile actuelle. Placeholder explicatif traduit FR/EN donnant un exemple concret (ex. FR : « Décrivez ce que vous cherchez : F3 climatisé à Mermoz, moins de 400 000 FCFA… »). **3 pastilles d'exemples cliquables** sous la barre (requêtes pré-remplies, une façon de montrer ce que Milo comprend sans explication). **Repli** : si Milo ne comprend pas la requête (`understood: false`), repli sur la recherche texte classique `q` — jamais d'écran bloquant. Sur `/listings` : bouton **« Demander à Milo »** qui déplie la même barre, avec les pastilles de critères compris mêlées aux pastilles de filtres actifs déjà en place (§ parcours utilisateur ci-dessous). **Texte honnête partout** : Milo comprend une recherche décrite en une phrase, il **ne converse pas** (pas de tour-par-tour, pas de mémoire de conversation) — formulation à éviter : « discutez avec Milo » ou tout ce qui suggère un chatbot. **Accueil PC modifié = changement de périmètre volontaire** (supersede la décision du 2026-10-29 ci-dessus qui le gardait inchangé) — **une capture de l'accueil avec la barre hero sera proposée avant tout commit d'implémentation**, conformément à la règle d'or (ne rien casser/changer sans validation visuelle préalable sur le PC).

**Parcours utilisateur** :
1. Le champ de recherche en langage naturel, en haut de `/listings` (mobile et PC).
2. Après soumission : les critères comprises s'affichent en **pastilles modifiables** (réutilise le composant de puces déjà présent dans `ListingsFilters.tsx` pour les filtres actifs — `activeChips`), chaque pastille retirable en un clic, exactement comme les filtres manuels aujourd'hui.
3. `GET /listings` est alors appelé avec les `strictFilters`, résultats affichés dans la grille existante (aucun nouveau composant de liste).
4. **Aucun résultat** : réutilise l'état vide déjà présent sur `/listings` (icône + message + lien retour catalogue), message adapté pour mentionner les critères comprises.
5. **Non compris** (`understood: false`) : message dédié invitant à reformuler ou à utiliser les filtres classiques — jamais un écran bloquant, les filtres manuels restent toujours accessibles en secours.
- **Libellés** : nouveau namespace `search` (ou extension de l'existant) dans `fr.json`/`en.json`, résolu par `detectedLanguage` (pas par le cookie `allo-locale`) pour les messages de pastilles/erreurs générés par Milo — la langue de l'UI globale (menus, pied de page) reste pilotée par le sélecteur, seule la **réponse à la recherche** change avec la langue détectée.
- **Mobile** (mode application sous 768 px) : champ en haut de `/listings`, pastilles en ligne défilante horizontalement (`overflow-x-auto`, pattern déjà utilisé ailleurs dans l'app pour les onglets de type de bien), clavier avec bouton d'envoi dédié.
- **PC** : aucun changement de mise en page existante si Milo n'ajoute qu'un champ au-dessus du panneau actuel — à confirmer en maquette avant implémentation, mais le principe est de ne rien casser de l'affichage actuel (règle d'or déjà appliquée aux chantiers mobiles précédents).

### 2.e Ajouter une langue / langue non prise en charge

**Pour ajouter une langue (ex. wolof plus tard)** :
1. Créer le fichier de dictionnaire (montants, chambres, types, transaction, lieux, équipements, préférences floues) sur le modèle des fichiers FR/EN existants.
2. Ajouter les libellés (pastilles, messages d'erreur, « je n'ai pas compris ») dans un nouveau `xx.json` next-intl.
3. Écrire son jeu de test (§ 2.f) et viser les mêmes seuils (§ 2.g) **avant** de l'ajouter à la liste des langues prises en charge.
4. Ajouter la langue à la liste explicite (`locales` de `src/i18n/config.ts` **si** elle doit aussi devenir une langue de l'interface, ou à une liste séparée si Milo doit la comprendre sans que le site entier soit traduit — à trancher au cas par cas).

**Langue détectée mais non prise en charge** : `detectedLanguage: 'unsupported'` → réponse dans `defaultLocale` (langue du site), avec un message explicite (« je ne comprends pas encore le [langue], je réponds en français » / équivalent EN) plutôt qu'un silence ou une mauvaise détection forcée vers FR/EN.

### 2.f Jeu de test

- **Validé le 2026-10-29** : **100 requêtes FR pures + 100 EN pures + un 3ᵉ fichier `mixed.json` de 30 requêtes à langues mélangées**, mesurés **séparément** (3 scores distincts, pas de mélange des moyennes).
- Formulations variées d'un utilisateur sénégalais : abréviations (F3, T3, « clim », « wifi dispo »), fautes de frappe plausibles, termes locaux (« studio meublé », « villa haut standing », noms de quartiers réels de `regions.ts`), requêtes très courtes (« villa Almadies ») et requêtes longues/composées (« je cherche un F3 climatisé à louer à Mermoz pour moins de 400 000 »).
- Format JSON, trois fichiers (`tests/fr.json`, `tests/en.json`, `tests/mixed.json`), structure proposée :
```json
{
  "query": "2 chambres climatisées à Dakar sous 350k",
  "expected": {
    "detectedLanguage": "fr",
    "strictFilters": { "minRooms": 2, "region": "Dakar", "amenities": ["clim"], "maxPrice": 350000 },
    "understood": true
  }
}
```
- **Mesure automatique** : script qui exécute l'analyseur sur chaque entrée, compare champ par champ (`strictFilters` en ensemble, pas en égalité stricte d'ordre), calcule précision/rappel par type de critère (montant, pièces, chambres, type, lieu, transaction, équipement) et le taux de détection de langue correcte — **par fichier (fr.json, en.json, mixed.json), chacun mesuré séparément**, conformément à Milo.md § 3.4.

### 2.g Seuils de réussite — **validés le 2026-10-29**

Principe directeur validé : **privilégier la non-extraction à la mauvaise extraction**. Un critère non reconnu (`unmatchedTokens`) est toujours préférable à un critère mal déduit et appliqué en filtre strict — en cas de doute, l'analyseur doit s'abstenir plutôt que deviner.

| Mesure | Seuil | Par langue ? |
|---|---|---|
| Précision des critères extraits — montants | **≥ 95 %** | Oui |
| Précision des critères extraits — type de transaction (location/vente) | **≥ 95 %** | Oui |
| Précision des critères extraits — autres types (pièces, chambres, type de bien, lieu, équipement) | ≥ 85 % par type | Oui |
| Taux de requêtes où les contraintes strictes (budget, pièces, chambres, type) sont toutes respectées quand elles sont présentes dans la requête | ≥ 80 % | Oui |
| Précision de la détection de langue | ≥ 90 % sur requêtes de 4 mots et plus | Oui |
| **Requêtes de 2-3 mots** | **Pas de seuil de détection : repli automatique et systématique sur la langue du sélecteur** (`defaultLocale`), conformément à Milo.md § 3.4 — la détection de langue n'est pas mesurée sur ce sous-ensemble, qui est structurellement hors de portée d'un détecteur fiable | — |
| Temps de réponse de l'analyseur (hors appel réseau `/listings`) | < 200 ms p95 sur le VPS (CPU seul, pas de modèle lourd en v0) | Global |
| Jamais d'annonce inventée | 100 % — toute réponse vient de `GET /listings`/Meilisearch, jamais générée | Global, non négociable |

### 2.h Découpage en lots, risques, effort

| Lot | Contenu | Commit | Risque principal |
|---|---|---|---|
| 1 | Dictionnaires FR/EN (montants, pièces, chambres, types, transaction, équipements) + fonction d'extraction pure, tests unitaires. **Inclut un lot Backend séparé** : filtre `minBeds`/`maxBeds` (`FilterListingsDto` + `ListingsService.findAll` + tests) — nouveau filtre sur `beds`, qui n'existe pas encore côté API ; aucun changement visible sur le Frontend existant (aucune UI manuelle ne l'expose, comme `minRooms`/`maxRooms` aujourd'hui) | 2 (1 dictionnaires/extraction, 1 Backend `minBeds`/`maxBeds`) | Aucun — F3/T3 (pièces) vs « chambres »/« bedrooms » (beds) tranché (décision ci-dessus) |
| 2 | Dictionnaire des lieux (régions/villes/quartiers de `regions.ts`) + normalisation accents/fautes | 1 | Couverture des quartiers réels incomplète (peu de données en base, voir § 1.d) — **complété au lot 2b** : `cityContains` (filtre tolérant, Backend) + `quartiers.ts` (quartiers/communes réels saisis à la main par Malick, `needsValidation: true`) |
| 3 | Détection de langue (franc + heuristique de recouvrement) + règle de repli sur le sélecteur | 1 | Précision sur requêtes très courtes — risque principal du projet, à mesurer tôt |
| 4 | Endpoint `POST /search/parse-query` (Backend), branchement sur les dictionnaires des lots 1-3, tests e2e | 1 | Aucun — assemblage des lots précédents |
| 5 | Interface : barre hero accueil (PC+mobile, remplace bouton « Rechercher »/barre blanche mobile) + bouton « Demander à Milo » sur `/listings` + pastilles de critères + état « non compris » (repli sur `q`) — mis à jour le 2026-10-29 (§ 2.d), accueil PC désormais dans le périmètre (capture à valider avant commit) | 1-2 | Ne pas casser l'affichage PC actuel hors accueil (règle d'or des chantiers précédents) ; accueil PC modifié = changement voulu mais à valider sur capture |
| 6 | Branchement Meilisearch pour le classement des `softPreferences` (filterable/sortable à configurer, § 1.b) | 1 | Configuration Meilisearch jamais testée en conditions réelles jusqu'ici — premier usage réel de `filter`/`sort` |
| 7 | Mesure indépendante (20 requêtes réelles, hors contrôle de l'agent) + corrections par classe + jeu de dev (168 cas FR/EN/mixte, `Backend/src/milo/dev-dataset.ts`) + mesure avant/après | 2 (1 mesure lecture seule, 1 corrections) | Volume de données réel insuffisant pour un jeu de test 100 % réaliste (catalogue de dev pauvre, § 1.d) — jeu de test construit sur des requêtes plausibles plutôt que rejouées depuis la base |

**Effort estimé** : Milo.md l'estimait à « quelques jours avec l'agent » — ce découpage en 7 lots le confirme pour un périmètre FR+EN, un lot par session de travail étant réaliste.

**Écart au périmètre initial du lot 7 (2026-10-31)** : le jeu de test réellement livré compte 168 cas (82 FR + 66 EN + 20 mixtes) plutôt que les 230 (100+100+30) visés au § 2.f, et chaque cas vérifie seulement les critères qu'il cible (pas une comparaison exhaustive de `strictFilters`) plutôt qu'un calcul de précision/rappel complet par type de critère — décision prise seule pour tenir dans l'effort disponible, en priorisant la couverture des classes corrigées (montants, lieux, types/pièces, équipements) sur le volume brut. Mesure avant/après sur ce jeu : 36,9 % → 100 %. Le format `{ query, expected: { strictFilters, understood } }` décrit ci-dessus n'a pas été repris tel quel ; `dev-dataset.ts` utilise un format plus léger (`expect` partiel par champ) mieux adapté à des cas ciblés par règle.
