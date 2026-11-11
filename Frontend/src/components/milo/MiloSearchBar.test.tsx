import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MiloSearchBar from './MiloSearchBar';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (key: string) => `miloFaq.${key}`,
}));

const classifyMiloQuery = vi.fn();
vi.mock('@/lib/milo', async () => {
  const actual = await vi.importActual<typeof import('@/lib/milo')>('@/lib/milo');
  return { ...actual, classifyMiloQuery: (...args: unknown[]) => classifyMiloQuery(...args) };
});

const PROPS = { placeholder: 'p', ariaLabel: 'Recherche Milo', clearLabel: 'Effacer' };

describe('MiloSearchBar', () => {
  beforeEach(() => {
    push.mockReset();
    classifyMiloQuery.mockReset();
  });

  it('envoi : requête comprise → navigue vers /listings avec les strictFilters sérialisés + milo=1', async () => {
    classifyMiloQuery.mockResolvedValue({
      kind: 'redirect',
      params: new URLSearchParams({ region: 'Dakar', cityContains: 'Mermoz', minRooms: '3', maxRooms: '3', milo: '1', miloLang: 'fr', miloText: 'F3 à Mermoz' }),
    });
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} />);
    await user.type(screen.getByRole('textbox'), 'F3 à Mermoz');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const url = push.mock.calls[0][0] as string;
    expect(url.startsWith('/listings?')).toBe(true);
    expect(url).toContain('region=Dakar');
    expect(url).toContain('cityContains=Mermoz');
    expect(url).toContain('milo=1');
    expect(url).toContain('miloLang=fr');
  });

  it('repli : non compris → /listings?q=<texte>, sans paramètre milo', async () => {
    classifyMiloQuery.mockResolvedValue({
      kind: 'redirect',
      params: new URLSearchParams({ q: 'bla bla bla', miloMiss: '1', miloLang: 'fr' }),
    });
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} />);
    await user.type(screen.getByRole('textbox'), 'bla bla bla');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('/listings?q=bla');
    expect(url).toContain('miloMiss=1');
    expect(url).not.toContain('milo=1');
  });

  it('repli silencieux : délai dépassé / erreur réseau → /listings?q=<texte> brut', async () => {
    classifyMiloQuery.mockResolvedValue({ kind: 'redirect', params: new URLSearchParams({ q: 'villa Almadies' }) });
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} />);
    await user.type(screen.getByRole('textbox'), 'villa Almadies');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/listings?q=villa+Almadies');
  });

  it("pas de double envoi : un clic pendant le chargement n'appelle pas classifyMiloQuery deux fois", async () => {
    let resolve!: (v: unknown) => void;
    classifyMiloQuery.mockReturnValue(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'F3 Dakar');
    const submitButton = screen.getByRole('button', { name: PROPS.ariaLabel });
    await user.click(submitButton);
    await user.click(submitButton); // second clic pendant le chargement — ignoré
    expect(classifyMiloQuery).toHaveBeenCalledTimes(1);
    resolve({ kind: 'redirect', params: new URLSearchParams({ milo: '1', miloLang: 'fr' }) });
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });

  it('envoi bloqué sous 2 caractères après trim (bouton désactivé, Entrée sans effet)', async () => {
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} />);
    await user.type(screen.getByRole('textbox'), ' a ');
    await user.keyboard('{Enter}');
    expect(classifyMiloQuery).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: PROPS.ariaLabel })).toBeDisabled();
  });

  it('bouton effacer (croix) vide le champ ; Échap aussi', async () => {
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'F3 Dakar');
    await user.click(screen.getByRole('button', { name: PROPS.clearLabel }));
    expect(input).toHaveValue('');

    await user.type(input, 'villa Saly');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('role="search" porté par le conteneur, étiquette liée au champ', () => {
    render(<MiloSearchBar {...PROPS} />);
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: PROPS.ariaLabel })).toBeInTheDocument();
  });

  it('placeholder tournant (hero) : la première phrase est visible, en calque aria-hidden', () => {
    render(<MiloSearchBar {...PROPS} size="hero" rotatingPhrases={['Phrase A', 'Phrase B']} />);
    const layer = screen.getByText('Phrase A');
    expect(layer.closest('[aria-hidden]')).not.toBeNull();
    // L'étiquette accessible du champ reste statique, jamais une des phrases.
    expect(screen.getByRole('textbox', { name: PROPS.ariaLabel })).toBeInTheDocument();
  });

  it('la rotation ne se lance pas (et le calque disparaît) dès le focus ou du texte saisi', async () => {
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} size="hero" rotatingPhrases={['Phrase A', 'Phrase B']} />);
    expect(screen.getByText('Phrase A')).toBeInTheDocument();
    await user.click(screen.getByRole('textbox'));
    expect(screen.queryByText('Phrase A')).not.toBeInTheDocument();
  });
});

describe('MiloSearchBar — Milo FAQ (lot « Milo FAQ »)', () => {
  beforeEach(() => {
    push.mockReset();
    classifyMiloQuery.mockReset();
  });

  it('faq détectée : affiche la carte, ne navigue jamais, ne ferme jamais onSubmitted', async () => {
    classifyMiloQuery.mockResolvedValue({
      kind: 'faq',
      faq: { id: 'tarifs_abonnements', answerKey: 'tarifs_abonnements', confidence: 0.75 },
      detectedLanguage: 'fr',
    });
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} onSubmitted={onSubmitted} />);
    await user.type(screen.getByRole('textbox'), 'abonnement');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it('bouton « Lancer une recherche à la place » : navigue vers /listings?q=, referme la carte', async () => {
    classifyMiloQuery.mockResolvedValue({
      kind: 'faq',
      faq: { id: 'unknown', answerKey: 'unknown', confidence: 0.3 },
      detectedLanguage: 'fr',
    });
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} onSubmitted={onSubmitted} />);
    await user.type(screen.getByRole('textbox'), 'comment ca marche');
    await user.keyboard('{Enter}');
    await screen.findByRole('status');

    await user.click(screen.getByText('miloFaq.searchInsteadLabel'));
    expect(push).toHaveBeenCalledWith('/listings?q=comment%20ca%20marche');
    expect(onSubmitted).toHaveBeenCalled();
  });

  it('Échap referme la carte faq sans vider le champ', async () => {
    classifyMiloQuery.mockResolvedValue({
      kind: 'faq',
      faq: { id: 'contact_support', answerKey: 'contact_support', confidence: 1 },
      detectedLanguage: 'fr',
    });
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'contact');
    await user.keyboard('{Enter}');
    await screen.findByRole('status');

    await user.click(input);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(input).toHaveValue('contact');
  });

  it('retaper du texte referme la carte faq précédente', async () => {
    classifyMiloQuery.mockResolvedValue({
      kind: 'faq',
      faq: { id: 'contact_support', answerKey: 'contact_support', confidence: 1 },
      detectedLanguage: 'fr',
    });
    const user = userEvent.setup();
    render(<MiloSearchBar {...PROPS} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'contact');
    await user.keyboard('{Enter}');
    await screen.findByRole('status');

    await user.type(input, ' encore');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });
});
