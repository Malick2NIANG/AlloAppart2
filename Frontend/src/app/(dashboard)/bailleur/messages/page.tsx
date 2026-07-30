import { getTranslations } from 'next-intl/server';
import MessagesShell from '@/components/messages/MessagesShell';

export default async function BailleurMessagesPage() {
  const t = await getTranslations('bailleur');
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] overflow-hidden">
      <MessagesShell emptyHint={t('messagesEmptyHint')} space="bailleur" />
    </div>
  );
}
