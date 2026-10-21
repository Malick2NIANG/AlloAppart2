import ChatRoom from '@/components/messages/ChatRoom';

export default async function BailleurMessageRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return (
    // Sous 768px : annule le padding du <main> (que la liste compense déjà
    // via ces mêmes classes, contrairement à cette page jusqu'ici — bug
    // identifié à l'audit) et donne à ChatRoom la pleine hauteur utile
    // (100dvh − en-tête mobile 4rem ; route immersive, barre du bas masquée,
    // donc rien d'autre à soustraire). Inchangé ≥768px.
    <div className="max-md:-m-4 max-md:h-[calc(100dvh-4rem)] max-md:overflow-hidden">
      <ChatRoom roomId={roomId} backUrl="/bailleur/messages" />
    </div>
  );
}
