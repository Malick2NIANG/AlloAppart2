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

## 8 ter. Lot 7 bis — corrections 2, classes A-G (2026-11-04)

Mesure indépendante série 2 (`requetes_2.json`) non conforme (9 erreurs/8 requêtes) : le jeu de dev à 100 % était sur-ajusté. Corrections par classes générales, validées sur un jeu de dev tenu à part (30 % non consulté pendant l'écriture des règles) — jamais sur les 20+20 requêtes des deux mesures indépendantes.

- **Classe A — nombres nus et unités** (`extractors/price.ts`) : un chiffre sans multiplicateur/devise ET < 1000 n'est jamais un prix. Un nombre suivi d'une unité de durée (nuit/jour/semaine/mois/an/weekend), de surface (m2/m²/hectare/sqm/feet) ou de personnes (personne/people/pax/adulte/enfant) est consommé comme tel, jamais comme prix/chambres. Si un mot-clé de budget est suivi de plusieurs nombres, le candidat retenu est celui porteur d'un multiplicateur/devise, pas le premier rencontré (bug trouvé : « budget » existant à la fois en FR et en EN faisait matcher deux fois la même occurrence et écrasait le bon montant par le mauvais — corrigé par un suivi des positions de mots-clés déjà utilisées). « mil » ajouté comme abréviation de « mille » (25mil = 25000). Un montant « total » pour un séjour (N jours/nuits + total) n'est pas un prix mensuel : ambiguïté, aucun filtre.
- **Classe B — négation des équipements** (`extractors/amenities.ts`) : un équipement précédé (fenêtre de 3 mots) d'une négation (sans, pas de, pas d', surtout pas de, non, aucun, without, no, not, don't want, no need for) n'est JAMAIS extrait positivement — il part en mot non compris avec l'ambiguïté `negatedAmenity`. Formes collées testées : « sans piscine ni parking », « avec ou sans », « with or without ». Même règle pour « meublé »/« furnished ».
- **Classe C — intervalles et bornes chambres/pièces** (`extractors/roomsAndBeds.ts`) : « 2 à 3 chambres »/« 2-3 »/« entre 2 et 3 »/« 2 or/to 3 bedrooms »/« between 2 and 3 » → `minBeds`+`maxBeds` ; « X minimum/au moins X/X ou plus/X+/at least X/minimum X » → `minBeds` seul ; « maximum X/au plus/at most/up to X » → `maxBeds` seul. **Mêmes règles étendues aux pièces** (« F3 minimum » → `minRooms` seul) — gap trouvé : les pièces n'avaient aucun support de qualificatif contrairement aux chambres ; `applyBeds` généralisé en `applyCount(kind, …)` partagé. « F3 »/« 2 chambres » seuls restent une égalité (inchangé).
- **Classe D — intervalles de montants** (`extractors/price.ts`) : « between 70 and 85 million », « from 150k to 200k », « 70-85M », « entre 40 et 55 millions », variantes « 70 – 85 »/« 70 to 85 »/« 70 à 85 » (tiret/en-dash normalisé en amont) ; le premier nombre hérite du multiplicateur/devise du second s'il n'en a pas. `minPrice`+`maxPrice`.
- **Classe E — lieux** (`places/quartiers.ts`, `places/aliases.ts`) : liste complétée (Mamelles, Maristes, Bel-Air, Fass, Mbao, Sangalkam, Bambilor, Lac Rose côté Dakar ; Joal, Fadiouth, Warang, Pointe Sarène, Toubab Dialaw côté Thiès), toutes `needsValidation` (à valider par Malick). Alias ajoutés : Sacré-Cœur/SC3, Point E/Pointe, Parcelles/PA, Grand-Yoff, Retba→Lac Rose. Un quartier inconnu reste un mot non compris, jamais un `cityContains` inventé.
- **Classe F — nombres écrits** (`extractors/price.ts`, `parseWrittenNumber`) : « quatre-vingt-dix millions », « soixante millions », « one hundred thousand », « ninety million » → valeurs exactes (FR : unités/dix-dix-neuf/vingt…quatre-vingt-dix + cent/mille/million ; EN : analogue). Limite acceptée : un nombre écrit ne peut pas prêter son multiplicateur à un nombre chiffré voisin dans une fourchette (hors périmètre explicite de la tâche).
- **Classe G — montant « nu » avec contexte de budget clair** : un montant ≥ 1000 ou à multiplicateur, sans indicateur de direction mais avec un contexte clair (par mois/per month, à louer/à vendre + montant) → `maxPrice` = montant × 1,10 (arrondi au millier) + ambiguïté `targetAmount` (« ≈ » côté interface). Sans contexte clair : ambiguïté `amountDirection`, aucun filtre (inchangé).
- **Bug transverse — rupture de clause perdue à la tokenisation** (`tokenize.ts`) : une virgule/point entre deux clauses sans rapport (« minimum 3 bedrooms, max 500000 ») disparaissait entièrement, rendant les deux mots adjacents pour les fenêtres d'adjacence à portée fixe — un « max » de la clause de prix suivante était happé comme qualificatif de chambres (et volé à l'extraction du prix). Corrigé par un champ `brokenAfter` sur chaque token, vérifié par les qualificatifs postfixes (chambres/pièces ET prix).
- **Validation** : 248 cas (166 dev + 82 tenus à part), ≥ 50 % de pièges négatifs par classe (A 52 %, B 73 %, C 57 %, D 50 %, E 50 %) — 100 %/100 % dev vs tenu à part. `sorties_brutes_4.json`/`sorties_brutes_serie2_v2.json` régénérés sans interprétation (tests de non-régression uniquement).
- **Ambiguïtés** : `MiloAmbiguity` étendu de 4 à 9 valeurs (`periodNotSupported`, `landmark`, `numberedDistrict`, `amountDirection`, `approximateAmount`, `chambreCount` en plus de `type`/`transactionType`/`beds`/`region`).

