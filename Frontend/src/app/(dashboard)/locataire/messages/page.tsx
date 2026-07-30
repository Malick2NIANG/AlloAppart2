import { getTranslations } from 'next-intl/server';
import MessagesShell from '@/components/messages/MessagesShell';

export default async function LocataireMessagesPage() {
  const t = await getTranslations('locataire');
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] overflow-hidden">
      <MessagesShell emptyHint={t('messagesEmptyHint')} space="locataire" />
    </div>
  );
}
