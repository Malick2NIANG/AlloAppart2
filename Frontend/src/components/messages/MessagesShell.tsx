'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import Pusher from 'pusher-js';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import type { Message, MessageReplyTo, MessageRoom, User } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatTime(dateStr: string, numLocale = 'fr-FR'): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString(numLocale, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(numLocale, { day: '2-digit', month: '2-digit' });
}

function formatAudioTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?';
}

function getDisplayName(p: { firstName?: string | null; lastName?: string | null; agencyName?: string | null; roles?: string[] } | null | undefined, fallback = 'Utilisateur'): string {
  if (!p) return fallback;
  if (p.roles?.includes('PRO_AGENCE') && p.agencyName) return p.agencyName;
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || fallback;
}

function isAudioMessage(content: string) {
  return content.startsWith('[AUDIO]:');
}
function getAudioUrl(content: string) {
  return content.replace('[AUDIO]:', '');
}

/* ── Custom audio player ─────────────────────────────────────────────────── */

const PLAYBACK_SPEEDS = [1, 1.5, 2];

function AudioPlayer({ src, isMine }: { src: string; isMine: boolean }) {
  const audioRef   = useRef<HTMLAudioElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);

  const speed = PLAYBACK_SPEEDS[speedIdx];

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = ratio * a.duration;
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % PLAYBACK_SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = PLAYBACK_SPEEDS[next];
  };

  const trackClass = isMine ? 'bg-white/20' : 'bg-line';
  const fillClass  = isMine ? 'bg-white'    : 'bg-gold-dark';
  const textClass  = isMine ? 'text-white/60' : 'text-sub';
  const btnClass   = isMine
    ? 'bg-white/20 hover:bg-white/30 text-white'
    : 'bg-gold-pale hover:bg-gold/30 text-gold-dark';
  const speedClass = isMine
    ? 'text-white/70 hover:text-white bg-white/10 hover:bg-white/20'
    : 'text-gold-dark hover:text-gold-dark bg-gold-pale hover:bg-gold/30';

  /* Afficher la durée totale au repos, le temps courant pendant la lecture */
  const timeDisplay = playing ? formatAudioTime(current) : (duration > 0 ? formatAudioTime(duration) : '—');

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] py-0.5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (!a) return;
          setCurrent(a.currentTime);
          setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
        }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onEnded={() => {
          setPlaying(false); setProgress(0); setCurrent(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
      />
      <button
        type="button"
        onClick={toggle}
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${btnClass}`}
      >
        <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'} text-[11px] ${playing ? '' : 'ml-0.5'}`} />
      </button>

      <div className="flex-1 min-w-0">
        {/* Barre de progression */}
        <div className={`h-1.5 rounded-full cursor-pointer ${trackClass}`} onClick={seek}>
          <div className={`h-full rounded-full transition-none ${fillClass}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1 gap-1">
          {/* Durée : total au repos, courant pendant lecture */}
          <span className={`text-[9px] tabular-nums ${textClass}`}>{timeDisplay}</span>
          {/* Vitesse de lecture */}
          <button
            type="button"
            onClick={cycleSpeed}
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-colors leading-none ${speedClass}`}
          >
            {speed === 1 ? '1×' : `${speed}×`}
          </button>
        </div>
      </div>

      <i className={`fa-solid fa-microphone text-[10px] shrink-0 ${textClass}`} />
    </div>
  );
}

/* ── MessagesShell ───────────────────────────────────────────────────────── */

interface Props {
  emptyHint?: string;
  space?: 'bailleur' | 'locataire' | 'agent';
}

const SPACE_BADGE_CLS = {
  bailleur:  { icon: 'fa-house-chimney-user', cls: 'bg-gold-pale text-gold-dark'      },
  locataire: { icon: 'fa-user',               cls: 'bg-blue-50 text-blue-700'         },
  agent:     { icon: 'fa-shield-halved',      cls: 'bg-emerald-50 text-emerald-700'   },
};

