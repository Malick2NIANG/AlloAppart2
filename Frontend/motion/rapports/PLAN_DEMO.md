# PLAN_DEMO — Données de démonstration du film de lancement

Prompt 01 · 13 octobre 2026 · **Plan uniquement : rien n'a été créé, exécuté ni installé.**
Entrées : `RAPPORT_00.md` (section « Décisions validées »), lecture du code (`Backend/prisma/schema.prisma`, services NestJS, pages Next.js, `prisma/seed.ts`, `seed.pilot.ts`, `scripts/cleanup-test-listings.ts`, `Frontend/e2e/flow.mjs`).

Notation : **J** = date et heure d'exécution du seed (toutes les dates sont relatives à J). « Gabarit du code » = texte repris tel quel de l'application (notifications, statuts), jamais réécrit pour le film.

---

## 0. Principes

1. **Rien d'inventé côté interface** : le seed ne crée que des **données**. Tous les écrans filmés sont les écrans réels qui affichent ces données.
2. **Uniquement des comptes `demo-`** (décision validée). Aucun vrai compte, aucune vraie annonce.
3. **Base séparée** (recommandation, § 6). La base de développement n'est jamais modifiée.
4. **Pas de faux témoignages** : aucun avis client (`Review`) ni note d'agent (`AgentRating`) inventé. Ce seraient des témoignages fictifs présentés comme réels dans une publicité. Les sections « Avis » restent donc vides ou absentes.
5. **Cohérence avec les règles métier du code** :
   - la vente est réservée aux agences abonnées ;
   - un bailleur particulier a au plus 10 annonces actives ;
   - les types de biens respectent le mode : TERRAIN, MAISON et LOCAL_COMMERCIAL en vente seulement ; CHAMBRE, STUDIO et BUREAU en location seulement ;
   - les montants sont calculés avec les **mêmes formules** que `bookings.service.ts` et la configuration de la plateforme (commission nuitée 10 %, commission mensuelle 1 mois de loyer).

---

## 1. Comptes par rôle

Tous en `+clerk_test@example.com` (voir correction de connexion en fin de document — remplace le domaine `@example.test` prévu initialement). Aucun avatar photo : les initiales s'affichent, donc **aucun visage**.

| Clé | E-mail | Nom affiché | Rôles en base | Écrans servis (scènes) |
|---|---|---|---|---|
| `demo-locataire` | demo-locataire+clerk_test@example.com | Fatou Ndiaye | LOCATAIRE | 08 : réservation, messagerie côté locataire, « Mes réservations » |
| `demo-bailleur` | demo-bailleur+clerk_test@example.com | Moussa Sarr | LOCATAIRE, BAILLEUR | 07 : demande et suivi AlloVérifié ; 08 : messagerie côté bailleur ; 10 : Publier ; 12 : Mes annonces et boost (+ revenus si crédibles) |
| `demo-bailleur-2` | demo-bailleur-2+clerk_test@example.com | Aminata Diallo | LOCATAIRE, BAILLEUR | Aucun écran filmé : elle diversifie le catalogue (05, 06) |
| `demo-agence` | demo-agence+clerk_test@example.com | Ousmane Ba — agence « Atlantique Horizon Immobilier »* | PRO_AGENCE + abonnement **PRO ACTIVE** | 11 : vitrine, fiche vente, Publier en mode Vente ; option boost gratuit en 12 |
| `demo-agent` | demo-agent+clerk_test@example.com | Cheikh Mbaye | AGENT_TERRAIN (zone : Dakar) | 07 : missions, démarrer et terminer une visite |
| `demo-agent-2` | demo-agent-2+clerk_test@example.com | Mariama Sow | AGENT_TERRAIN (zone : Thiès / Mbour) | Liste d'agents proposée au bailleur (07) ; auteure de la 2ᵉ vérification |
| `demo-locataire-2`, `demo-locataire-3` | demo-locataire-2+clerk_test@example.com, demo-locataire-3+clerk_test@example.com | Ndeye Seck, Pape Gueye | LOCATAIRE | Historique (réservations passées → revenus du bailleur). Non filmés |
| **Admin** | — | — | — | **Aucun compte admin** : l'espace admin n'est pas filmé (décision). Les étapes d'assignation sont posées directement par le seed. |

