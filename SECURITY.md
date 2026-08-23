# Notes de sécurité — AlloAppart

Document vivant : notes d'architecture sécurité et décisions prises lors de la revue pré-production (2026-08).

## Row Level Security (RLS) — non applicable

RLS (sécurité au niveau des lignes Postgres) est pertinent dans des architectures où le client (frontend, mobile) se connecte **directement** à la base de données (ex: Supabase + PostgREST). Ce n'est **pas** le cas ici :

- Le Frontend ne contient aucune connexion directe à Postgres (`DATABASE_URL` n'existe que dans `Backend/.env`, jamais référencé côté Frontend — vérifié par grep).
- Le port Postgres (`5433:5432` dans `docker-compose.yml`) n'est exposé que pour le développement local (accès outils/migrations depuis la machine hôte), jamais accessible publiquement en production.
- Tout accès aux données passe exclusivement par l'API NestJS (`Backend/src`), qui applique ses propres contrôles d'autorisation au niveau applicatif : guards (`ClerkAuthGuard`, `@Roles`), et vérifications d'ownership explicites dans chaque service (cf. revue IDOR du 2026-08-23 sur 9 modules).

**Conclusion** : la sécurité des données repose sur la couche applicative (NestJS), pas sur des policies RLS Postgres. Si un jour un accès direct à la base est introduit (ex: dashboard analytics branché directement sur Postgres), RLS redeviendra pertinent et devra être réévalué à ce moment-là.

## Authentification et mots de passe

- Aucun mot de passe n'est stocké dans la base AlloAppart (confirmé : aucun champ `password`/`passwordHash` dans `prisma/schema.prisma`, seul un booléen `mustChangePassword` existe).
- L'authentification (connexion, création de session) est intégralement déléguée à Clerk — pas de route de login custom côté Backend.
- La route `PATCH /auth/me/password` (changement de mot de passe) ne sert qu'au changement forcé du mot de passe temporaire des comptes créés par un admin (agents terrain, agences) — gardée par un check `mustChangePassword === true` et throttlée à 5/min depuis le 2026-08-23. Un changement de mot de passe volontaire doit passer par l'UI Clerk elle-même.
