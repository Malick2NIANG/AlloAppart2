'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { Verification } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface DetailVerif extends Omit<Verification, 'listing' | 'agent'> {
  listing?: {
    id: string; title: string; city: string; address?: string;
    images: string[]; lat?: number; lng?: number;
    owner?: { id: string; firstName: string; lastName: string; phone?: string; email?: string };
  };
  agent?: { id: string; firstName: string; lastName: string };
}

const STATUS_STEPS = ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'DONE'] as const;

export default function MissionDetailPage() {
  const { id }       = useParams<{ id: string }>();
  const router       = useRouter();
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const t            = useTranslations('agent');
  const locale       = useLocale();
  const numLocale    = locale === 'en' ? 'en-US' : 'fr-FR';
  const toastRef     = useRef(toast);
  toastRef.current   = toast;
  const tRef         = useRef(t);
  tRef.current       = t;

  const [v,               setV]               = useState<DetailVerif | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [acting,          setActing]          = useState(false);
  const [activeImg,       setActiveImg]       = useState(0);
  const [showComplete,    setShowComplete]    = useState(false);
  const [showDecline,     setShowDecline]     = useState(false);
  const [notes,           setNotes]           = useState('');
  const [reportUrl,       setReportUrl]       = useState('');
  const [tourUrl,         setTourUrl]         = useState('');
  const [photos,          setPhotos]          = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [declineReason,   setDeclineReason]   = useState('');
  const photoRef = useRef<HTMLInputElement>(null);

  const STATUS_LABEL: Record<string, string> = {
    REQUESTED:       t('statusRequested'),
    SCHEDULED:       t('statusScheduled'),
    IN_PROGRESS:     t('statusInProgress'),
    DONE:            t('statusDone'),
    REJECTED:        t('statusRejected'),
    DECLINE_PENDING: t('statusDeclinePending'),
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(numLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString(numLocale, { hour: '2-digit', minute: '2-digit' });

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<DetailVerif>(`/verifications/${id}/detail`, token);
      setV(data);
    } catch {
      toastRef.current.error(tRef.current('missionNotFound'));
      router.push('/agent/verifications');
    } finally { setLoading(false); }
  }, [id, getToken, router]);

  useEffect(() => { void load(); }, [load]);

  const doAction = async (action: 'start' | 'complete' | 'decline', body?: object) => {
    const token = await getToken();
    if (!token) return;
    setActing(true);
    try {
      await api.patch(`/verifications/${id}/${action}`, body ?? {}, token);
      toastRef.current.success(
        action === 'start' ? t('actionStarted') :
        action === 'complete' ? t('actionCertifiedDetail') : t('declineSubmittedAdmin'),
      );
      await load();
      setShowComplete(false); setShowDecline(false);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? t('genericError');
      toastRef.current.error(msg);
    } finally { setActing(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const token = await getToken().catch(() => null);
    if (!token) return;
    setUploadingPhotos(true);
    for (const file of files) {
      try {
        const form = new FormData();
        form.append('file', file);
        const res  = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
        const data = await res.json() as { url?: string };
        if (data.url) setPhotos((p) => [...p, data.url!]);
      } catch { /* skip */ }
    }
    setUploadingPhotos(false);
    e.target.value = '';
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
    </div>
  );
  if (!v) return null;

  const isScheduled  = v.status === 'SCHEDULED';
  const isInProgress = v.status === 'IN_PROGRESS';
  const isDone       = v.status === 'DONE';
  const earliest     = new Date(new Date(v.scheduledAt).getTime() - 15 * 60 * 1000);
  const canStart     = new Date() >= earliest;
  const minsLeft     = Math.ceil((earliest.getTime() - Date.now()) / 60000);
  const stepIdx      = STATUS_STEPS.indexOf(v.status as typeof STATUS_STEPS[number]);
  const mapsUrl      = v.listing?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.listing.address}, ${v.listing.city}`)}`
    : v.listing?.lat && v.listing.lng
      ? `https://www.google.com/maps/?q=${v.listing.lat},${v.listing.lng}`
      : null;

  const images = v.listing?.images ?? [];

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* ── Retour ── */}
      <Link href="/agent/verifications" className="inline-flex items-center gap-2 text-sm text-sub hover:text-gold-dark transition-colors">
        <i className="fa-solid fa-arrow-left text-xs" /> {t('backToMissions')}
      </Link>

      {/* ── Header mission ── */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
            isInProgress ? 'bg-purple-50' : isDone ? 'bg-emerald-50' : 'bg-blue-50'
          }`}>
            <i className={`fa-solid text-sm ${
              isInProgress ? 'fa-person-walking text-purple-600' : isDone ? 'fa-shield-check text-emerald-600' : 'fa-calendar-check text-blue-600'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold text-text leading-tight">{v.listing?.title ?? t('missionFallback')}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                isInProgress ? 'bg-purple-50 text-purple-600' : isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
              }`}>{STATUS_LABEL[v.status] ?? v.status}</span>
              <span className="text-[11px] font-medium bg-gold-pale text-gold-dark px-2.5 py-0.5 rounded-full">
                {v.auditType === 'BASIC' ? t('auditBasic') : t('auditFull')}
              </span>
            </div>
          </div>
        </div>

        {/* Date / heure */}
        <div className="flex items-center gap-2 text-sm text-sub mt-2">
          <i className="fa-regular fa-calendar text-gold-dark text-xs" />
          <span>{fmtDate(v.scheduledAt)} · <strong className="text-text">{fmtTime(v.scheduledAt)}</strong></span>
        </div>
      </div>

      {/* ── Timeline statut ── */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-xs font-bold text-sub uppercase tracking-wider mb-4">{t('progression')}</h2>
        <div className="flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => {
            const done    = stepIdx >= i;
            const current = stepIdx === i;
            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-colors ${
                    done
                      ? current
                        ? 'bg-gold-dark border-gold-dark text-white'
                        : 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-bg border-line text-sub'
                  }`}>
                    {done && !current ? <i className="fa-solid fa-check text-[9px]" /> : i + 1}
                  </div>
                  <p className={`text-[9px] font-medium whitespace-nowrap ${done ? 'text-text' : 'text-sub'}`}>
                    {STATUS_LABEL[step]}
                  </p>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${stepIdx > i ? 'bg-emerald-400' : 'bg-line'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Images du logement ── */}
      {images.length > 0 && (
        <div className="rounded-2xl border border-line bg-card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[activeImg]} alt={v.listing?.title ?? ''} className="w-full h-52 object-cover" />
          {images.length > 1 && (
            <div className="flex gap-1.5 p-3 overflow-x-auto">
              {images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img} alt={`${i + 1}`}
                  onClick={() => setActiveImg(i)}
                  className={`h-12 w-16 object-cover rounded-lg cursor-pointer shrink-0 transition-all ${
                    i === activeImg ? 'ring-2 ring-gold-dark' : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Adresse + Maps ── */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-xs font-bold text-sub uppercase tracking-wider mb-3">{t('localisation')}</h2>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-text text-sm">{v.listing?.address ?? t('addressMissing')}</p>
            <p className="text-xs text-sub mt-0.5">
              <i className="fa-solid fa-location-dot text-gold-dark text-[10px] mr-1" />
              {v.listing?.city}
            </p>
          </div>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-gold-pale text-gold-dark text-xs font-semibold px-3 py-2 hover:bg-gold/20 transition-colors">
              <i className="fa-solid fa-map-location-dot text-sm" /> {t('itinerary')}
            </a>
          )}
        </div>
      </div>

      {/* ── Propriétaire ── */}
      {v.listing?.owner && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-xs font-bold text-sub uppercase tracking-wider mb-3">{t('ownerLabel')}</h2>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gold-pale flex items-center justify-center text-sm font-bold text-gold-dark shrink-0">
                {v.listing.owner.firstName[0]}{v.listing.owner.lastName[0]}
              </div>
              <div>
                <p className="font-semibold text-text text-sm">{v.listing.owner.firstName} {v.listing.owner.lastName}</p>
                <p className="text-xs text-sub">{t('ownerLabel')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {v.listing.owner.phone && (
                <a href={`tel:${v.listing.owner.phone}`}
                  className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors"
                  title={t('callTitle')}>
                  <i className="fa-solid fa-phone text-sm" />
                </a>
              )}
              <Link href={`/agent/messages?listing=${v.listingId}`}
                className="h-9 w-9 rounded-full bg-gold-pale flex items-center justify-center text-gold-dark hover:bg-gold/20 transition-colors"
                title={t('chatTitle')}>
                <i className="fa-solid fa-comment-dots text-sm" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Photos de visite (si DONE) ── */}
      {isDone && v.photos && v.photos.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-xs font-bold text-sub uppercase tracking-wider mb-3">{t('visitPhotosCount', { count: v.photos.length })}</h2>
          <div className="grid grid-cols-3 gap-2">
            {v.photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`${i + 1}`} className="aspect-square rounded-xl object-cover" />
            ))}
          </div>
        </div>
      )}

      {/* ── Rapport (si DONE) ── */}
      {isDone && (v.notes ?? v.reportUrl) && (
        <div className="rounded-2xl border border-line bg-card p-5 space-y-3">
          <h2 className="text-xs font-bold text-sub uppercase tracking-wider">{t('reportTitle')}</h2>
          {v.notes && <p className="text-sm text-text leading-relaxed">{v.notes}</p>}
          {v.reportUrl && (
            <a href={v.reportUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-gold-dark text-sm hover:underline">
              <i className="fa-solid fa-file-lines" /> {t('seeFullReport')}
            </a>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      {(isScheduled || isInProgress) && v.status !== 'DECLINE_PENDING' && (
        <div className="space-y-3">
          {isScheduled && (
            canStart ? (
              <button onClick={() => void doAction('start')} disabled={acting}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gold-dark hover:bg-gold-dark/90 text-white font-semibold py-3.5 disabled:opacity-50 transition-colors">
                {acting ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-play text-sm" /> {t('startVisit')}</>}
              </button>
            ) : (
              <div className="w-full flex items-center gap-3 rounded-2xl bg-blue-50 border border-blue-200 px-5 py-3.5">
                <i className="fa-solid fa-clock text-blue-500 text-lg shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-700">{t('visitScheduledAt', { time: fmtTime(v.scheduledAt) })}</p>
                  <p className="text-xs text-blue-500">{t('startAvailableIn', { mins: minsLeft })}</p>
                </div>
              </div>
            )
          )}
          {isInProgress && (
            <button onClick={() => setShowComplete(true)} disabled={acting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 disabled:opacity-50 transition-colors">
              <i className="fa-solid fa-shield-check text-sm" /> {t('certifyProperty')}
            </button>
          )}
          {isScheduled && (
            <button onClick={() => setShowDecline(true)} disabled={acting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-amber-200 text-amber-600 hover:bg-amber-50 font-medium py-3 text-sm transition-colors">
              <i className="fa-solid fa-xmark" /> {t('declineMission')}
            </button>
          )}
        </div>
      )}

      {/* ── Modal Certifier ── */}
      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowComplete(false)}>
          <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-text text-lg">{t('certifyModalTitle')}</h3>
            <p className="text-sm text-sub">{t('missionLabel')} <span className="font-semibold text-text">{v.listing?.title}</span></p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-sub uppercase tracking-wide mb-1.5 block">{t('fieldObservations')}</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('fieldObservationsPh')}
                  className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub uppercase tracking-wide mb-1.5 block">
                  {t('fieldPhotosCount', { count: photos.length })}
                </label>
                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {photos.map((url, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <i className="fa-solid fa-xmark text-[9px]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => photoRef.current?.click()} disabled={uploadingPhotos}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-bg py-2.5 text-sm text-sub hover:border-gold/40 hover:text-gold-dark transition-colors">
                  {uploadingPhotos ? <><i className="fa-solid fa-spinner fa-spin" /> {t('uploading')}</> : <><i className="fa-solid fa-camera" /> {t('addPhotos')}</>}
                </button>
                <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub uppercase tracking-wide mb-1.5 block">{t('fieldReportUrlShort')}</label>
                <input type="url" value={reportUrl} onChange={(e) => setReportUrl(e.target.value)}
                  placeholder="https://drive.google.com/..." className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub uppercase tracking-wide mb-1.5 block">
                  {t('fieldTour3d')} <span className="text-gold-dark font-bold">AlloVérifié™</span> <span className="text-sub font-normal">{t('fieldOptional')}</span>
                </label>
                <input type="url" value={tourUrl} onChange={(e) => setTourUrl(e.target.value)}
                  placeholder="https://lumalabs.ai/capture/..." className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowComplete(false); setPhotos([]); }}
                className="flex-1 rounded-xl border border-line text-sub hover:bg-bg text-sm font-medium py-2.5 transition-colors">
                {t('cancel')}
              </button>
              <button onClick={() => void doAction('complete', { notes: notes.trim() || undefined, reportUrl: reportUrl.trim() || undefined, tourUrl: tourUrl.trim() || undefined, photos: photos.length ? photos : undefined })}
                disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 disabled:opacity-50 transition-colors">
                {acting ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-shield-check" /> {t('certify')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Décliner ── */}
      {showDecline && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowDecline(false)}>
          <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-text text-lg">{t('declineMission')}</h3>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
              <i className="fa-solid fa-circle-info text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">{t('declineInfoShort')}</p>
            </div>
            <textarea rows={4} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}
              placeholder={t('declineReasonPhShort')}
              maxLength={500}
              className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
            <p className="text-[11px] text-sub text-right -mt-2">{declineReason.length}/500</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDecline(false); setDeclineReason(''); }}
                className="flex-1 rounded-xl border border-line text-sub hover:bg-bg text-sm font-medium py-2.5 transition-colors">
                {t('cancel')}
              </button>
              <button onClick={() => void doAction('decline', { reason: declineReason })}
                disabled={!declineReason.trim() || acting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 disabled:opacity-50 transition-colors">
                {acting ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-paper-plane text-xs" /> {t('submit')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