\* Nom d'agence fictif : **vérifier qu'aucune agence réelle au Sénégal ne le porte** (recherche web et RCCM) avant le tournage.

**Champs à fixer pour chaque compte**, sinon les redirections de `/redirect` cassent la capture :
- `termsAcceptedAt` = J − 60 j ;
- `bailleurTermsAcceptedAt` pour les bailleurs et l'agence ;
- `mustChangePassword = false` ;
- `locale = 'fr'` ;
- `isSuspended = false`.

**Lien avec Clerk** (point technique clé) : le backend retrouve l'utilisateur par `clerkId` (`ClerkAuthGuard`). Chaque compte de démo doit donc exister **réellement dans l'instance Clerk de développement**.
- Le seed (ou un script de provisionnement séparé, sur le modèle de `Frontend/rapports-mobile/tools/provision-test-accounts.mjs`) crée chaque compte par l'API Backend de Clerk, avec un **mot de passe réel généré** (et non `skip_password_requirement`).
- **Correction de connexion** (voir fin de document) : les sessions par jeton Clerk ne fonctionnent pas sur les espaces connectés (rendu serveur). La connexion des captures se fait par le **vrai formulaire `/sign-in`** avec e-mail + mot de passe (voir PLAN_CAPTURE § 4, révisé).
- Le mot de passe généré est stocké **uniquement** dans un fichier local non versionné (`Frontend/motion/capture/.credentials.env`, gitignoré), jamais affiché ni commité — même format que `.credentials.env` de `rapports-mobile/tools/`.
- Ensuite, le seed fait un `upsert` en base avec le vrai `clerkId`.
- Les comptes Clerk sont retrouvés par e-mail : jamais de doublon.

**Agence — vitrine** :
- slug : `atlantique-horizon-immobilier` ;
- bio de 3 lignes ;
- adresse affichée : « Mermoz, Dakar » (quartier seulement) ;
- couleur prise dans `agency-color-palette.ts` ;
- `profileViews` : 1 240 ;
- avatar : **monogramme graphique** créé pour l'agence fictive (pas de photo de personne).

**Téléphone et WhatsApp de l'agence** : voir la décision D6. Un numéro sénégalais inventé peut appartenir à quelqu'un de réel et il serait visible à l'écran.

---

## 2. Annonces (23)

