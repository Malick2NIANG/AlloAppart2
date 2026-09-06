import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { RentalMode } from '@/types';

const DEFAULT_MIN_LEASE_MONTHS = 1;

interface Props {
  rentalMode: RentalMode;
  minimumNights?: number | null;
  maximumNights?: number | null;
  minLeaseMonths?: number | null;
  depositMonths?: number | null;
  chargesIncluded?: boolean | null;
  cleaningFee?: number | null;
}

const MODE_ICON: Record<RentalMode, string> = {
  NIGHTLY: 'fa-moon',
  MONTHLY: 'fa-key',
  MIXED: 'fa-shuffle',
};

/**
 * Carte "Conditions de location" affichée sur la fiche annonce : rend
 * explicites (a) le mode de location et (b) les règles fixées par le
 * bailleur pour CETTE annonce (séjour min/max, caution, durée de bail,
 * charges, ménage), puis (c) les règles générales de la plateforme
 * (commission, annulation, fenêtre de litige) — cf. CGU pour le détail
 * légal complet.
 *
 * ⚠️ Les valeurs de commission/annulation/litige affichées ici doivent
 * rester synchronisées avec Backend/src/bookings/bookings.service.ts et
 * avec /cgu (sections "tarifs", "annulation", "litiges").
 */
export default async function RentalTermsCard({
  rentalMode,
  minimumNights,
  maximumNights,
  minLeaseMonths,
  depositMonths,
  chargesIncluded,
  cleaningFee,
}: Props) {
  const t = await getTranslations('detail');

  const showNightlyRules = rentalMode === 'NIGHTLY' || rentalMode === 'MIXED';
  const showMonthlyRules = rentalMode === 'MONTHLY' || rentalMode === 'MIXED';

  const rules: { icon: string; label: string; value: string }[] = [];
  if (showNightlyRules && minimumNights) {
    rules.push({ icon: 'fa-arrow-down-short-wide', label: t('ruleMinNights'), value: t('ruleMinNightsValue', { count: minimumNights }) });
  }
  if (showNightlyRules && maximumNights) {
    rules.push({ icon: 'fa-arrow-up-short-wide', label: t('ruleMaxNights'), value: t('ruleMaxNightsValue', { count: maximumNights }) });
  }
  if (showMonthlyRules && minLeaseMonths) {
    rules.push({ icon: 'fa-calendar-days', label: t('ruleMinLease'), value: t('ruleMinLeaseValue', { count: minLeaseMonths }) });
  }
  if (showMonthlyRules && depositMonths) {
    rules.push({ icon: 'fa-shield-halved', label: t('ruleDeposit'), value: t('ruleDepositValue', { count: depositMonths }) });
  }
  if (showMonthlyRules && chargesIncluded != null) {
    rules.push({
      icon: chargesIncluded ? 'fa-plug-circle-check' : 'fa-plug-circle-xmark',
      label: chargesIncluded ? t('ruleChargesIncludedYes') : t('ruleChargesIncludedNo'),
      value: '',
    });
  }
  if (showNightlyRules && cleaningFee) {
    rules.push({ icon: 'fa-broom', label: t('ruleCleaningFee'), value: `${cleaningFee.toLocaleString()} FCFA` });
  }

  const effectiveMinLeaseMonths = minLeaseMonths ?? DEFAULT_MIN_LEASE_MONTHS;

  return (
    <div className="bg-card backdrop-blur-xl border border-line rounded-3xl p-6 md:p-8 shadow-lg">
      <h2 className="text-xl md:text-2xl font-semibold text-text mb-4">{t('rentalTermsTitle')}</h2>

      {/* Mode de location */}
      <div className="flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold-pale/60 px-4 py-3">
        <span className="h-9 w-9 rounded-full bg-gold-pale text-gold-dark inline-grid place-items-center shrink-0">
          <i className={`fa-solid ${MODE_ICON[rentalMode]} text-sm`} />
        </span>
        <div>
          <p className="text-xs font-medium text-gold-dark/70 mb-0.5">{t('modeLabel')}</p>
          <p className="font-semibold text-gold-dark">
            {rentalMode === 'NIGHTLY' && t('modeNightly')}
            {rentalMode === 'MONTHLY' && t('modeMonthly')}
            {rentalMode === 'MIXED' && t('modeMixed')}
          </p>
          <p className="text-xs text-gold-dark/80 mt-0.5">
            {rentalMode === 'NIGHTLY' && t('modeNightlyDesc')}
            {rentalMode === 'MONTHLY' && t('modeMonthlyDesc')}
            {rentalMode === 'MIXED' && t('modeMixedDesc')}
          </p>
        </div>
      </div>

      {/* Seuil nuitée/mensuel (annonces mixtes) */}
      {rentalMode === 'MIXED' && (
        <p className="mt-3 flex items-start gap-2 text-xs text-sub">
          <i className="fa-solid fa-circle-info mt-0.5 shrink-0 text-gold-dark" />
          {t('mixedThresholdNote', { months: effectiveMinLeaseMonths })}
        </p>
      )}

      {/* Règles fixées par le bailleur */}
      {rules.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-text mb-3">{t('landlordRulesTitle')}</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {rules.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="h-7 w-7 rounded-full bg-bg text-gold-dark border border-line inline-grid place-items-center shrink-0">
                  <i className={`fa-solid ${r.icon} text-[11px]`} />
                </span>
                <div>
                  <p className="text-text font-medium leading-tight">{r.label}</p>
                  {r.value && <p className="text-xs text-sub">{r.value}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Règles générales AlloAppart */}
      <div className="mt-5 pt-5 border-t border-line">
        <h3 className="text-sm font-semibold text-text mb-3">{t('generalRulesTitle')}</h3>
        <ul className="space-y-2.5 text-xs text-sub">
          {showMonthlyRules && (
            <li className="flex items-start gap-2">
              <i className="fa-solid fa-sack-dollar mt-0.5 shrink-0 text-gold-dark" />
              {t('generalRuleCommissionMonthly')}
            </li>
          )}
          {showNightlyRules && (
            <li className="flex items-start gap-2">
              <i className="fa-solid fa-calendar-xmark mt-0.5 shrink-0 text-gold-dark" />
              {t('generalRuleCancellation')}
            </li>
          )}
          <li className="flex items-start gap-2">
            <i className="fa-solid fa-scale-balanced mt-0.5 shrink-0 text-gold-dark" />
            {t('generalRuleDisputeWindow')}
          </li>
        </ul>
        <Link
          href="/cgu#tarifs"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gold-dark hover:text-gold underline underline-offset-2"
        >
          <i className="fa-solid fa-file-lines text-[10px]" />
          {t('viewFullTermsLink')}
        </Link>
      </div>
    </div>
  );
}
