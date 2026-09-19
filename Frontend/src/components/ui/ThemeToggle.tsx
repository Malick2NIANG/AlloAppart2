'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM read on mount for theme init
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    /* Applique immédiatement en client — c'est la SEULE chose qui détermine
       l'affichage : `allo-theme` n'est lu côté serveur qu'une fois, dans
       app/layout.tsx, pour poser la classe initiale au tout premier rendu
       (évite un flash au chargement). Comme <html> n'est jamais démonté
       pendant la navigation dans l'app, cette classe reste correcte sans
       intervention supplémentaire. */
    document.documentElement.classList.toggle('dark', next);
    /* Persiste via cookie pour que le PROCHAIN chargement de page (nouvel
       onglet, rechargement) démarre déjà dans le bon thème. Pas de
       router.refresh() ici : ça forcerait un aller-retour serveur complet
       (le dashboard re-vérifie l'auth et re-fetch /auth/me à chaque rendu)
       pour ne resynchroniser qu'un attribut déjà appliqué côté client — la
       cause du "à-coup" perceptible à chaque bascule de thème. */
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `allo-theme=${next ? 'dark' : 'light'};path=/;max-age=${maxAge};samesite=lax`;
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