Prix réalistes en FCFA (marché 2026, **à faire valider par l'équipe**). Les coordonnées GPS sont indicatives : le seed doit **vérifier chaque point** avec `findRegionAt` sur `senegal-regions.json` (même contrôle que le formulaire, tolérance 3 km) et refuser un point incohérent.

Statut ACTIVE sauf mention contraire. Propriétaires : M = Moussa, A = Aminata, AG = agence.

| # | Titre (affiché) | Type · transaction · mode | Ville / région · quartier | Prix | Caractéristiques | Prop. | Statut / particularité | Scènes |
|---|---|---|---|---|---|---|---|---|
| L01 | Appartement F3 meublé avec vue mer | APPARTEMENT · LOCATION · MIXED | **Dakar / Dakar** · Almadies | 85 000 F/nuit · 950 000 F/mois | 3 p., 2 ch., 2 sdb, 110 m², clim, wifi, parking, gardien | M | **AlloVérifié** (V1) | 05, 06, 08 |
| L02 | Studio meublé à Mermoz | STUDIO · LOCATION · NIGHTLY | Dakar / Dakar · Mermoz | 25 000 F/nuit | 1 p., 35 m², clim, wifi | M | Vérification **planifiée aujourd'hui** (V3) | 07 |
| L03 | Appartement F4 lumineux à Point E | APPARTEMENT · LOCATION · MONTHLY | Dakar / Dakar · Point E | 650 000 F/mois, caution 2 mois | 4 p., 3 ch., 130 m² | M | — | 05, 12 |
| L04 | Chambre meublée à Ouakam | CHAMBRE · LOCATION · MONTHLY | Dakar / Dakar · Ouakam | 90 000 F/mois | 18 m², charges incluses | M | — | 12 |
| L05 | Villa avec piscine à Saly | VILLA · LOCATION · NIGHTLY | Saly / Thiès · Saly Portudal | 120 000 F/nuit, ménage 15 000 F | 4 ch., piscine, jardin | M | **Boostée** (`boostUntil` = J + 5 j) | 12, (08) |
| L06 | Appartement F2 au Plateau | APPARTEMENT · LOCATION · MONTHLY | Dakar / Dakar · Plateau | 450 000 F/mois | 2 p., 65 m² | M | **DRAFT** (onglet Brouillons) | 12 |
| L07 | Appartement F3 à Sacré-Cœur | APPARTEMENT · LOCATION · MONTHLY | Dakar / Dakar · Sacré-Cœur 3 | 400 000 F/mois, caution 2 mois | 3 p., 95 m² | M | **RENTED** (bail actif de Ndeye) | 12 |
| L08 | Studio sur l'île de Saint-Louis | STUDIO · LOCATION · NIGHTLY | Saint-Louis / Saint-Louis | 20 000 F/nuit | 30 m² | M | **SUSPENDED** (onglet Archivées) | 12 |
| L09 | Appartement F3 à Thiès | APPARTEMENT · LOCATION · MONTHLY | Thiès / Thiès | 175 000 F/mois | 3 p., 90 m² | A | — | 05 |
| L10 | Villa familiale à Kaolack | VILLA · LOCATION · MONTHLY | Kaolack / Kaolack | 250 000 F/mois | 4 ch., cour | A | — | 05 |
| L11 | Studio meublé à Ziguinchor | STUDIO · LOCATION · NIGHTLY | Ziguinchor / Ziguinchor | 18 000 F/nuit | 28 m² | A | — | 05 |
| L12 | Appartement F2 à Liberté 6 | APPARTEMENT · LOCATION · MONTHLY | **Dakar / Dakar** · Liberté 6 | 300 000 F/mois | 2 p., 70 m² | A | **AlloVérifié** (V2) | 05 |
| L13 | Chambre à Sor, Saint-Louis | CHAMBRE · LOCATION · MONTHLY | Saint-Louis / Saint-Louis | 60 000 F/mois | 16 m² | A | — | — |
| L14 | Appartement meublé à Ngor | APPARTEMENT · LOCATION · NIGHTLY | Dakar / Dakar · Ngor | 60 000 F/nuit | 2 p., 60 m² | A | — | 05 |
| L15 | Villa 5 chambres aux Almadies | VILLA · LOCATION · MONTHLY | Dakar / Dakar · Almadies | 2 500 000 F/mois | 5 ch., piscine, 450 m² | AG | — | 11 |
| L16 | Bureau de 120 m² au Plateau | BUREAU · LOCATION · MONTHLY | Dakar / Dakar · Plateau | 1 200 000 F/mois | 120 m², 4 bureaux | AG | — | 11 |
| L17 | Appartement F4 standing à Mermoz | APPARTEMENT · LOCATION · MONTHLY | Dakar / Dakar · Mermoz | 700 000 F/mois | 4 p., 140 m² | AG | — | 11 |
| L18 | Terrain titré de 300 m² à Diamniadio | TERRAIN · **VENTE** | Diamniadio / Dakar | 30 000 000 F | 300 m², titre foncier | AG | — | 05, 11 |
| L19 | Villa à vendre à Saly Portudal | VILLA · **VENTE** | Saly / Thiès | 125 000 000 F | 4 ch., piscine, 600 m² | AG | — | 11 |
| L20 | Maison à vendre à Thiès | MAISON · **VENTE** | Thiès / Thiès | 48 000 000 F | 5 p., 250 m² | AG | — | 11 |
| L21 | Appartement F4 à vendre aux Almadies | APPARTEMENT · **VENTE** | **Dakar / Dakar** · Almadies | 165 000 000 F | 4 p., 150 m² | AG | — | **11 (fiche vente)** |
| L22 | Local commercial au centre de Kaolack | LOCAL_COMMERCIAL · **VENTE** | Kaolack / Kaolack | 60 000 000 F | 180 m² | AG | — | — |
| L23 | Terrain de 500 m² à Saly | TERRAIN · **VENTE** | Saly / Thiès | 22 000 000 F | 500 m² | AG | — | — |

**Bilan** : 20 annonces actives dans le catalogue public (2 pages de 12), dont 14 en location et 6 en vente. Répartition par région : Dakar 11, Thiès 5, Kaolack 2, Saint-Louis 1, Ziguinchor 1.

**Annonces filmées en gros plan** : on choisit **ville = « Dakar »** (L01, L12, L21). Ainsi le défaut connu (la tuile « Région » affiche la ville) donne « Dakar / Région », qui reste exact, sans toucher au code.

**Descriptions** : 2 à 3 phrases sobres et sans superlatif invérifiable, rédigées au prompt 02. Exemple pour L01 : « Appartement meublé de 3 pièces au 4ᵉ étage, vue sur l'océan. Climatisation, wifi et place de parking sécurisée. À 5 minutes de la Corniche. »

**Identifiants** :
- UUID **déterministes**, en version 5 à partir de la clé `demo-L01`… Les DTO exigent un UUID (`@IsUUID`), donc on ne peut pas utiliser d'identifiant lisible.
- Le marquage « démo » se fait par le propriétaire (`demo-…@example.test`) et par la liste des UUID connus du seed.

---

## 3. Photos

**Décision validée** : nouvelles, libres de droit, **au moins 3 par annonce**, cohérentes avec le bien. Elle prime sur le document de prompts, qui disait « une au minimum ».

| Source | Licence | URL de la licence | Usage commercial | Attribution |
|---|---|---|---|---|
| **Unsplash** | Licence Unsplash | https://unsplash.com/license | Oui, gratuit | Non obligatoire (on la consigne quand même) |
| **Pexels** | Licence Pexels | https://www.pexels.com/license/ | Oui, gratuit | Non obligatoire (idem) |

Ces deux licences interdisent de revendre les photos telles quelles et de laisser croire que les personnes ou marques visibles cautionnent le produit. Nos critères les respectent.

**Volume** : 23 annonces × 3 à 5 photos ≈ **80 photos**. S'y ajoutent **8 photos de visite** pour les 2 vérifications terminées et 3 pour la visite filmée en direct (07). Toutes viennent des **mêmes séries** que les photos des annonces concernées.

**Critères de sélection** (contrôle photo par photo au prompt 02) :
1. **Une série par bien** : 3 à 5 vues d'un même logement, du même photographe ou de la même séance. Sinon le carrousel montrerait trois maisons différentes.
2. **Aucun visage, aucune personne identifiable**, aucune plaque d'immatriculation, aucun logo ni marque.
3. **Cohérence avec la ville** :
   - extérieurs au style sahélien et côtier (béton clair, toits-terrasses, bougainvilliers) ;
   - Saly : villas avec piscine et jardins ;
   - Saint-Louis : façades coloniales colorées ;
   - terrains : sol sableux, clôture en parpaing.
   - Les intérieurs peuvent être génériques s'ils restent sobres.
4. **Pas de lieu célèbre** (pont Faidherbe, Monument de la Renaissance…) présenté comme un bien à louer ou à vendre.
5. Résolution d'au moins 1 600 px de large.

**Manifeste** : `Frontend/motion/demo/photos/credits.json`, une entrée par photo :
- clé d'annonce ;
- source (nom) ;
- URL de la page source ;
- auteur ;
- licence ;
- date de téléchargement.

Les URL précises des photos ne sont **pas** listées ici : elles seront choisies et vérifiées une par une au prompt 02, et non inventées. Des recherches suggérées, sur Unsplash et Pexels, sont fournies pour chaque type :
- « modern apartment living room » ;
- « villa pool tropical » ;
- « african house exterior » ;
- « empty land plot sand » ;
- « office space empty » ;
- « bedroom minimal ».

**Hébergement** :
- Les photos sont téléchargées une fois dans `Frontend/motion/demo/photos/`.
- Le seed les envoie sur **Cloudinary**, dans un dossier dédié `allo-appart/demo/` avec l'étiquette `demo`. Elles sont ainsi supprimables d'un coup.
- `res.cloudinary.com` est déjà autorisé dans `next.config.ts`.
- On évite le lien direct vers Unsplash : une URL de ce type est déjà cassée sur `/regions/dakar`.

**Agence et comptes** : monogramme graphique pour l'agence ; aucun avatar pour les autres comptes.

---

## 4. Historique (uniquement ce qui apparaît dans les écrans retenus)

### 4.1 AlloVérifié™ (scènes 05, 06, 07)

| # | Annonce | Agent | Statut | Dates | Contenu |
|---|---|---|---|---|---|
| V1 | L01 | Cheikh Mbaye | **DONE** | demandée J − 24 j, faite J − 20 j ; `isVerified = true`, `verifiedAt` = J − 20 j | Notes factuelles sur la visite (conformité de la surface, des pièces, des équipements, de l'accès) ; **4 photos de visite** de la même série ; `reportUrl` vide (pas de faux rapport PDF) |
| V2 | L12 | Mariama Sow | **DONE** | faite J − 45 j | Notes et **4 photos** |
| V3 | L02 | Cheikh Mbaye | **SCHEDULED** | `scheduledAt` = J arrondi au quart d'heure | Mission du jour pour la scène 07. Le code n'autorise « Démarrer » qu'à partir de `scheduledAt` − 15 min : il faut donc **re-seeder le jour même de la capture** |

- Le badge expire automatiquement après 6 mois (tâche planifiée) : les dates ci-dessus restent largement dans la validité.
- **Paiement des demandes** : V1 à V3 sont créées directement en base. Il n'y a donc ni `VerificationPayment` ni passage par PayDunya.
- **Admin** : l'assignation n'est pas filmée. Dans le clip 07, un texte animé dit par exemple « Un agent AlloVérifié est assigné ». Il n'y a aucun faux écran.

### 4.2 Réservations et revenus (scènes 08 et 12)

Les montants suivent les formules du code :
- **nuitée** : prix par nuit × nuits ; commission 10 % ;
- **mensuel** : loyer + caution ; commission = 1 mois de loyer.

Le graphique des revenus (`/analytics/owner/monthly`) additionne `totalAmount` des réservations payées (CONFIRMED, COMPLETED, ACTIVE, TERMINATED) selon le mois de **création** sur 6 mois glissants.

| Mois (création) | Réservations de Moussa | Total du mois |
|---|---|---|
| J − 5 mois | L01, 4 nuits (Ndeye), COMPLETED | 340 000 F |
| J − 4 mois | L01, 6 nuits (Pape), COMPLETED | 510 000 F |
| J − 3 mois | L01, 3 nuits (Ndeye) ; L05, 2 nuits (Pape), COMPLETED | 495 000 F |
| J − 2 mois | L05, 5 nuits (Ndeye) ; L02, 7 nuits (Pape), COMPLETED | 775 000 F |
| J − 1 mois | L01, 7 nuits (Pape) ; L05, 3 nuits (Ndeye), COMPLETED | 955 000 F |
| Mois en cours | L07 bail mensuel (Ndeye) ACTIVE : loyer + caution 2 mois = 1 200 000 F ; L05, 3 nuits (Fatou), **CONFIRMED** à venir (J + 12 → J + 15) | 1 560 000 F |

- Les totaux sont indicatifs. Le seed les **recalcule** avec le code réel, y compris les frais de ménage de L05 s'ils entrent dans le total, et ne les saisit pas en dur.
- La courbe est montante et crédible.
- **Décision prise** : le tableau de revenus n'est filmé que s'il paraît crédible. Contrôle visuel au prompt 02.

**Autres données** :
- **Fatou** : la réservation L05 confirmée à venir, plus une réservation **COMPLETED** passée sur L14 (propriétaire Aminata). « Mes réservations » montre donc un historique.
- **Escrow** : HELD pour la réservation à venir, RELEASED pour les réservations terminées. À aligner sur les règles de `payments.service`.
- `paymentRef` = **null** sur les réservations du seed. La page de détail n'affiche la référence que si elle existe : on évite ainsi d'afficher une fausse référence PayDunya.
- **Contrat** du bail L07 : la ligne `Contract` est de type HABITATION ; le PDF est généré à la volée par l'application.

### 4.3 Messagerie (scène 08)

**Salon R1 (L01) — Fatou ↔ Moussa**, 4 messages datés de J − 1 j :
- Fatou : « Bonjour Moussa, l'appartement est-il disponible le week-end prochain ? »
- Moussa : « Bonjour Fatou, oui, il est libre. Arrivée possible dès 14 h. »
- Fatou : « Parfait. Le parking est-il inclus ? »
- Moussa : « Oui, une place sécurisée en sous-sol. »

Le message suivant est tapé **en direct** pendant la capture (voir PLAN_CAPTURE).

**Autres salons** : R2 (L05, Fatou ↔ Moussa, à propos de la réservation confirmée) et R3 (L07, Ndeye ↔ Moussa). Ils donnent une liste de conversations crédible.

### 4.4 Notifications (visibles par la cloche des écrans connectés)

- Les **types et textes sont ceux des gabarits** de `notifications.service.ts`, sans rédaction libre.
- **Moussa** : visite AlloVérifié planifiée (V3), paiement reçu (L05), nouveau message. 2 non lues.
- **Cheikh** : mission assignée (V3), non lue.
- **Fatou** : paiement confirmé (L05), lue.

### 4.5 Divers

| Élément | Valeur |
|---|---|
| Favoris de Fatou | L01, L05, L12 |
| Abonnement de l'agence | PRO, ACTIVE, depuis J − 60 j, tarif = `PlatformConfig` (150 000 F/mois) |
| `PlatformConfig` | Non touchée : la ligne se crée seule avec les valeurs par défaut |
| Avis, notes d'agent, signalements | **Aucun** (§ 0, principe 4) |

---

## 5. Sécurité du seed

| Exigence | Mise en œuvre proposée |
|---|---|
| **Sauvegarde préalable** | Avant toute chose, `pg_dump` au format custom de la base de développement `allo_appart` via le conteneur `allo_postgres`. Le fichier est rangé **hors du dépôt** (par exemple `C:\Users\HP\Desktop\AlloAppart\backups\allo_appart_AAAAMMJJ-HHMM.dump`) puis vérifié par `pg_restore --list`. On sauvegarde même avec une base séparée. |
| **Marquage `demo-`** | E-mails `demo-…@example.test` ; UUID déterministes listés dans le seed ; dossier Cloudinary `allo-appart/demo/` + étiquette `demo`. |
| **Idempotent** | Commande `reset` : suppression de toutes les données marquées, puis recréation complète dans une transaction. Elle donne **le même état à chaque exécution**, aux dates relatives à J près. Les comptes Clerk sont retrouvés par e-mail et jamais dupliqués. |
| **Supprimable d'une commande** | `demo:clean` supprime, dans l'ordre des dépendances (même cascade que `cleanup-test-listings.ts`) : les lignes en base, les comptes Clerk `demo-…@example.test` et les fichiers Cloudinary du dossier demo. Il supprime aussi ceux envoyés pendant les captures, dont les identifiants sont consignés par les scripts de capture. Avec une base séparée, `demo:drop` supprime toute la base. |
| **Garde-fous** | Le seed **refuse de s'exécuter** si le nom de la base ne se termine pas par `_demo` (sauf option explicite) ou si `NODE_ENV=production`. Il affiche la base ciblée, sans mot de passe. Il ne lit les secrets (Clerk, Cloudinary) que dans `Backend/.env`, sans jamais les écrire ni les journaliser. |
| **Effets de bord coupés** | Le backend lancé en mode démo l'est **sans SMTP, Twilio ni OneSignal** (variables vides). D'après le code, chaque service ne fait rien sans configuration. Aucun e-mail, SMS ni notification push n'est donc envoyé pendant les captures. **À confirmer** au prompt 02 par un test de fumée. |
| **Comptes Clerk** | Une instance Clerk de développement est plafonnée en nombre d'utilisateurs (100 selon l'offre gratuite, **à vérifier**). Les scripts E2E en créent à chaque passage. Il faut contrôler la marge avant d'en ajouter 8. Si un webhook Clerk atteint le backend local, il peut créer une ligne `users` en LOCATAIRE : le seed fait alors un `upsert` sur `clerkId` et fixe les rôles. |

**Emplacement du seed** : il a besoin du client Prisma du Backend. Je recommande donc `Backend/prisma/seed.demo.ts` et `Backend/scripts/demo-clean.ts`, sur le modèle de `seed.pilot.ts` et `cleanup-test-listings.ts`. Ce sont des fichiers **nouveaux** : aucun code existant n'est modifié, mais cela demande une autorisation explicite au prompt 02 (règle « ne modifie pas Backend/ »).

Les commandes de lancement sont regroupées dans un petit script Node de `Frontend/motion`, qui passe la bonne `DATABASE_URL` au Backend sans toucher à `Backend/package.json`.

---

## 6. Écarter les annonces « Appartement Test E2E » et « Grand standing »

| | **Option 1 — Base de démo séparée** (recommandée) | Option 2 — Archivage dans la base de dev, après sauvegarde |
|---|---|---|
| Principe | Deuxième base `allo_appart_demo` dans le même conteneur PostGIS, migrée par `prisma migrate deploy`. Pour les captures, on relance le backend sur le même port 4000 avec la `DATABASE_URL` de démo. Le frontend ne change pas. | Les 7 annonces passent en SUSPENDED (onglet « Archivées » de leurs propriétaires) et les annonces de démo sont ajoutées dans la base de dev. |
| Catalogue filmé | **Uniquement** les 20 annonces de démo | Mélange démo + 4 ou 5 annonces de dev restantes (photos hors sujet, titres non soignés) : il faudrait les archiver aussi |
| Risque pour la base de dev | Aucun | Modifications réelles à défaire (restauration) |
| Pollution par les tests E2E | Impossible : `flow.mjs` vise la base de dev | Chaque passage E2E remet des annonces de test dans le catalogue |
| Retour arrière | Supprimer la base | Restaurer la sauvegarde (perte des changements faits entre-temps) |
| Coût | Création de la base et migrations : quelques minutes | Faible, mais le nettoyage est permanent |

**Recommandation : option 1.** Les annonces E2E et « Grand standing » restent intactes dans la base de dev et n'apparaissent jamais à l'écran.

**Précautions** :
- Ne pas lancer `e2e/flow.mjs` pendant que le backend tourne en mode démo, sinon il écrirait dans la base de démo.
- **Meilisearch** : l'index `listings` est partagé. La page `/listings` filmée lit PostgreSQL, pas Meilisearch, et le seed écrit directement en base sans indexer. Seule la page `/search` (non filmée) en dépend. Après la session de démo, on relance le backend de dev et on réindexe si besoin.
- **Cache Next.js** : certaines pages publiques (`/agences`) ont un cache de données d'une heure. Après chaque bascule de base, on redémarre le frontend. Si des données de dev réapparaissent, on vide le cache généré `.next/cache`.

---

## 7. Décisions à valider (données)

| # | Question | Proposition |
|---|---|---|
| D1 | Base de démo séparée ou archivage ? | **Base séparée** `allo_appart_demo` |
| D2 | Seed dans `Backend/prisma/seed.demo.ts` et `Backend/scripts/demo-clean.ts` (nouveaux fichiers, aucun code existant modifié) ? | Oui, à autoriser explicitement au prompt 02 |
| D3 | Catalogue de 23 annonces, prix et quartiers du § 2 | Valider ou corriger les prix (connaissance du marché par l'équipe) |
| D4 | Noms fictifs (comptes et « Atlantique Horizon Immobilier ») | Valider après vérification qu'aucune agence réelle ne porte ce nom |
| D5 | Photos Unsplash et Pexels, séries par bien, hébergées dans Cloudinary `allo-appart/demo/` | Oui |
| D6 | Téléphone et WhatsApp de l'agence visibles à l'écran : vrai numéro de l'équipe AlloAppart, ou numéro fictif masqué au montage ? | **Vrai numéro de l'équipe** (un numéro inventé peut appartenir à quelqu'un de réel) |
| D7 | Aucun avis ni note d'agent inventés (faux témoignages) | Oui |
| D8 | Mention « Annonces et données de démonstration » discrète dans les clips qui montrent le catalogue ou des chiffres (05, 06, 08, 11, 12). Le film présente des biens qui n'existent pas, et la plateforme n'est pas encore en production. | **Oui, recommandé** (honnêteté publicitaire) |
| D9 | 2 annonces vérifiées (L01, L12), plus L02 vérifiée en direct pendant la scène 07 | Oui. Une 3ᵉ est possible si la grille filtrée paraît trop vide |
| D10 | Backend de démo lancé sans SMTP, Twilio ni OneSignal | Oui |
| D11 | Sauvegarde de la base de dev hors du dépôt (dossier `AlloAppart\backups`) | Oui |

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

*Reçue pendant l'exécution du prompt 02. Remplace la méthode « jeton de connexion » du § 4 de PLAN_CAPTURE.md et la mention « sans mot de passe » du § 1 ci-dessus. Le même texte figure à la fin de PLAN_DEMO.md et de PLAN_CAPTURE.md.*

- **Constat** : les sessions par jeton Clerk ne fonctionnent pas sur les espaces connectés (rendu serveur).
- **Méthode validée** : connexion par le **vrai formulaire `/sign-in`**, avec des comptes de démo dont l'adresse contient **`+clerk_test`** (ex. `demo-bailleur+clerk_test@example.com`), qui acceptent le code `424242` en instance de développement, et un **mot de passe de test généré**, stocké uniquement dans un fichier local non versionné (`Frontend/motion/capture/.credentials.env`).
- `Frontend/rapports-mobile/tools/clerk-session.mjs` montre la méthode de référence (attendre `window.Clerk.loaded` avant de remplir le formulaire).
- Les adresses de comptes du § 1 ci-dessus sont corrigées en conséquence (`+clerk_test@example.com` au lieu de `@example.test`).
- Le reste des décisions ne change pas.
- **Rendu mobile** : l'application a désormais un mode « application » sous 768 px (barre de navigation du bas, feuilles du bas/BottomSheet, PWA). Toute capture à 390 × 844 doit montrer ce rendu réel.
