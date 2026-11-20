import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const replace = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => params,
}));

// Le libellé d'un sujet est partagé par le bouton « question courante » et
// l'en-tête de l'accordéon (même clé i18n, une seule source de vérité) —
// le premier des deux (ordre du DOM) est toujours le bouton « question
// courante ».
function commonQuestionButton(id: string) {
  return screen.getAllByRole('button', { name: `miloFaqQuestions.${id}` })[0];
}

describe('AideContent', () => {
  beforeEach(() => {
    replace.mockReset();
    params = new URLSearchParams();
  });

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

  describe('lot « boutons retour » — restauration de la question via ?sujet=', () => {
    it('?sujet=<id> connu au montage : la carte se rouvre automatiquement', () => {
      params = new URLSearchParams({ sujet: 'tarifs_abonnements' });
      render(<NearMeProvider><AideContent /></NearMeProvider>);
      const status = screen.getByRole('status');
      expect(within(status).getByText('miloFaq.tarifs_abonnements')).toBeInTheDocument();
    });

    it('?sujet= inconnu : ignoré sans erreur, aucune carte affichée', () => {
      params = new URLSearchParams({ sujet: 'sujet_invente' });
      render(<NearMeProvider><AideContent /></NearMeProvider>);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('ouvrir une question courante reflète son id dans ?sujet= (replace, jamais push — pas de nouvel historique)', async () => {
      const user = userEvent.setup();
      render(<NearMeProvider><AideContent /></NearMeProvider>);
      await user.click(commonQuestionButton('tarifs_abonnements'));
      expect(replace).toHaveBeenCalledWith('/aide?sujet=tarifs_abonnements', { scroll: false });
    });

    it('« Poser une autre question » retire ?sujet= de l\'URL', async () => {
      params = new URLSearchParams({ sujet: 'tarifs_abonnements' });
      const user = userEvent.setup();
      render(<NearMeProvider><AideContent /></NearMeProvider>);
      await user.click(screen.getByText('aide.askAnotherLabel'));
      expect(replace).toHaveBeenCalledWith('/aide', { scroll: false });
    });
  });
});
