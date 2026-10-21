import { auth } from '@clerk/nextjs/server';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import type { User } from '@/types';
import MessagesShell from '@/components/messages/MessagesShell';

export default async function BailleurMessagesPage() {
  const t = await getTranslations('bailleur');
  const { getToken } = await auth();
  const token = await getToken();

  // Compte dual bailleur+locataire → boîte de réception unique et partagée
  // (cf. décision du 2026-09-25) : pas de badge "Espace Bailleur", trompeur
  // puisque cette page affiche aussi les conversations côté locataire.
  let isDual = false;
  if (token) {
    const me = await api.get<User>('/auth/me', token).catch(() => null);
    isDual = !!me?.roles.includes('LOCATAIRE') && !!me?.roles.some((r) => r === 'BAILLEUR' || r === 'PRO_AGENCE');
  }

  return (
    // Sous 768px : la vraie topbar mobile fait 4rem (DashboardShell.tsx),
    // pas 3.5rem (topbar desktop) — écart de 8px identifié à l'audit (constat
    // 6). 100dvh tient compte du clavier virtuel ; --bottom-offset réserve la
    // place de la barre de navigation du bas (visible ici, page non
    // immersive) + l'encoche. Inchangé ≥768px.
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] max-md:h-[calc(100dvh-4rem-var(--bottom-offset,0))] overflow-hidden">
      <MessagesShell emptyHint={t('messagesEmptyHint')} space={isDual ? undefined : 'bailleur'} />
    </div>
  );
}
