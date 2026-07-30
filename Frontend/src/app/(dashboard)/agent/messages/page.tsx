import { getTranslations } from 'next-intl/server';
import MessagesShell from '@/components/messages/MessagesShell';

export default async function AgentMessagesPage() {
  const t = await getTranslations('agent');
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] overflow-hidden">
      <MessagesShell emptyHint={t('messagesEmptyHint')} space="agent" />
    </div>
  );
}
