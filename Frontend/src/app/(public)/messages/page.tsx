'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { MessageRoom, Message } from '@/types';

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

function avatarInitials(firstName?: string, lastName?: string) {
  return `${(firstName ?? '?')[0]}${(lastName ?? '')[0] ?? ''}`.toUpperCase();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 24) return d.toLocaleTimeString('fr-SN', { hour: '2-digit', minute: '2-digit' });
  if (diffH < 48) return 'Hier';
  return d.toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' });
}

export default function MessagesPage() {
  const { isSignedIn, getToken, userId } = useAuth();
  const t = useTranslations('messages');
  const searchParams = useSearchParams();
  const preSelectedRoomId = searchParams.get('room');

  const [mounted, setMounted] = useState(false);
  const [rooms, setRooms] = useState<MessageRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<MessageRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRoomsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingMsgsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard pattern
  useEffect(() => { setMounted(true); }, []);

  const loadRooms = useCallback(async () => {
    if (!isSignedIn) return;
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<MessageRoom[]>('/messages/rooms', token);
      setRooms(data);
      return data;
    } catch {
      return undefined;
    }
  }, [isSignedIn, getToken]);

  const loadMessages = useCallback(async (roomId: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<Message[]>(`/messages/rooms/${roomId}`, token);
      // API returns desc order, reverse for display
      setMessages([...data].reverse());
    } catch {
      // ignore
    }
  }, [getToken]);

  const markRead = useCallback(async (roomId: string) => {
    const token = await getToken();
    if (!token) return;
    await api.post(`/messages/rooms/${roomId}/read`, {}, token).catch(() => {});
  }, [getToken]);

  // Load rooms on mount + poll every 10s
  useEffect(() => {
    if (!isSignedIn || !mounted) return;

    const init = async () => {
      setLoadingRooms(true);
      const data = await loadRooms();
      setLoadingRooms(false);

      if (data && data.length > 0) {
        const target = preSelectedRoomId
          ? data.find((r) => r.id === preSelectedRoomId) ?? data[0]
          : data[0];
        setActiveRoom(target);
      }
    };

    init();

    pollingRoomsRef.current = setInterval(loadRooms, 10000);
    return () => { if (pollingRoomsRef.current) clearInterval(pollingRoomsRef.current); };
  }, [isSignedIn, mounted, loadRooms, preSelectedRoomId]);

  // Load messages + poll every 4s when activeRoom changes
  useEffect(() => {
    if (!activeRoom) return;
    if (pollingMsgsRef.current) clearInterval(pollingMsgsRef.current);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state set in effect body
    setLoadingMessages(true);
    loadMessages(activeRoom.id).then(() => setLoadingMessages(false));
    markRead(activeRoom.id);

    pollingMsgsRef.current = setInterval(() => {
      loadMessages(activeRoom.id);
    }, 4000);

    return () => { if (pollingMsgsRef.current) clearInterval(pollingMsgsRef.current); };
  }, [activeRoom?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom when messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectRoom = (room: MessageRoom) => {
    setActiveRoom(room);
    markRead(room.id);
  };

  const send = async () => {
    if (!input.trim() || !activeRoom || sending) return;
    const token = await getToken();
    if (!token) return;
    setSending(true);
    const text = input.trim();
    setInput('');

    try {
      const msg = await api.post<Message>(`/messages/rooms/${activeRoom.id}/send`, { content: text }, token);
      setMessages((prev) => [...prev, msg]);
      // Refresh room list to update last message preview
      loadRooms();
    } catch {
      setInput(text); // restore if failed
    } finally {
      setSending(false);
    }
  };

  if (!mounted) return null;

  if (!isSignedIn) {
    return (
      <main className="py-10 px-4 bg-bg min-h-screen">
        <div className="aa-container max-w-5xl">
          <VisitorGate t={t} />
        </div>
      </main>
    );
  }

  const filteredRooms = searchQuery.trim()
    ? rooms.filter((r) =>
        r.listing?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.participants.some((p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : rooms;

  const otherParticipants = (room: MessageRoom) =>
    room.participants.filter((p) => p.id !== userId);

  const totalUnread = 0; // unread count requires extra field from API

  return (
    <main className="bg-bg" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="aa-container max-w-5xl h-full flex flex-col py-6 px-4">

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-text flex items-center gap-2">
            <i className="fa-solid fa-comments text-gold-dark" />
            {t('title')}
            {totalUnread > 0 && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-gray-900">
                {totalUnread}
              </span>
            )}
          </h1>
          <Link href="/espace" className="text-xs text-sub hover:text-gold-dark transition-colors">
            {t('backToSpace')}
          </Link>
        </div>

        <div className="flex flex-1 overflow-hidden rounded-2xl border border-line bg-card min-h-0">

          {/* Thread list */}
          <div className="w-72 shrink-0 border-r border-line flex flex-col overflow-hidden">
            <div className="p-3 border-b border-line">
              <div className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2 text-xs">
                <i className="fa-solid fa-magnifying-glass text-[11px] text-sub" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search')}
                  className="flex-1 bg-transparent text-text placeholder:text-sub outline-none text-xs"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingRooms && rooms.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sub text-sm">
                  <i className="fa-solid fa-spinner fa-spin mr-2" /> Chargement…
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <i className="fa-solid fa-comment-slash text-2xl text-sub/40 mb-3" />
                  <p className="text-sm text-sub">Aucune conversation</p>
                  <p className="text-xs text-sub/60 mt-1">Contactez un bailleur depuis une annonce.</p>
                </div>
              ) : (
                filteredRooms.map((room) => {
                  const others = otherParticipants(room);
                  const name = others.length > 0
                    ? `${others[0].firstName} ${others[0].lastName}`
                    : 'Conversation';
                  const lastMsg = room.messages?.[0];
                  const initials = others.length > 0
                    ? avatarInitials(others[0].firstName, others[0].lastName)
                    : '??';

                  return (
                    <button
                      key={room.id}
                      onClick={() => selectRoom(room)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-bg border-b border-line/50 ${activeRoom?.id === room.id ? 'bg-gold-pale' : ''}`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-pale text-xs font-bold text-gold-dark">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-text truncate">{name}</p>
                          {lastMsg && (
                            <p className="text-[10px] text-sub shrink-0 ml-1">{formatTime(lastMsg.createdAt)}</p>
                          )}
                        </div>
                        <p className="truncate text-xs text-sub">
                          {room.listing?.title ?? 'Annonce'}
                        </p>
                        {lastMsg && (
                          <p className="truncate text-xs text-sub/70 mt-0.5">{lastMsg.content}</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat window */}
          {activeRoom ? (
            <div className="flex flex-1 flex-col min-w-0">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
                {(() => {
                  const others = otherParticipants(activeRoom);
                  const name = others.length > 0 ? `${others[0].firstName} ${others[0].lastName}` : 'Conversation';
                  const initials = others.length > 0 ? avatarInitials(others[0].firstName, others[0].lastName) : '??';
                  return (
                    <>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-pale text-xs font-bold text-gold-dark">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text">{name}</p>
                        <p className="text-xs text-sub truncate max-w-xs">{activeRoom.listing?.title ?? 'Annonce'}</p>
                      </div>
                    </>
                  );
                })()}
                <div className="ml-auto flex gap-2">
                  <Link
                    href={`/listings/${activeRoom.listingId}`}
                    className="flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs text-sub hover:bg-bg transition"
                  >
                    <i className="fa-solid fa-house text-[10px]" /> Voir l&apos;annonce
                  </Link>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-sub text-sm">
                    <i className="fa-solid fa-spinner fa-spin mr-2" /> Chargement…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-sub text-sm">
                    Aucun message — dites bonjour !
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === userId || (msg.sender && msg.sender.id === userId);
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${
                          isMe
                            ? 'bg-gold text-gray-900 rounded-br-sm'
                            : 'bg-bg text-text border border-line rounded-bl-sm'
                        }`}>
                          <p>{msg.content}</p>
                          <p className={`mt-1 text-[10px] text-right ${isMe ? 'text-gray-700' : 'text-sub'}`}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-line p-4 flex items-center gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder={t('writeMessage')}
                  className="flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub outline-none focus:border-gold/50 transition-colors"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || sending}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-gray-900 hover:bg-gold-dark hover:text-white transition-colors disabled:opacity-40"
                >
                  {sending
                    ? <i className="fa-solid fa-spinner fa-spin text-sm" />
                    : <i className="fa-solid fa-paper-plane text-sm" />
                  }
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-10">
              <i className="fa-solid fa-comments text-5xl text-sub/20 mb-4" />
              <p className="text-sm text-sub">Sélectionnez une conversation</p>
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-xs text-sub">
          <i className="fa-solid fa-circle-info mr-1 text-gold-dark" />
          {t('realtimeNote')}
        </p>
      </div>
    </main>
  );
}
