import ChatRoom from '@/components/messages/ChatRoom';

export default async function LocataireMessageRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <ChatRoom roomId={roomId} backUrl="/locataire/messages" />;
}
