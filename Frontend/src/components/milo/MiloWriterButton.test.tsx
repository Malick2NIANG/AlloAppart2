import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MiloWriterButton, { type MiloWriterFields } from './MiloWriterButton';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}(${JSON.stringify(params)})` : key,
}));

const apiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { post: (...args: unknown[]) => apiPost(...args) },
}));

const getToken = vi.fn().mockResolvedValue('token-123');

function baseFields(overrides: Partial<MiloWriterFields> = {}): MiloWriterFields {
  return { type: 'APPARTEMENT', city: 'Dakar', ...overrides };
}

describe('MiloWriterButton', () => {
  beforeEach(() => {
    apiPost.mockReset();
    getToken.mockClear();
  });

  it('désactivé tant que la ville manque, avec une aide claire', () => {
    render(
      <MiloWriterButton
        fields={{ type: 'APPARTEMENT' }}
        currentDescription=""
        onApply={vi.fn()}
        getToken={getToken}
        defaultLocale="fr"
      />,
    );
    expect(screen.getByRole('button', { name: /button/ })).toBeDisabled();
    expect(screen.getByText('missingFields')).toBeInTheDocument();
  });

  it('activé dès que le type et la ville sont renseignés', () => {
    render(
      <MiloWriterButton
        fields={baseFields()}
        currentDescription=""
        onApply={vi.fn()}
        getToken={getToken}
        defaultLocale="fr"
      />,
    );
    expect(screen.getByRole('button', { name: /button/ })).toBeEnabled();
  });

  it('description vide : applique directement le texte proposé, sans confirmation', async () => {
    apiPost.mockResolvedValue({ text: 'Texte proposé par Milo.', fallback: false });
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <MiloWriterButton
        fields={baseFields()}
        currentDescription=""
        onApply={onApply}
        getToken={getToken}
        defaultLocale="fr"
      />,
    );

    await user.click(screen.getByRole('button', { name: /button/ }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith('Texte proposé par Milo.'));
    expect(apiPost).toHaveBeenCalledWith(
      '/milo/write-description',
      expect.objectContaining({ type: 'APPARTEMENT', city: 'Dakar', locale: 'fr' }),
      'token-123',
    );
    // Dialog de confirmation jamais ouvert (rien à écraser).
    expect(screen.queryByText('overwriteTitle')).not.toBeInTheDocument();
  });

  it('description déjà remplie : demande confirmation avant toute application', async () => {
    apiPost.mockResolvedValue({ text: 'Nouvelle proposition.', fallback: false });
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <MiloWriterButton
        fields={baseFields()}
        currentDescription="Texte déjà saisi par l'utilisateur."
        onApply={onApply}
        getToken={getToken}
        defaultLocale="fr"
      />,
    );

    await user.click(screen.getByRole('button', { name: /button/ }));

    await screen.findAllByText('overwriteTitle');
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getAllByText('Nouvelle proposition.').length).toBeGreaterThan(0);
  });

  it('confirmation « Remplacer » : écrase le texte existant', async () => {
    apiPost.mockResolvedValue({ text: 'Nouvelle proposition.', fallback: false });
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <MiloWriterButton
        fields={baseFields()}
        currentDescription="Ancien texte."
        onApply={onApply}
        getToken={getToken}
        defaultLocale="fr"
      />,
    );

    await user.click(screen.getByRole('button', { name: /button/ }));
    await screen.findAllByText('overwriteTitle');
    await user.click(screen.getAllByRole('button', { name: 'overwriteReplace' })[0]);

    expect(onApply).toHaveBeenCalledWith('Nouvelle proposition.');
  });

  it('confirmation « Ajouter à la suite » : concatène au texte existant', async () => {
    apiPost.mockResolvedValue({ text: 'Nouvelle proposition.', fallback: false });
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <MiloWriterButton
        fields={baseFields()}
        currentDescription="Ancien texte."
        onApply={onApply}
        getToken={getToken}
        defaultLocale="fr"
      />,
    );

    await user.click(screen.getByRole('button', { name: /button/ }));
    await screen.findAllByText('overwriteTitle');
    await user.click(screen.getAllByRole('button', { name: 'overwriteAppend' })[0]);

    expect(onApply).toHaveBeenCalledWith('Ancien texte.\n\nNouvelle proposition.');
  });

  it('confirmation « Annuler » : ne touche jamais au texte existant', async () => {
    apiPost.mockResolvedValue({ text: 'Nouvelle proposition.', fallback: false });
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <MiloWriterButton
        fields={baseFields()}
        currentDescription="Ancien texte."
        onApply={onApply}
        getToken={getToken}
        defaultLocale="fr"
      />,
    );

    await user.click(screen.getByRole('button', { name: /button/ }));
    await screen.findAllByText('overwriteTitle');
    await user.click(screen.getAllByRole('button', { name: 'overwriteCancel' })[0]);

    expect(onApply).not.toHaveBeenCalled();
  });

  it('erreur réseau : affiche un message clair, ne perd jamais le texte existant', async () => {
    apiPost.mockRejectedValue(new Error('network down'));
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <MiloWriterButton
        fields={baseFields()}
        currentDescription="Texte précieux de l'utilisateur."
        onApply={onApply}
        getToken={getToken}
        defaultLocale="fr"
      />,
    );

    await user.click(screen.getByRole('button', { name: /button/ }));

    await screen.findByText('errorTitle');
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByText('overwriteTitle')).not.toBeInTheDocument();
  });

  it('bascule FR → EN : la génération suivante est demandée en anglais', async () => {
    apiPost.mockResolvedValue({ text: 'Generated by Milo.', fallback: false });
    const user = userEvent.setup();
    render(
      <MiloWriterButton
        fields={baseFields()}
        currentDescription=""
        onApply={vi.fn()}
        getToken={getToken}
        defaultLocale="fr"
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'languageEn' }));
    await user.click(screen.getByRole('button', { name: /button/ }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        '/milo/write-description',
        expect.objectContaining({ locale: 'en' }),
        'token-123',
      ),
    );
  });

  it('defaultLocale="en" : génère en anglais par défaut sans action de l\'utilisateur', async () => {
    apiPost.mockResolvedValue({ text: 'Generated by Milo.', fallback: false });
    const user = userEvent.setup();
    render(
      <MiloWriterButton
        fields={baseFields()}
        currentDescription=""
        onApply={vi.fn()}
        getToken={getToken}
        defaultLocale="en"
      />,
    );

    await user.click(screen.getByRole('button', { name: /button/ }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        '/milo/write-description',
        expect.objectContaining({ locale: 'en' }),
        'token-123',
      ),
    );
  });
});
