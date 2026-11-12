'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PendingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending: boolean;
  children: ReactNode;
}

/**
 * Retour visuel immédiat (disabled + spinner + aria-busy) pendant une action
 * encore en cours — anti double-clic, cf. lot « diagnostic performance
 * mobile ». `className` reste entièrement fourni par l'appelant : au repos
 * (pending=false), le rendu est identique à un <button> classique, aucune
 * classe ajoutée ici hors `tap-target` (zone ≥44px, déjà la convention du
 * reste de l'app — voir FavoriteButton, BottomSheet).
 */
export default function PendingButton({ pending, disabled, className = '', children, ...rest }: PendingButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending}
      className={`tap-target disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {pending ? <i className="fa-solid fa-spinner fa-spin" /> : children}
    </button>
  );
}
