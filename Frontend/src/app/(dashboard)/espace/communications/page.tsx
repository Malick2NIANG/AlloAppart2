'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';

type Segment = 'ALL' | 'BAILLEURS' | 'LOCATAIRES' | 'PRO_AGENCES';

const SEGMENT_OPTIONS: { value: Segment; label: string }[] = [
  { value: 'ALL',        label: 'Tous les utilisateurs'  },
  { value: 'LOCATAIRES', label: 'Locataires uniquement'  },
  { value: 'BAILLEURS',  label: 'Bailleurs'              },
  { value: 'PRO_AGENCES', label: 'Agences PRO'           },
];

export default function AdminCommunicationsPage() {
  const { getToken } = useAuth();
  const [title, setTitle]     = useState('');
  const [message, setMessage] = useState('');
  const [segment, setSegment] = useState<Segment>('ALL');
  const [sending, setSending] = useState(false);
  const [flash, setFlash]     = useState<{ msg: string; ok: boolean } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!flash) return;
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 4000);
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, [flash]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getToken();
    if (!token) return;
    setSending(true);
    try {
      const res = await api.post<{ sent: boolean; recipients: number }>(
        '/notifications/broadcast',
        { title, message, segment },
        token,
      );
      setFlash({
        msg: `Notification envoyée à ${res.recipients} destinataire${res.recipients !== 1 ? 's' : ''}`,
        ok: true,
      });
      setTitle('');
      setMessage('');
      setSegment('ALL');
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : 'Erreur lors de l\'envoi', ok: false });
    } finally {
      setSending(false);
    }
  };

  const canSubmit = title.trim().length > 0 && message.trim().length > 0 && !sending;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Communications</h1>
        <p className="mt-1 text-sm text-sub">Notifications push et emails vers les utilisateurs</p>
      </div>

      {flash && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
          flash.ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          <i className={`fa-solid ${flash.ok ? 'fa-circle-check' : 'fa-circle-xmark'} text-base`} />
          {flash.msg}
        </div>
      )}

      <div className="space-y-4">
        {/* Push notifications */}
        <div className="rounded-2xl border border-line bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-pale">
              <i className="fa-solid fa-bell text-gold-dark" />
            </div>
            <div>
              <h2 className="font-semibold text-text">Notifications push (OneSignal)</h2>
              <p className="text-sm text-sub">Envoi d&apos;une notification à tous les utilisateurs ou un segment</p>
            </div>
          </div>

          <form onSubmit={handleSend} className="flex flex-col gap-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-sub">Titre</label>
                <span className="text-xs text-sub">{title.length}/50</span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 50))}
                placeholder="Ex : Nouvelle fonctionnalité disponible"
                maxLength={50}
                required
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-sub">Message</label>
                <span className="text-xs text-sub">{message.length}/200</span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="Corps de la notification..."
                maxLength={200}
                required
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 resize-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-sub">Segment cible</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as Segment)}
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text outline-none focus:border-gold"
              >
                {SEGMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gold-dark py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending
                ? <><i className="fa-solid fa-spinner fa-spin text-xs" />Envoi en cours...</>
                : <><i className="fa-solid fa-paper-plane text-xs" />Envoyer la notification</>}
            </button>
          </form>
        </div>

        {/* Email broadcast */}
        <div className="rounded-2xl border border-line bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-pale">
              <i className="fa-solid fa-envelope text-gold-dark" />
            </div>
            <div>
              <h2 className="font-semibold text-text">Email en masse</h2>
              <p className="text-sm text-sub">Envoi d&apos;un email transactionnel à un groupe d&apos;utilisateurs</p>
            </div>
            <span className="ml-auto text-xs border border-amber-200 bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 font-medium">
              Bientôt disponible
            </span>
          </div>
          <p className="text-sm text-sub">
            L&apos;intégration email sera disponible via{' '}
            <span className="font-medium text-text">Resend</span> ou{' '}
            <span className="font-medium text-text">SendGrid</span>. Les templates sont déjà configurés pour les notifications transactionnelles (réservations, vérifications…).
          </p>
        </div>

        {/* Log des notifications */}
        <div className="rounded-2xl border border-line bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-pale">
              <i className="fa-solid fa-list-check text-gold-dark" />
            </div>
            <div>
              <h2 className="font-semibold text-text">Notifications automatiques actives</h2>
              <p className="text-sm text-sub">Ces notifications sont déjà envoyées automatiquement</p>
            </div>
          </div>
          <ul className="space-y-2">
            {[
              { icon: 'fa-calendar-plus',        label: 'Nouvelle demande de réservation — bailleur notifié par email' },
              { icon: 'fa-circle-check',          label: 'Réservation confirmée — locataire notifié par email'          },
              { icon: 'fa-circle-xmark',          label: 'Réservation annulée — les deux parties notifiées'             },
              { icon: 'fa-shield-halved',         label: 'Badge AlloVérifié attribué — bailleur notifié'                },
              { icon: 'fa-triangle-exclamation',  label: 'Abonnement expirant — agence notifiée 7 jours avant'          },
            ].map((item) => (
              <li key={item.label} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <i className={`fa-solid ${item.icon} text-[10px] text-emerald-600`} />
                </span>
                <span className="text-text">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
