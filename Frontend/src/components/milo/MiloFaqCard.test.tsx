import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MiloFaqCard from './MiloFaqCard';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `miloFaq.${key}`,
}));

describe('MiloFaqCard', () => {
  it('affiche le texte résolu via answerKey, aria-live polite', () => {
    render(
      <MiloFaqCard
        faq={{ id: 'tarifs_abonnements', answerKey: 'tarifs_abonnements', confidence: 0.75 }}
        onSearchInstead={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('miloFaq.tarifs_abonnements');
  });

  it('affiche un lien quand le sujet en a un (FAQ_LINKS)', () => {
    render(
      <MiloFaqCard
        faq={{ id: 'tarifs_abonnements', answerKey: 'tarifs_abonnements', confidence: 0.75 }}
        onSearchInstead={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const link = screen.getByRole('link', { name: 'miloFaq.linkLabel' });
    expect(link).toHaveAttribute('href', '/bailleur/abonnement');
  });

  it("n'affiche aucun lien quand le sujet n'en a pas (ex. milo_c_est_quoi)", () => {
    render(
      <MiloFaqCard
        faq={{ id: 'milo_c_est_quoi', answerKey: 'milo_c_est_quoi', confidence: 0.75 }}
        onSearchInstead={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('bouton « lancer une recherche à la place » appelle onSearchInstead', async () => {
    const onSearchInstead = vi.fn();
    const user = userEvent.setup();
    render(
      <MiloFaqCard
        faq={{ id: 'unknown', answerKey: 'unknown', confidence: 0.3 }}
        onSearchInstead={onSearchInstead}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByText('miloFaq.searchInsteadLabel'));
    expect(onSearchInstead).toHaveBeenCalledTimes(1);
  });

  it('bouton fermer (croix) appelle onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <MiloFaqCard
        faq={{ id: 'contact_support', answerKey: 'contact_support', confidence: 1 }}
        onSearchInstead={vi.fn()}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'miloFaq.closeLabel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Échap appelle onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <MiloFaqCard
        faq={{ id: 'contact_support', answerKey: 'contact_support', confidence: 1 }}
        onSearchInstead={vi.fn()}
        onClose={onClose}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('le focus se déplace sur la carte à son apparition (accessibilité clavier)', () => {
    render(
      <MiloFaqCard
        faq={{ id: 'contact_support', answerKey: 'contact_support', confidence: 1 }}
        onSearchInstead={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveFocus();
  });
});
