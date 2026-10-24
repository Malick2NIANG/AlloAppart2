# Audit mobile AlloAppart — lecture seule

Date : 2026-10-19. Aucun fichier de l'application n'a été modifié pendant cet audit ; seuls `Frontend/rapports-mobile/AUDIT_MOBILE.md` et `Frontend/rapports-mobile/captures/` ont été écrits. Aucun commit.

Objectif : préparer le chantier « mobile first, style application » sous 768px, sans rien changer à l'affichage ≥768px (règle absolue retenue pour tout ce document).

## Méthodologie

- **67 pages** (`page.tsx`) + les layouts structurants (`src/app/layout.tsx`, `(public)/layout.tsx`, `(dashboard)/layout.tsx` + `DashboardShell.tsx`, `(dashboard)/espace/layout.tsx`, `(auth)/layout.tsx`) ont été lus intégralement, par moi-même pour les layouts/composants transverses et via 5 sous-agents en parallèle pour les pages (pages publiques ; locataire ; bailleur ; agent de terrain ; admin), chacun avec le même référentiel de règles.
- Les composants partagés centraux (`ListingsFilters`, `ImageUploadZone`, `PhotoCropper`/`AvatarCropper`, `LocationPicker`, `MessagesShell`/`ChatRoom`, `BookingCard`/`BookingSearchRow`/`BookingPagination`/`StatFilterCard`/`ContractCard`, `ConfirmModal`, `ToastProvider`, `CookieConsentBanner`, `DemoDevBar`, `PhoneInput`, `AvailabilityCalendar`, `KpiWidgets`/`TrendCharts`) ont été lus en entier.
- **Captures Playwright** (390×844 @2x mobile + 1440×900 PC) réalisées pour les 14 pages publiques accessibles sans connexion, avec détection automatique du défilement horizontal (`document.scrollWidth > window.innerWidth`). Playwright (`@playwright/test` 1.62.1) et Chromium étaient déjà installés — aucune installation nécessaire.
- Les pages connectées (locataire/bailleur/agent/admin) n'ont **pas** été capturées : aucun compte n'a été créé et la connexion n'a pas été contournée, conformément à la consigne. Leur évaluation repose uniquement sur la lecture de code. Une capture sera possible une fois des comptes de démonstration disponibles.
- Une incohérence relevée entre deux sous-agents sur `PhoneInput.tsx` (menu pays : clampé ou non horizontalement) a été vérifiée personnellement par relecture directe — résolue ci-dessous (section composants partagés).

## Résumé chiffré — 67 pages notées

| Gravité | Nombre | % |
|---|---|---|
| OK | 10 | 15 % |
| MINEUR | 22 | 33 % |
| MOYEN | 23 | 34 % |
| MAJEUR | 12 | 18 % |

Répartition par parcours :

| Parcours | Pages | OK | MINEUR | MOYEN | MAJEUR |
|---|---|---|---|---|---|
| Public (dont auth, légal) | 28 | 6 | 12 | 8 | 2 |
| Locataire | 9 | 2 | 3 | 3 | 1 |
| Bailleur / agence | 14 | 2 | 4 | 5 | 3 |
| Agent de terrain | 6 | 0 | 0 | 4 | 2 |
| Admin | 10 | 0 | 3 | 3 | 4 |

## Captures — résultat du test de défilement horizontal

Aucune des 14 pages publiques capturées ne présente de défilement horizontal involontaire (`hasHorizontalScroll: false` partout, `scrollWidth === innerWidth` à chaque fois, y compris sur la fiche annonce où une image a temporairement élargi la mesure à 417px avant stabilisation). Le seul incident technique : la capture mobile de l'accueil a expiré en attendant `networkidle` (probablement une connexion persistante de type websocket) — reprise avec succès en attendant `load` à la place ; résultat identique (pas de scroll horizontal). Fichiers dans `Frontend/rapports-mobile/captures/` : `mobile-<page>.png` / `pc-<page>.png` pour accueil, listings, listing-detail, agences, agence-vitrine, search, region-dakar, sign-in, sign-up, cgu, confidentialite, cookies, a-propos, plan-du-site. Le détail brut (scrollWidth/innerWidth par page) est dans `scroll-report.json`.

Ce résultat ne veut pas dire « aucun problème mobile » : le défilement horizontal volontaire existe à plusieurs endroits (onglets de type de bien, stepper, vignettes photo, tableau de la page cookies) via `overflow-x-auto` — voir plus bas, à trancher produit.

## Constats transversaux (à traiter une seule fois, pas page par page)

