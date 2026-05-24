import ChatRoom from '@/components/messages/ChatRoom';

export default async function BailleurMessageRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <ChatRoom roomId={roomId} backUrl="/bailleur/messages" />;
}
