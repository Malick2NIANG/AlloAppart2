import { getTranslations } from 'next-intl/server';
import MessagesShell from '@/components/messages/MessagesShell';

export default async function AgentMessagesPage() {
  const t = await getTranslations('agent');
  return (
    // Sous 768px : la vraie topbar mobile fait 4rem (DashboardShell.tsx),
    // pas 3.5rem (topbar desktop) — écart de 8px identifié à l'audit (constat
    // 6). 100dvh tient compte du clavier virtuel ; --bottom-offset réserve la
    // place de la barre de navigation du bas (visible ici, page non
    // immersive) + l'encoche. Inchangé ≥768px.
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] max-md:h-[calc(100dvh-4rem-var(--bottom-offset,0))] overflow-hidden">
      <MessagesShell emptyHint={t('messagesEmptyHint')} space="agent" />
    </div>
  );
}
