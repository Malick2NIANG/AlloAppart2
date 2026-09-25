import { auth } from '@clerk/nextjs/server';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import type { User } from '@/types';
import MessagesShell from '@/components/messages/MessagesShell';

export default async function LocataireMessagesPage() {
  const t = await getTranslations('locataire');
  const { getToken } = await auth();
  const token = await getToken();

  // Compte dual bailleur+locataire → boîte de réception unique et partagée
  // (cf. décision du 2026-09-25) : pas de badge "Espace Locataire", trompeur
  // puisque cette page affiche aussi les conversations côté bailleur.
  let isDual = false;
  if (token) {
    const me = await api.get<User>('/auth/me', token).catch(() => null);
    isDual = !!me?.roles.includes('LOCATAIRE') && !!me?.roles.some((r) => r === 'BAILLEUR' || r === 'PRO_AGENCE');
  }

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] overflow-hidden">
      <MessagesShell emptyHint={t('messagesEmptyHint')} space={isDual ? undefined : 'locataire'} />
    </div>
  );
}
