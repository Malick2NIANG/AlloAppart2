# Récupération des accès Administrateur — Allo-Appart

> **CONFIDENTIEL** — Ne jamais committer ce fichier avec des données réelles.  
> Conserver une copie chiffrée hors du dépôt (gestionnaire de mots de passe, coffre-fort numérique).

---

## Architecture de sécurité du compte admin

- Le rôle `ADMIN` **ne peut pas être attribué via l'API**. Aucun endpoint n'écrit `ADMIN` dans le tableau `roles`.
- L'attribution se fait **uniquement en SQL direct** sur la base PostgreSQL.
- Le compte admin est **protégé contre la suspension et la suppression** au niveau du service (`target.roles.includes(Role.ADMIN)` → `ForbiddenException`).
- L'authentification passe par **Clerk** (JWT), pas par un mot de passe stocké en base.

---

## Niveau 1 — Mot de passe oublié (flux standard)

> Utiliser en priorité. Ne nécessite aucun accès technique.

1. Aller sur `/sign-in` de l'application.
2. Cliquer **"Mot de passe oublié"**.
3. Saisir l'adresse email du compte admin.
4. Clerk envoie un **code OTP à usage unique** à cet email.
5. Saisir le code → définir un nouveau mot de passe.
6. Connexion automatique.

**Prérequis** : accès à la boîte email du compte admin.

---

## Niveau 2 — Perte d'accès à l'email (tableau de bord Clerk)

> Si l'email du compte admin est lui-même inaccessible.

1. Se connecter sur [https://dashboard.clerk.com](https://dashboard.clerk.com) avec le compte Anthropic/organisation propriétaire du projet.
2. Sélectionner le projet **Allo-Appart**.
3. Aller dans **Users** → rechercher le compte admin (par nom ou clerkId).
4. Options disponibles :
   - **Forcer la réinitialisation du mot de passe** (Clerk envoie un lien de reset).
   - **Modifier l'adresse email principale** du compte (puis utiliser le Niveau 1).
   - **Supprimer et recréer** le compte Clerk si nécessaire (voir Niveau 3 pour rattacher le rôle).

**Prérequis** : accès au dashboard Clerk (identifiants de l'organisation).

---

## Niveau 3 — Récupération totale (accès SQL direct)

> En dernier recours, si le compte Clerk est perdu ou corrompu.

### Étape A — Créer un nouveau compte Clerk

1. Créer un compte sur l'application (inscription classique → rôle `LOCATAIRE` par défaut).
2. Récupérer le `clerkId` du nouveau compte depuis le dashboard Clerk (format `user_xxxxxxxxxxxxxxxxxxxxxxxx`).

### Étape B — Attribuer le rôle ADMIN en SQL

Se connecter à la base PostgreSQL de production et exécuter :

```sql
-- Attribuer le rôle ADMIN (remplacer le clerkId)
UPDATE users
SET roles = ARRAY['ADMIN']::"Role"[]
WHERE "clerkId" = 'user_xxxxxxxxxxxxxxxxxxxxxxxx';

-- Vérification
SELECT id, email, roles, "isSuspended"
FROM users
WHERE "clerkId" = 'user_xxxxxxxxxxxxxxxxxxxxxxxx';
```

> Pour ajouter ADMIN sans écraser les autres rôles existants :
> ```sql
> UPDATE users
> SET roles = array_append(roles, 'ADMIN'::"Role")
> WHERE "clerkId" = 'user_xxxxxxxxxxxxxxxxxxxxxxxx'
>   AND NOT (roles @> ARRAY['ADMIN']::"Role"[]);
> ```

### Étape C — Rétrograder l'ancien compte si nécessaire

```sql
-- Retirer le rôle ADMIN de l'ancien compte
UPDATE users
SET roles = array_remove(roles, 'ADMIN'::"Role")
WHERE "clerkId" = 'user_ancien_clerk_id';
```

---

## Informations à conserver hors du dépôt

Stocker les éléments suivants dans un gestionnaire de mots de passe sécurisé (Bitwarden, 1Password, etc.) :

| Information | Valeur |
|---|---|
| Email du compte admin | *(à renseigner)* |
| clerkId du compte admin | *(à renseigner — format `user_xxx`)* |
| URL Clerk Dashboard | https://dashboard.clerk.com |
| URL base de données production | *(dans `.env.production` — ne pas écrire ici)* |

---

## Attribution initiale du rôle ADMIN (première installation)

Après le premier déploiement, pour attribuer le rôle ADMIN au compte fondateur :

```sql
-- Trouver l'utilisateur par email
SELECT id, "clerkId", email, roles FROM users WHERE email = 'votre@email.com';

-- Attribuer ADMIN
UPDATE users
SET roles = ARRAY['ADMIN']::"Role"[]
WHERE email = 'votre@email.com';
```

---

## Rappel sécurité

- Ne jamais partager les identifiants Clerk ou base de données par email ou messagerie non chiffrée.
- Changer le mot de passe du compte admin immédiatement après toute procédure de récupération.
- Auditer les logs Clerk après toute récupération pour détecter un accès non autorisé.
- Ce fichier ne doit **jamais** contenir de valeurs réelles de clerkId, email ou mot de passe.
