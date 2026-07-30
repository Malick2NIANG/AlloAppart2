'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { MessageRoom } from '@/types';

interface Props {
  listingId: string;
  price: string;
  landlordName: string;
  landlordAvatar?: string | null;
  landlordPhone?: string | null;
  isAgency?: boolean;
  agencyName?: string | null;
  agencySlug?: string | null;
  perMonth: string;
  priceRaw: number;
  numLocale: string;
  isOwner?: boolean;
}

export default function ListingContactCard({
  listingId, landlordName, landlordAvatar, landlordPhone,
  isAgency = false, agencyName, agencySlug,
  perMonth, priceRaw, numLocale, isOwner = false,
}: Props) {
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const t = useTranslations('detail');

  const [liked,        setLiked]        = useState(false);
  const [likeLoading,  setLikeLoading]  = useState(false);
  const [message,      setMessage]      = useState('');
  const [sending,      setSending]      = useState(false);
  const [sent,         setSent]         = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(pathname)}`;

  // Charger l'état favori initial
  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then((token) => {
      if (!token) return;
      api.get<{ favorited: boolean }>(`/listings/${listingId}/favorite`, token)
        .then((r) => setLiked(r.favorited))
        .catch(() => {});
    });
  }, [isSignedIn, listingId, getToken]);

  const toggleLike = async () => {
    if (!isSignedIn) { router.push(signInUrl); return; }
    const token = await getToken();
    if (!token || likeLoading) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await api.delete(`/listings/${listingId}/favorite`, token);
        setLiked(false);
      } else {
        await api.post(`/listings/${listingId}/favorite`, {}, token);
        setLiked(true);
      }
    } catch { /* ignore */ }
    finally { setLikeLoading(false); }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    if (!isSignedIn) { router.push(signInUrl); return; }
    const token = await getToken();
    if (!token) return;

    setSending(true);
    setError(null);
    const text = message.trim();
    setMessage('');

    try {
      const room = await api.post<MessageRoom>('/messages/rooms', { listingId }, token);
      await api.post(`/messages/rooms/${room.id}/send`, { content: text }, token);
      setSent(true);
      setTimeout(() => router.push(`/locataire/messages/${room.id}`), 1200);
    } catch {
      setError(t('sendError'));
      setMessage(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* ── Price + contact card ────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-xl border border-line rounded-3xl p-6 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-extrabold text-text">
              {priceRaw.toLocaleString(numLocale)} FCFA
            </p>
            <p className="text-xs text-sub -mt-0.5">{perMonth}</p>
          </div>
          {/* Favorite */}
          <button
            onClick={toggleLike}
            disabled={likeLoading}
            title={liked ? t('removeFavorite') : t('addFavorite')}
            className={`h-10 w-10 rounded-full border grid place-items-center transition ${
              liked ? 'border-red-300 bg-red-50 text-red-400' : 'border-line hover:bg-gold-pale text-sub hover:text-gold-dark'
            }`}>
            {likeLoading
              ? <i className="fa-solid fa-spinner fa-spin text-sm" />
              : <svg className="h-5 w-5" fill={liked ? '#f87171' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
            }
          </button>
        </div>

        {/* Contact form — masqué si l'user est le propriétaire */}
        <div className="mt-4">
          {isOwner ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-gold/30 bg-gold-pale px-4 py-3 text-sm text-gold-dark">
              <i className="fa-solid fa-house-chimney-user shrink-0" />
              <span className="font-medium">{t('yourListing')}</span>
            </div>
          ) : sent ? (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <i className="fa-solid fa-circle-check" />
              {t('messageSent')}
            </div>
          ) : (
            <>
              <textarea
                id="contact-textarea"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('contactPlaceholder')}
                className="w-full border border-line rounded-xl px-3 py-2 text-sm text-text bg-bg placeholder:text-sub outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition resize-none"
              />
              {error && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <i className="fa-solid fa-circle-exclamation text-[10px]" /> {error}
                </p>
              )}
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending}
                className="w-full btn-gold py-2.5 rounded-full font-semibold mt-2 hover:scale-[1.02] transition disabled:opacity-50 flex items-center justify-center gap-2">
                {sending
                  ? <><i className="fa-solid fa-spinner fa-spin" /> {t('contactSending')}</>
                  : t('contactLandlord')
                }
              </button>
            </>
          )}
        </div>

        {/* Landlord / Agency info */}
        <div className="mt-5 pt-4 border-t border-line">
          {/* Label contextuel */}
          <div className="flex items-center gap-1.5 mb-3">
            <i className={`fa-solid ${isAgency ? 'fa-building' : 'fa-user'} text-[10px] text-sub`} />
            <p className="text-xs text-sub font-medium uppercase tracking-wide">
              {isAgency ? t('agencyType') : t('landlordType')}
            </p>
          </div>

          {/* Avatar + nom */}
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative h-10 w-10 shrink-0">
              {landlordAvatar ? (
                <Image
                  src={landlordAvatar}
                  alt={landlordName}
                  fill
                  className="rounded-full object-cover"
                  sizes="40px"
                />
              ) : (
                <div className={`h-10 w-10 rounded-full grid place-items-center text-sm font-bold ${
                  isAgency ? 'bg-blue-50 text-blue-700' : 'bg-gold-pale text-gold-dark'
                }`}>
                  {isAgency
                    ? <i className="fa-solid fa-building text-xs" />
                    : <span>{landlordName.charAt(0).toUpperCase()}</span>
                  }
                </div>
              )}
              {/* Badge agence */}
              {isAgency && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 border-2 border-card">
                  <i className="fa-solid fa-check text-[6px] text-white" />
                </span>
              )}
            </div>

            {/* Infos */}
            <div className="min-w-0">
              {isAgency && agencyName ? (
                <>
                  <p className="font-semibold text-text text-sm truncate">{agencyName}</p>
                  <p className="text-xs text-sub truncate">{landlordName}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-text text-sm truncate">{landlordName}</p>
                  {landlordPhone && <p className="text-xs text-sub">{landlordPhone}</p>}
                </>
              )}
            </div>
          </div>

          {/* Lien vitrine agence — affiché uniquement pour les agences */}
          {isAgency && agencySlug && (
            <Link
              href={`/agences/${agencySlug}`}
              className="mt-3 text-sm text-gold-dark hover:text-gold transition-colors flex items-center gap-1"
            >
              {t('viewAgencyShowcase')} <i className="fa-solid fa-arrow-right text-xs" />
            </Link>
          )}
        </div>
      </div>

      {/* ── Mobile CTA ─── masqué si propriétaire ──────────────── */}
      {!isOwner && <div className="fixed bottom-3 inset-x-0 z-40 px-4 md:hidden">
        <div className="mx-auto max-w-md rounded-2xl shadow-lg border border-line bg-white/90 backdrop-blur-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-base font-extrabold text-text">{priceRaw.toLocaleString(numLocale)} FCFA</p>
            <p className="text-[11px] text-sub -mt-0.5">{perMonth}</p>
          </div>
          <button
            onClick={() => document.getElementById('contact-textarea')?.focus()}
            className="btn-gold px-4 py-2 rounded-full text-sm font-semibold">
            {t('contactBtn')}
          </button>
        </div>
      </div>}
    </>
  );
}
