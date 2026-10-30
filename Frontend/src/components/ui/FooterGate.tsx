'use client';

import { usePathname } from 'next/navigation';

/**
 * Masque le pied de page sous 768px sur la messagerie publique (/messages) :
 * comme dans une application de messagerie, la page occupe tout l'écran et
 * n'a pas de pied de page. Sans effet à partir de 768px, ni sur les autres
 * pages (le contenu est rendu tel quel).
 */
export default function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMessages = pathname === '/messages' || pathname.startsWith('/messages/');
  return isMessages ? <div className="max-md:hidden">{children}</div> : <>{children}</>;
}
