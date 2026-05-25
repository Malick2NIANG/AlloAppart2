'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Message, MessageRoom, User } from '@/types';

interface Props {
  roomId: string;
  backUrl: string;
}

export default function ChatRoom({ roomId, backUrl }: Props) {
  const { getToken } = useAuth();
  const [messages, setMessages]   = useState<Message[]>([]);
  const [room, setRoom]           = useState<MessageRoom | null>(null);
  const [me, setMe]               = useState<User | null>(null);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const bottomRef                 = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (silent = false) => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<Message[]>(`/messages/rooms/${roomId}`, token);
      setMessages([...data].reverse());
      if (!silent) setLoading(false);
    } catch {}
  }, [roomId, getToken]);

  // Initial load : user + room info + messages + mark read
  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const [user, rooms] = await Promise.all([
          api.get<User>('/auth/me', token),
          api.get<MessageRoom[]>('/messages/rooms', token),
          fetchMessages(),
          api.post(`/messages/rooms/${roomId}/read`, {}, token).catch(() => {}),
        ]);
        setMe(user);
        setRoom(rooms.find((r) => r.id === roomId) ?? null);
      } catch {}
    });
  }, [roomId, getToken, fetchMessages]);

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll with exponential backoff
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let delay = 3000;
    const MAX_DELAY = 30000;
    let lastCount = messages.length;

    const poll = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const data = await api.get<Message[]>(`/messages/rooms/${roomId}`, token);
        const reversed = [...data].reverse();
        if (reversed.length !== lastCount) {
          delay = 3000;
          lastCount = reversed.length;
          setMessages(reversed);
        } else {
          delay = Math.min(delay * 1.5, MAX_DELAY);
        }
      } catch {}
      timeoutId = setTimeout(poll, delay);
    };

    timeoutId = setTimeout(poll, delay);
    return () => clearTimeout(timeoutId);
  }, [roomId, getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const token = await getToken();
    if (!token) return;
    setInput('');
    setSending(true);
    try {
      const msg = await api.post<Message>(
        `/messages/rooms/${roomId}/send`,
        { content: text },
        token,
      );
      setMessages((prev) => [...prev, { ...msg, sender: me ?? undefined } as Message]);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const otherParticipants = room?.participants.filter((p) => p.id !== me?.id) ?? [];
  const otherName = otherParticipants.map((p) => `${p.firstName} ${p.lastName}`).join(', ') || 'Conversation';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-line shrink-0">
        <Link href={backUrl} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gold-pale text-sub hover:text-gold-dark transition-colors">
          <i className="fa-solid fa-arrow-left text-sm" />
        </Link>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-pale">
          <i className="fa-solid fa-user text-gold-dark text-sm" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-text truncate">{otherName}</p>
          {room?.listing && (
            <p className="text-xs text-sub truncate">{room.listing.title}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-2 pr-1">
        {messages.length === 0 && (
          <p className="text-center text-sm text-sub py-12">
            Aucun message. Démarrez la conversation !
          </p>
        )}
        {messages.map((msg) => {
          const isMine = me !== null && msg.senderId === me.id;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isMine
                  ? 'bg-gold-dark text-white rounded-br-sm'
                  : 'bg-card border border-line text-text rounded-bl-sm'
              }`}>
                {!isMine && msg.sender && (
                  <p className="text-[10px] font-semibold text-gold-dark mb-0.5">
                    {msg.sender.firstName}
                  </p>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[10px] mt-1 text-right ${isMine ? 'text-white/60' : 'text-sub'}`}>
                  {formatTime(msg.createdAt)}
                  {isMine && msg.readAt && (
                    <i className="fa-solid fa-check-double ml-1 text-[9px]" />
                  )}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 pt-4 border-t border-line shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Écrivez votre message…"
          className="flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub outline-none focus:ring-2 focus:ring-gold-dark transition"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="btn-gold px-4 py-2.5 disabled:opacity-50 shrink-0"
        >
          {sending
            ? <i className="fa-solid fa-spinner fa-spin text-sm" />
            : <i className="fa-solid fa-paper-plane text-sm" />
          }
        </button>
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
