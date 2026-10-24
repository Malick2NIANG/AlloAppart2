# RAPPORT 00 — Audit de préparation du film de lancement (lecture seule)

Date : 13 octobre 2026 · Périmètre : `C:\Users\HP\Desktop\AlloAppart\AlloAppartProject\Code`
Méthode : lecture du code (Backend, Frontend, prisma), git, `tsc --noEmit`, lint, navigation **non connectée** dans l'application locale (desktop + rendu mobile 390 × 844 simulé dans des iframes), appels GET publics à l'API locale.
Aucun seed, aucune migration, aucun compte, aucun formulaire, aucune installation.

> Limite importante : je n'ai **pas pu ouvrir les espaces connectés** (bailleur, agence, agent, admin, locataire). Se connecter suppose de saisir un mot de passe, ce que je ne fais pas. Tout ce qui concerne ces écrans est vérifié **dans le code uniquement** et noté « non constaté à l'écran ».

---

## 1. État du code

| Point | Constat |
|---|---|
| Branche / dernier commit | `develop` à jour avec `origin/develop`. Dernier commit `619484e` (13/10/2026 21:05, Malick Niang) : « feat(publier): afficher le détail des erreurs de validation de l'API ». |
| Arbre de travail | Une seule modification non commitée : `TODO_PRODUCTION.md` (mise à jour de la liste, 8 ajouts / 3 retraits). |
| **Projet Remotion** | `Frontend/motion/` est **ignoré par git** (`Frontend/.gitignore`, ligne 44 : `/motion/`). Le projet du film n'est donc pas versionné : à décider avant d'y produire 11 clips. |
| TypeScript | Backend : 0 erreur. Frontend : 0 erreur. |
| Lint (sans `--fix`) | Backend : 0 erreur, 0 avertissement (129 fichiers). Frontend : 0 / 0 (164 fichiers). |
| Démarrage | Frontend `http://localhost:3000` et API `http://localhost:4000/api/v1` répondent. |
| Tests | Non lancés (non demandés). Fichiers présents : 6 tests Frontend (Vitest), 19 specs Backend (Jest). CI : `.github/workflows/ci.yml`. |
| Effet de bord à signaler | `tsc --noEmit` a mis à jour `Frontend/tsconfig.tsbuildinfo` (cache de compilation incrémentale, ignoré par git). Aucun autre fichier touché. |

Sécurité non ré-auditée, comme demandé.

---

## 2. Cartographie fonctionnelle

Légende état : **F** fonctionnel · **P** partiel · **C** cassé · **I** inexistant. « Écran » = constaté visuellement (non connecté) ; « code » = vérifié dans le code seulement.

