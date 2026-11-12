import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomSheet from './BottomSheet';

/**
 * Bug "modale cassée sur mobile" (ex. signalement d'annonce) : un ancêtre
 * quelconque avec backdrop-filter/filter/transform/will-change (ex. les
 * cartes "glass" `backdrop-blur-xl` de la fiche annonce) devenait le bloc de
 * confinement du `position: fixed` de la feuille — elle se recalait alors
 * sur CET ancêtre au lieu du viewport et flottait au milieu de la page.
 * Fix : rendu via portail vers document.body, immunisé contre tout ancêtre.
 */
describe('BottomSheet — portail (bug "modale cassée dans un ancêtre filtré")', () => {
  it('rend son contenu en dehors de tout ancêtre avec backdrop-filter (portail vers document.body)', async () => {
    render(
      <div style={{ backdropFilter: 'blur(24px)' }} data-testid="filtered-ancestor">
        <BottomSheet open onClose={vi.fn()} titleId="t1">
          <h2 id="t1">Titre</h2>
          <p>Contenu</p>
        </BottomSheet>
      </div>,
    );

    await waitFor(() => expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0));
    const dialog = screen.getAllByRole('dialog')[0];
    const filteredAncestor = screen.getByTestId('filtered-ancestor');

    expect(filteredAncestor.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  it('rend son contenu en dehors de tout ancêtre avec transform', async () => {
    render(
      <div style={{ transform: 'translateZ(0)' }} data-testid="transformed-ancestor">
        <BottomSheet open onClose={vi.fn()} titleId="t2">
          <h2 id="t2">Titre</h2>
        </BottomSheet>
      </div>,
    );

    await waitFor(() => expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0));
    const dialog = screen.getAllByRole('dialog')[0];
    expect(screen.getByTestId('transformed-ancestor').contains(dialog)).toBe(false);
  });

  it('affiche bien le contenu passé en enfant', async () => {
    render(
      <BottomSheet open onClose={vi.fn()} titleId="t3">
        <h2 id="t3">Signaler cette annonce</h2>
      </BottomSheet>,
    );
    await waitFor(() => expect(screen.getAllByText('Signaler cette annonce').length).toBeGreaterThan(0));
  });

  it('Échap appelle onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BottomSheet open onClose={onClose} titleId="t4">
        <h2 id="t4">Titre</h2>
      </BottomSheet>,
    );
    await waitFor(() => expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it("n'affiche aucun dialogue quand open=false", () => {
    render(
      <BottomSheet open={false} onClose={vi.fn()} titleId="t5">
        <h2 id="t5">Titre</h2>
      </BottomSheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
