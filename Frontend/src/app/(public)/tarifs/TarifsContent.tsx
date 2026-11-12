'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import type { PublicPricing } from './pricing';

interface Props {
  pricing: PublicPricing | null;
}

/**
 * Contenu de /tarifs, séparé de page.tsx (Server Component) pour rester
 * testable avec Vitest/RTL comme un composant ordinaire (voir
 * TarifsContent.test.tsx) — même découpage que MiloFaqCard.
 *
 * `pricing` vient toujours de PlatformConfigService (GET /tarifs) : aucun
 * montant n'est écrit en dur ici, seuls les libellés de plans/fonctionnalités
 * (`bailleur.plan*`) sont repris tels quels de /bailleur/abonnement, et la
 * durée de validité AlloVérifié (6 mois) est reprise des CGU — non
 * configurable, donc pas une valeur à aller chercher en direct.
 */
export default function TarifsContent({ pricing }: Props) {
  const t      = useTranslations('tarifs');
  const tb     = useTranslations('bailleur');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  const fmt = (n: number) => n.toLocaleString(numLocale);

  const PLANS = pricing
    ? [
        {
          key: 'STARTER',
          name: 'Starter',
          price: fmt(pricing.starterPriceFcfa),
          listings: tb('planStarterListings'),
          features: [tb('planStarterFeature1'), tb('planStarterFeature2'), tb('planStarterFeature3'), tb('planStarterFeature4')],
        },
        {
          key: 'PRO',
          name: 'Pro',
          price: fmt(pricing.proPriceFcfaMonthly),
          listings: tb('planProListings'),
          features: [tb('planProFeature1'), tb('planProFeature2'), tb('planProFeature3'), tb('planProFeature4'), tb('planProFeature5')],
          highlighted: true,
        },
      ]
    : [];

  return (
    <main className="min-h-screen bg-bg py-14 px-4">
      <div className="aa-container max-w-5xl">

        {/* En-tête */}
        <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-pale px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-gold-dark mb-3">
            <i className="fa-solid fa-tag text-[9px]" /> {t('badge')}
          </span>
          <h1 className="text-3xl font-extrabold text-text md:text-4xl">{t('title')}</h1>
          <p className="mt-2 text-sub">{tb('abonnementSubtitle')}</p>
        </div>

        {/* Particuliers — gratuit */}
        <section className="mb-8 rounded-2xl border border-line bg-card p-6 text-center">
          <h2 className="text-lg font-bold text-text">{t('individualTitle')}</h2>
          <p className="mt-1 text-3xl font-extrabold text-gold-dark">{t('individualPrice')}</p>
          <p className="mt-2 text-sm text-sub">{tb('listingLimitBannerText')}</p>
        </section>

        {/* Agences — plans */}
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-gold-dark">
          {t('agencyTitle')}
        </h2>
        {pricing ? (
          <div className="grid gap-6 md:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative rounded-2xl border p-6 transition ${
                  plan.highlighted ? 'border-gold bg-gold-pale/30 dark:bg-gold-dark/10 shadow-md' : 'border-line bg-card'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-1 text-xs font-bold text-gray-900">
                    {tb('abonnementPopular')}
                  </span>
                )}
                <h3 className="text-lg font-bold text-text">{plan.name}</h3>
                <p className="mt-1 text-3xl font-extrabold text-text">
                  {plan.price} <span className="text-base font-medium text-sub">{tb('fcfaPerMonth')}</span>
                </p>
                <p className="mt-1 text-sm text-sub">{plan.listings}</p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-text">
                      <i className="fa-solid fa-check text-gold-dark text-xs" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div
            role="status"
            className="rounded-2xl border border-line bg-card p-8 text-center text-sm text-sub"
          >
            <i className="fa-solid fa-circle-exclamation mb-2 block text-lg text-gold-dark" />
            {t('unavailable')}
          </div>
        )}

        {/* Commission + AlloVérifié */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-card p-5">
            <h3 className="text-sm font-semibold text-text">{t('commissionTitle')}</h3>
            {pricing ? (
              <ul className="mt-2 space-y-1.5 text-sm text-sub">
                <li>{t('commissionNightly', { rate: Math.round(pricing.nightlyCommissionRate * 100) })}</li>
                <li>{t('commissionMonthly', { months: pricing.monthlyCommissionMonths })}</li>
              </ul>
            ) : (
              <p className="mt-2 text-sm text-sub">{t('unavailable')}</p>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <h3 className="text-sm font-semibold text-text">{t('auditTitle')}</h3>
            {pricing ? (
              <p className="mt-2 text-sm text-sub">{t('auditValue', { price: fmt(pricing.auditBasicPriceFcfa) })}</p>
            ) : (
              <p className="mt-2 text-sm text-sub">{t('unavailable')}</p>
            )}
          </div>
        </section>

        {/* Moyens de paiement */}
        <p className="mt-6 text-center text-xs text-sub">{tb('abonnementSecureNote')}</p>

        {/* CTA */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/become-bailleur"
            className="tap-target btn-gold justify-center rounded-full px-6 py-3 text-sm font-bold"
          >
            <i className="fa-solid fa-house-chimney-user" /> {t('ctaBecomeBailleur')}
          </Link>
          <a
            href="mailto:alloappart221@gmail.com"
            className="tap-target inline-flex items-center justify-center gap-2 rounded-full border border-line bg-card px-6 py-3 text-sm font-semibold text-text hover:border-gold/50 hover:text-gold-dark transition-colors"
          >
            <i className="fa-solid fa-envelope" /> {t('ctaContact')}
          </a>
        </div>

      </div>
    </main>
  );
}