| Fonctionnalité | Route(s) / composant(s) | Rôle(s) | État vérifié | Film |
|---|---|---|---|---|
| Page Annonces : Tout / À louer / À vendre, types adaptés à la transaction, menu Région, panneau Filtres (annonceur + AlloVérifié), pastilles actives, « Tout effacer », Par page (6/12/24), pagination, onglet Mes favoris | `/listings` · `listings/page.tsx`, `ListingsFilters.tsx` | public ; favoris = connecté | **F** (code + écran) | Oui, **avec réserve** (données, cf. § 3) |
| Fiche logement (location) | `/listings/[id]` · `page.tsx`, `ListingHeroCarousel`, `ListingContactCard`, `ListingBookingCard`, `RentalTermsCard`, `MapView`, `ListingReviewForm` | public | **F** (écran) — petit défaut : la tuile « Région » affiche la **ville** (« Pikine / Région », « Grand standing / Région ») | Avec réserve |
| Fiche **vente** : Appeler, SMS, WhatsApp ; sans réservation ni avis | même page, `isVente` | public | **F** (écran) : Appeler + SMS visibles, pas de réservation, pas d'avis, garanties adaptées. WhatsApp n'apparaît que si l'agence a un numéro WhatsApp (absent chez « Guilla immo »). **Mobile** : la barre basse n'affiche qu'**un** bouton (WhatsApp sinon Appeler), pas de SMS (noté dans TODO). | Avec réserve |
| Vente directe réservée aux agences abonnées | `publier/page.tsx` (`canUseVenteMode` = PRO_AGENCE + abonnement ACTIVE), contrôle aussi côté service | PRO_AGENCE abonnée | **F** (code) | Avec réserve (compte agence abonné requis) |
| AlloVérifié™ — demande bailleur | `/bailleur/verifications` · `POST /verifications` (paiement PayDunya, ou crédit, ou gratuit si PRO actif) | BAILLEUR / PRO_AGENCE | **F** (code). Écran de **suivi** avec frise Demandé → Planifié → En cours → Vérifié | Avec réserve |
| AlloVérifié™ — assignation | `/espace/verifications` · `PATCH /verifications/:id/assign` | ADMIN (connexion avec code e-mail) | **F** (code) | Avec réserve |
| AlloVérifié™ — visite agent | `/agent/verifications`, `/agent/verifications/[id]` · `start`, `complete` (photos + rapport) | AGENT_TERRAIN | **F** (code) | Avec réserve |
| AlloVérifié™ — badge | `AlloVerifieBadge` sur carte + fiche ; `isVerified` posé à la fin de visite (ou validation admin) ; expiration automatique prévue | — | **F** (écran : badge vert « AlloVérifié » visible) | Oui |
| Messagerie | `/locataire|bailleur|agent/messages[/roomId]`, `/messages` · `MessagesShell`, `ChatRoom` (temps réel via Soketi/Pusher) | connectés | **F** (code) — non constaté à l'écran | Avec réserve (Soketi doit tourner, 2 comptes) |
| Réservation nuitée / mensuelle / mixte | `ListingBookingCard`, `MonthlyBookingRequestForm` · `rentalMode` NIGHTLY / MONTHLY / MIXED | LOCATAIRE | **F** (code) ; carte de prix visible à l'écran | Avec réserve |
| Paiement PayDunya | `POST /payments/initiate` → `payment_url` ouvert dans un **nouvel onglet PayDunya** (page tierce, sandbox) ; retour `/paiement/confirmation` | LOCATAIRE | **F** (code) | **Partiel** : seul l'avant / l'après est filmable dans l'app |
| Publication en 6 étapes (Type & Titre, Caractéristiques, Localisation, Prix, Photos, Récapitulatif) + modification identique | `/publier` (`STEP_LABELS` × 6), `/bailleur/listings/[id]/edit` (stepper aligné, commit `9b80919`) | BAILLEUR / PRO_AGENCE | **F** (code) ; non connecté → « Connectez-vous » à l'écran | Avec réserve |
| Champs selon le type de bien ; carte liée aux 14 régions (choix de région → recentrage `flyTo`, clic → région déduite, position incohérente bloquée avec tolérance 3 km) | `lib/listingProfile.ts`, `lib/senegalRegions.ts` (14 régions, contours geoBoundaries), `LocationPicker` | idem | **F** (code + tests unitaires présents) | Oui (après seed) |
| Mes annonces : miniatures, statuts (Actives / Brouillons / Louées / Archivées), bouton Voir sur brouillons et archives, boost | `/bailleur/listings` | BAILLEUR / PRO_AGENCE | **F** (code) | Avec réserve |
| Boost | `/bailleur/boost`, modale dans Mes annonces → paiement PayDunya (nouvel onglet), illimité gratuit en PRO | idem | **F** (code) | Avec réserve (paiement non filmable) |
| Tableau de bord bailleur : biens, réservations, paiements, revenus (courbe mensuelle), rapport PDF, notifications | `/bailleur`, `/bailleur/bookings`, `/bailleur/analytics`, `/notifications` | BAILLEUR | **F** (code) | Avec réserve (chiffres vides sans données) |
| Espace agence | `/bailleur/*` + `/bailleur/ma-vitrine`, `/bailleur/analytics` (statistiques vitrine), `/bailleur/abonnement` ; vitrine publique `/agences/[slug]` | PRO_AGENCE | Vitrine publique **F** (écran). **« Portefeuille » et « Clients » : I** — aucun écran dédié n'existe. | Avec réserve ; ne pas annoncer de portefeuille / clients |
| Contrat PDF | `ContractCard` → `GET /contracts/booking/:id/download` (régénéré à la volée) | locataire / bailleur | **F** (code) — c'est un **téléchargement**, rien ne s'affiche dans l'app | Avec réserve (montrer le bouton, ou le PDF ouvert hors app) |
| Reçu PDF | `/locataire/paiements` → `GET /bookings/:id/receipt` | LOCATAIRE | **F** (code), téléchargement | Idem |
| Rapport mensuel PDF | `/bailleur` et `/bailleur/analytics` → `GET /analytics/owner/report?month=` | BAILLEUR | **F** (code), téléchargement | Idem |
| Notifications in-app | `NotificationBell`, `/notifications` | connectés | **F** (code) | Avec réserve |
| Notifications e-mail | nodemailer (envoi validé le 13/10) | — | Rien à l'écran de l'application (boîte mail externe) | Non (ou capture de boîte mail hors app) |

