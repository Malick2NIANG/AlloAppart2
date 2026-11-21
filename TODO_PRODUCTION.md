# À faire avant la mise en production — AlloAppart

Seul ce qui reste à faire est listé ici (mis à jour le 2026-10-13). Le code, les tests (Frontend 63, Backend : suite complète verte en CI), la CI et les audits `npm` en production (0 vulnérabilité) sont à jour et poussés sur `develop` (dernier commit : `619484e`). Voir `DEPLOY.md` pour le détail pas-à-pas.

## Démarches administratives

- [ ] **Mettre à jour les mentions légales (NINEA/RCCM)** une fois l'immatriculation APIX obtenue (tâche #38).

## Infrastructure

- [ ] Réserver le nom de domaine `alloappart.sn` (bureau accrédité NIC Sénégal).
- [ ] Créer le VPS Hetzner (CPX41, décidé le 2026-09-26) et pointer le DNS.
- [ ] Remplir `.env.prod` à partir de `.env.prod.example` et lancer `docker compose -f docker-compose.prod.yml up -d --build`.
- [ ] Appliquer les migrations Prisma en prod : `docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy` (47 migrations, dont `add_listing_sale_mode` et `add_boost_payment_amount`), **plus 2 nouvelles migrations du lot « mobile/push » à inclure dans ce même `migrate deploy`** : `20261120140303_add_push_subscriptions` et `20261120160000_add_listing_image_originals`.
- [ ] Vérifier l'obtention du certificat HTTPS (Caddy / Let's Encrypt) — **obligatoire pour les notifications push** : l'API Web Push (`navigator.serviceWorker` + `PushManager.subscribe`) est indisponible dans un navigateur hors contexte sécurisé (HTTPS), le push ne fonctionnera pas tant que le certificat n'est pas actif.
- [ ] Définir les variables d'environnement du push natif (Web Push/VAPID) dans `.env.prod` (noms seulement, valeurs générées séparément — voir `DEPLOY.md`) : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- [ ] Reconfigurer les webhooks externes vers les URLs de prod (Clerk, PayDunya, et tout callback Cloudinary/Twilio existant).

## Bascule en mode production

- [ ] Basculer Clerk en clés **Live** (`sk_live_...`, `pk_live_...`) au lieu des clés de test.
- [ ] Basculer PayDunya en clés **Live** au lieu du sandbox.
- [ ] Créer/renseigner les comptes tiers manquants dans `.env.prod` : Cloudinary (photos), Twilio (WhatsApp), SMTP.
- [ ] Remplacer l'expéditeur e-mail actuel (compte Gmail de dev) par `noreply@alloappart.sn` (`SMTP_FROM` et config SMTP dans `.env.prod`). L'envoi réel avec nodemailer 10.1.0 a été validé le 2026-10-13.
- [ ] **Controlled Live session** — une fois basculé en Live, session de test contrôlée avant l'ouverture publique : un vrai petit paiement PayDunya de bout en bout (webhook/callback inclus), un compte de chaque rôle (locataire, bailleur, agence, agent terrain, admin), les flux critiques (réservation, messagerie, AlloVérifié, notifications, vente directe : publication d'un terrain en brouillon puis publié, modification, page détail avec Appeler/SMS/WhatsApp, cohérence région ↔ carte à la publication).

## Sécurité

- [ ] Relancer `npm audit --omit=dev` (Backend et Frontend) juste avant la mise en ligne : de nouveaux avis peuvent apparaître.
- [ ] **Mettre à jour Next.js** (avis de sécurité signalé par le serveur de dev sur la version actuelle, 16.4.0) : `next upgrade --agent=security`, à faire après le chantier mobile avec la suite de tests complète et les contrôles pixel, avant la mise en ligne.
- [ ] Backend : des `overrides` du `package.json` forcent des versions corrigées de `multer`, `body-parser`, `follow-redirects` et `fast-uri` (version majeure 3.x pour ce dernier) parce que `@nestjs/platform-express` épingle `multer` à une version vulnérable ; les retirer dès qu'une version de NestJS corrige ces dépendances, puis relancer `npm audit`.
- [ ] Scan applicatif type OWASP ZAP une fois en staging.
- [ ] Surveiller `braces` (5 alertes dev-only côté Frontend, via `eslint-config-next` ; aucun correctif publié) et `npm audit` Backend une fois Prisma 8 stable publié (les overrides `deepmerge-ts`, `mysql2`, `js-yaml`, `argparse` pourront alors être retirés).

## Sauvegardes

- [ ] Activer le cron du script `scripts/backup-postgres.sh` (backup quotidien, rétention 14j).
- [ ] Brancher un stockage externe (Hetzner Storage Box ou S3-compatible via `rclone`) — le script actuel garde les backups sur le même disque que le VPS, donc aucune vraie protection si le serveur tombe.

## Performance

- [ ] Lancer le test de charge k6 (`scripts/load-test.js`) contre la prod, montée progressive (20 VUs puis 100 VUs). But : valider que le CPX41 tient le trafic visé. Si CPU/RAM sature, upgrade vers le tier au-dessus (simple, sans migration de données).