## 8 quater. Lot 7 ter — corrections 3, classes 1-2 + audit régions (2026-11-05)

Mesure indépendante série 3 non conforme (2 erreurs/20 requêtes) : direction de prix inversée et numéro de téléphone pris pour un prix. Corrections par classes générales.

- **Classe 1 — direction d'un montant** (`extractors/price.ts`) : un qualificatif de borne (minimum/min/au moins/maximum/max/au plus/jusqu'à/up to/under/at least/at most…) s'applique à l'élément qui le précède ou le suit IMMÉDIATEMENT dans la même proposition (`crossesClauseBreak`, nouveau garde-fou sur `nearestUnclaimed`) ; un qualificatif collé à une quantité NON monétaire (étage/floor, chambres, pièces, personnes, m²/hectares, années, nuits/jours/semaines — `NON_MONETARY_QUALIFIER_NEIGHBORS`) ne descend/remonte jamais sur un montant plus loin, mais seulement pour les mots-clés qui peuvent grammaticalement se lire en arrière (`POSTFIX_ELIGIBLE` : minimum/maximum/min/max/au moins/au plus/at least/at most — jamais « budget »/« jusqu'à », prefix-only). Bugs trouvés en cascade pendant la validation : (1) « minimum » traversait une virgule pour happer un montant plus loin (« 3ème étage minimum, 350.000 FCFA maximum » → minPrice au lieu de maxPrice) ; (2) le blocage ajouté bloquait aussi « budget » à tort (« 2 chambres budget 250000 » → maxPrice perdu), corrigé en le restreignant à `POSTFIX_ELIGIBLE` ; (3) les pluriels des mots de durée (nuits/semaines/ans/années/nights/weeks/years) manquaient dans `nonMonthlyPeriodKeywords`, laissant un petit nombre nu devenir la cible d'un qualificatif postfixe (« 10 ans minimum, 80M maximum » → minPrice:10) ; (4) la boucle de mot-clé postfixe ne vérifiait jamais `isUsableAlone`, laissant un nombre nu sans rapport (« 2 etages min, 2000000 » → minPrice:2) devenir une cible — corrigé en ajoutant la vérification. `adulte(s)`/`enfant(s)` avaient leur pendant EN (`adult`/`adults`/`child`/`children`) oublié dans `FORBIDDEN_FOLLOW_WORDS`. `maxPrice` déjà confirmé par un mot-clé direct n'est plus jamais abaissé par un candidat « parasite » restant (`targetAmount`, `Math.min` isolé du montant déjà posé). « 1.5 million » (point décimal EN) reconnu comme « 1,5 million » (FR).
- **Classe 2 — numéros de téléphone** (`extractors/phone.ts`, nouveau, lancé avant le reste du pipeline comme les lieux) : formats sénégalais/internationaux (espaces/points/tirets/parenthèses/préfixe +221/00221), toute suite ≥ 7 chiffres dont le regroupement ne respecte pas strictement « 1 à 3 chiffres puis des groupes de 3 » (« 77 123 45 67 » ≠ « 15 000 »), un jeton unique nu ≥ 9 chiffres (format local/international sans séparateur), et les mots-clés (numéro/tel/whatsapp/wa/contact/appelez/call/phone/joignable) suivis de chiffres — jamais prix/pièces/chambres. Un montant explicitement cué par « budget » n'est jamais lu comme un téléphone, même nu et ≥ 9 chiffres (priorité au montant explicite). Bugs trouvés pendant la validation : un groupe unique sans séparateur échouait trivialement la règle « 1-3 chiffres » dès qu'il dépassait 3 chiffres (« 1200000 » happé à tort, corrigé par `groups.length > 1` requis pour cette branche) ; les boucles de consommation ne respectaient pas la rupture de clause (`brokenAfter`), happant un nombre sans rapport juste après une virgule (« tel 77.123.45.67, 3 chambres » mangeait le « 3 »).
- **Classe 3 — audit des régions des lieux** (`places/quartiers.ts`) : Toubab Dialaw corrigé Thiès → Dakar (département de Rufisque, commune de Yène, d'après le découpage administratif — région de Dakar). Confirmés déjà corrects : Rufisque, Bargny, Diamniadio, Sangalkam, Bambilor, Lac Rose (département de Rufisque, région de Dakar). Ajoutés avec `needsValidation` : Sébikotane, Yenne, Kounoune (Dakar, département de Rufisque) ; Pout, Sindia (Thiès, départements de Thiès/Mbour).
- **Classe 4 — cohérence « total de séjour »** (`extractors/price.ts`, `STAY_DURATION_WORDS`) : « semaine(s) »/« week(s) » ajoutés (« 2 semaines, budget 600k total » → ambiguïté `stayTotal`, aucun filtre) ; « mois »/« month » restent volontairement absents (décision de portée confirmée : une durée en mois n'empêche jamais un prix mensuel, son unité par défaut).
- **Validation** : 90 cas (60 dev + 30 tenus à part, classes 1-2), 58 % de pièges négatifs (classe 1 : 50 %, classe 2 : 71 %) — 100 %/100 % dev vs tenu à part. `sorties_brutes_serie3_v2.json` régénéré sans interprétation.
- **Ambiguïtés** : `MiloSpanCategory` étendu avec `'phone'` (nouvelle catégorie de span, pas une ambiguïté).
