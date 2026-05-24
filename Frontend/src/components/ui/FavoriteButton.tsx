'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';

interface Props {
  listingId: string;
  initialFavorite?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export default function FavoriteButton({ listingId, initialFavorite = false, className = '', size = 'sm' }: Props) {
  const { isSignedIn, getToken } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [liked,    setLiked]   = useState(initialFavorite);
  const [loading,  setLoading] = useState(false);
  const [toast,    setToast]   = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSignedIn) {
      setToast(true);
      setTimeout(() => {
        setToast(false);
        router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
      }, 1200);
      return;
    }

    const next = !liked;
    setLiked(next);
    setLoading(true);

    try {
      const token = await getToken();
      if (next) {
        await api.post(`/listings/${listingId}/favorite`, {}, token ?? undefined);
      } else {
        await api.delete(`/listings/${listingId}/favorite`, token ?? undefined);
      }
    } catch {
      setLiked(!next);
    } finally {
      setLoading(false);
    }
  };

  const dim = size === 'md' ? 'h-10 w-10' : 'h-9 w-9';

  return (
    <>
      <button
        aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        onClick={handleClick}
        disabled={loading}
        className={`${dim} grid place-items-center rounded-full bg-white/80 transition-all duration-300 hover:bg-gold-pale disabled:opacity-70 ${className}`}
      >
        <i className={`fa-heart text-sm transition-colors duration-300 ${liked ? 'fa-solid text-gold-dark' : 'fa-regular text-sub'}`} />
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-text px-4 py-3 text-sm font-semibold text-bg shadow-lg animate-fadeUp">
          <i className="fa-solid fa-right-to-bracket text-gold" />
          Connectez-vous pour sauvegarder
        </div>
      )}
    </>
  );
}