### Ce que recouvre « suivi » dans le produit
1. **Suivi de demande AlloVérifié™** : frise de statut sur `/bailleur/verifications` (Demandé → Planifié → En cours → Vérifié ; Refusé à part). C'est le seul vrai écran de « suivi ».
2. **Suivi de réservation** : pastilles de statut dans `/locataire/bookings` et `/bailleur/bookings`, détail `/locataire/bookings/[id]` ; le bouton « Suivre ma réservation » de `/paiement/confirmation` renvoie simplement vers `/locataire/bookings`.
3. **Côté agent** : liste des missions et historique (`/agent/verifications`).
Il n'existe **pas** d'écran de suivi dédié : ne pas en annoncer un.

---

## 3. Affichage mobile et assets

### Rendu 390 × 844 (constaté, non connecté)
- **Annonces** : lisible ; la ligne des types de bien défile horizontalement (Tous, Apparts, Villas…) ; pas de débordement.
- **Fiche logement** : hero plein écran correct ; **barre de prix fixe en bas** (« 90 000 FCFA/nuit · Envoyer ») qui recouvre le contenu pendant le défilement → à prévoir dans les cadrages.
- **Fiche vente** : barre basse « Appeler l'agence » seule (pas de SMS en mobile).
- **Vitrine agence** `/agences/guilla-immo` : correcte (avatar, « Agence PRO », 4 biens, filtres).
- **Publier** non connecté : écran « Connectez-vous ». Espaces connectés : **non constatés**.
- **Page Région** (`/regions/dakar`, hors film) : image de couverture cassée (URL Unsplash) et « 0 logement » alors qu'il y a des annonces à Dakar.

### Qualité des données et des visuels — **principal frein au tournage**
- **11 annonces actives** dans la base locale, dont **6 « Appartement Test E2E <horodatage> »** (créées par `Frontend/e2e/flow.mjs`), visibles dans le catalogue public.
- **Photos** : 12 images Cloudinary, **1 seule par annonce** (2 pour une villa). Plusieurs sont **sans rapport avec un logement** : bureau « My Space », logo Windows, arbre mort pour le terrain ; les annonces E2E ont une image grise unie.
- **1 seule annonce AlloVérifiée** (« Appartements 3 pieces »), sans fiche de vérification publique associée (aucune photo de visite à montrer).
- **1 seule annonce en vente** (« TITRE FONCIER THIES », ville saisie « Grand standing »).
- Titres et descriptions non soignés (« Appartements 3 pieces », fautes, prix mensuel 2 700 000 FCFA pour un 3 pièces à Pikine).
- Agence « Guilla immo » : avatar = photo de personne, pas de numéro WhatsApp.
- Tableaux de bord : chiffres, revenus et graphiques probablement vides ou incohérents sans réservations payées (non constaté).
- Logo : PNG 500 × 500 (petit pour du plein écran vertical) + `favicon.svg` (maison seule). Une version vectorielle du logo complet manque.
- Icônes : Font Awesome via CDN (cohérent partout).