export default function MessagesShell({ emptyHint, space }: Props) {
  const { getToken } = useAuth();
  const t = useTranslations('messagesShell');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const searchParams = useSearchParams();
  const roomFromUrl  = searchParams.get('room');

  const [me,           setMe]           = useState<User | null>(null);
  const [rooms,        setRooms]        = useState<MessageRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);
  const [search,       setSearch]       = useState('');
  const [voiceError,   setVoiceError]   = useState<string | null>(null);
  const [replyingTo,   setReplyingTo]   = useState<Message | null>(null);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editOriginal, setEditOriginal] = useState('');

  /* ── Voice recording ──────────────────────────────────────────────────── */
  const [recording,      setRecording]      = useState(false);
  const [recordingTime,  setRecordingTime]  = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const meRef     = useRef<User | null>(null);
  useEffect(() => { meRef.current = me; }, [me]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  const SPACE_BADGE: Record<string, { label: string; icon: string; cls: string }> = {
    bailleur:  { label: t('spaceBailleur'),  ...SPACE_BADGE_CLS.bailleur  },
    locataire: { label: t('spaceLocataire'), ...SPACE_BADGE_CLS.locataire },
    agent:     { label: t('spaceAgent'),     ...SPACE_BADGE_CLS.agent     },
  };

  /* ── Load rooms + me ──────────────────────────────────────────────────── */
  const loadRooms = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoadingRooms(false); return; }
    try {
      const [user, list] = await Promise.all([
        api.get<User>('/auth/me', token),
        api.get<MessageRoom[]>('/messages/rooms', token),
      ]);
      setMe(user);
      setRooms(list);
    } catch {}
    finally { setLoadingRooms(false); }
  }, [getToken]);

  useEffect(() => { void loadRooms(); }, [loadRooms]);

  // Auto-ouvrir la room passée en ?room= (ex: depuis la page vérifications)
  useEffect(() => {
    if (roomFromUrl && rooms.length > 0 && !activeRoomId) {
      setActiveRoomId(roomFromUrl);
    }
  }, [roomFromUrl, rooms, activeRoomId]);

  /* ── Load messages ────────────────────────────────────────────────────── */
  const loadMessages = useCallback(async (roomId: string) => {
    setLoadingMsgs(true);
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<Message[]>(`/messages/rooms/${roomId}`, token);
      setMessages([...data].reverse());
      await api.post(`/messages/rooms/${roomId}/read`, {}, token).catch(() => {});
      /* Marquer comme lu localement + signaler la sidebar */
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId && r.messages?.[0]
            ? { ...r, messages: [{ ...r.messages[0], readAt: new Date().toISOString() }] }
            : r,
        ),
      );
      window.dispatchEvent(new Event('aa-messages-updated'));
    } catch {}
    finally { setLoadingMsgs(false); }
  }, [getToken]);

  useEffect(() => {
    if (!activeRoomId) return;
    setMessages([]);
    void loadMessages(activeRoomId);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeRoomId, loadMessages]);

  /* ── Scroll to bottom ─────────────────────────────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Pusher realtime ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!activeRoomId) return;
    const pusherKey  = process.env.NEXT_PUBLIC_SOKETI_APP_KEY ?? '';
    const pusherHost = process.env.NEXT_PUBLIC_SOKETI_HOST ?? 'localhost';
    const pusherPort = Number(process.env.NEXT_PUBLIC_SOKETI_PORT ?? '6001');
    if (!pusherKey) return;

    // En prod, Soketi est servi en HTTPS/WSS via Caddy (port 443) — le
    // navigateur bloque un ws:// non chiffré depuis une page https://.
    const useTLS = pusherPort === 443;
    const client = new Pusher(pusherKey, {
      cluster: 'mt1', wsHost: pusherHost, wsPort: pusherPort, wssPort: pusherPort,
      forceTLS: useTLS, enabledTransports: useTLS ? ['wss'] : ['ws'], disableStats: true,
    });
    const ch = client.subscribe(`room-${activeRoomId}`);
    ch.bind('new-message', (msg: Message) => {
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      /* Message d'autrui reçu en temps réel → marquer lu immédiatement (l'utilisateur regarde) */
      if (msg.senderId !== meRef.current?.id) {
        void getToken().then((token) =>
          token ? api.post(`/messages/rooms/${activeRoomId}/read`, {}, token) : null
        ).finally(() => {
          setRooms((prev) =>
            prev.map((r) =>
              r.id === activeRoomId && r.messages?.[0]
                ? { ...r, messages: [{ ...r.messages[0], readAt: new Date().toISOString() }] }
                : r,
            ),
          );
          window.dispatchEvent(new Event('aa-messages-updated'));
        });
      } else {
        window.dispatchEvent(new Event('aa-messages-updated'));
      }
    });
    ch.bind('message-edited', (data: { id: string; content: string; editedAt: string }) => {
      setMessages((prev) => prev.map((m) => m.id === data.id ? { ...m, content: data.content, editedAt: data.editedAt } : m));
    });
    ch.bind('message-deleted', (data: { id: string }) => {
      setMessages((prev) => prev.map((m) => m.id === data.id ? { ...m, deletedAt: new Date().toISOString() } : m));
    });
    return () => { ch.unbind_all(); client.unsubscribe(`room-${activeRoomId}`); client.disconnect(); };
  // getToken est stable (Clerk) — pas de boucle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, getToken]);

  /* ── Send text ────────────────────────────────────────────────────────── */
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !activeRoomId) return;
    const token = await getToken();
    if (!token) return;
    setInput('');
    setSending(true);

    /* ── Mode édition ── */
    if (editingId) {
      try {
        await api.patch(`/messages/${editingId}`, { content: text }, token);
        setMessages((prev) => prev.map((m) => m.id === editingId ? { ...m, content: text, editedAt: new Date().toISOString() } : m));
      } catch { setInput(text); }
      finally { setSending(false); setEditingId(null); setEditOriginal(''); }
      return;
    }

    /* ── Mode envoi normal (avec réponse optionnelle) ── */
    const capturedReply = replyingTo;
    setReplyingTo(null);
    try {
      const body: { content: string; replyToId?: string } = { content: text };
      if (capturedReply) body.replyToId = capturedReply.id;
      const msg = await api.post<Message>(`/messages/rooms/${activeRoomId}/send`, body, token);
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, { ...msg, sender: me ?? undefined } as Message]);
    } catch { setInput(text); setReplyingTo(capturedReply); }
    finally { setSending(false); }
  };

  const startEdit = (msg: Message) => {
    setReplyingTo(null);
    setEditingId(msg.id);
    setEditOriginal(msg.content);
    setInput(msg.content);
    inputRef.current?.focus();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setInput(editOriginal);
    setEditOriginal('');
  };

  const handleDelete = async (messageId: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await api.delete(`/messages/${messageId}`, token);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m));
    } catch { /* silencieux */ }
  };

  /* ── Voice recording ──────────────────────────────────────────────────── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(100); // collect every 100ms
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      alert(t('micUnavailable'));
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    chunksRef.current = [];
    setRecording(false);
    setRecordingTime(0);
  };

  const sendVoice = async () => {
    const mr = mediaRecorderRef.current;
    if (!mr || !activeRoomId) return;
    if (timerRef.current) clearInterval(timerRef.current);

    await new Promise<void>((resolve) => {
      mr.onstop = async () => {
        mr.stream?.getTracks().forEach((t) => t.stop());
        const mimeType = mr.mimeType || 'audio/webm';
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        setRecording(false);
        setRecordingTime(0);
        mediaRecorderRef.current = null;

        const token = await getToken().catch(() => null);
        if (!token) { resolve(); return; }

        setSending(true);
        setVoiceError(null);
        try {
          const form = new FormData();
          form.append('file', blob, `voice.${ext}`);
          const res = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          if (!res.ok) throw new Error(`Upload failed (${res.status})`);
          const data = await res.json() as { url?: string };
          if (!data.url) throw new Error('Missing URL in upload response');
          const msg = await api.post<Message>(
            `/messages/rooms/${activeRoomId}/send`,
            { content: `[AUDIO]:${data.url}` },
            token,
          );
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, { ...msg, sender: me ?? undefined } as Message]);
        } catch (err) {
          setVoiceError(err instanceof Error ? err.message : t('voiceMessage'));
        }
        finally { setSending(false); resolve(); }
      };
      if (mr.state !== 'inactive') mr.stop();
      else resolve();
    });
  };

  /* ── Filtered rooms ───────────────────────────────────────────────────── */
  const q = search.trim().toLowerCase();
  const filteredRooms = rooms.filter((r) => {
    if (!q) return true;
    const title = r.listing?.title?.toLowerCase() ?? '';
    const names = r.participants.map((p) => getDisplayName(p).toLowerCase()).join(' ');
    return title.includes(q) || names.includes(q);
  });

  const userFallback = t('userFallback');
  const otherParticipants = activeRoom?.participants.filter((p) => p.id !== me?.id) ?? [];
  const otherName = otherParticipants
    .map((p) => getDisplayName(p, userFallback))
    .join(', ') || t('conversationFallback');

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full rounded-2xl border border-line overflow-hidden bg-card shadow-sm">

      {/* ── LEFT — conversation list ── */}
      <div className={`flex flex-col border-r border-line bg-bg ${activeRoomId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 shrink-0`}>

        <div className="px-4 pt-5 pb-3 border-b border-line shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-text">Messages</h1>
            <span className="text-xs font-medium bg-gold-pale text-gold-dark px-2.5 py-1 rounded-full">
              {t('convCount', { count: rooms.length })}
            </span>
          </div>
          {space && (() => {
            const b = SPACE_BADGE[space];
            return (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold mb-1 ${b.cls}`}>
                <i className={`fa-solid ${b.icon} text-[10px]`} />
                {b.label}
              </span>
            );
          })()}
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sub text-xs pointer-events-none" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-xl border border-line bg-card pl-8 pr-8 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-1 focus:ring-gold-dark transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sub hover:text-text">
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingRooms ? (
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                  <div className="h-11 w-11 rounded-full bg-line shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-line rounded w-3/4" />
                    <div className="h-2.5 bg-line rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="h-14 w-14 rounded-2xl bg-gold-pale flex items-center justify-center mb-3">
                <i className="fa-solid fa-comment-dots text-2xl text-gold-dark" />
              </div>
              <p className="font-semibold text-text text-sm">
                {q ? t('noResults') : t('noConversations')}
              </p>
              <p className="text-xs text-sub mt-1">
                {q ? t('noResultsFor', { search }) : (emptyHint ?? '')}
              </p>
            </div>
          ) : (
            <div className="p-2 flex flex-col gap-0.5">
              {filteredRooms.map((room) => {
                const lastMsg   = room.messages?.[0];
                const hasUnread = !!lastMsg && !lastMsg.readAt && lastMsg.senderId !== me?.id;
                const others    = room.participants.filter((p) => p.id !== me?.id);
                const name      = others.map((p) => getDisplayName(p, userFallback)).join(', ') || t('conversationFallback');
                const initials  = getInitials(name);
                const otherAvatar = others.length === 1 ? (others[0] as { avatar?: string | null }).avatar ?? null : null;
                const isActive  = room.id === activeRoomId;
                const isAudio   = !!lastMsg && isAudioMessage(lastMsg.content);
                const preview   = lastMsg && !isAudio ? lastMsg.content : null;

                return (
                  <button
                    key={room.id}
                    onClick={() => setActiveRoomId(room.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                      isActive ? 'bg-gold-pale border border-gold-dark/20' : 'hover:bg-card'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {otherAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={otherAvatar} alt={name} className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <div className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold ${
                          isActive ? 'bg-gold-dark text-white' : 'bg-gold-pale text-gold-dark'
                        }`}>
                          {initials}
                        </div>
                      )}
                      {hasUnread && !isActive && (
                        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-bg" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={`truncate text-sm ${hasUnread ? 'font-bold text-text' : 'font-medium text-text'}`}>
                          {name}
                        </p>
                        {lastMsg && (
                          <span className="text-[10px] text-sub shrink-0">{formatTime(lastMsg.createdAt, numLocale)}</span>
                        )}
                      </div>
                      <p className="text-xs text-sub truncate">
                        {room.listing?.title ?? t('deletedListing')}
                      </p>
                      {(preview || isAudio) && (
                        <p className={`text-xs truncate mt-0.5 flex items-center gap-1 ${hasUnread ? 'text-text font-medium' : 'text-sub'}`}>
                          {isAudio
                            ? <><i className="fa-solid fa-microphone text-[10px] shrink-0" /> {t('voiceMessage')}</>
                            : preview
                          }
                        </p>
                      )}
                    </div>
                    {hasUnread && !isActive && (
                      <span className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                        1
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT — chat ── */}
      {!activeRoomId ? (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center px-8 bg-bg/50">
          <div className="h-20 w-20 rounded-3xl bg-gold-pale flex items-center justify-center mb-5">
            <i className="fa-solid fa-comment-dots text-4xl text-gold-dark" />
          </div>
          <h2 className="text-lg font-bold text-text mb-1">{t('yourMessages')}</h2>
          <p className="text-sm text-sub max-w-xs">
            {t('selectConvHint')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-w-0">

          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-card shrink-0">
            <button
              onClick={() => setActiveRoomId(null)}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-full hover:bg-gold-pale text-sub hover:text-gold-dark transition-colors"
            >
              <i className="fa-solid fa-arrow-left text-sm" />
            </button>
            <div className="h-9 w-9 shrink-0 rounded-full bg-gold-pale flex items-center justify-center text-sm font-bold text-gold-dark">
              {getInitials(otherName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text truncate text-sm">{otherName}</p>
              {activeRoom?.listing && (
                <p className="text-xs text-sub truncate">
                  <i className="fa-solid fa-house text-[9px] mr-1 text-gold-dark/60" />
                  {activeRoom.listing.title}
                </p>
              )}
            </div>
            {otherParticipants[0] && (
              <Link
                href={`/bailleur/profil/${otherParticipants[0].id}`}
                className="shrink-0 text-xs text-gold-dark hover:underline hidden sm:block"
              >
                {t('viewProfile')} <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-0.5" />
              </Link>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2 bg-bg/30">
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-12">
                <i className="fa-solid fa-spinner fa-spin text-xl text-gold-dark" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-sub py-12">{t('noMessages')}</p>
            ) : (
              <>
                {messages.map((msg, i) => {
                  const isMine    = me !== null && msg.senderId === me.id;
                  const isDeleted = !!msg.deletedAt;
                  const isAudio   = !isDeleted && isAudioMessage(msg.content);
                  const showDate  = i === 0 || (
                    new Date(messages[i - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString()
                  );
                  const actionBtnClass = 'h-6 w-6 rounded-full flex items-center justify-center transition-colors text-sub hover:text-text hover:bg-line';
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex items-center justify-center my-3">
                          <span className="text-[10px] text-sub bg-card border border-line rounded-full px-3 py-1">
                            {new Date(msg.createdAt).toLocaleDateString(numLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                        </div>
                      )}

                      {/* Wrapper avec boutons d'action au survol */}
                      <div id={`msg-${msg.id}`} className={`group flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>

                        {/* Actions côté gauche pour mes messages */}
                        {isMine && !isDeleted && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mb-1">
                            {!isAudio && (
                              <button type="button" onClick={() => startEdit(msg)} className={actionBtnClass} title="Modifier">
                                <i className="fa-solid fa-pen text-[10px]" />
                              </button>
                            )}
                            <button type="button" onClick={() => void handleDelete(msg.id)} className={`${actionBtnClass} hover:text-red-500`} title="Supprimer">
                              <i className="fa-solid fa-trash text-[10px]" />
                            </button>
                            <button type="button" onClick={() => setReplyingTo(msg)} className={actionBtnClass} title={t('reply')}>
                              <i className="fa-solid fa-reply text-[10px]" />
                            </button>
                          </div>
                        )}

                        {/* Bulle */}
                        <div className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                          isDeleted
                            ? isMine ? 'bg-gold-dark/30 text-white/50' : 'bg-card border border-line text-sub'
                            : isMine
                              ? 'bg-gold-dark text-white rounded-br-sm'
                              : 'bg-card border border-line text-text rounded-bl-sm'
                        }`}>
                          {!isMine && msg.sender && !isDeleted && (
                            <p className="text-[10px] font-bold text-gold-dark mb-0.5">{getDisplayName(msg.sender, userFallback)}</p>
                          )}

                          {/* Citation du message répondu */}
                          {msg.replyTo && !isDeleted && (
                            <div className={`text-xs rounded-lg px-2.5 py-1.5 mb-2 border-l-2 cursor-pointer ${
                              isMine ? 'bg-white/10 border-white/40' : 'bg-bg border-gold-dark/40'
                            }`}
                              onClick={() => {
                                const el = document.getElementById(`msg-${msg.replyTo!.id}`);
                                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                            >
                              <p className={`font-semibold text-[10px] mb-0.5 ${isMine ? 'text-white/70' : 'text-gold-dark'}`}>
                                {msg.replyTo.sender ? getDisplayName(msg.replyTo.sender, userFallback) : t('messageFallback')}
                              </p>
                              {msg.replyTo.deletedAt ? (
                                <p className={`italic text-[11px] ${isMine ? 'text-white/40' : 'text-sub/60'}`}>{t('messageDeleted')}</p>
                              ) : isAudioMessage(msg.replyTo.content) ? (
                                <p className={`text-[11px] flex items-center gap-1 ${isMine ? 'text-white/60' : 'text-sub'}`}>
                                  <i className="fa-solid fa-microphone text-[9px]" /> {t('voiceMessage')}
                                </p>
                              ) : (
                                <p className={`truncate text-[11px] ${isMine ? 'text-white/60' : 'text-sub'}`}>{msg.replyTo.content}</p>
                              )}
                            </div>
                          )}

                          {/* Contenu */}
                          {isDeleted ? (
                            <p className="text-xs italic flex items-center gap-1.5">
                              <i className="fa-solid fa-ban text-[10px]" /> {t('messageDeleted')}
                            </p>
                          ) : isAudio ? (
                            <AudioPlayer src={getAudioUrl(msg.content)} isMine={isMine} />
                          ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          )}

                          {/* Heure + lu + modifié */}
                          {!isDeleted && (
                            <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? 'text-white/60' : 'text-sub'}`}>
                              {msg.editedAt && <span className="text-[9px] italic">{t('editedLabel')}</span>}
                              <span className="text-[10px]">{formatTime(msg.createdAt, numLocale)}</span>
                              {isMine && (
                                <i className={`fa-solid text-[9px] ${msg.readAt ? 'fa-check-double text-white/80' : 'fa-check'}`} />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions côté droit pour les autres */}
                        {!isMine && !isDeleted && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mb-1">
                            <button type="button" onClick={() => setReplyingTo(msg)} className={actionBtnClass} title={t('reply')}>
                              <i className="fa-solid fa-reply text-[10px]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Bandeau — réponse à un message */}
          {replyingTo && !editingId && (
            <div className="mx-4 flex items-center gap-2 bg-gold-pale border border-gold-dark/20 rounded-xl px-3 py-2">
              <i className="fa-solid fa-reply text-gold-dark text-xs shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-gold-dark">{replyingTo.sender ? getDisplayName(replyingTo.sender, userFallback) : t('messageFallback')}</p>
                <p className="text-xs text-sub truncate">
                  {isAudioMessage(replyingTo.content)
                    ? <><i className="fa-solid fa-microphone text-[9px] mr-1" />{t('voiceMessage')}</>
                    : replyingTo.content
                  }
                </p>
              </div>
              <button type="button" onClick={() => setReplyingTo(null)} className="text-sub hover:text-text shrink-0">
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            </div>
          )}

          {/* Bandeau — modification d'un message */}
          {editingId && (
            <div className="mx-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <i className="fa-solid fa-pen text-blue-500 text-xs shrink-0" />
              <p className="text-xs text-blue-700 flex-1 truncate">{t('editingBanner')}</p>
              <button type="button" onClick={cancelEdit} className="text-blue-400 hover:text-blue-600 shrink-0">
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            </div>
          )}

          {/* Erreur vocal */}
          {voiceError && (
            <div className="mx-4 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <i className="fa-solid fa-triangle-exclamation shrink-0" />
              <span>{voiceError}</span>
              <button type="button" onClick={() => setVoiceError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-line bg-card shrink-0">
            {recording ? (
              /* ── Mode enregistrement ── */
              <>
                <div className="flex items-center gap-2.5 flex-1 bg-bg rounded-xl px-4 py-2.5 border border-red-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-sm font-mono text-red-500 tabular-nums">
                    {formatAudioTime(recordingTime)}
                  </span>
                  <span className="text-xs text-sub">{t('recordingLabel')}</span>
                </div>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-sub hover:bg-bg hover:text-red-500 transition-colors"
                  title={t('cancelRecordTitle')}
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
                <button
                  type="button"
                  onClick={() => void sendVoice()}
                  disabled={sending || recordingTime === 0}
                  className="btn-gold px-4 py-2.5 disabled:opacity-50 flex items-center gap-2"
                  title={t('sendVoiceTitle')}
                >
                  {sending
                    ? <i className="fa-solid fa-spinner fa-spin text-sm" />
                    : <i className="fa-solid fa-paper-plane text-sm" />
                  }
                </button>
              </>
            ) : (
              /* ── Mode normal ── */
              <>
                <input
                  ref={inputRef}
                  type="text" value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  placeholder={t('messagePlaceholder')}
                  className="flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub outline-none focus:ring-2 focus:ring-gold-dark transition"
                />
                {/* Micro si le champ est vide, sinon bouton envoyer */}
                {input.trim() ? (
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending}
                    className="btn-gold px-4 py-2.5 disabled:opacity-50 shrink-0"
                  >
                    {sending
                      ? <i className="fa-solid fa-spinner fa-spin text-sm" />
                      : <i className="fa-solid fa-paper-plane text-sm" />
                    }
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={!activeRoomId || sending}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-pale text-gold-dark hover:bg-gold/30 transition-colors disabled:opacity-40 shrink-0"
                    title={t('recordVoiceTitle')}
                  >
                    <i className="fa-solid fa-microphone text-sm" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
