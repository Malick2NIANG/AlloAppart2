'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function ChangePasswordPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('changePassword');

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
      setError(t('tooShort'));
      return;
    }
    if (newPassword !== confirmPwd) {
      setError(t('mismatch'));
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t('sessionExpired'));
      await api.patch('/auth/me/password', { newPassword }, token);
      toast.success(t('success'));
      router.push('/redirect');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorFallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    // max-md:min-h-dvh (lot 1) : tient compte du clavier virtuel sous 768px.
    // Sans effet à partir de 768px (min-h-screen inchangé).
    <div className="flex min-h-screen max-md:min-h-dvh flex-col bg-bg">
      <div
        aria-hidden
        className="h-0.5 w-full shrink-0"
        style={{ background: 'linear-gradient(90deg, #facc15, #b58900, transparent)' }}
      />

      {/* Logo — mobile uniquement (lot 1). Sans effet à partir de 768px. */}
      <div className="md:hidden flex justify-center pt-5 shrink-0">
        <Image src="/images/LOGO.png" alt="AlloAppart" width={220} height={63} className="h-9 w-auto" priority />
      </div>

      {/* Marges 16px + padding bas incluant --safe-bottom sous 768px (lot 1) ;
          px-6/py-10 inchangés à partir de 768px. */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 md:px-6 max-md:pb-[calc(2.5rem+var(--safe-bottom,0px))]">
        <div className="w-full max-w-sm">
          {/* Carte flottante retirée sous 768px (mode app : contenu pleine
              largeur, pas d'effet de carte) ; inchangée à partir de 768px. */}
          <div className="rounded-2xl border border-line bg-card p-6 shadow-lg max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-pale">
                <i className="fa-solid fa-lock-open text-xl text-gold-dark" />
              </div>
              <h1 className="text-xl font-bold text-text">{t('title')}</h1>
              <p className="mt-1 text-sm text-sub">{t('subtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
              <Field label={t('newPassword')}>
                <PwdInput
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showNew}
                  onToggle={() => setShowNew(!showNew)}
                  toggleLabel={showNew ? t('hidePassword') : t('showPassword')}
                />
              </Field>

              <Field label={t('confirmPassword')}>
                <PwdInput
                  value={confirmPwd}
                  onChange={setConfirmPwd}
                  show={showConfirm}
                  onToggle={() => setShowConfirm(!showConfirm)}
                  toggleLabel={showConfirm ? t('hidePassword') : t('showPassword')}
                />
              </Field>

              {error && (
                <p className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                  <i className="fa-solid fa-circle-exclamation shrink-0" /> {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-gold justify-center disabled:opacity-50">
                {loading
                  ? <><i className="fa-solid fa-spinner fa-spin" /> {t('saving')}</>
                  : <><i className="fa-solid fa-shield-check" /> {t('submit')}</>
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

function PwdInput({ value, onChange, show, onToggle, toggleLabel }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; toggleLabel: string;
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
        className="w-full rounded-xl border border-line bg-bg py-2 pl-10 pr-11 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition max-md:text-base"
      />
      <button
        type="button"
        onClick={onToggle}
        className="tap-target absolute right-3.5 top-1/2 -translate-y-1/2 text-sub hover:text-text transition"
        aria-label={toggleLabel}
      >
        <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
      </button>
    </div>
  );
}
