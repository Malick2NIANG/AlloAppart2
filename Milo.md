# Milo — IA propriétaire d'AlloAppart

Statut : **idée validée, en attente.** On démarre seulement quand Malick le décide, après la fin et la stabilisation de la plateforme (chantier mobile terminé, mise en ligne faite). Dernière mise à jour : 2026-10-23.

## 1. Objectif

Développer des modèles d'IA spécialisés dans l'immobilier sénégalais, maîtrisés en interne, intégrés à AlloAppart, **sans aucun frais**.

## 2. Contrainte absolue : coût zéro

Conséquences retenues :
- Aucune API d'IA payante, ni au lancement ni plus tard. Les fonctionnalités IA actuellement bloquées faute de crédit Anthropic **restent désactivées** jusqu'à ce que Milo les remplace (pas de solution transitoire payante).
- Développement et entraînement : uniquement sur le matériel déjà possédé (PC de développement) et sur des quotas gratuits de calcul s'ils existent au moment venu. Leurs conditions changent souvent : **à vérifier le moment venu**, ne pas les considérer comme acquises.
- Exécution en production : uniquement sur l'infrastructure déjà payée pour la plateforme (VPS), donc **sans GPU**. Cela limite la taille des modèles : petits modèles quantifiés, exécutés sur processeur, avec un temps de réponse plus lent. Les composants doivent être conçus avec cette limite.
- Un composant qui ne peut pas atteindre les seuils de qualité à coût zéro **reste désactivé** plutôt que d'être dégradé ou facturé.
- À vérifier avant de s'engager : la capacité réelle du VPS (CPU, mémoire) à héberger un modèle sans gêner la plateforme.

## 3. Conclusions de la discussion du 2026-10-23

### 3.1 Principes à garder
- Pas de frais par requête, qualité mesurable avant la production, résultats toujours tirés des vraies annonces, modèles versionnés avec retour arrière possible, interface interne documentée.