## Après bascule

- [ ] Recharger le crédit API Anthropic avant d'activer les fonctionnalités IA (actuellement bloquées faute de crédit).
- [ ] Retest manuel complet, rôle par rôle, une fois tout en ligne.

## Fin du chantier mobile

- [ ] **Supprimer les données de test du chantier mobile** (état après les lots 6a/6b — les tests en session réelle de ces deux lots ont été nettoyés après coup, rien à ajouter à la liste ci-dessous ; reste à compléter après le lot 7) :
  - 4 comptes Clerk de dev (`aa-test-locataire`, `aa-test-bailleur`, `aa-test-agence`, `aa-test-agent` `+clerk_test@example.com`) — à supprimer côté Clerk (dashboard dev) et leur ligne `users` correspondante en base de dev.
  - 1 compte Clerk ADMIN de dev (`nmalick166+admin-test@gmail.com`, ajouté au lot 7 — audit « style application mobile ») — à supprimer côté Clerk et sa ligne `users` correspondante. `ADMIN_TEST_EMAIL` (Backend/.env) à retirer en même temps.
  - 4 comptes Clerk ADMIN orphelins trouvés en base pendant le lot 7, `aa.admin.<timestamp>+clerk_test@example.com` (rôles `{LOCATAIRE,ADMIN}`), restes d'une tentative antérieure — leur domaine `@example.com` ne peut recevoir le code 2FA, donc inutilisables en l'état ; à supprimer (Clerk + base) ou à garder sciemment, à trancher.
  - 2 annonces de test : `a4c4b7be-a3e5-4493-a879-d0b0a67d9b93` (« TEST QA — Appartement de test », compte BAILLEUR) et `b10922c2-adc1-46ea-827d-2f6c3d4539cc` (« TEST QA — Studio agence », compte PRO_AGENCE) — leur suppression entraîne en cascade réservations/vérifications/rooms liées.
  - 6 réservations de test sur `a4c4b7be…` (statuts PENDING/CONFIRMED/COMPLETED/CANCELLED/DISPUTED), avec 1 avis (review) et des reçus PDF associés.
  - 3 vérifications AlloVérifié de test sur `b10922c2…` (une DONE historique, deux menées en conditions réelles jusqu'à DONE).
  - 2 conversations de test (`message_rooms`) : locataire↔bailleur et agent↔bailleur (cette dernière créée directement en base, aucun flux UI n'ajoutant normalement un agent à une conversation).
  - 1 abonnement PRO de test sur le compte PRO_AGENCE (`subscriptions`, à retirer si le compte lui-même n'est pas supprimé).
  - 3 notifications de test pour le compte LOCATAIRE.
  - 1 favori ajouté par le compte LOCATAIRE sur une annonce **réelle** (pas une annonce de test) — à retirer de ses favoris, ne pas supprimer l'annonce.
  - Retirer `allowedDevOrigins` de `Frontend/next.config.ts` (`git checkout -- Frontend/next.config.ts`) ; supprimer `Frontend/rapports-mobile/tools/.credentials.env` et `Frontend/rapports-mobile/tools/.sessions/`.
  - **Nom d'agence du compte de test PRO_AGENCE** (`aa-test-agence+clerk_test@example.com`, ci-dessus) : `agencyName` = « Agence Test AlloAppart » — visible publiquement (fiches annonces, vitrine) tant que le compte n'est pas supprimé.
  - **Comptes de test E2E supplémentaires trouvés en base (lot « recette », 2026-11-21), non documentés jusqu'ici** — aucun mot de passe listé ici, uniquement des identifiants. Créés par les scripts `Frontend/rapports-mobile/tools/provision-test-accounts.mjs`/`assign-test-roles.mjs` au fil des sessions de test E2E (motif `aa.<role>.<timestamp>+clerk_test@example.com`) :
    - `aa.locataire.1787425731399`, `aa.locataire.1787454317707`, `aa.locataire.1789935119612`, `aa.bailleur.1789933827378`, `aa.bailleur.1787421221236`, `aa.debug.1787421468`, `aa.bailleur.1787421555897`, `aa.bailleur.1789932157520`, `aa.bailleur.1789934476667`, `aa.bailleur.1789935119612`, `aa.bailleur.1789936096519`, `aa.locataire.1789936096519`, `aa.admin.1789936096519`, `aa.admin.1789936884230`, `aa.bailleur.1789936884230`, `aa.locataire.1789936884230`, `aa.locataire.1789938623251`, `aa.bailleur.1789938229287`, `aa.bailleur.1789938623251`, `aa.admin.1789938623251`, `aa.bailleur.1789940408468`, `aa.locataire.1789940408468`, `aa.admin.1789940408468`, `aa.bailleur.1789946365769`, `aa.locataire.1789946365769`, `aa.admin.1789946365769` (26 comptes, tous `+clerk_test@example.com`) — à supprimer côté Clerk (dashboard dev) et en base (`users`).
  - **Annonces de test E2E supplémentaires liées aux comptes ci-dessus, non documentées jusqu'ici** : « Appartement Test E2E 1789935119612 » (`a9b9a2de-75cf-4798-ae5e-b25ba9bef1b2`), « Appartement Test E2E 1789936096519 » (`1972cf50-c5b2-45dc-a473-679b2a7df2f5`), « Appartement Test E2E 1789936884230 » (`c5a6c83a-8b90-4ec2-bc8d-c5eadf0f63a4`), « Appartement Test E2E 1789938623251 » (`fe77bf9d-175a-4635-95f4-885a8913a27f`), « Appartement Test E2E 1789940408468 » (`3271dbfd-58f2-4642-a117-5b98e759a32c`), « Appartement Test E2E 1789946365769 » (`ce7b8797-5e34-4dee-8bad-d5657b9061c0`) — suppression en cascade des réservations/vérifications/rooms éventuellement liées, comme pour les 2 annonces « TEST QA » déjà listées.
- [ ] Si une règle de pare-feu Windows dédiée au dev (ports 3000/4000) a été créée pendant les tests smartphone, la supprimer (vérifié le 2026-10-24 : aucune règle de ce type trouvée actuellement — rien à faire pour l'instant, voir point smartphone ci-dessous) ; supprimer le worktree de référence (`git worktree remove C:\Users\HP\AppData\Local\Temp\aa-ref-1fc624c`).
- [ ] **Tests à faire sur un vrai smartphone.** Adresse Wi-Fi du PC passée à `192.168.1.4` (nouvelle box) ; `.env.local`/`next.config.ts` à jour, Docker/Backend/Frontend tous vérifiés OK le 2026-10-24 (`http://192.168.1.4:3000`, `http://192.168.1.4:3000/sign-in`, `http://192.168.1.4:4000/api/v1/listings` → 200). **Point bloquant probable restant : le réseau Wi-Fi est sur le profil Windows « Public »**, et aucune règle de pare-feu entrante n'autorise explicitement les ports 3000/4000 (vérifié par dump complet des règles ; énumération détaillée refusée sans droits admin). À faire : soit ajouter une règle entrante (PowerShell admin, ex. `New-NetFirewallRule -DisplayName "AlloAppart dev 3000 et 4000" -Direction Inbound -LocalPort 3000,4000 -Protocol TCP -Action Allow -Profile Public`), soit passer le réseau en profil Privé, puis retester depuis le téléphone. Parcours à couvrir une fois la connexion établie : modifier une annonce à travers les 6 étapes puis enregistrer ; créer puis annuler une demande AlloVérifié ; archiver puis restaurer une annonce ; ouvrir une conversation avec le clavier ; parcours complet bailleur, locataire, agent, admin ; installation de la PWA ; effet du glissement de la feuille du bas.
- [ ] Supprimer les captures du chantier mobile (`Frontend/rapports-mobile/captures/`, environ 262 Mo, ignorées par git) une fois les tests sur smartphone terminés.
- [ ] Bouton « Installer l'app » (PWA) dans le menu « Plus ».

## Plus tard (non bloquant)

- [ ] Ajouter des tests unitaires pour le rejet de montant incohérent sur les webhooks réservations, abonnements et AlloVérifié (déjà couvert pour le boost).
- [ ] Élargir la couverture de tests (Backend et Frontend) au-delà des premiers tests.
- [ ] Décider si la page détail d'une annonce en brouillon ou archivée doit être réservée à son propriétaire (aujourd'hui elle s'ouvre pour quiconque connaît l'URL).
- [ ] Page Annonces : ajouter un tri et des filtres prix / pièces (l'API et le Backend sont à vérifier) ; filtre « à vendre » sur la vitrine d'agence.
- [ ] Barre de contact mobile d'une annonce en vente : ajouter SMS à côté de WhatsApp / Appeler.
- [ ] Suggestion automatique de la ville à la publication (non implémenté) — `city` reste un champ texte libre dans `Frontend/src/app/(public)/publier/page.tsx` (`region` est en liste fermée, pas `city`) ; 78 % des valeurs `city` en base ne correspondent à aucune ville canonique de `regions.ts` (cf. rapport Milo lot 2, `Frontend/rapports-milo/PLAN_SEARCH_V0.md` § 1.d) — `Backend/src/milo/places/quartiers.ts` (quartiers réels, lot 2b) est une base de départ possible pour les suggestions.
- [ ] Nettoyer les valeurs `city` parasites en base (ex. « Grand standing », qui n'est pas une ville — erreur de saisie repérée via le rapport Milo lot 2).
- [ ] Authentifier `gh` sur la machine de dev (`gh auth login`) pour éviter la limite de 60 requêtes/heure en suivant la CI.
- [ ] Migration Google Maps abandonnée (coût) : on garde Leaflet / OpenStreetMap (contours des régions : geoBoundaries ADM1, licence CC BY 3.0 IGO, attribution affichée sur la carte).