1. **Police des champs de formulaire sous 16px, quasi systémique.** `globals.css:186` définit `.input-field { font-size: 0.875rem }` (14px), utilisée par la quasi-totalité des `<input>`/`<textarea>`/`<select>` du site (tout `/publier`, tout le stepper d'édition bailleur, `/profil`, `/profil/securite`, formulaires admin, agent, etc.). Sous le seuil demandé, Safari iOS zoome automatiquement au focus. **Un seul correctif (relever `.input-field` à `1rem`) résout la majorité des cas d'un coup** ; il reste ensuite les champs qui utilisent directement `text-sm`/`text-xs` au lieu de `.input-field` (barres de recherche `BookingSearchRow`, `PhoneInput`, formulaires `(auth)`, `AgenceClientShell`, etc.) à corriger au même endroit mais composant par composant.
2. **Zones tactiles sous 44px, quasi partout.** Les boutons `.btn-gold`/`.btn-outline` globaux sont déjà conformes (≈46px), mais la grande majorité des boutons secondaires inline (`px-3 py-1.5`, `text-xs px-2.5 py-1.5`, icônes `h-8 w-8`/`h-9 w-9`/`h-10 w-10`) tombent entre 28 et 40px. C'est le problème le plus répété de tout l'audit, concentré sur les boutons d'action de carte (bailleur/admin/locataire), la pagination personnalisée, et les icônes de contact.
3. **4 éléments `position: fixed` ancrés en bas d'écran, qui vont tous se chevaucher avec la future barre de navigation :**
   - `DemoDevBar.tsx` (`fixed bottom-5 left-1/2`, z-9999, hors production uniquement)
   - `CookieConsentBanner.tsx` (`fixed inset-x-0 bottom-0`, z-60 — a déjà causé un bug de bouton inaccessible, documenté dans son propre commentaire de code, corrigé via une variable CSS `--cookie-banner-h` qui réduit dynamiquement la hauteur du dashboard)
   - `ToastProvider.tsx` (`fixed bottom-5 right-5`, z-200, largeur 320px)
   - `ListingContactCard.tsx:284` (`fixed bottom-3 inset-x-0 md:hidden`) — une barre d'action mobile **déjà existante** sur la fiche annonce publique, découverte pendant l'audit (non anticipée au départ). `main` de la page réserve déjà `pb-24` sur mobile pour elle.
   
   Ces 4 éléments utilisent des z-index différents (60, 200, 9999, 40) sans coordination : la future barre de navigation devra soit s'empiler proprement au-dessus, soit absorber/repositionner ces éléments sous 768px.
4. **Modales centrées très majoritairement, et seulement une minorité passe par le composant partagé `ConfirmModal`.** De nombreuses pages réimplémentent leur propre modale centrée locale au lieu de réutiliser `ConfirmModal.tsx` : `espace/users/page.tsx` (`Modal` local), `espace/reviews/page.tsx` (suppression), `espace/config/page.tsx` (3 modales locales : confirmation, annulation, changement de PIN), `bailleur/verifications/page.tsx` (4 modales dont 2 avec listes paginées imbriquées), `ReportModal.tsx`, `AvatarCropper.tsx`, l'`upgradeModal` de `/publier`, les modales de confirmation de `/bailleur/boost` et `/bailleur/abonnement`, `VerificationQrModal.tsx` (entièrement centrée, sans même l'adaptation `items-end` que d'autres ont déjà). **Bonne nouvelle partielle** : les 3 modales de `locataire/bookings/page.tsx` et les 3 modales de `agent/verifications/[id]/page.tsx` ont déjà `items-end sm:items-center` — un début de pattern bottom-sheet, point de départ réutilisable.
5. **Deux bugs tactiles actuels, indépendants du chantier mobile, à corriger quel que soit le calendrier :**
   - `ImageUploadZone.tsx:328-355` — les actions « Définir comme principale », « Ajuster », « Supprimer » sur chaque photo sont conditionnées à `opacity-0 group-hover:opacity-100` : sur tactile, il n'y a pas d'état `:hover` persistant, donc **ces actions sont aujourd'hui invisibles et inaccessibles sur mobile**, pas seulement mal dimensionnées. Utilisé par `/publier` et par le stepper d'édition bailleur.
   - `PhotoCropper.tsx:18-24` — canvas à largeur fixe en pixels (`480×360` en mode rectangle, `320×320` en mode carré) dans une modale `max-w-md p-6` : il faut ≈560px ou ≈400px de large disponibles, ce qui **déborde déjà aujourd'hui sur un iPhone SE/mini (375px)**. Utilisé par `ImageUploadZone` et par `/bailleur/ma-vitrine` (logo agence).
6. **Hauteurs de zone de chat incohérentes entre 3 implémentations**, aucune ne tenant compte du clavier virtuel (`100vh` statique, pas de `100dvh` ni `visualViewport`) :
   - `MessagesShell.tsx` — relativement avancé : bascule déjà liste/conversation au breakpoint `md:` (768px).
   - `ChatRoom.tsx:131` — hauteur forfaitaire `calc(100vh - 10rem)`, utilisée par les pages `.../messages/[roomId]` de locataire/bailleur/agent.
   - Les pages `.../messages/page.tsx` (liste, hors `[roomId]`) de locataire/bailleur/agent annulent le padding du `<main>` via `-m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)]` — mais `3.5rem` (56px) correspond à la topbar **desktop** (`DashboardShell.tsx:717`, `h-14`), alors que sous `lg:` (zone qui engloberales futurs <768px) c'est la topbar **mobile** `h-16` (64px, `DashboardShell.tsx:698`) qui s'affiche réellement — écart de 8px déjà présent aujourd'hui, qui s'aggravera avec l'ajout d'une barre de navigation basse à soustraire en plus.
7. **Seuil de breakpoint à réconcilier.** Toute la navigation actuelle (`NavbarClient.tsx`, `DashboardShell.tsx`) bascule mobile/desktop au seuil `lg:` (1024px), pas à 768px. Comme la règle du chantier est « rien ne change à partir de 768px », le nouveau mode app devra être imbriqué **dans** la zone déjà `lg:hidden` existante (donc strictement entre 0 et 768px), sans toucher au comportement actuel entre 768 et 1024px (qui restera le hamburger/drawer actuel). Architecturalement cohérent, mais à garder explicite car aucun seuil 768px n'existe nulle part aujourd'hui dans le code.
8. **PWA / viewport / safe-area : confirmé totalement absent.** Aucun `<meta name="viewport">` custom, aucun `manifest.json`, aucun `viewport-fit=cover`, aucune variable `safe-area-inset-*` dans `src/app/layout.tsx` ni `globals.css`. Le thème sombre existe uniquement via les classes Tailwind `dark:`, lues côté serveur (cookie), sans lien avec le sujet mobile.
9. **Système de toast dupliqué.** `/bailleur/abonnement/page.tsx:187,195` réimplémente son propre mécanisme de notification `fixed top-4 right-4` + indicateur de polling, en plus du `ToastProvider` global (`fixed bottom-5 right-5`). Les deux coexistent sans lien.
10. **Vérification d'une incohérence entre deux sous-agents** sur `src/components/ui/PhoneInput.tsx` (menu déroulant des pays) : un agent affirmait l'absence de toute protection contre le débordement horizontal, un autre affirmait l'existence d'un `max-w-[90vw]`. Lecture directe (lignes 196-202) : **les deux ont partiellement raison**. La largeur du menu est bien plafonnée (`max-w-[90vw]`, ligne 202, et `Math.min(menuPos.width, 288)`, ligne 201), **mais** la position `left` (ligne 201, `style={{ left: menuPos.left }}`) est calculée depuis `getBoundingClientRect()` sans être elle-même clampée à `window.innerWidth` — si le champ téléphone est proche du bord droit d'un écran étroit, le menu peut donc toujours déborder partiellement à droite malgré le plafond de largeur. Risque réel mais mineur (le plafond de largeur limite fortement l'ampleur du débordement).

