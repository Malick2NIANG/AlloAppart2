'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { User } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface AgentStats {
  assigned: number;
  inProgress: number;
  doneThisMonth: number;
  doneTotal: number;
  averageRating: number | null;
  ratingCount: number;
}

export default function AgentProfilPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const toastRef     = useRef(toast);
  toastRef.current   = toast;

  const [user,    setUser]    = useState<User | null>(null);
  const [stats,   setStats]   = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [firstName,    setFirstName]    = useState('');
  const [lastName,     setLastName]     = useState('');
  const [phone,        setPhone]        = useState('');
  const [bio,          setBio]          = useState('');
  const [coverageZone, setCoverageZone] = useState('');
  const [avatar,       setAvatar]       = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const token = await getToken().catch(() => null);
    if (!token) return;
    try {
      const [me, st] = await Promise.all([
        api.get<User>('/auth/me', token),
        api.get<AgentStats>('/verifications/stats', token),
      ]);
      setUser(me);
      setStats(st);
      setFirstName(me.firstName ?? '');
      setLastName(me.lastName ?? '');
      setPhone(me.phone ?? '');
      setBio(me.bio ?? '');
      setCoverageZone(me.coverageZone ?? '');
      setAvatar(me.avatar ?? '');
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = await getToken().catch(() => null);
    if (!token) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json() as { url?: string };
      if (data.url) { setAvatar(data.url); }
    } catch { toastRef.current.error('Erreur upload photo'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getToken().catch(() => null);
    if (!token) return;
    setSaving(true);
    try {
      const updated = await api.patch<User>('/auth/me', {
        firstName:    firstName.trim() || undefined,
        lastName:     lastName.trim()  || undefined,
        phone:        phone.trim()     || undefined,
        bio:          bio.trim()       || undefined,
        coverageZone: coverageZone.trim() || undefined,
        avatar:       avatar           || undefined,
      }, token);
      setUser(updated);
      toastRef.current.success('Profil mis à jour !');
    } catch { toastRef.current.error('Erreur lors de la mise à jour.'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
    </div>
  );
  if (!user) return null;

  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <h1 className="text-xl font-extrabold text-text">
        <i className="fa-solid fa-user-circle text-gold-dark mr-2" />
        Mon profil
      </h1>

      {/* ── Stats résumé ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: 'fa-calendar-check', label: 'Planifiées',    val: stats.assigned,      color: 'text-blue-600',    bg: 'bg-blue-50' },
            { icon: 'fa-person-walking', label: 'En cours',      val: stats.inProgress,    color: 'text-purple-600',  bg: 'bg-purple-50' },
            { icon: 'fa-shield-check',   label: 'Ce mois',       val: stats.doneThisMonth, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: 'fa-star',           label: 'Note moy.',     val: stats.averageRating != null ? stats.averageRating.toFixed(1) : '—', color: 'text-gold-dark', bg: 'bg-gold-pale' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-card p-4 flex flex-col items-center gap-1.5">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${s.bg}`}>
                <i className={`fa-solid ${s.icon} ${s.color} text-sm`} />
              </div>
              <p className="text-xl font-extrabold text-text">{s.val}</p>
              <p className="text-[10px] font-medium text-sub">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Formulaire profil ── */}
      <form onSubmit={(e) => void handleSave(e)} className="rounded-2xl border border-line bg-card p-5 space-y-5">

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Avatar" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gold-pale flex items-center justify-center text-xl font-extrabold text-gold-dark">
                {initials || <i className="fa-solid fa-user" />}
              </div>
            )}
            <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploading}
              className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-xl bg-gold-dark text-white flex items-center justify-center hover:bg-gold-dark/90 transition-colors shadow-sm">
              {uploading
                ? <i className="fa-solid fa-spinner fa-spin text-[10px]" />
                : <i className="fa-solid fa-camera text-[10px]" />}
            </button>
          </div>
          <div>
            <p className="font-bold text-text">{firstName} {lastName}</p>
            <p className="text-xs text-sub mt-0.5">{user.email}</p>
            <p className="text-[11px] font-medium bg-gold-pale text-gold-dark rounded-full px-2.5 py-0.5 inline-block mt-1.5">
              <i className="fa-solid fa-id-badge mr-1 text-[9px]" />Agent terrain
            </p>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>

        {/* Nom / Prénom */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 block">Prénom</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
              placeholder="Prénom" maxLength={100}
              className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 block">Nom</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)}
              placeholder="Nom" maxLength={100}
              className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40" />
          </div>
        </div>

        {/* Téléphone */}
        <div>
          <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 block">Téléphone</label>
          <div className="relative">
            <i className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-sub text-xs" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              type="tel" placeholder="+221 77 000 00 00"
              className="w-full rounded-xl border border-line bg-bg pl-9 pr-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40" />
          </div>
        </div>

        {/* Zone de couverture */}
        <div>
          <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 block">
            Zone de couverture
          </label>
          <div className="relative">
            <i className="fa-solid fa-location-dot absolute left-3.5 top-1/2 -translate-y-1/2 text-sub text-xs" />
            <input value={coverageZone} onChange={(e) => setCoverageZone(e.target.value)}
              placeholder="Ex : Dakar, Plateau, Mermoz…" maxLength={200}
              className="w-full rounded-xl border border-line bg-bg pl-9 pr-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40" />
          </div>
          <p className="text-[11px] text-sub mt-1.5">Les quartiers ou villes où vous intervenez.</p>
        </div>

        {/* Bio */}
        <div>
          <label className="text-[11px] font-bold text-sub uppercase tracking-wide mb-1.5 flex items-center justify-between">
            <span>Bio / Présentation</span>
            <span className={`font-medium ${bio.length > 450 ? 'text-amber-500' : 'text-sub'}`}>{bio.length}/500</span>
          </label>
          <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            placeholder="Parlez brièvement de votre expérience, vos points forts en tant qu'agent terrain…"
            className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none" />
        </div>

        {/* Submit */}
        <button type="submit" disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gold-dark hover:bg-gold-dark/90 text-white font-semibold py-3 disabled:opacity-50 transition-colors">
          {saving
            ? <><i className="fa-solid fa-spinner fa-spin" /> Enregistrement…</>
            : <><i className="fa-solid fa-floppy-disk text-sm" /> Enregistrer les modifications</>}
        </button>
      </form>

      {/* ── Infos compte ── */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-3">
        <h2 className="text-xs font-bold text-sub uppercase tracking-wider">Informations du compte</h2>
        <div className="divide-y divide-line">
          {[
            { icon: 'fa-envelope', label: 'Email', val: user.email },
            { icon: 'fa-calendar', label: 'Membre depuis', val: new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
            { icon: 'fa-shield-check', label: 'Certifications totales', val: stats?.doneTotal ?? '—' },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-bg flex items-center justify-center">
                  <i className={`fa-solid ${r.icon} text-sub text-[11px]`} />
                </div>
                <p className="text-xs font-medium text-sub">{r.label}</p>
              </div>
              <p className="text-sm font-semibold text-text">{r.val}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
