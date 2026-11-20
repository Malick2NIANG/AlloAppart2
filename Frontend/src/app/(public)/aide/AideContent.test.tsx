import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AideContent from './AideContent';
import { NearMeProvider } from '@/components/listings/NearMeContext';
import { FAQ_TOPIC_IDS } from '@/components/milo/faqTopicIds';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) =>
    params ? `${ns}.${key}(${JSON.stringify(params)})` : `${ns}.${key}`,
  useLocale: () => 'fr',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Le libellé d'un sujet est partagé par le bouton « question courante » et
// l'en-tête de l'accordéon (même clé i18n, une seule source de vérité) —
// le premier des deux (ordre du DOM) est toujours le bouton « question
// courante ».
function commonQuestionButton(id: string) {
  return screen.getAllByRole('button', { name: `miloFaqQuestions.${id}` })[0];
}

describe('AideContent', () => {
  it('un clic sur une question courante affiche la carte-réponse correspondante, sans appel réseau', async () => {
    const user = userEvent.setup();
    render(<NearMeProvider><AideContent /></NearMeProvider>);
    await user.click(commonQuestionButton('tarifs_abonnements'));
    const status = screen.getByRole('status');
    expect(within(status).getByText('miloFaq.tarifs_abonnements')).toBeInTheDocument();
  });

  it('une nouvelle question remplace la précédente (une seule carte à la fois, aucun historique)', async () => {
    const user = userEvent.setup();
    render(<NearMeProvider><AideContent /></NearMeProvider>);
    await user.click(commonQuestionButton('tarifs_abonnements'));
    await user.click(commonQuestionButton('milo_c_est_quoi'));

    const statuses = screen.getAllByRole('status');
    expect(statuses).toHaveLength(1);
    expect(within(statuses[0]).getByText('miloFaq.milo_c_est_quoi')).toBeInTheDocument();
    expect(within(statuses[0]).queryByText('miloFaq.tarifs_abonnements')).not.toBeInTheDocument();
  });

  it('« Poser une autre question » vide la carte', async () => {
    const user = userEvent.setup();
    render(<NearMeProvider><AideContent /></NearMeProvider>);
    await user.click(commonQuestionButton('tarifs_abonnements'));
    expect(screen.getByRole('status')).toBeInTheDocument();

    await user.click(screen.getByText('aide.askAnotherLabel'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('affiche exactement un bouton « question courante » + un en-tête d\'accordéon par sujet FAQ activé, aucun sujet désactivé/inventé', () => {
    render(<NearMeProvider><AideContent /></NearMeProvider>);
    const topicButtonNames = screen.getAllByRole('button')
      .map((el) => el.textContent)
      .filter((text): text is string => !!text && text.startsWith('miloFaqQuestions.'));
    for (const id of FAQ_TOPIC_IDS) {
      expect(topicButtonNames.filter((text) => text === `miloFaqQuestions.${id}`)).toHaveLength(2);
    }
    expect(topicButtonNames).not.toContain('miloFaqQuestions.sujet_invente');
  });

  it('accordéon : un clic révèle la réponse (mêmes clés i18n que la carte)', async () => {
    const user = userEvent.setup();
    render(<NearMeProvider><AideContent /></NearMeProvider>);
    const accordionButton = screen.getByRole('button', { name: 'miloFaqQuestions.milo_exemples', expanded: false });
    expect(screen.queryByText('miloFaq.milo_exemples')).not.toBeInTheDocument();
    await user.click(accordionButton);
    expect(screen.getByText('miloFaq.milo_exemples')).toBeInTheDocument();
  });
});
