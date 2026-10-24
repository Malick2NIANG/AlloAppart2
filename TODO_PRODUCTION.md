# À faire avant la mise en production — AlloAppart

Seul ce qui reste à faire est listé ici (mis à jour le 2026-10-13). Le code, les tests (Frontend 63, Backend : suite complète verte en CI), la CI et les audits `npm` en production (0 vulnérabilité) sont à jour et poussés sur `develop` (dernier commit : `619484e`). Voir `DEPLOY.md` pour le détail pas-à-pas.

## Démarches administratives

- [ ] **Mettre à jour les mentions légales (NINEA/RCCM)** une fois l'immatriculation APIX obtenue (tâche #38).

## Infrastructure

- [ ] Réserver le nom de domaine `alloappart.sn` (bureau accrédité NIC Sénégal).
- [ ] Créer le VPS Hetzner (CPX41, décidé le 2026-09-26) et pointer le DNS.
- [ ] Remplir `.env.prod` à partir de `.env.prod.example` et lancer `docker compose -f docker-compose.prod.yml up -d --build`.
- [ ] Appliquer les migrations Prisma en prod : `docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy` (47 migrations, dont `add_listing_sale_mode` et `add_boost_payment_amount`).
- [ ] Vérifier l'obtention du certificat HTTPS (Caddy / Let's Encrypt).
- [ ] Reconfigurer les webhooks externes vers les URLs de prod (Clerk, PayDunya, et tout callback Cloudinary/OneSignal/Twilio existant).

## Bascule en mode production

- [ ] Basculer Clerk en clés **Live** (`sk_live_...`, `pk_live_...`) au lieu des clés de test.
- [ ] Basculer PayDunya en clés **Live** au lieu du sandbox.
- [ ] Créer/renseigner les comptes tiers manquants dans `.env.prod` : Cloudinary (photos), OneSignal (push), Twilio (WhatsApp), SMTP.
- [ ] Remplacer l'expéditeur e-mail actuel (compte Gmail de dev) par `noreply@alloappart.sn` (`SMTP_FROM` et config SMTP dans `.env.prod`). L'envoi réel avec nodemailer 10.1.0 a été validé le 2026-10-13.
- [ ] **Controlled Live session** — une fois basculé en Live, session de test contrôlée avant l'ouverture publique : un vrai petit paiement PayDunya de bout en bout (webhook/callback inclus), un compte de chaque rôle (locataire, bailleur, agence, agent terrain, admin), les flux critiques (réservation, messagerie, AlloVérifié, notifications, vente directe : publication d'un terrain en brouillon puis publié, modification, page détail avec Appeler/SMS/WhatsApp, cohérence région ↔ carte à la publication).

## Sécurité

