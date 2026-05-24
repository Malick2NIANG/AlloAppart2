'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-red-50">
        <i className="fa-solid fa-triangle-exclamation text-4xl text-red-400" />
      </div>
      <h1 className="text-3xl font-bold text-text">Une erreur est survenue</h1>
      <p className="mt-3 max-w-sm text-sub">
        Quelque chose s&apos;est mal passé. Réessayez ou revenez à l&apos;accueil.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button onClick={reset} className="btn-gold px-6 py-2.5">
          <i className="fa-solid fa-rotate-right mr-2" />
          Réessayer
        </button>
        <a href="/" className="rounded-full border border-line px-6 py-2.5 text-sm font-medium text-text hover:bg-card transition">
          <i className="fa-solid fa-house mr-2" />
          Accueil
        </a>
      </div>
    </main>
  );
}
