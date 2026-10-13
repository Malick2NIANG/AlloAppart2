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

## Plus tard (non bloquant)

- [ ] Ajouter des tests unitaires pour le rejet de montant incohérent sur les webhooks réservations, abonnements et AlloVérifié (déjà couvert pour le boost).
- [ ] Élargir la couverture de tests (Backend et Frontend) au-delà des premiers tests.
- [ ] Décider si la page détail d'une annonce en brouillon ou archivée doit être réservée à son propriétaire (aujourd'hui elle s'ouvre pour quiconque connaît l'URL).
- [ ] Page Annonces : ajouter un tri et des filtres prix / pièces (l'API et le Backend sont à vérifier) ; filtre « à vendre » sur la vitrine d'agence.
- [ ] Barre de contact mobile d'une annonce en vente : ajouter SMS à côté de WhatsApp / Appeler.
- [ ] Suggestion automatique de la ville à la publication (non implémenté).
- [ ] Authentifier `gh` sur la machine de dev (`gh auth login`) pour éviter la limite de 60 requêtes/heure en suivant la CI.
- [ ] Migration Google Maps abandonnée (coût) : on garde Leaflet / OpenStreetMap (contours des régions : geoBoundaries ADM1, licence CC BY 3.0 IGO, attribution affichée sur la carte).
