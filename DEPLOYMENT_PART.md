# Où en est le déploiement — AlloAppart

Non, pas encore en production — le code est prêt, mais rien n'est déployé. Voici où on en est exactement.

## Terminé (tout le travail côté code)

- Qualité de code : eslint, code reviews (paiements, auth, permissions/webhooks), premiers tests unitaires Frontend — tout vert.
- Sécurité : SECURITY.md conforme, recherche de secrets, npm audit nettoyé (Frontend 0 vulnérabilité, Backend 4 acceptées).
- CI verte sur tous les commits récents.

## Ce qui reste, dans l'ordre logique

1. **Créer l'entreprise (APIX/RCCM)** — en cours du côté de Malick, nécessaire pour obtenir des clés PayDunya en vrai (Live), pas en sandbox.
2. **Scan OWASP ZAP** — dernier test de sécurité, à faire une fois en staging (pas encore fait).
3. **Bascule en mode Live** — remplacer les clés de test par les vraies : Clerk, PayDunya, plus créer les comptes Cloudinary/OneSignal/Twilio/SMTP en prod.
4. **Infrastructure** — réserver `alloappart.sn`, créer le VPS Hetzner (**CPX41**, décidé le 2026-09-26), lancer `docker compose`, appliquer les migrations, vérifier HTTPS, reconfigurer les webhooks vers les URLs de prod.
5. **Sauvegardes** — activer le cron de backup + brancher le stockage externe (Storage Box).
6. **Test de montée en charge (k6)** — `scripts/load-test.js`, montée progressive (20 VUs puis 100 VUs) contre les endpoints publics une fois en staging/prod. C'est ce test qui valide si le CPX41 tient réellement le trafic visé, pas juste sa fiche technique — étape à ne pas sauter avant l'ouverture publique. Si CPU/RAM sature, upgrade vers un tier au-dessus (changement facile chez Hetzner, sans migration de données).
7. **Session Live contrôlée** — un vrai petit paiement PayDunya de bout en bout (webhook/callback inclus), un compte de chaque rôle (locataire, bailleur, agence, agent terrain, admin), les flux critiques (réservation, messagerie, AlloVérifié, notifications). À faire ensemble avant l'ouverture publique.
8. **Recharger le crédit API Anthropic** (pour les fonctionnalités IA, actuellement bloquées) + retest manuel complet une fois en ligne.
9. **Mettre à jour les mentions légales NINEA/RCCM** une fois les papiers reçus (cf. `TODO_PRODUCTION.md` et tâche dédiée).

## En résumé

Le développement et l'audit qualité/sécurité sont finis, mais le déploiement lui-même n'a pas commencé. C'est une étape à part entière, pas juste "appuyer sur un bouton" — il reste du vrai travail (VPS, DNS, clés Live, tests en conditions réelles, test de charge) avant l'ouverture au public.

## Budget retenu

- Serveur : **Hetzner CPX41** (8 vCPU, 16 Go RAM, 240 Go NVMe, ~27,25€/mois).
- Budget total disponible : 500 000 FCFA.
- Estimation année 1 tout compris (formalités APIX/RCCM + domaine `.sn` + hébergement CPX41 + backup Storage Box 1 To) : ~345 000 à ~405 000 FCFA (centré ~355 000 FCFA), laissant ~95 000 à ~155 000 FCFA de marge de sécurité sur les 500 000.
- Années suivantes (sans les frais de création) : ~255 000 FCFA/an récurrent (domaine + hébergement CPX41 + backup).
- Clerk, Cloudinary et OneSignal restent gratuits tant que l'usage reste sous leurs paliers gratuits respectifs (50 000 MAU / 25 Go / 1 000 MAU) — non comptés dans ce total.
- Coûts variables non-fixes à part : commissions PayDunya (~2-3 % + frais opérateur Wave/Orange Money) et messages WhatsApp Twilio, proportionnels à l'usage réel, pas un forfait.
