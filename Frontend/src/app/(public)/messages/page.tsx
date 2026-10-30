'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import MessagesShell from '@/components/messages/MessagesShell';

function VisitorGate({ t }: { t: ReturnType<typeof useTranslations<'messages'>> }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gold-pale ring-4 ring-gold/20">
        <i className="fa-solid fa-comments text-3xl text-gold-dark" />
      </div>
      <h2 className="text-2xl font-extrabold text-text">{t('visitorTitle')}</h2>
      <p className="mt-3 max-w-sm text-sm text-sub">{t('visitorDesc')}</p>
      <Link href="/sign-in" className="btn-gold mt-8 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
        <i className="fa-solid fa-arrow-right-to-bracket" /> {t('signIn')}
      </Link>
    </div>
  );
}

/**
 * Messagerie publique — lot « messagerie mode application » : réutilise
 * MessagesShell (mêmes fonctions que les espaces bailleur/locataire/agent :
 * non-lus, archivage, vocal, temps réel Soketi, ?room=, séparateurs de
 * date…) au lieu de l'ancienne implémentation dédiée qui n'avait aucune de
 * ces fonctions et ouvrait toujours la première conversation (jamais la
 * liste sur mobile). ?room=, VisitorGate et BOTTOM_NAV_TOGGLE_EVENT
 * conservés — ce dernier est géré par MessagesShell lui-même.
 */
export default function MessagesPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const t = useTranslations('messages');

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <main className="py-10 px-4 bg-bg min-h-screen">
        <div className="aa-container max-w-5xl">
          <VisitorGate t={t} />
        </div>
      </main>
    );
  }

  return (
    // ≥768px (tablette ET PC, NavbarClient.tsx ne varie pas entre les deux :
    // h-20 partout à partir de 768px) : calc(100vh - 80px), pas 64px comme
    // l'ancienne implémentation le supposait à tort (constat confirmé par
    // capture — la navbar publique mesure réellement 80px dès 768px, jamais
    // 64px). Sous 768px : la navbar publique fait 3.5rem (max-md:h-14, lot
    // 2a) ; 100dvh tient compte du clavier virtuel ; --bottom-offset réserve
    // la place de la barre de navigation du bas + l'encoche.
    <main className="bg-bg h-[calc(100vh-80px)] max-md:h-[calc(100dvh-3.5rem-var(--bottom-offset,0))]">
      <div className="aa-container max-w-5xl h-full py-6 px-4">
        <MessagesShell emptyHint={t('noRoomsHint')} />
      </div>
    </main>
  );
}
