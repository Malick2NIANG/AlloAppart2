# À faire avant la mise en production — AlloAppart

Checklist technique avant déploiement et retest en conditions réelles. Les démarches administratives (déclaration de société, NINEA, etc.) sont suivies séparément.

> Le commit + push du travail en cours n'est pas listé ici : c'est fait en parallèle, indépendamment de cette checklist.

## Qualité de code

- [x] **Eslint test** — eslint complet passé sur l'intégralité du Backend (`{src,apps,libs,test}/**/*.ts`) et du Frontend (`npm run lint`) : 0 erreur, 0 warning des deux côtés.
- [x] **Code review — paiements (PayDunya)** — les 4 flux (réservations, abonnements PRO_AGENCE, AlloVérifié, boost) vérifient le hash de signature en `timingSafeEqual` et re-confirment toujours le statut auprès de PayDunya (jamais le payload webhook comme source de vérité). Faille trouvée et corrigée (commit `2427f4b`, CI verte run [36197557443](https://github.com/Malick2NIANG/AlloAppart2/actions/runs/36197557443)) : seul le webhook réservations comparait le montant reçu au montant attendu ; les 3 autres ne le faisaient pas, ce qui aurait permis de confirmer un paiement avec un token PayDunya valide mais d'un montant différent. Contrôle de montant ajouté partout. **Limite connue (boost uniquement) :** `BoostPayment` n'a pas de colonne `amount`, donc la vérification compare au tarif *courant* plutôt qu'au tarif au moment du paiement — si l'admin change le prix du boost pendant qu'un paiement est en attente, ce paiement légitime à l'ancien prix serait rejeté (échec sûr, pas une faille : le bailleur peut relancer). À corriger proprement plus tard via une migration ajoutant `amount` à `BoostPayment`. Aucun test unitaire n'a été ajouté pour couvrir le rejet de montant incohérent sur les 3 handlers corrigés.
- [x] **Code review — auth (Clerk + 2FA admin)** — JWT Clerk vérifié cryptographiquement (signature + expiration), ordre des guards correct, routes `admin-mfa/*` sans bypass possible (rôle revérifié côté service), OTP hashé/salé/à usage unique/throttlé. Deux points mineurs relevés puis corrigés (commit `b844397`, CI verte run [36199317614](https://github.com/Malick2NIANG/AlloAppart2/actions/runs/36199317614)) : verrouillage anti-brute-force par compte admin (5 échecs → 15 min de blocage, indépendant du throttle par IP contournable) et purge quotidienne des OTP/sessions expirés.
- [x] **Code review — permissions par rôle (guards) et webhooks** — tous les webhooks recensés (4 PayDunya + Clerk), toutes les routes `@Public()` passées en revue (rien de sensible exposé), IDOR vérifié par échantillonnage (listings, messages, verifications) : ownership systématiquement contrôlée côté service. Rien à corriger.
- [x] **Unit test (Frontend, premiers tests)** — mise en place de Vitest (`npm test`), 3 fichiers / 30 tests sur les fonctions pures les plus à risque : `utils.ts` (formatage prix/date, détection email placeholder Clerk), `bookingStatus.ts` (couverture des 9 statuts, aucun oublié), `agencyColors.ts` (repli sur "gold" par défaut). Ajouté à la CI (`npm test` dans le job Frontend). `vitest@3.2.7` installé plutôt que `5.x` : la v5 exige `@types/node` ≥22 (projet en ^20) et l'upgrade a buté sur un problème d'écriture sur le node_modules monté en sandbox — non résolu ici, **à retenter sur une vraie machine**. `npm audit` révèle 1 vulnérabilité modérée dev-only dans `@vitest/mocker` (path traversal, corrigée en v5) : sans impact production (outil de test, jamais exécuté en prod/CI de build), acceptée en attendant l'upgrade v5. Backend : 17 fichiers `.spec.ts`, 262 tests, déjà en place. Couverture encore à élargir des deux côtés (au-delà de ces premiers tests).

## Sécurité

- [x] **Security review** — relecture de `SECURITY.md` face à l'implémentation réelle (RLS non applicable confirmé par grep, aucun champ password en base, pas de route de login custom, `PATCH /auth/me/password` bien gardée par `mustChangePassword` + throttle 5/min) : aucune correction nécessaire. Recherche de secrets commités : aucun `.env` réel jamais commité (historique git complet vérifié), aucune clé Clerk/AWS/Twilio/Cloudinary en dur dans le code, seul secret de dev trouvé (`DEV_FALLBACK_VERIFICATION_SECRET`) est explicitement non-sécurisé par nom et bloqué en production par une exception.
- [x] **Vulnérability test (npm audit)** — Frontend à 0 vulnérabilité (Next.js RCE critique corrigée via 16.3.6, sharp, js-yaml). Backend passé de 12 à 4 (nodemailer, multer, qs, fast-uri, js-yaml corrigés ; Prisma aligné en 7.10.0). Les 4 restantes (`deepmerge-ts`/`@prisma/config`/`mysql2`) sont des dépendances du CLI Prisma, pas sur le chemin des requêtes API — acceptées en attendant une release stable de Prisma 8. **À revérifier `npm audit` Backend une fois Prisma 8 stable publié.** CI verte sur commit `3a7173a` (run [36195849716](https://github.com/Malick2NIANG/AlloAppart2/actions/runs/36195849716)).
- [ ] **Vulnérability test (scan applicatif)** — scan type OWASP ZAP une fois en staging.

## Bascule en mode production

- [ ] Basculer Clerk en clés **Live** (`sk_live_...`, `pk_live_...`) au lieu des clés de test.
- [ ] Basculer PayDunya en clés **Live** au lieu du sandbox.
- [ ] Créer/renseigner les comptes tiers manquants dans `.env.prod` : Cloudinary (photos), OneSignal (push), Twilio (WhatsApp), SMTP (`noreply@alloappart.sn`).
- [ ] **Controlled Live session** — une fois basculé en Live, faire une session de test contrôlée en conditions réelles avant l'ouverture publique : un vrai petit paiement PayDunya de bout en bout (webhook/callback inclus), un compte de chaque rôle (locataire, bailleur, agence, agent terrain, admin), les flux critiques (réservation, messagerie, AlloVérifié, notifications).

## Infrastructure (voir `DEPLOY.md` pour le détail pas-à-pas)

- [ ] Réserver le nom de domaine `alloappart.sn` (bureau accrédité NIC Sénégal).
- [ ] Créer le VPS Hetzner (CPX21 pour démarrer) et pointer le DNS.
- [ ] Remplir `.env.prod` à partir de `.env.prod.example` et lancer `docker compose -f docker-compose.prod.yml up -d --build`.
- [ ] Appliquer les migrations Prisma en prod (`npx prisma migrate deploy`).
- [ ] Vérifier l'obtention du certificat HTTPS (Caddy / Let's Encrypt).
- [ ] Reconfigurer les webhooks externes vers les URLs de prod (Clerk, PayDunya, et tout callback Cloudinary/OneSignal/Twilio existant).

## Sauvegardes

- [ ] Activer le cron du script `scripts/backup-postgres.sh` (backup quotidien, rétention 14j).
- [ ] Brancher un stockage externe (Hetzner Storage Box ou S3-compatible via `rclone`) — le script actuel garde les backups sur le même disque que le VPS, donc aucune vraie protection si le serveur tombe.

## Performance

- [ ] Lancer le test de charge k6 (`scripts/load-test.js`) contre la prod, montée progressive (20 VUs puis 100 VUs). Si CPU/RAM sature, upgrade vers CPX31.

## Après bascule

- [ ] Recharger le crédit API Anthropic avant d'activer les fonctionnalités IA (actuellement bloquées faute de crédit).
- [ ] Retest manuel complet, rôle par rôle, une fois tout en ligne.