### 3.2 « Entraîner depuis zéro » : écarté pour la production
- Un modèle de langage qui écrit un bon français depuis zéro demande des milliards de mots et des semaines de GPU. AlloAppart n'aura que quelques milliers d'annonces et peu de documentation : trop peu. Résultat attendu : phrases maladroites, répétitions, inventions (contraire au principe « la qualité avant l'indépendance »).
- **Voie retenue** : partir d'un petit modèle ouvert à licence permissive (licence à vérifier), l'adapter à l'immobilier sénégalais (affinage), l'héberger soi-même. On obtient le même but (contrôle, aucun frais par requête, données à soi) avec une qualité atteignable.
- L'entraînement depuis zéro reste possible comme **petit projet de recherche et d'apprentissage**, jamais comme candidat à la production.
- Utiliser un framework open source n'est pas utiliser un modèle préentraîné ; mais « gratuit » ne veut pas dire « sans contrainte » : licences et conditions d'usage à contrôler.

### 3.3 Les trois composants

**Milo Search** (recherche en langage naturel) — le plus utile.
- N'a pas besoin d'un gros modèle génératif.
- Extraction des critères (lieu, budget, chambres, type, préférences) = extraction structurée : règles + petit modèle d'étiquetage.
- Contraintes strictes (budget, nombre de chambres…) appliquées par filtrage classique sur les vraies annonces. Meilisearch est déjà dans la pile (Docker) : recherche hybride/sémantique à étudier.
- Un petit modèle de recherche sémantique (embeddings) pour les préférences floues.
- Ne jamais inventer d'annonce, de prix ou de caractéristique.
- À commencer plus tôt que prévu initialement.

**Milo FAQ** (assistant) — réponses fondées sur des documents.
- Base de documents validés ; le modèle répond uniquement avec les passages retrouvés, sinon il dit qu'il ne sait pas.
- Peut se limiter à renvoyer le bon passage, sans générer de texte (aucun risque d'invention, coût minimal).

**Milo Writer** (rédaction d'annonces) — bon premier essai.
- Entrée structurée (champs du formulaire) → description.
- Vérification automatique de chaque texte généré contre les champs saisis : aucun équipement, surface ou emplacement absent des données.
- Possible aussi par modèles de phrases + petit modèle d'amélioration, selon ce que le coût zéro permet.

### 3.4 Langue
- **Décision du 2026-10-29 : Milo répond dans la langue dans laquelle l'utilisateur lui écrit (détection automatique)**, même si le sélecteur FR/EN du header indique l'autre langue. Le sélecteur (locale next-intl) sert de **langue par défaut** quand la détection est incertaine (requêtes très courtes ou ambiguës comme « villa Almadies »).
- Détection : bibliothèque ou modèle libre exécuté sur le VPS (CPU, gratuit), à choisir en phase 1 (ex. identification de langue fastText, franc). Aucune API payante.
- L'analyseur Search applique **tous les dictionnaires ensemble** : une phrase mélangeant les langues reste comprise ; la détection sert à choisir la langue de la réponse.
- **Langues prises en charge = liste explicite et croissante**, pas « toutes les langues ». Détecter une langue est facile et gratuit ; la comprendre et y répondre demande, pour chacune : un dictionnaire, des libellés traduits et un jeu de test avec seuils. Langue détectée mais non prise en charge : réponse dans la langue du site, avec message clair. Lancement : français et anglais ; ajouts un par un quand leur jeu de test atteint les seuils.
- Search : dictionnaires et règles FR **et** EN (ex. « 2 chambres » / « 2 bedrooms », « moins de » / « under », « louer » / « rent », « à vendre » / « for sale »), avec le vocabulaire local (quartiers, termes de location) dans les deux langues. Les pastilles de critères, messages d'erreur et « je n'ai pas compris » sont affichés dans la langue détectée.
- FAQ : documents validés en FR et EN ; réponse dans la langue détectée si un document existe dans cette langue, sinon repli sur la langue du site avec mention explicite. Writer : description générée dans la langue demandée/détectée.
- Les seuils de qualité sont mesurés **séparément pour chaque langue prise en charge**, avec un jeu de test par langue (dont des phrases à langues mélangées).
- Wolof : exclu pour l'instant (peu de données fiables).

### 3.4 bis Emplacement dans le code (décision du 2026-10-29)
- **Backend** : module dédié `Backend/src/milo/` (analyseur, dictionnaires, détection de langue, jeux de test). Toute la logique y vit.
- **Frontend** : interface seulement (champ de recherche, pastilles de critères) dans `Frontend/src/components/milo/`. Pas de dossier `MiloAI` séparé.
- **Documentation** : `Milo.md` à la racine.
- Raison : un seul projet à maintenir, sur le même VPS.

### 3.5 Données et vie privée
- Commencer par les textes d'annonces et la documentation de la plateforme.
- Ne pas utiliser les messages privés des utilisateurs sans consentement explicite et sans respect de la loi sénégalaise sur les données personnelles.
- Contrôler les droits d'utilisation de toute donnée collectée.

## 4. Méthode

Phase 1 — Faisabilité : fixer les seuils de réussite chiffrés pour chaque composant ; tester un modèle ouvert tel quel sur des cas de test ; si les seuils sont déjà atteints, on gagne des mois. Vérifier le calcul réellement disponible à coût zéro et la capacité du VPS.
Phase 2 — Données : collecte, nettoyage, déduplication, droits, séparation entraînement / validation / test, jeux de test représentatifs.
Phase 3 — Prototypes à petite échelle, comparaison d'options.
Phase 4 — Entraînement/adaptation et évaluation (pertinence, hallucinations, cas limites) ; refus du passage en production si les seuils ne sont pas atteints.
Phase 5 — Intégration : interfaces internes documentées, temps de réponse, consommation de ressources, sécurité des entrées et sorties, journaux, reprise.
Phase 6 — Amélioration continue : mesures en usage réel, corrections, réentraînement justifié, versionnement.

## 4 bis. Décision du 2026-10-23 : on commence par Search v0

À démarrer **dès la fin du chantier mobile** (décision de Malick). Première version de Milo Search **sans modèle entraîné** :
- Un analyseur de phrase à règles et dictionnaires qui convertit la demande en filtres que le site sait déjà appliquer : montants (« 350 000 », « 350k », « moins de 350.000 FCFA »), chambres (« 2 chambres », « F3 »), lieux (régions, villes et quartiers tirés de la base), types de bien (« appart », « villa », « studio », « terrain »), location ou achat, équipements courants (climatisation, wifi, piscine…).
- Contraintes strictes (budget, chambres, type) appliquées par filtrage classique sur les vraies annonces ; jamais d'annonce, de prix ou de caractéristique inventé.
- Préférences floues (« proche de la mer ») utilisées pour classer les résultats (Meilisearch, déjà dans le Docker), sans exclure d'annonces.
- Interface : les critères compris s'affichent en pastilles modifiables, pour rendre visible et rattrapable toute erreur de compréhension.
- Amélioration progressive : les requêtes non comprises indiquent quels synonymes ajouter. Aucun coût, aucun entraînement.
- Limite assumée : toutes les formulations libres ne seront pas comprises dès la première version.
- Effort estimé : quelques jours avec l'agent. À cadrer par un prompt dédié au moment de démarrer.

Ensuite : Milo FAQ en version « renvoie le bon passage » (base de questions-réponses validées par Malick + Meilisearch), puis Milo Writer en dernier (phrases-modèles à partir des champs du formulaire ; un vrai modèle rédactionnel dépend du calcul disponible à coût zéro).

## 5. Ordre proposé (non contraignant)

1. Milo Search (valeur produit la plus élevée, en grande partie algorithmique donc compatible coût zéro).
2. Milo FAQ (retrouver et renvoyer les bons passages).
3. Milo Writer (avec la vérification contre les champs du formulaire).

L'ordre final sera confirmé par l'étude de faisabilité.

## 6. Critères de réussite (à chiffrer en phase 1)

- **Search** : précision des critères extraits, respect strict des contraintes, pertinence du classement, taux de résultats satisfaisants.
- **FAQ** : exactitude, taux de réponses non fondées, capacité à reconnaître ses limites.
- **Writer** : qualité rédactionnelle, respect des caractéristiques fournies, zéro information inventée, utilité réelle.
- Les seuils sont fixés **avant** les tests finaux et comparés à des cas de test indépendants.

## 7. Prochaine étape

Rien tant que Malick n'a pas dit « on commence ». À ce moment-là : rédiger le document de faisabilité de la phase 1 (objectifs chiffrés, jeux de test, options comparées, calcul disponible à coût zéro, capacité du VPS).

## 8. Avancement — Search v0 (mis à jour le 2026-10-29)

Découpage détaillé et décisions : `Frontend/rapports-milo/PLAN_SEARCH_V0.md`.

**Fait** :
- **Lot 1** — Dictionnaires FR/EN (montants, pièces, chambres, types, transaction, équipements, préférences floues) + extraction pure `extractCriteria()` (`Backend/src/milo/`), tests unitaires. Backend séparé : filtre `minBeds`/`maxBeds` sur `GET /listings`.
- **Lot 2** — Dictionnaire des lieux (régions/villes/quartiers de `regions.ts`), normalisation accents/fautes. Lot 2b : `city` étant un champ texte libre (78 % de valeurs non canoniques en base), ajout du filtre tolérant `cityContains` (Backend) + `quartiers.ts` (quartiers/communes réels saisis à la main, à valider) ; Milo n'émet plus jamais `city` exact.
- **Lot 3** — Détection de langue coût zéro (`Backend/src/milo/language/detectLanguage.ts`) : signaux du dictionnaire (lot 1) + mots-outils à poids faible, repli sur `tinyld` (bibliothèque retenue après comparaison avec franc-min) à partir de 4 mots en cas d'égalité, sinon repli sur la langue du sélecteur. Jeu de test de 190 requêtes (`Backend/src/milo/tests/language.json`).
- **Lot 4** — Endpoint `POST /search/parse-query` (`Backend/src/milo/milo.controller.ts`), public, limité à 30 req/min/IP. Entrée `{ text, defaultLocale }`, sortie `{ detectedLanguage, languageConfidence, languageMethod, strictFilters, softPreferences, unmatchedTokens, ambiguities, understood }` — jamais d'annonce, uniquement des filtres. Contrat vérifié avec `FilterListingsDto` (tests dédiés). Pas de journalisation du texte des utilisateurs (vie privée).
- **Lot 7 (corrections, 2026-10-31)** — Mesure indépendante sur 20 requêtes réelles (`Desktop/AlloAppart/Milo_TEST_INDEPENDANT/`) : transaction/langue/lieu bons, types 84 %, pièces 80 %, montants 30 % + 1 faux. Corrections par classe (détail § 8 bis) : périodes de prix, repères/axes, quartiers numérotés, direction de montant, montants approximatifs, fourchettes, type CHAMBRE vs nombre de chambres, pluriels/fautes de type, équipement en préférence douce. Jeu de dev `Backend/src/milo/dev-dataset.ts` (168 cas FR/EN/mixte) : 36,9 % → 100 % avant/après sur ce jeu ; p95 latence 0,6 ms. `sorties_brutes_2.json` régénéré sur les mêmes 20 requêtes (non interprété, test de non-régression uniquement — aucune de leurs phrases n'est dans le code ni les dictionnaires).

**Restant** :
- **Lot 5** — Interface : barre de recherche en langage naturel (accueil PC+mobile, remplace le bouton « Rechercher »/la barre blanche mobile ; bouton « Demander à Milo » sur `/listings`), pastilles de critères, état « non compris » avec repli sur `q`.
- **Lot 6** — Branchement Meilisearch pour le classement des `softPreferences` (filterable/sortable à configurer).

## 8 bis. Lot 7 — règles ajoutées (2026-10-31)

Principe inchangé : mieux vaut ne pas extraire qu'extraire faux, coût zéro, aucune annonce inventée. Toutes les règles ci-dessous sont des classes générales (jamais une phrase spécifique des 20 requêtes de mesure).

- **Montants — périodes** (`extractors/price.ts`) : un montant adjacent à une période NON mensuelle (la nuit, par jour, par semaine, par an…) n'est jamais un prix — ambiguïté `periodNotSupported` + mot non compris. « par mois »/mensuel = unité par défaut, extraction normale. Une durée de location seule (« à l'année », « for one week », « 4 jours ») sans rapport avec un montant ne bloque rien (vérification d'adjacence stricte, pas de portée phrase entière).
- **Montants — direction** : mots-clés de direction acceptés en préfixe ET en suffixe (« 300k maximum », pas seulement « maximum 300k »), fenêtre de 4 tokens (tolère un mot de période entre les deux). Montant plausible sans aucune direction ni « budget » → ambiguïté `amountDirection`, aucun filtre posé.
- **Montants — approximatifs** (environ, autour de, vers, ~, around, about, approximately) : `maxPrice` = montant × 1,10 (arrondi au millier), jamais `minPrice`, ambiguïté `approximateAmount`.
- **Montants — fourchettes** : « 200k-300k » (tiret, suffixe collé ou mot partagé type « 80-120 millions »), « from X to Y » (EN), en plus de « entre X et Y » déjà existant.
- **Montants — formes** : « 100 mille »/« 400 mille » (×1000), « 300 K »/« 80 M » (espace avant la lettre, en plus de la forme collée), « 30,000 »/« 12,000,000 » (virgules anglo-saxonnes, en plus des points FR).
- **Lieux — repères/axes** (`places/landmarks.ts`, nouveau) : VDN, Corniche, autoroute (à péage), aéroport, « route de … » ne deviennent jamais un `cityContains` — ambiguïté `landmark` ; Corniche déclenche en plus la préférence douce `near_sea` déjà existante. La région déjà connue par ailleurs est conservée.
- **Lieux — quartiers numérotés** (`places/numberedDistricts.ts`, nouveau) : le numéro fait partie du nom (jamais un mot non compris séparé). Bases connues avec numéros notoires : Liberté (1-6), HLM (1-5), Sicap Liberté (1-4, graphie romaine I-IV acceptée) → `cityContains` complet, aucune ambiguïté. Parcelles Assainies (connecteur « unité »/« unit » optionnel) : toujours le nom seul + ambiguïté `numberedDistrict` (trop d'unités, 1 à 26+, pour une liste fiable). Mermoz Sacré-Cœur ajouté comme quartier composé distinct de Mermoz seul (`places/quartiers.ts`).
- **Type CHAMBRE vs nombre de chambres** (`extractors/roomsAndBeds.ts`) : « chambre »/« room » nu (sans nombre devant, sans autre type déjà posé) → type CHAMBRE. « 2 chambres »/« 3 bedrooms » → nombre de chambres. « 1 chambre » isolé → ambiguïté `chambreCount` (type ou nombre) ; mais avec un autre type déjà posé (« appartement avec 1 chambre »), c'est sans ambiguïté un nombre de chambres. Formes acceptées (1 à 10) : chiffre, mot écrit (trois/three), tiret collé (3-bedroom), abréviations (3 BR, 3 ch., 3 chbres).
- **Types — pluriels/fautes** (`dictionaries/fr.ts`/`en.ts`) : appartements/apparts/apartement, villas/vila, maisons/maisson, studios, terrains, locaux/locaux commerciaux, houses, apartments/flats, lands/plots. « parcelles » (pluriel) volontairement absent de TERRAIN — collision avec le quartier « Parcelles Assainies ».
- **Équipements** (`extractors/amenities.ts`) : synonymes piscine (pool, swimming pool, piscine privée). Un mot de préférence (de préférence, idéalement, si possible, preferably, ideally, would be nice) à proximité (fenêtre de 3 tokens) transforme l'équipement en préférence douce au lieu d'un filtre strict. « Meublé »/« furnished » : absent de la liste réelle des équipements (`Frontend/src/lib/listingProfile.ts`) — décision prise seul de ne pas l'ajouter, reste un mot non compris sans erreur ni ambiguïté.
- **Ponctuation** (`tokenize.ts`) : `.`/`,` en début/fin de mot retirés à la tokenisation (pas seulement la virgule finale comme avant), jamais à l'intérieur d'un nombre — s'applique à tous les extracteurs en amont.
- **Ambiguïtés** : `MiloAmbiguity` étendu de 4 à 9 valeurs (`periodNotSupported`, `landmark`, `numberedDistrict`, `amountDirection`, `approximateAmount`, `chambreCount` en plus de `type`/`transactionType`/`beds`/`region`).
