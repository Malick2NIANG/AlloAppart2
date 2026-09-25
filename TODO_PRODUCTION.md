# À faire avant la mise en production — AlloAppart

Checklist technique avant déploiement et retest en conditions réelles. Les démarches administratives (déclaration de société, NINEA, etc.) sont suivies séparément.

> Le commit + push du travail en cours n'est pas listé ici : c'est fait en parallèle, indépendamment de cette checklist.

## Qualité de code

- [x] **Eslint test** — eslint complet passé sur l'intégralité du Backend (`{src,apps,libs,test}/**/*.ts`) et du Frontend (`npm run lint`) : 0 erreur, 0 warning des deux côtés.
- [ ] **Code review** — relecture du code (soi-même à froid, ou une autre paire d'yeux) sur les zones sensibles : paiements, authentification, permissions par rôle, webhooks.
- [ ] **Unit test** — élargir la couverture de tests automatisés. Le Backend a 17 fichiers `.spec.ts` ; le Frontend n'en a aucun actuellement (vérifié uniquement par tsc/eslint + tests manuels).

## Sécurité

- [ ] **Security review** — relecture des points listés dans `SECURITY.md` (RLS non applicable / contrôle au niveau applicatif, gestion des mots de passe via Clerk) + vérifier qu'aucune clé, token ou secret n'est commité dans le dépôt.
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
