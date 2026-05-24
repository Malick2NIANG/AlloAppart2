'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    /* Applique immédiatement en client */
    document.documentElement.classList.toggle('dark', next);
    /* Persiste via cookie (lu par le layout serveur au prochain rendu) */
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `allo-theme=${next ? 'dark' : 'light'};path=/;max-age=${maxAge};samesite=lax`;
    /* Refresh silencieux pour re-sync le layout serveur */
    router.refresh();
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={dark ? 'Mode clair' : 'Mode sombre'}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-sub transition hover:border-gold/50 hover:text-gold-dark"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
