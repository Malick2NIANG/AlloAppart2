'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

type Segment = 'ALL' | 'BAILLEURS' | 'LOCATAIRES' | 'PRO_AGENCES';

export default function AdminCommunicationsPage() {
  const { getToken } = useAuth();
  const t = useTranslations('admin');
  const [title, setTitle]     = useState('');
  const [message, setMessage] = useState('');
  const [segment, setSegment] = useState<Segment>('ALL');
  const [sending, setSending] = useState(false);
  const [flash, setFlash]     = useState<{ msg: string; ok: boolean } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SEGMENT_OPTIONS: { value: Segment; label: string }[] = useMemo(() => [
    { value: 'ALL',         label: t('commsSegmentAll')         },
    { value: 'LOCATAIRES',  label: t('commsSegmentLocataires')  },
    { value: 'BAILLEURS',   label: t('commsSegmentBailleurs')   },
    { value: 'PRO_AGENCES', label: t('commsSegmentProAgences')  },
  ], [t]);

  const AUTO_NOTIFICATIONS = useMemo(() => [
    { key: 'a1', icon: 'fa-calendar-plus',       label: t('commsAuto1') },
    { key: 'a2', icon: 'fa-circle-check',        label: t('commsAuto2') },
    { key: 'a3', icon: 'fa-circle-xmark',        label: t('commsAuto3') },
    { key: 'a4', icon: 'fa-shield-halved',       label: t('commsAuto4') },
    { key: 'a5', icon: 'fa-triangle-exclamation', label: t('commsAuto5') },
  ], [t]);

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
      setFlash({ msg: t('commsSent', { count: res.recipients }), ok: true });
      setTitle('');
      setMessage('');
      setSegment('ALL');
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : t('commsSendError'), ok: false });
    } finally {
      setSending(false);
    }
  };

  const canSubmit = title.trim().length > 0 && message.trim().length > 0 && !sending;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">{t('commsTitle')}</h1>
        <p className="mt-1 text-sm text-sub">{t('commsSubtitle')}</p>
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
              <h2 className="font-semibold text-text">{t('commsPushTitle')}</h2>
              <p className="text-sm text-sub">{t('commsPushDesc')}</p>
            </div>
          </div>

          <form onSubmit={handleSend} className="flex flex-col gap-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-sub">{t('commsFieldTitle')}</label>
                <span className="text-xs text-sub">{title.length}/50</span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 50))}
                placeholder={t('commsFieldTitlePh')}
                maxLength={50}
                required
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-sub">{t('commsFieldMessage')}</label>
                <span className="text-xs text-sub">{message.length}/200</span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                rows={3}
                placeholder={t('commsFieldMessagePh')}
                maxLength={200}
                required
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 resize-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-sub">{t('commsFieldSegment')}</label>
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
                ? <><i className="fa-solid fa-spinner fa-spin text-xs" />{t('commsSending')}</>
                : <><i className="fa-solid fa-paper-plane text-xs" />{t('commsSend')}</>}
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
              <h2 className="font-semibold text-text">{t('commsEmailTitle')}</h2>
              <p className="text-sm text-sub">{t('commsEmailDesc')}</p>
            </div>
            <span className="ml-auto text-xs border border-amber-200 bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 font-medium">
              {t('commsComingSoon')}
            </span>
          </div>
          <p className="text-sm text-sub">{t('commsEmailNote')}</p>
        </div>

        {/* Log des notifications */}
        <div className="rounded-2xl border border-line bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-pale">
              <i className="fa-solid fa-list-check text-gold-dark" />
            </div>
            <div>
              <h2 className="font-semibold text-text">{t('commsAutoTitle')}</h2>
              <p className="text-sm text-sub">{t('commsAutoDesc')}</p>
            </div>
          </div>
          <ul className="space-y-2">
            {AUTO_NOTIFICATIONS.map((item) => (
              <li key={item.key} className="flex items-start gap-3 text-sm">
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
