'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  roomId: string;
  basePath: string;
}

/**
 * Remplace ChatRoom.tsx : cette route (/.../messages/[roomId]) est toujours
 * atteinte par une navigation fraîche (ex. ListingContactCard), jamais
 * depuis la liste elle-même (qui utilise ?room= sur MessagesShell). Plutôt
 * que de dupliquer l'interface de conversation, on bascule immédiatement
 * vers MessagesShell avec la même room — son propre effet de bootstrap
 * insère déjà la liste dans l'historique pour ce cas (lien direct ?room=
 * sans entrée « liste » préalable), donc le retour système fonctionne sans
 * logique supplémentaire ici.
 */
export default function MessageRoomRedirect({ roomId, basePath }: Props) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`${basePath}?room=${roomId}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redirection unique au montage
  }, []);

  return (
    <div className="flex items-center justify-center py-20">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
    </div>
  );
}
