'use client';

import { useParams } from 'next/navigation';
import MessageRoomRedirect from '@/components/messages/MessageRoomRedirect';

export default function AgentMessageRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  return <MessageRoomRedirect roomId={roomId} basePath="/agent/messages" />;
}
