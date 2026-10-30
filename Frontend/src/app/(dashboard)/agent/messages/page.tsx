import { getTranslations } from 'next-intl/server';
import MessagesShell from '@/components/messages/MessagesShell';

export default async function AgentMessagesPage() {
  const t = await getTranslations('agent');
  return (
    // Sous 768px : la vraie topbar mobile fait 4rem (DashboardShell.tsx),
    // pas 3.5rem (topbar desktop) — écart de 8px déjà corrigé ici. 100dvh
    // tient compte du clavier virtuel ; --bottom-offset réserve la place de
    // la barre de navigation du bas (visible ici, page non immersive) +
    // l'encoche.
    // 768-1023px (tablette, lot messagerie mobile) : la topbar DashboardShell
    // reste à 4rem jusqu'à 1024px (`lg:hidden`, pas `md:hidden`) — seule la
    // VRAIE largeur PC (≥1024px, topbar `lg:flex` à 3.5rem) correspond au
    // calc précédent, utilisé par erreur dès 768px (écart de 8px, deux
    // panneaux légèrement trop hauts). lg: ci-dessous corrige sans toucher
    // au calc existant <768px ni à la vraie largeur PC.
    <div className="-m-4 sm:-m-6 lg:-m-8 md:h-[calc(100vh-4rem)] lg:h-[calc(100vh-3.5rem)] max-md:h-[calc(100dvh-4rem-var(--bottom-offset,0))] overflow-hidden">
      <MessagesShell emptyHint={t('messagesEmptyHint')} space="agent" />
    </div>
  );
}