## Tableau complet par page

### Pages publiques (28 routes)

| Route | Fichier | Gravité | Effort | Problèmes précis |
|---|---|---|---|---|
| `/` | `(public)/page.tsx` | MINEUR | S | `page.tsx:141` hero `min-h-[92vh]` + `py-40 md:py-52` → beaucoup de scroll avant le contenu sur petit écran. |
| `/listings` | `(public)/listings/page.tsx` + `ListingsFilters.tsx` | MOYEN | M | Onglets `py-2.5` (~38px) l.140,151 ; « par page » `h-7 w-9` l.310 ; pagination `h-10 w-10` (40px) l.327,338,344-369 ; `ListingsFilters.tsx` toggle transaction l.149, dropdowns classiques (pas bottom sheet) l.163,175,213,229, chips type en `overflow-x-auto` l.282. |
| `/listings/[id]` | `(public)/listings/[id]/page.tsx` + composants | **MAJEUR** | **L** | `ListingContactCard.tsx:284` = 4ᵉ `fixed` bottom (voir constat 3) ; textarea contact `text-sm` l.189-196 ; favori `h-10 w-10` l.125 ; `ListingHeroCarousel.tsx` flèches/partage/fermer <44px (l.135,139,156,240), vignettes `overflow-x-auto` l.337 ; `ListingBookingCard.tsx` boutons `py-2.5` l.612,625 + `AvailabilityCalendar` (cases 36px) ; `MonthlyBookingRequestForm.tsx:105` input date `text-sm` ; `ReportModal.tsx:207` modale centrée classique + textarea `text-sm` ; carte dans conteneur `h-64` fixe l.299-311. |
| `/agences` | `(public)/agences/page.tsx` | MINEUR | S | Boutons CTA carte `py-2.5` (~40px) l.136,140. |
| `/agences/[slug]` | `(public)/agences/[slug]/page.tsx` + `AgenceClientShell.tsx` | MOYEN | M | Input recherche largeur fixe `w-64` + `text-sm` l.248 ; 3 `<select>` `text-sm` l.256,264,271 ; boutons carte `py-2 text-xs` (~32px) l.349-361 ; pagination `px-3 py-2` (~36px) l.372-388. |
| `/search` | `(public)/search/page.tsx` | MINEUR | S | Input recherche `text-sm` l.47. |
| `/regions/[slug]` | `(public)/regions/[slug]/page.tsx` | MINEUR | S | Pagination `h-10 w-10` (40px) l.200-240, même motif que `/listings`. |
| `/favoris` | `(public)/favoris/page.tsx` | OK | S | `redirect('/listings?tab=favoris')`, aucune UI propre. |
| `/messages` | `(public)/messages/page.tsx` | MOYEN | M | `:218` hauteur figée `calc(100vh - 64px)`, implémentation de chat indépendante de `MessagesShell`/`ChatRoom` (3ᵉ formule, voir constat 6) ; input recherche `text-xs` l.248 ; input message `text-sm` l.384 ; bouton envoyer `h-10 w-10` l.389. Point positif : bascule déjà sur `md:` l.239,399 ; bouton retour déjà 44px l.314. |
| `/profil` | `(public)/profil/page.tsx` | MOYEN | M | Champs `.input-field` (14px) l.236,243,251,267 ; `PhoneInput` 14px l.192,210 ; bouton Enregistrer `py-2` (~36px) l.275 ; `AvatarCropper.tsx` modale centrée + canvas fixe 320px pouvant déborder à 320px de large (l.149-164,183-196). |
| `/profil/securite` | `(public)/profil/securite/page.tsx` | MOYEN | S | 3 inputs mot de passe `text-sm` l.144 ; boutons œil sans zone de tap l.148-151 ; bouton Enregistrer `px-5 py-2` (~36px) l.102. |
| `/publier` | `(public)/publier/page.tsx` + `ImageUploadZone.tsx` + `LocationPicker(Inner).tsx` | **MAJEUR** | **L** | Zoom Safari sur tous les champs (`.input-field`, 13 lignes listées) ; barre Précédent/Suivant/Publier en flux normal, pas collée en bas (l.955-999) ; `ImageUploadZone` actions hover-only inaccessibles au tactile (bug actuel, l.328-355) ; carte Leaflet `h-64` (l.721) ; `upgradeModal` centrée (l.1005-1053) ; stepper + récap en `overflow-x-auto` (l.1068,1206). |
| `/onboarding` | `(public)/onboarding/page.tsx` | OK | S | Grandes cartes tactiles, aucun input texte. |
| `/bookings/[id]` | `(public)/bookings/[id]/page.tsx` | OK | S | `flex-col sm:flex-row` déjà en place l.136. |
| `/paiement/confirmation` | `(public)/paiement/confirmation/page.tsx` | OK | S | Carte centrée `max-w-md`, boutons empilés mobile. |
| `/verifier/[token]` | `(public)/verifier/[token]/page.tsx` | OK | S | Même gabarit, aucun input. |
| `/a-propos` | `(public)/a-propos/page.tsx` | MINEUR | S | Bouton Retour `px-4 py-1.5` (~28-30px) l.23. |
| `/cgu` | `(public)/cgu/page.tsx` | MINEUR | S | Bouton Retour l.46 même motif. |
| `/confidentialite` | `(public)/confidentialite/page.tsx` | MINEUR | S | Bouton Retour l.41 même motif. |
| `/cookies` | `(public)/cookies/page.tsx` | MINEUR | S | Bouton Retour l.41 ; tableau 2 colonnes en `overflow-x-auto` l.94-111 (scroll probablement inutile à cette largeur). |
| `/plan-du-site` | `(public)/plan-du-site/page.tsx` | MINEUR | S | Bouton Retour l.69 même motif. |
| `/sign-in` | `(auth)/sign-in/.../page.tsx` + `SignInForm.tsx` | MOYEN | M | Inputs `text-sm` l.408,422 ; OTP `text-sm` l.275,353 (zoom, **incohérent** avec `/sign-up` dont l'OTP est `text-xl`) ; boutons œil sans zone de tap l.423-427 ; layout `(auth)/layout.tsx:19` en `h-screen` (pas `dvh`), mitigé par un scroll interne. |
| `/sign-up` | `(auth)/sign-up/.../page.tsx` + `SignUpForm.tsx` | MOYEN | M | Inputs `text-sm` l.264,278 ; boutons œil l.281-285 ; OTP en `text-xl` (l.208, pas de risque de zoom, contrairement à `/sign-in`). |
| `/sso-callback` | `(auth)/sso-callback/page.tsx` | MOYEN | S | Hérite du layout `(auth)` ci-dessus, page elle-même très simple. |
| `/accept-terms` | `accept-terms/page.tsx` | MINEUR | S | Checkbox 16px mais ligne entière cliquable (l.68-69) — risque faible. |
| `/change-password` | `change-password/page.tsx` | MINEUR | S | 2 inputs mot de passe `text-sm` l.132 ; boutons œil sans zone de tap l.134-141. |
| `/redirect` | `redirect/page.tsx` | OK | S | Spinner + bouton retry uniquement. |
| `/verification-admin` | `verification-admin/page.tsx` | MINEUR | S | Bouton fermer `h-7 w-7` (28px) l.92 ; OTP en `text-xl` (l.114, pas de risque de zoom). |

### Espace locataire (9 routes)

| Route | Fichier | Gravité | Effort | Problèmes précis |
|---|---|---|---|---|
| `/locataire` | `locataire/page.tsx` | OK | S | Grille `grid-cols-2 sm:grid-cols-4` déjà responsive l.81,134. |
| `/locataire/bookings` | `locataire/bookings/page.tsx` | **MAJEUR** | **L** | 3 modales centrées dupliquées (Cancellation l.733, Dispute l.845, Review l.989, déjà `items-end sm:items-center`) ; boutons fermeture 32px l.746,858,1003 ; étoiles sans padding l.926-944,380-384 ; quasi tous les boutons d'action en `text-xs py-1.5 px-3` (~28-30px, 10 occurrences l.506-683) ; 2 textarea `text-sm` l.883,1032. |
| `/locataire/bookings/[id]` | `locataire/bookings/[id]/page.tsx` | MOYEN | M | Étoiles sans padding l.380-384 ; textarea `text-sm` l.386-392 ; boutons `py-2 text-sm` (~36-40px) l.344-363. |
| `/locataire/favorites` | `locataire/favorites/page.tsx` | MINEUR | S | Bouton retirer favori `h-10 w-10` (40px) l.209-219. |
| `/locataire/paiements` | `locataire/paiements/page.tsx` | MOYEN | M | Squelette de chargement `grid-cols-3` sans variante responsive l.127 (seul le KPI final l.161 est responsive) ; liens « Voir reçu »/« Voir réservation » sans padding l.315-331. |
| `/locataire/messages` | `locataire/messages/page.tsx` | MINEUR | S | Wrapper `h-[calc(100vh-3.5rem)]` l.22 — écart de 8px avec la vraie topbar mobile (voir constat 6). |
| `/locataire/messages/[roomId]` | `locataire/messages/[roomId]/page.tsx` | OK | S | Délègue entièrement à `ChatRoom` (voir constat 6). |
| `/become-bailleur` | `become-bailleur/page.tsx` | MINEUR | S | Boutons soumission ≈44-45px (OK) ; stepper déjà adapté mobile ; `PhoneInput` non ré-audité ici (déjà couvert). |
| `/notifications` | `notifications/page.tsx` | MOYEN | M | « Marquer tout comme lu » et « Fermer » en boutons texte sans padding (~20px de hauteur) l.132-158, action fréquente de premier plan. |

### Espace bailleur / agence (14 routes)

| Route | Fichier | Gravité | Effort | Problèmes précis |
|---|---|---|---|---|
| `/bailleur` | `bailleur/page.tsx` | MINEUR | S | Grille KPI `grid-cols-2 xl:grid-cols-4` (2 colonnes jusqu'à 1280px, acceptable) l.311,515. |
| `/bailleur/listings` | `bailleur/listings/page.tsx` | MOYEN | M | 5 modales centrées (verif/boost/archive/delete/upgrade, l.518-702) ; actions `ListingCard` en liens sans padding l.869-954 ; recherche `text-sm` l.439. |
| `/bailleur/listings/[id]/edit` | `listings/[id]/edit/page.tsx` | **MAJEUR** | **L** | Stepper 6 étapes, le plus complexe avec `/publier`. Carte Leaflet `h-64` l.546 ; tous les champs `.input-field` (14px) ; boutons Précédent/Suivant en flux normal, pas collés en bas (l.770-805) ; étape Photos délègue à `ImageUploadZone` (bug hover-only) ; étape Localisation délègue à `LocationPicker`/`PhotoCropper` (débordement 375px). |
| `/bailleur/bookings` | `bookings/page.tsx` + `BookingActions.tsx` | MOYEN | M | Boutons d'action ≈33px l.84 (BookingActions) + lien Contacter sans padding l.252-258, plusieurs petites cibles collées en `flex-wrap`. |
| `/bailleur/messages` | `messages/page.tsx` | MINEUR | S | Même écart de 8px que côté locataire (constat 6) l.22. |
| `/bailleur/messages/[roomId]` | `messages/[roomId]/page.tsx` + `ChatRoom.tsx` | **MAJEUR** | **M** | Ne compense pas le padding `<main>` (contrairement à la liste) → double marge possible ; bouton retour 32px ; input `text-sm` ; zone de saisie non ancrée, recouvrira directement la future barre de navigation. |
| `/bailleur/agents` | `agents/page.tsx` | MINEUR | S | Wrapper `max-w-5xl px-4` s'ajoute au padding du `<main>` → double marge horizontale (32px cumulés) l.151. |
| `/bailleur/agents/[id]` | `agents/[id]/page.tsx` | OK | S | Aucune largeur fixe, `flex-wrap` partout ; bouton retour sans padding (mineur). |
| `/bailleur/verifications` | `verifications/page.tsx` (1485 lignes) | **MAJEUR** | **L** | `DateTimePicker` interne : popover `fixed` via `getBoundingClientRect` sans clamp (l.625-628), cellules jour `h-8` (32px) l.657, créneaux `py-1.5` (~33px) l.679,693 ; 4 modales centrées empilables dont 2 avec listes paginées imbriquées (l.179,812,995,1130). |
| `/bailleur/boost` | `boost/page.tsx` | MOYEN | M | Modale de confirmation centrée partagée avec `/listings` (l.317-389). |
| `/bailleur/abonnement` | `abonnement/page.tsx` | MOYEN | M | Système de toast local dupliqué (constat 9) l.187,195 ; modale confirmation centrée l.317-369. |
| `/bailleur/ma-vitrine` | `ma-vitrine/page.tsx` | MOYEN | M | Bouton « Enregistrer » sticky uniquement en `lg:` — sur mobile il faut scroller tout le formulaire pour l'atteindre (contraire à la règle CTA collé en bas) l.471-476 ; `PhotoCropper` mode carré (débordement 375px) l.320 ; swatches couleur `h-10 w-10` (40px) l.341. |
| `/bailleur/analytics` | `analytics/page.tsx` | MINEUR | S | Composants propres (pas `KpiWidgets`/`TrendCharts`, réservés à l'admin) ; graphiques déjà en `ResponsiveContainer`. |
| `/bailleur/profil/[id]` | `profil/[id]/page.tsx` | OK | S | `flex items-start gap-5` + `min-w-0 flex-1` gèrent bien le texte long. |

### Espace agent de terrain (6 routes)

| Route | Fichier | Gravité | Effort | Problèmes précis |
|---|---|---|---|---|
| `/agent` | `agent/page.tsx` | MOYEN | M | Boutons nav mois/semaine `h-8 w-8` (32px) l.300,306,359,369 ; chips de mission `text-[9px]` tronqués l.329-345 ; toggle Mois/Semaine ≈30px l.270-271. |
| `/agent/verifications` | `verifications/page.tsx` | **MAJEUR** | **L** | Icônes contact bailleur (appel/email/chat) `h-8 w-8` (32px) l.490,498,505-509 — **action critique terrain** sous 44px ; bouton suppression photo en hover-only (invisible au tactile, même bug qu'`ImageUploadZone`) l.346-352 ; textarea/champs 14px l.263,301,333,375 ; modale centrée non adaptée mobile (contrairement à la page détail) l.648-662 ; `input type="file"` sans `capture` l.368. |
| `/agent/verifications/[id]` | `verifications/[id]/page.tsx` | MOYEN | M | **Points positifs** : 3 CTA critiques (démarrer/certifier/décliner) déjà pleine largeur ≥44px l.316-347, modales déjà `items-end sm:items-center` l.353,413,442. **Problèmes** : icônes contact `h-9 w-9` (36px) l.268-278 ; même bug hover-only sur suppression photo l.375-378 ; textarea 14px l.363,420,449 ; aucun `navigator.geolocation` (lien Maps externe seulement, l.136-140,243-248) — pas de base réutilisable pour une future géolocalisation native. |
| `/agent/messages` | `messages/page.tsx` | MOYEN | S | `h-[calc(100vh-3.5rem)]` l.7 — même écart de 8px (constat 6). |
| `/agent/messages/[roomId]` | `messages/[roomId]/page.tsx` + `ChatRoom.tsx` | **MAJEUR** | **L** | 3ᵉ formule de hauteur différente des deux précédentes (constat 6) ; aucune gestion clavier virtuel ; bouton retour 32px l.135 ; input `text-sm` l.197. |
| `/agent/profil` | `profil/page.tsx` | MOYEN | M | Bouton édition avatar `h-7 w-7` (28px) l.167-172 ; bio/couverture `text-sm` l.220-236 ; `PhoneInput` (voir constat 10). |

### Espace admin (10 routes — traité en dernier par décision produit)

| Route | Fichier | Gravité | Effort | Problèmes précis |
|---|---|---|---|---|
| `/espace` | `espace/page.tsx` + `OverviewAnalytics.tsx` | MINEUR | S | Grilles déjà responsives (`grid-cols-2 lg:grid-cols-5/4`, `xl:grid-cols-3`) ; graphiques `height={220}` fixe, largeur fluide. |
| `/espace/users` | `users/page.tsx` | **MAJEUR** | **L** | Pas de `<table>` (confirmé) : grille de cartes. Boutons icône ~32px répétés 5-6× par carte l.318-346 ; pagination `h-8 w-8` l.379 ; 6 modales centrées via `Modal` local (pas `ConfirmModal` partagé) l.601 ; inputs 14px l.256,34,453,511,566. |
| `/espace/listings` | `listings/page.tsx` | MOYEN | M | Grille cartes déjà responsive l.293 ; boutons activer/suspendre/supprimer ~32px l.407-434 ; `ConfirmModal` centrée l.329. |
| `/espace/verifications` | `verifications/page.tsx` | **MAJEUR** | **L** | Modale d'assignation très lourde : centrée, contient une liste d'agents paginée imbriquée dans une modale `max-w-md` (l.395-466) — forte candidate à une refonte plein écran plutôt qu'un simple bottom sheet. Nombreux boutons ~32-34px l.625-678. |
| `/espace/subscriptions` | `subscriptions/page.tsx` | MOYEN | M | Boutons carte ~32px l.394-413 ; aucune confirmation modale sur suspendre/réactiver (action directe, hors-sujet mobile mais à signaler). |
| `/espace/bookings` | `bookings/page.tsx` | **MAJEUR** | **L** | 5 `ConfirmModal` centrées l.285-337 ; jusqu'à 4 boutons simultanés par carte en litige ~32-34px l.398-445 ; `BookingSearchRow`/`BookingPagination` partagés (14px / ~32-40px). |
| `/espace/reviews` | `reviews/page.tsx` | MINEUR | S | Page la plus simple (une seule action, suppression) ; modale centrée locale l.236. |
| `/espace/reports` | `reports/page.tsx` | MOYEN | M | Bon pattern déjà en place (`flex-col sm:flex-row` l.371) ; 3-4 boutons par carte ~32-34px l.328-356 ; `ConfirmModal` centrée l.230. |
| `/espace/communications` | `communications/page.tsx` | MINEUR | S | Déjà en colonne unique ; inputs/textarea/select 14px l.110,125,133 ; bouton d'envoi ≈40-42px (proche de la cible, pas garanti) l.143. |
| `/espace/config` | `config/page.tsx` | **MAJEUR** | **L** | Page la plus lourde à adapter : bloc d'actions d'en-tête sans `flex-wrap`, risque de débordement horizontal réel sous 375px (l.236) ; 3 modales réimplémentées localement (pas le composant partagé) l.609,685,748 ; incohérence de police : champs tarifaires en 16px mais champs PIN/OTP en 14px (l.455 vs 538,568,765,776). |

## Composants partagés — à créer ou à adapter pour le socle mobile

### À créer (n'existent pas encore)

| Composant | Rôle | Où l'intégrer sans toucher à ≥768px |
|---|---|---|
| `BottomNav` (variante publique) | Accueil/Annonces/Favoris/Messages/Compte | Dans `(public)/layout.tsx`, rendu conditionnel à un nouveau seuil <768px, imbriqué dans la zone déjà `lg:hidden` de `NavbarClient.tsx`. |
| `BottomNav` (variante par rôle) | 4 raccourcis selon rôle + menu « Plus » | Dans `DashboardShell.tsx`, même principe, imbriqué sous le `lg:hidden` existant (actuellement 1024px). |
| `BottomSheet` | Remplacement progressif des modales centrées | Composant générique à utiliser d'abord dans `ConfirmModal.tsx`, puis dans les modales locales listées au constat 4. |
| Mécanisme de réservation d'espace bas | Éviter que contenu/CTA passent sous la bottom nav + les éléments fixes existants | Généraliser le pattern `--cookie-banner-h` déjà utilisé par `CookieConsentBanner.tsx` à tous les éléments fixes bas (constat 3). |

### À adapter (existants)

- **`NavbarClient.tsx` / `DashboardShell.tsx`** — accueillir la nouvelle bottom nav sous 768px sans modifier le comportement `lg:` actuel.
- **`DemoDevBar.tsx`, `CookieConsentBanner.tsx`, `ToastProvider.tsx`, `ListingContactCard.tsx`** — repositionner au-dessus de la bottom nav sous 768px (constat 3).
- **`ConfirmModal.tsx`** — convertir en bottom sheet sous 768px ; traiter en parallèle les ~15 réimplémentations locales listées au constat 4 (chacune individuellement, car elles ne partagent pas de code commun).
- **`ImageUploadZone.tsx`** — remplacer le pattern hover-only par des actions toujours visibles ou un menu au tap. **Bug actuel**, indépendant du calendrier mobile.
- **`PhotoCropper.tsx` / `AvatarCropper.tsx`** — rendre le canvas responsive (débordement actuel sous 375px). **Bug actuel.**
- **`MessagesShell.tsx`** — déjà avancé (bascule à `md:`/768px) ; juste harmoniser avec la bottom nav.
- **`ChatRoom.tsx`** — recalculer la hauteur dynamiquement (`100dvh` + variables CSS pour topbar/bottom-nav), gérer le clavier virtuel, agrandir le bouton retour (32px→44px).
- **`AvailabilityCalendar.tsx`** — cases 36px → 44px.
- **`BookingSearchRow.tsx` / `BookingPagination.tsx`** — police 14px → 16px sur l'input, boutons 32-40px → 44px (bénéficie à 7 pages d'un coup : bookings/favorites/paiements/notifications × 3 rôles + admin).
- **`PhoneInput.tsx`** — police 16px ; clamper `left` à `window.innerWidth` en plus du `max-w-[90vw]` déjà présent (constat 10).
- **`.input-field` (`globals.css:186`)** — 14px → 16px, le correctif à plus fort effet de levier de tout l'audit.

### Pages les plus délicates (confirmées par l'audit)

1. `/publier` et `/bailleur/listings/[id]/edit` — les deux steppers à 6 étapes, partagent les mêmes composants à risque (`ImageUploadZone`, `LocationPicker`, `PhotoCropper`) : à corriger une fois, bénéfice double.
2. Messagerie (`MessagesShell`/`ChatRoom`, 3 formules de hauteur incohérentes, constat 6) — présente dans les 3 espaces connectés (locataire/bailleur/agent).
3. Tableaux/listes admin — pas de vrai `<table>` HTML nulle part (bonne nouvelle structurelle), mais `espace/config`, `espace/users`, `espace/verifications`, `espace/bookings` cumulent chacun plusieurs modales locales non partagées.
4. Fiche annonce publique (`/listings/[id]`) — découverte d'une 4ᵉ barre fixe bas d'écran (`ListingContactCard`) à coordonner impérativement avec la future bottom nav.
5. Carte Leaflet (`LocationPicker`/`MapView`) — gère bien le pan/pinch tactile nativement, mais toujours en conteneur `h-64` fixé par la page appelante (pas par le composant) : risque de conflit geste tactile/scroll de page, présent sur `/listings/[id]`, `/publier`, et le stepper d'édition bailleur.

## Lots proposés (un lot = un commit)

| # | Lot | Pages / composants | Effort | Risques principaux | Tests Vitest à prévoir |
|---|---|---|---|---|---|
| 0 | **Socle technique** (prérequis à tout le reste) | `.input-field` 16px, nouveau seuil <768px isolé des `lg:`/`md:` existants, harmonisation des 4 `fixed` bottom, composants `BottomNav`/`BottomSheet`, correctifs immédiats `ImageUploadZone` (hover-only) et `PhotoCropper` (débordement 375px — bugs actuels, pas seulement préparatoires) | L | Rayon d'impact énorme (`.input-field` touche quasi tous les formulaires) → repasser visuellement partout ≥768px après coup pour garantir zéro régression. | Tests unitaires du hook/utilitaire de détection de breakpoint si extrait ; tests de non-régression sur la suite existante (63 passés/1 skip à ce jour). |
| 1 | **Public — navigation, accueil, annonces, fiche annonce** | `/`, `/listings`, `/listings/[id]`, `/agences`, `/agences/[slug]`, `/search`, `/regions/[slug]`, `/favoris` | L | `ListingContactCard` a déjà sa propre barre fixe mobile → fusion ou coexistence à trancher avec la bottom nav (point à valider). | Si logique de prix/disponibilité extraite en JS pur, tests dédiés. |
| 2 | **Public — publication et compte** | `/publier`, `/profil`, `/profil/securite`, `/onboarding`, `/messages` (public) | L | Partage les composants du Lot 0 déjà corrigés (`ImageUploadZone`, `PhotoCropper`, `LocationPicker`) — vérifier la non-régression plutôt que recorriger. | Tests sur la validation du stepper si existants, à ne pas casser. |
| 3 | **Authentification et pages légales** | `/sign-in`, `/sign-up`, `/sso-callback`, `/accept-terms`, `/change-password`, `/redirect`, `/verification-admin`, pages légales (5) | M | Faible — bon lot « rapide » pour valider le socle avant les espaces connectés plus complexes. | — |
| 4 | **Espace locataire** | 9 pages locataire + `become-bailleur` + `notifications` | L | `locataire/bookings` très dense en modales/boutons (le plus gros fichier du lot) ; `VerificationQrModal` la modale la plus éloignée du pattern bottom-sheet. | Si la logique de filtrage réservations est extraite, tests dédiés. |
| 5 | **Espace bailleur et agence** | 14 pages bailleur/* | L | Le stepper d'édition réutilise les composants du Lot 0/2 — traiter après pour éviter un double correctif ; `bailleur/verifications` (1485 lignes) le fichier le plus lourd de tout l'audit. | — |
| 6 | **Espace agent de terrain** | 6 pages agent/* | M-L | Rôle qui utilise déjà le plus le mobile en situation réelle (terrain) — à prioriser indépendamment de l'ordre du tableau si le produit le souhaite (point à valider) ; bug hover-only sur suppression photo déjà présent aujourd'hui. | — |
| 7 | **Espace admin** (traité en dernier, comme décidé) | 10 pages espace/* | L | Plus gros volume de modales locales non partagées à convertir une par une (`users`, `verifications`, `bookings`, `config`) ; priorité produit la plus basse. | — |

## Points à valider (décisions produit, pas techniques)

1. **`ListingContactCard`** a déjà sa propre barre fixe mobile sur la fiche annonce — faut-il la fusionner avec la future bottom nav publique, ou les faire coexister empilées ?
2. **Défilement horizontal volontaire** (onglets stepper, chips de type de bien, vignettes photo, tableau de `/cookies`) : exception acceptée à la règle « aucun défilement horizontal », ou à supprimer aussi ?
3. **`PhotoCropper`** déborde déjà aujourd'hui sur un écran 375px (iPhone SE/mini) — bug actuel indépendant du chantier. Correctif immédiat hors lots, ou intégré au Lot 0/2 ?
4. **`ImageUploadZone`** : les actions photo (principale/ajuster/supprimer) sont invisibles au tactile dès aujourd'hui. Même question : fix immédiat hors lots, ou Lot 0/2 ?
5. **Priorité de l'espace agent terrain** : classé en position 6 par parcours logique, mais c'est le rôle qui travaille déjà le plus depuis un smartphone — faut-il l'avancer dans l'ordre réel des lots ?
6. **Double système de toast** (`ToastProvider` global + mécanisme local de `/bailleur/abonnement`) — unifié au Lot 0, ou laissé tel quel ?
7. **`espace/verifications`** (admin) : la modale d'assignation contient une liste d'agents paginée imbriquée — plutôt qu'un bottom sheet classique, faut-il prévoir un écran plein dédié mobile ?

## Limites de cet audit

- Pages connectées non capturées visuellement (aucune connexion contournée) — évaluation par lecture de code uniquement pour locataire/bailleur/agent/admin.
- Quelques composants secondaires non lus en détail par manque de temps, signalés explicitement par les sous-agents : `Skeleton.tsx` (admin), `MapViewInner.tsx` (comportement tactile détaillé de la carte sur la fiche annonce), `PhotoCropper.tsx` n'a été lu en détail que via le lot bailleur (confirmé dans le lot public comme « référencé, non lu » puis effectivement audité par le lot bailleur — pas de contradiction, juste une répartition du travail entre agents).
- Aucun test de performance (taille de bundle, temps de chargement réel sur réseau mobile) n'a été réalisé — hors périmètre de cette mission.

## Décisions validées

**Règle d'or :** tout changement, y compris les corrections de bogues actuels (`PhotoCropper`, `ImageUploadZone`), reste derrière `max-width: 767px` (media query ou variantes `max-md:`). L'affichage à partir de 768px reste identique en tout point, sans exception. S'applique aussi à `.input-field` : 16px uniquement sous 768px, inchangé à 14px à partir de 768px.

1. **Pages immersives** (fiche `/listings/[id]`, messagerie `/messages/[roomId]`, steppers `/publier` et édition d'annonce) : la `BottomNav` est masquée sur ces pages ; la barre de contact/actions déjà existante (ex. `ListingContactCard`) reste seule maîtresse du bas d'écran.
2. **Défilement horizontal volontaire accepté** pour les onglets, chips et vignettes (avec scroll-snap + indice visuel de contenu supplémentaire). Exception : le tableau de `/cookies` passe en liste de cartes sous 768px au lieu du défilement horizontal actuel.
3. **`PhotoCropper`** : canvas rendu adaptatif (plus de largeur fixe en pixels). Commit séparé, premier lot.
4. **`ImageUploadZone`** : actions photo (principale/ajuster/supprimer) rendues toujours visibles sous `@media (hover: none)` ; comportement au survol sur PC inchangé. Même commit de lot que le point 3, ou un commit voisin du même lot.
5. **Priorité revue** : l'espace agent de terrain est avancé juste après le public dans l'ordre des lots (au lieu d'après bailleur/agence).
6. **Toasts** : pas d'unification du mécanisme (`ToastProvider` global vs système local de `/bailleur/abonnement`) — le PC ne change pas. Sous 768px uniquement, `ToastProvider`, la bannière cookies, `DemoDevBar` et `ListingContactCard` se repositionnent au-dessus de la barre de navigation du bas.
7. **Admin — modale d'assignation d'agent** (`espace/verifications`) : convertie en écran plein (bottom sheet pleine hauteur) sur mobile, plutôt qu'un bottom sheet classique.

### Lots révisés (remplacent la section « Lots proposés » ci-dessus)

| # | Lot | Contenu |
|---|---|---|
| 0a | Correctifs immédiats | `ImageUploadZone` (actions toujours visibles sous `hover: none`), `PhotoCropper` (canvas adaptatif), `.input-field` 16px sous 768px uniquement, viewport + safe-area, remise à niveau des zones tactiles <44px — tout derrière `max-width: 767px`. |
| 0b | Socle navigation | `BottomNav` publique et par rôle, masquage sur les pages immersives (décision 1), empilement des éléments fixes au-dessus de la barre du bas (décision 6). |
| 0c | Socle modales | `BottomSheet` générique + migration de `ConfirmModal`. |
| 0d | PWA | Manifeste, icônes, mode standalone, page hors connexion — sans cache des pages connectées ni de l'API. |
| 1 | Auth et légales | `/sign-in`, `/sign-up`, `/sso-callback`, pages légales, `/accept-terms`, `/change-password`, `/redirect`, `/verification-admin`. |
| 2 | Public | `/`, `/listings`, `/listings/[id]`, `/agences`, `/agences/[slug]`, `/search`, `/regions/[slug]`, `/favoris`. |
| 3 | Publication et compte | `/publier`, `/profil`, `/profil/securite`, `/onboarding`, `/messages`. |
| 4 | Agent de terrain | Les 6 pages `agent/*` (avancé selon la décision 5). |
| 5 | Locataire | Les 9 pages `locataire/*` + `become-bailleur` + `notifications`. |
| 6 | Bailleur et agence | Les 14 pages `bailleur/*`. |
| 7 | Admin | Les 10 pages `espace/*`, dont l'écran plein d'assignation d'agent (décision 7). |

### Contrôle PC à chaque lot

À chaque lot, refaire les captures à 1440px et 1024px des pages publiques et les comparer pixel par pixel aux captures `pc-*.png` de référence (`rapports-mobile/captures/`). Tout écart détecté sur une zone non concernée par le lot bloque le commit.
