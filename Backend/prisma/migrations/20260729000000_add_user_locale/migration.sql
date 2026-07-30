-- Ajout de la langue de communication de l'utilisateur.
-- Utilisée par mail.service, sms.service et notifications.service pour choisir
-- la langue des emails, SMS et notifications in-app.
-- Défaut 'fr' : le Sénégal est le marché principal, et les comptes existants
-- ont tous été créés avant l'introduction de l'anglais.

ALTER TABLE "users" ADD COLUMN "locale" VARCHAR(5) NOT NULL DEFAULT 'fr';
