'use client';

/**
 * Graphes de tendance 12 mois de la Vue d'ensemble admin — alimentés par
 * /analytics/admin/monthly. Extraits pour garder OverviewAnalytics.tsx
 * lisible (config recharts : dégradés, tooltip, axes).
 */

import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/utils';
import {
  ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { NEON, THEME } from './KpiWidgets';

export interface MonthlyTrendPoint {
  label: string;
  newUsers: number;
  newListings: number;
  newBookings: number;
  revenue: number;
}

export function RevenueBookingsChart({ monthly, gradientId }: { monthly: MonthlyTrendPoint[]; gradientId: string }) {
  const t = useTranslations('admin');
  return (
    <div className="xl:col-span-2 rounded-2xl border border-line bg-card p-5">
      <p className="text-sm font-semibold text-text mb-4">
        <i className="fa-solid fa-chart-area mr-2" style={{ color: NEON.gold }} />
        {t('analyticsRevenueTrendTitle')}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={NEON.gold} stopOpacity={0.5} />
              <stop offset="100%" stopColor={NEON.gold} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={THEME.line} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: THEME.sub }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="revenue"
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11, fill: THEME.sub }} axisLine={false} tickLine={false} width={40}
          />
          <YAxis yAxisId="bookings" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: THEME.sub }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            contentStyle={{ background: THEME.card, border: `1px solid ${THEME.line}`, borderRadius: 12, fontSize: 12, color: THEME.text }}
            labelStyle={{ color: NEON.gold }}
            formatter={(v: ValueType | undefined, name) =>
              name === t('chartRevenueLabel') ? [formatPrice(Number(v)), name] : [Number(v), name]
            }
          />
          <Area yAxisId="revenue" type="monotone" dataKey="revenue" name={t('chartRevenueLabel')} stroke={NEON.gold} strokeWidth={2} fill={`url(#${gradientId})`} />
          <Line yAxisId="bookings" type="monotone" dataKey="newBookings" name={t('chartBookingsLabel')} stroke={NEON.cyan} strokeWidth={2} dot={{ r: 3, fill: NEON.cyan }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NewUsersChart({ monthly, gradientId }: { monthly: MonthlyTrendPoint[]; gradientId: string }) {
  const t = useTranslations('admin');
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="text-sm font-semibold text-text mb-4">
        <i className="fa-solid fa-user-plus mr-2" style={{ color: NEON.purple }} />
        {t('analyticsUsersTrendTitle')}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={NEON.purple} stopOpacity={0.95} />
              <stop offset="100%" stopColor={NEON.purple} stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={THEME.line} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: THEME.sub }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: THEME.sub }} axisLine={false} tickLine={false} width={26} />
          <Tooltip
            contentStyle={{ background: THEME.card, border: `1px solid ${THEME.line}`, borderRadius: 12, fontSize: 12, color: THEME.text }}
            formatter={(v: ValueType | undefined) => [Number(v), t('chartUsersLabel')]}
          />
          <Bar dataKey="newUsers" name={t('chartUsersLabel')} fill={`url(#${gradientId})`} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
