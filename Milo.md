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

**Restant** :
- **Lot 5** — Interface : barre de recherche en langage naturel (accueil PC+mobile, remplace le bouton « Rechercher »/la barre blanche mobile ; bouton « Demander à Milo » sur `/listings`), pastilles de critères, état « non compris » avec repli sur `q`.
- **Lot 6** — Branchement Meilisearch pour le classement des `softPreferences` (filterable/sortable à configurer).
- **Lot 7** — Jeu de test complet (100 FR + 100 EN + 30 mixtes) + mesure automatique + rapport des seuils.
