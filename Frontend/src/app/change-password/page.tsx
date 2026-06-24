'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function ChangePasswordPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPwd) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée.');
      await api.patch('/auth/me/password', { newPassword }, token);
      toast.success('Mot de passe mis à jour avec succès.');
      router.push('/redirect');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div
        aria-hidden
        className="h-0.5 w-full shrink-0"
        style={{ background: 'linear-gradient(90deg, #facc15, #b58900, transparent)' }}
      />

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-line bg-card p-6 shadow-lg">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
                <i className="fa-solid fa-lock-open text-xl text-gold-dark" />
              </div>
              <h1 className="text-xl font-bold text-text">Changement de mot de passe requis</h1>
              <p className="mt-1 text-sm text-sub">
                Pour la sécurité de votre compte, choisissez un nouveau mot de passe avant de continuer.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
              <Field label="Nouveau mot de passe">
                <PwdInput value={newPassword} onChange={setNewPassword} show={showNew} onToggle={() => setShowNew(!showNew)} />
              </Field>

              <Field label="Confirmer le mot de passe">
                <PwdInput value={confirmPwd} onChange={setConfirmPwd} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
              </Field>

              {error && (
                <p className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <i className="fa-solid fa-circle-exclamation shrink-0" /> {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-gold justify-center disabled:opacity-50">
                {loading
                  ? <><i className="fa-solid fa-spinner fa-spin" /> Enregistrement…</>
                  : <><i className="fa-solid fa-shield-check" /> Valider</>
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text">{label}</label>
      {children}
    </div>
  );
}

function PwdInput({ value, onChange, show, onToggle }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
}) {
  return (
    <div className="relative">
      <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        required
        className="w-full rounded-xl border border-line bg-bg py-2 pl-10 pr-11 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sub hover:text-text transition"
        aria-label={show ? 'Masquer' : 'Afficher'}
      >
        <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
      </button>
    </div>
  );
}
