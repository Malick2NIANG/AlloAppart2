'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { MessageRoom } from '@/types';
import { SkeletonListRow } from '@/components/ui/Skeleton';

export default function LocataireMessagesPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<MessageRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getToken().then((token) => {
      if (!token) { setLoading(false); return; }
      api.get<MessageRoom[]>('/messages/rooms', token)
        .then(setRooms)
        .catch(() => setError('Impossible de charger les messages.'))
        .finally(() => setLoading(false));
    });
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonListRow key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{error}</p>
        <button onClick={load} className="mt-4 btn-gold text-sm">
          <i className="fa-solid fa-rotate-right mr-1.5" />Réessayer
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Messages</h1>
        <p className="mt-1 text-sm text-sub">{rooms.length} conversation{rooms.length > 1 ? 's' : ''}</p>
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-comment-dots text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">Aucune conversation</p>
          <p className="mt-1 text-sm text-sub">Contactez un bailleur depuis une annonce pour démarrer.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onClick={() => router.push(`/locataire/messages/${room.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onClick }: { room: MessageRoom; onClick: () => void }) {
  const lastMsg = room.messages?.[0];
  const hasUnread = lastMsg && !lastMsg.readAt;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-line bg-card p-4 flex items-center gap-4 hover:border-gold-dark/40 hover:bg-gold-pale/20 transition-colors text-left"
    >
      <div className="relative shrink-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-pale">
          <i className="fa-solid fa-comment-dots text-gold-dark text-lg" />
        </div>
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-gold-dark border-2 border-bg" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate ${hasUnread ? 'font-semibold text-text' : 'font-medium text-text'}`}>
          {room.listing?.title ?? room.listingId}
        </p>
        <p className="text-sm text-sub truncate mt-0.5">
          {lastMsg ? lastMsg.content : 'Démarrez la conversation'}
        </p>
      </div>
      {lastMsg && (
        <p className="text-[11px] text-sub shrink-0 self-start mt-0.5">
          {formatTime(lastMsg.createdAt)}
        </p>
      )}
      <i className="fa-solid fa-chevron-right text-sub text-xs shrink-0" />
    </button>
  );
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}
