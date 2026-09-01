# Déploiement production — AlloAppart

Ce document est le guide pas-à-pas pour mettre AlloAppart en ligne sur `alloappart.sn`. Les étapes marquées **[TOI]** impliquent un compte, un paiement ou une action irréversible et doivent être exécutées personnellement. Les étapes marquées **[MOI]** sont déjà faites (fichiers de ce dépôt) ou peuvent être copiées-collées telles quelles.

---

## 0. Vue d'ensemble de la stack

7 conteneurs Docker derrière un seul reverse-proxy HTTPS :

```
Internet ──► Caddy (80/443) ──► frontend (Next.js, port 3000 interne)
                            ├──► backend  (NestJS,  port 4000 interne)
                            └──► soketi   (WebSocket temps réel, port 6001 interne)
                                    │
                    backend ──► postgres, redis, meilisearch (réseau interne uniquement)
```

Seul Caddy est exposé sur Internet. Tout le reste communique en interne. HTTPS est automatique (Let's Encrypt), géré par Caddy.

---

## 1. [TOI] Réserver le nom de domaine alloappart.sn

`alloappart.sn` est **disponible** (vérifié sur le whois officiel `https://whois.cctld.sn`).

Le `.sn` est un ccTLD géré par NIC Sénégal — l'achat ne se fait pas via un registrar international classique (Namecheap, OVH grand public, etc.) mais via un **bureau d'enregistrement accrédité NIC Sénégal**.

1. Va sur **https://www.nicsenegal.sn/** et cherche la liste des bureaux d'enregistrement accrédités (rubrique partenaires/registrars), ou contacte NIC Sénégal directement (`nic@nic.sn`, tel. 33 821 91 90) s'ils ne publient pas de liste claire.
2. Coût indicatif : ~10 000 FCFA/an pour un `.sn` de premier niveau.
3. Demande explicitement l'enregistrement de **`alloappart.sn`** (pas `.com.sn` ni une variante).
4. Une fois le domaine enregistré, tu auras accès à une interface pour gérer les enregistrements DNS (zone DNS). Garde ces identifiants — tu en auras besoin à l'étape 3.

> Si le bureau d'enregistrement choisi ne permet pas de gérer soi-même la zone DNS, demande-leur de pointer les enregistrements de l'étape 3 pour toi.

---

## 2. [TOI] Créer le serveur (VPS Hetzner)

1. Crée un compte sur **https://www.hetzner.com/cloud/** si ce n'est pas déjà fait.
2. Crée un nouveau projet, puis un serveur :
   - **Type** : CPX21 (3 vCPU partagés, 4 Go RAM, 80 Go NVMe, ~9,49 €/mois, 20 To de trafic inclus)
   - **Image** : Ubuntu 24.04
   - **Localisation** : Falkenstein ou Nuremberg (Allemagne) — la plus proche pour la latence Europe/Afrique de l'Ouest
   - **Clé SSH** : ajoute ta clé publique SSH (recommandé) plutôt qu'un mot de passe
3. Note l'**adresse IP publique** du serveur une fois créé — elle sera nécessaire à l'étape 3.

> Note capacité : le CPX21 (4 Go RAM) est suffisant pour démarrer (7 conteneurs légers), mais si tu vois de la RAM saturée après le test de charge (étape 7), passe au **CPX31** (8 Go RAM, ~15 €/mois) — c'est un simple redimensionnement dans l'interface Hetzner, sans réinstallation.

---

## 3. [TOI] Pointer le DNS vers le VPS

Dans l'interface DNS de ton bureau d'enregistrement (ou celle fournie par NIC Sénégal), crée ces enregistrements :

| Type | Nom | Valeur                    |
|------|-----|---------------------------|
| A    | @   | `<IP_DU_VPS>`             |
| A    | www | `<IP_DU_VPS>`             |
| A    | api | `<IP_DU_VPS>`             |

Propagation DNS : de quelques minutes à quelques heures. Vérifie avec `nslookup alloappart.sn` avant de continuer.

---

## 4. [TOI + MOI] Connexion au serveur et installation de Docker

Connecte-toi en SSH :
```bash
ssh root@<IP_DU_VPS>
```

Installe Docker + Docker Compose (script officiel) :
```bash
curl -fsSL https://get.docker.com | sh
```

Vérifie :
```bash
docker --version
docker compose version
```

---

## 5. [TOI + MOI] Cloner le projet et configurer les secrets

Sur le serveur :
```bash
git clone https://github.com/<ton-compte>/<ton-repo>.git allo-appart
cd allo-appart
cp .env.prod.example .env.prod
nano .env.prod   # ou vim — remplir TOUTES les valeurs
```

Variables à remplir dans `.env.prod` (voir le fichier pour la liste complète et les commandes `openssl` pour générer les secrets aléatoires) :
- `POSTGRES_PASSWORD`, `MEILI_MASTER_KEY`, `SOKETI_APP_KEY`, `SOKETI_APP_SECRET` → génère-les avec `openssl rand -base64 32` / `openssl rand -hex 20`
- `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → dashboard Clerk, bascule en **mode Live** (pas test) avant de copier les clés
- `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN` → dashboard PayDunya, clés **Live**
- `CLOUDINARY_*`, `ONESIGNAL_*`, `TWILIO_*`, `SMTP_*` → tes comptes existants
- `FRONTEND_URL` / `BACKEND_URL` sont déjà pré-remplis avec les bonnes valeurs `https://alloappart.sn` / `https://api.alloappart.sn`

**Ne colle jamais ces clés dans le chat avec moi** — remplis-les directement sur le serveur.

---

## 6. [TOI] Lancer la stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Premier démarrage : build des images (~5-10 min). Caddy va automatiquement demander un certificat Let's Encrypt pour `alloappart.sn`, `www.alloappart.sn` et `api.alloappart.sn` dès que le DNS pointe correctement vers le serveur.

Applique les migrations Prisma (une fois les conteneurs démarrés) :
```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

Vérifie que tout tourne :
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy   # vérifier l'obtention du certificat HTTPS
```

Teste dans un navigateur : `https://alloappart.sn` et `https://api.alloappart.sn/api/v1/listings`.

### Configurer les webhooks externes vers la nouvelle URL de prod
Une fois en ligne, mets à jour dans chaque dashboard externe :
- **Clerk** → webhook URL : `https://api.alloappart.sn/api/v1/webhooks/clerk`
- **PayDunya** → callback/IPN URL : `https://api.alloappart.sn/api/v1/payments/webhook/paydunya` (+ les webhooks boost/abonnement équivalents)
- **Cloudinary**, **OneSignal**, **Twilio** : mets à jour si des URLs de callback y sont configurées.

---

## 7. [TOI + MOI] Backup automatique Postgres

Le script `scripts/backup-postgres.sh` fait un `pg_dump` compressé quotidien avec rétention de 14 jours.

Rends-le exécutable et teste-le manuellement une fois :
```bash
chmod +x scripts/backup-postgres.sh
./scripts/backup-postgres.sh
```

Programme-le en cron pour tourner chaque nuit à 3h :
```bash
crontab -e
```
Ajoute :
```
0 3 * * * cd /root/allo-appart && ./scripts/backup-postgres.sh >> /var/log/allo-backup.log 2>&1
```

**Important — résilience réelle** : ce script garde les backups sur le même disque que le VPS. Si le VPS tombe en panne ou est supprimé, les backups locaux sont perdus aussi. Pour une vraie protection, copie régulièrement `backups/` vers un stockage externe, par exemple avec `rclone` vers un Hetzner Storage Box (~4€/mois) ou un bucket S3-compatible. Dis-moi si tu veux que je prépare ce script rclone une fois que tu as choisi le stockage externe.

---

## 8. Test de charge (k6)

Le script `scripts/load-test.js` simule des visiteurs qui parcourent les annonces (endpoint public le plus sollicité).

Installer k6 (sur ta machine locale, pas sur le VPS — pour ne pas fausser le test avec la charge du test lui-même) :
```bash
# macOS
brew install k6
# Linux (Debian/Ubuntu)
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

Lancer contre la prod, montée progressive prudente d'abord :
```bash
k6 run -e BASE_URL=https://api.alloappart.sn -e FRONTEND_URL=https://alloappart.sn -e VUS=20 -e DURATION=1m scripts/load-test.js
```

Si les seuils passent (95% des requêtes < 800ms, moins de 1% d'erreurs), augmente progressivement :
```bash
k6 run -e BASE_URL=https://api.alloappart.sn -e FRONTEND_URL=https://alloappart.sn -e VUS=100 -e DURATION=2m scripts/load-test.js
```

Pendant le test, surveille la consommation du VPS dans un autre terminal SSH :
```bash
docker stats
```

Si la RAM ou le CPU sature avant d'atteindre un trafic réaliste pour ton lancement, c'est le signal pour passer au CPX31 (voir étape 2).

---

## 9. Après le déploiement

- Le déploiement n'est pas figé : tu peux corriger du code et redéployer à tout moment avec `git pull && docker compose -f docker-compose.prod.yml up -d --build`.
- Les migrations Prisma futures s'appliquent avec la même commande qu'à l'étape 6.
- Pour voir les logs d'un service : `docker compose -f docker-compose.prod.yml logs -f backend` (remplace `backend` par `frontend`, `caddy`, etc.)
- Recharge le crédit API Anthropic avant d'activer les 6 fonctionnalités IA d'AlloAI (bloqué actuellement, voir mémoire projet).
