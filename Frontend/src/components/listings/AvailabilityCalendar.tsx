'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';

export interface BookedRange {
  startDate: string;
  endDate: string | null;
  status: string;
}

interface Props {
  ranges: BookedRange[];
  loading: boolean;
  /** Date sélectionnée (YYYY-MM-DD) — null si aucune. */
  selectedStart: string | null;
  selectedEnd: string | null;
  /** Appelé avec une date au format YYYY-MM-DD quand un jour disponible est cliqué. */
  onSelectDate: (iso: string) => void;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function isBooked(day: Date, ranges: BookedRange[]): boolean {
  const d = day.getTime();
  for (const r of ranges) {
    const start = new Date(r.startDate).setHours(0, 0, 0, 0);
    const end   = r.endDate
      ? new Date(r.endDate).setHours(23, 59, 59, 999)
      : new Date('9999-12-31').getTime();
    if (d >= start && d <= end) return true;
  }
  return false;
}

/** Formate une Date en YYYY-MM-DD en heure locale (évite le décalage UTC de toISOString). */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AvailabilityCalendar({ ranges, loading, selectedStart, selectedEnd, onSelectDate }: Props) {
  const [year, setYear]   = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());

  const t         = useTranslations('detail');
  const locale    = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  /* Noms de mois / jours localisés — semaine commençant lundi */
  const MONTHS = useMemo(
    () => Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(numLocale, { month: 'long' }).format(new Date(2024, i, 1))),
    [numLocale],
  );
  const DAYS = useMemo(
    () => Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(numLocale, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i))),
    [numLocale],
  );

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // Monday-based offset
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalCells  = startOffset + lastDay.getDate();
  const rows        = Math.ceil(totalCells / 7);
  const today       = new Date();

  const startObj = selectedStart ? new Date(`${selectedStart}T00:00:00`) : null;
  const endObj   = selectedEnd   ? new Date(`${selectedEnd}T00:00:00`)   : null;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < rows * 7; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) {
      cells.push(null);
    } else {
      cells.push(new Date(year, month, dayNum));
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text text-sm">{t('availabilityTitle')}</h3>
        <div className="flex items-center gap-2">
          <button type="button" onClick={prev} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-bg transition">
            <i className="fa-solid fa-chevron-left text-xs text-sub" />
          </button>
          <span className="text-sm font-medium text-text min-w-[140px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button type="button" onClick={next} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-bg transition">
            <i className="fa-solid fa-chevron-right text-xs text-sub" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <i className="fa-solid fa-spinner fa-spin text-gold" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d, i) => (
              <div key={i} className="text-center text-xs font-semibold text-sub py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const booked   = isBooked(day, ranges);
              const past     = day < today && !isSameDay(day, today);
              const isToday  = isSameDay(day, today);
              const disabled = booked || past;
              const isStart  = startObj && isSameDay(day, startObj);
              const isEnd    = endObj && isSameDay(day, endObj);
              const inRange  = !!startObj && !!endObj && day > startObj && day < endObj;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectDate(toLocalISODate(day))}
                  className={`flex items-center justify-center h-9 rounded-lg text-xs font-medium transition ${
                    booked
                      ? 'bg-red-100 text-red-500 line-through cursor-not-allowed'
                      : past
                        ? 'text-sub/40 cursor-not-allowed'
                        : isStart || isEnd
                          ? 'bg-gold text-gray-900 font-bold ring-2 ring-gold-dark'
                          : inRange
                            ? 'bg-gold-pale text-gold-dark'
                            : isToday
                              ? 'border border-gold text-gold-dark font-bold'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-sub">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-green-50 border border-green-200" />
              {t('availabilityLegendAvailable')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-red-100 border border-red-200" />
              {t('availabilityLegendBooked')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