- [ ] Relancer `npm audit --omit=dev` (Backend et Frontend) juste avant la mise en ligne : de nouveaux avis peuvent apparaître.
- [ ] **Mettre à jour Next.js** (avis de sécurité signalé par le serveur de dev sur la version actuelle, 16.4.0) : `next upgrade --agent=security`, à faire après le chantier mobile avec la suite de tests complète et les contrôles pixel, avant la mise en ligne.
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
  - 2 annonces de test : `a4c4b7be-a3e5-4493-a879-d0b0a67d9b93` (« TEST QA — Appartement de test », compte BAILLEUR) et `b10922c2-adc1-46ea-827d-2f6c3d4539cc` (« TEST QA — Studio agence », compte PRO_AGENCE) — leur suppression entraîne en cascade réservations/vérifications/rooms liées.
  - 6 réservations de test sur `a4c4b7be…` (statuts PENDING/CONFIRMED/COMPLETED/CANCELLED/DISPUTED), avec 1 avis (review) et des reçus PDF associés.
  - 3 vérifications AlloVérifié de test sur `b10922c2…` (une DONE historique, deux menées en conditions réelles jusqu'à DONE).
  - 2 conversations de test (`message_rooms`) : locataire↔bailleur et agent↔bailleur (cette dernière créée directement en base, aucun flux UI n'ajoutant normalement un agent à une conversation).
  - 1 abonnement PRO de test sur le compte PRO_AGENCE (`subscriptions`, à retirer si le compte lui-même n'est pas supprimé).
  - 3 notifications de test pour le compte LOCATAIRE.
  - 1 favori ajouté par le compte LOCATAIRE sur une annonce **réelle** (pas une annonce de test) — à retirer de ses favoris, ne pas supprimer l'annonce.
  - Retirer `allowedDevOrigins` de `Frontend/next.config.ts` (`git checkout -- Frontend/next.config.ts`) ; supprimer `Frontend/rapports-mobile/tools/.credentials.env` et `Frontend/rapports-mobile/tools/.sessions/`.
- [ ] Si une règle de pare-feu Windows dédiée au dev (ports 3000/4000) a été créée pendant les tests smartphone, la supprimer (vérifié le 2026-10-24 : aucune règle de ce type trouvée actuellement — rien à faire pour l'instant, voir point smartphone ci-dessous) ; supprimer le worktree de référence (`git worktree remove C:\Users\HP\AppData\Local\Temp\aa-ref-1fc624c`).
- [ ] **Tests à faire sur un vrai smartphone.** Adresse Wi-Fi du PC passée à `192.168.1.4` (nouvelle box) ; `.env.local`/`next.config.ts` à jour, Docker/Backend/Frontend tous vérifiés OK le 2026-10-24 (`http://192.168.1.4:3000`, `http://192.168.1.4:3000/sign-in`, `http://192.168.1.4:4000/api/v1/listings` → 200). **Point bloquant probable restant : le réseau Wi-Fi est sur le profil Windows « Public »**, et aucune règle de pare-feu entrante n'autorise explicitement les ports 3000/4000 (vérifié par dump complet des règles ; énumération détaillée refusée sans droits admin). À faire : soit ajouter une règle entrante (PowerShell admin, ex. `New-NetFirewallRule -DisplayName "AlloAppart dev 3000 et 4000" -Direction Inbound -LocalPort 3000,4000 -Protocol TCP -Action Allow -Profile Public`), soit passer le réseau en profil Privé, puis retester depuis le téléphone. Parcours à couvrir une fois la connexion établie : modifier une annonce à travers les 6 étapes puis enregistrer ; créer puis annuler une demande AlloVérifié ; archiver puis restaurer une annonce ; ouvrir une conversation avec le clavier ; parcours complet bailleur, locataire, agent, admin ; installation de la PWA ; effet du glissement de la feuille du bas.
- [ ] Bouton « Installer l'app » (PWA) dans le menu « Plus ».

## Plus tard (non bloquant)

- [ ] Ajouter des tests unitaires pour le rejet de montant incohérent sur les webhooks réservations, abonnements et AlloVérifié (déjà couvert pour le boost).
- [ ] Élargir la couverture de tests (Backend et Frontend) au-delà des premiers tests.
- [ ] Décider si la page détail d'une annonce en brouillon ou archivée doit être réservée à son propriétaire (aujourd'hui elle s'ouvre pour quiconque connaît l'URL).
- [ ] Page Annonces : ajouter un tri et des filtres prix / pièces (l'API et le Backend sont à vérifier) ; filtre « à vendre » sur la vitrine d'agence.
- [ ] Barre de contact mobile d'une annonce en vente : ajouter SMS à côté de WhatsApp / Appeler.
- [ ] Suggestion automatique de la ville à la publication (non implémenté).
- [ ] Authentifier `gh` sur la machine de dev (`gh auth login`) pour éviter la limite de 60 requêtes/heure en suivant la CI.
- [ ] Migration Google Maps abandonnée (coût) : on garde Leaflet / OpenStreetMap (contours des régions : geoBoundaries ADM1, licence CC BY 3.0 IGO, attribution affichée sur la carte).