### Thème à filmer
Les deux thèmes fonctionnent (bascule testée sur le DOM, sans enregistrer de préférence).
**Recommandation : thème sombre** pour tous les clips — cohérent avec la pub 16:9 et l'affiche (bleu nuit + or), et les cartes et badges dorés ressortent mieux. Réserve : le rendu sombre des tableaux de bord n'a pas pu être vérifié (connexion requise) ; à contrôler au prompt 01.

### Trop pauvre pour être filmé tel quel
Toutes les vues catalogue et fiche avec les données actuelles, les tableaux de bord sans historique, et toute scène qui montrerait plus d'une annonce vérifiée ou en vente.

---

## 4. Faisabilité des scènes proposées

| # | Scène | Verdict | Écrans / routes | Compte / rôle | Durée reco. | Risques |
|---|---|---|---|---|---|---|
| 03 | Problème | **Oui** | Animation pure (reprise de l'acte 1 existant) | — | 4 s | Aucun |
| 04 | Révélation | **Oui** | Animation pure (acte 2, logo, badge) | — | 5 s | Logo PNG limité en très grand |
| 05 | Recherche et filtres | **Avec réserve** | `/listings` : Tout/À louer/À vendre → Région → Filtres (AlloVérifié) → pastilles | Visiteur | 7 s | Données de démo indispensables (photos, pas d'annonces E2E) |
| 06 | Fiche logement | **Avec réserve** | `/listings/[id]` : carrousel, caractéristiques, badge, carte, carte de réservation | Visiteur | 6 s | Libellé « Région » qui affiche la ville ; barre mobile fixe ; une annonce par photo seulement |
| 07 | Parcours AlloVérifié™ | **Avec réserve** | `/bailleur/verifications` (frise de suivi) → `/agent/verifications/[id]` (mission) → badge sur l'annonce | Bailleur, agent terrain (+ admin pour l'assignation, connexion par code e-mail) | 9–10 s | 3 rôles ; paiement de la demande sur PayDunya (tiers) — prendre un bailleur PRO (gratuit) ou un crédit ; aucune photo de visite réelle aujourd'hui |
| 08 | Réservation et paiement | **Avec réserve** (paiement lui-même : **non**) | Carte de réservation → `/paiement/confirmation` → `/locataire/bookings` (statut) → bouton Reçu / Contrat | Locataire | 6 s | La page de paiement est PayDunya (tiers, sandbox) : à ne pas filmer ; confirmation et statut nécessitent une vraie réservation payée en sandbox |
| 09 | Messagerie | **Avec réserve** | `/locataire/messages/[roomId]` et côté bailleur | Locataire + bailleur | 5 s | Soketi doit tourner ; deux sessions ; pas de messagerie pour une annonce en vente |
| 10 | Publier en 6 étapes | **Avec réserve** | `/publier` (6 étapes, carte des régions, contrôle de cohérence) | Bailleur | 10 s | Filmer jusqu'au récapitulatif **sans valider** (sinon création réelle) ; **ne pas utiliser le mode démo** (`aa_demo_role` dans le stockage local simule le succès : faux UI) |
| 11 | Agence : vente directe | **Avec réserve** | Vitrine `/agences/[slug]` → fiche vente (Appeler / SMS / WhatsApp) ; `/publier` en mode Vente | PRO_AGENCE abonnée | 8 s | Ne pas montrer de « portefeuille / clients » (inexistant) ; renseigner un WhatsApp d'agence |
| 12 | Mes annonces, boost et revenus | **Avec réserve** | `/bailleur/listings` (miniatures, statuts, Voir, boost) → `/bailleur` (revenus) | Bailleur (PRO pour le boost gratuit) | 7 s | Revenus vides sans historique ; paiement du boost sur PayDunya |
| 13 | Appel à l'action | **Oui** | Animation pure (acte 4) | — | 5 s | **Domaine alloappart.sn non réservé** : bloquant pour la diffusion |

**Propositions :**
- **Fusionner 08 + 09** en « Réserver en confiance » (message au bailleur → réservation → statut confirmé), 8 s : plus fluide et évite de filmer PayDunya.
- **Raccourcir 12** en « Gérer ses annonces » et ne montrer les revenus que si les données de démo les rendent crédibles.
- **Ne rien ajouter** pour l'instant. Une scène « Notifications » serait possible (cloche + page), mais elle apporte peu.

---

## 5. Risques de capture

1. **Clerk en mode développement** : clé `pk_test_` → bandeau « Development mode » sur les écrans Clerk. À masquer (prompt 01).
2. **Connexion admin par code e-mail** à chaque fois : un humain doit relever le code. À éviter dans les captures automatisées.
3. **PayDunya** : nouvel onglet vers une page tierce en sandbox. Non filmable (règle 1). Toute scène de paiement s'arrête avant et reprend après.
4. **Carte OpenStreetMap** : tuiles chargées en réseau (latence, tuiles grises) ; l'attribution « © OpenStreetMap · geoBoundaries (CC BY 3.0 IGO) » doit rester visible (licence).
5. **Contenus variables** : dates relatives (« il y a… »), « Membre depuis 2026 », compteurs de notifications, prix et totaux selon la date. Le seed doit les figer.
6. **Temps de chargement** : squelettes (`PublicSkeletonOverlay`) et images Cloudinary à précharger avant chaque prise.
7. **Bannière cookies** et éventuels toasts à neutraliser.
8. **Saisie automatique du navigateur** : sur `/sign-in`, Chrome pré-remplit une adresse e-mail personnelle. Capturer dans un profil de navigateur vierge.
9. **Mode démo** (`aa_demo_role` dans le stockage local) : rend un faux succès de publication. À proscrire.
10. **Tests E2E** : `flow.mjs` crée des annonces « Test E2E » dans la même base. Les relancer pollue à nouveau le catalogue.
11. **Barres fixes mobiles** (prix, CTA) qui masquent une partie du contenu en défilement.
12. **PDF** (contrat, reçu, rapport) : téléchargés, pas affichés dans l'app.
13. **Brouillons accessibles par URL** (noté dans TODO) : ne pas filmer d'URL de brouillon.

---

## Sections finales

### Durée totale estimée des scènes retenues
Avec les durées recommandées ci-dessus (11 scènes) : **72 s** (hors 0,5 s de marge en tête et en fin de chaque clip).
Avec la fusion 08 + 09 : **10 clips, environ 70 s**.

### Scènes à fusionner / supprimer / ajouter
- Fusionner : 08 + 09 → « Réserver en confiance » (8 s).
- Raccourcir : 12 (7 s, revenus facultatifs).
- Supprimer : aucune, sous réserve des données de démo.
- Ajouter : aucune.

### Fonctionnalités insuffisamment prêtes ou non confirmées
- « Portefeuille » et « Clients » de l'espace agence : **inexistants**.
- SMS absent de la barre de contact mobile d'une annonce en vente.
- Libellé « Région » qui affiche la ville sur la fiche.
- Page Région : image cassée et 0 résultat.
- Tous les écrans connectés : vérifiés dans le code, **non constatés à l'écran**.
- Paiement : non filmable dans l'app (PayDunya tiers).
- Notifications e-mail : hors application.

### Assets insuffisants
- Photos de logements : à remplacer entièrement (plusieurs photos par bien, vrais intérieurs et extérieurs crédibles pour Dakar, droits d'usage clairs).
- Annonces de démo propres (titres, descriptions, prix cohérents), plusieurs AlloVérifiées, au moins 2 ou 3 en vente.
- Photos de visite terrain pour AlloVérifié.
- Agence de démo complète (logo, WhatsApp, téléphone).
- Historique de réservations et paiements pour les revenus.
- Logo complet en vectoriel.

### Risques techniques
Bandeau Clerk dev, code e-mail admin, PayDunya tiers, tuiles OSM, contenus variables, chargements, mode démo, pollution par les tests E2E, saisie automatique du navigateur, et projet `Frontend/motion` non versionné.

### Questions à trancher par l'équipe
1. **Format final** : un film maître d'environ 70 s, plus des déclinaisons courtes (15–30 s) pour les publicités ?
2. **Scènes retenues** et fusion 08 + 09 ?
3. **Thème** : sombre (recommandé) ou clair ?
4. **Données de démo** : quelles photos utiliser (photos réelles fournies par l'équipe, ou banque d'images libre de droits) ? Quels noms d'agence et de bailleurs fictifs ?
5. **Comptes de capture** : qui fournit les sessions bailleur, agence PRO abonnée, agent, admin et locataire, et qui saisit le code e-mail admin ?
6. **Versionnement** : retirer `Frontend/motion` du `.gitignore` pour versionner le film ?
7. **Domaine** : réservation d'alloappart.sn avant diffusion, ou autre adresse dans le CTA ?
8. **Petits correctifs** (libellé Région, SMS en mobile) : à faire avant tournage ? Ils sortent du périmètre du film et demanderaient une autorisation explicite.

---

## Décisions validées

*Décisions de l'utilisateur, reçues après la livraison du rapport. Elles s'imposent aux prompts suivants.*

### 1. Scènes, durée et formats

- **Scènes** : on garde les 11 scènes, mais les scènes **08 et 09 sont fusionnées** en une seule scène « **Réserver et échanger** ». La version maître dure donc environ **70 s**.
- **Scène 12** : elle montre seulement « **Mes annonces** » et le **boost**. Le tableau de bord des revenus n'y figure que s'il est crédible avec les données de démo.
- **Déclinaisons de 15 à 30 s** : elles viendront plus tard, tirées de la version maître.
- **Format** : **vertical 9:16 uniquement** pour l'instant. Une version 16:9 pour le site viendra peut-être plus tard.

### 2. Thème

- **Thème sombre pour tous les clips.**
- Au **prompt 01**, il faudra vérifier à l'écran, avec un compte de démo, les **tableaux de bord en thème sombre**. Pendant l'audit, je ne les ai vus que dans le code.

### 3. Réserves

**Données de démo**
- On utilise **uniquement** les comptes et annonces du seed de démo (préfixe `demo-`), **jamais de vrais comptes**.
- Le prompt 01 doit **recommander** comment écarter les 6 annonces « Appartement Test E2E » et l'annonce « Grand standing ». Deux options : une base de démo séparée, ou un archivage après sauvegarde.
- **Photos** : nouvelles, libres de droit, **au moins 3 par annonce** et cohérentes avec le bien.

**AlloVérifié**
- Prévoir **2 annonces vérifiées** avec une **vraie fiche de vérification**.

**Admin**
- L'espace admin **n'est pas filmé** (connexion par code OTP envoyé par e-mail).
- Dans la scène 07, l'étape de validation est représentée par un **texte animé, sans faux écran**.

**Paiement**
- On s'arrête **avant PayDunya**, comme prévu.

**« Portefeuille » et « Clients »**
- **Aucune mention** dans le film.

**Page `/regions/dakar`**
- Elle **n'est pas filmée**.
- Le correctif est fait côté code : **ne rien y toucher**.

**Éléments parasites à l'écran**
- Le prompt 01 doit **proposer comment masquer ou cadrer** :
  - le bandeau Clerk de développement ;
  - la bannière cookies ;
  - les squelettes de chargement ;
  - les barres fixes mobiles.

### Rappel de périmètre

- **Aucune modification de code dans le dépôt.**
- L'étape suivante, le prompt 01, sera lancée par l'utilisateur dans une nouvelle conversation.
