import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TarifsContent from './TarifsContent';
import type { PublicPricing } from './pricing';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) =>
    params ? `${ns}.${key}(${JSON.stringify(params)})` : `${ns}.${key}`,
  useLocale: () => 'fr',
}));

const PRICING: PublicPricing = {
  starterPriceFcfa: 75000,
  proPriceFcfaMonthly: 150000,
  nightlyCommissionRate: 0.1,
  monthlyCommissionMonths: 1,
  auditBasicPriceFcfa: 25000,
};

describe('TarifsContent', () => {
  it('affiche les deux plans avec les montants venant de la config (jamais en dur)', () => {
    render(<TarifsContent pricing={PRICING} />);
    expect(screen.getByText('75 000')).toBeInTheDocument();
    expect(screen.getByText('150 000')).toBeInTheDocument();
  });

  it('affiche la commission et AlloVérifié calculés depuis la config', () => {
    render(<TarifsContent pricing={PRICING} />);
    expect(screen.getByText('tarifs.commissionNightly({"rate":10})')).toBeInTheDocument();
    expect(screen.getByText('tarifs.commissionMonthly({"months":1})')).toBeInTheDocument();
    expect(screen.getByText('tarifs.auditValue({"price":"25 000"})')).toBeInTheDocument();
  });

  it('repli : affiche un message d\'indisponibilité quand pricing est null (endpoint en panne), jamais de montant inventé', () => {
    render(<TarifsContent pricing={null} />);
    const unavailable = screen.getAllByText('tarifs.unavailable');
    expect(unavailable.length).toBeGreaterThan(0);
    expect(screen.queryByText('75 000')).not.toBeInTheDocument();
    expect(screen.queryByText('150 000')).not.toBeInTheDocument();
  });

  it('les CTA pointent vers les parcours existants (devenir bailleur, contact e-mail réel)', () => {
    render(<TarifsContent pricing={PRICING} />);
    expect(screen.getByRole('link', { name: /tarifs.ctaBecomeBailleur/ })).toHaveAttribute('href', '/become-bailleur');
    expect(screen.getByRole('link', { name: /tarifs.ctaContact/ })).toHaveAttribute('href', 'mailto:alloappart221@gmail.com');
  });
});
