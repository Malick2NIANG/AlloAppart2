import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import FooterGate from './FooterGate';

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

function renderGate() {
  return render(
    <FooterGate>
      <footer data-testid="footer-content">
        <a href="/tarifs">Tarifs</a>
      </footer>
    </FooterGate>,
  );
}

describe('FooterGate (lot « footer mobile limité »)', () => {
  it.each(['/', '/aide', '/tarifs', '/a-propos', '/plan-du-site', '/confidentialite', '/cgu', '/cookies'])(
    'liste blanche "%s" : footer jamais masqué (pas de max-md:hidden), pas d\'espaceur',
    (path) => {
      pathname = path;
      const { container } = renderGate();
      expect(screen.getByTestId('footer-content').parentElement).not.toHaveClass('max-md:hidden');
      expect(container.querySelector('[aria-hidden]')).not.toBeInTheDocument();
    },
  );

  it.each(['/listings', '/listings/abc123', '/messages', '/locataire/favorites', '/bailleur/listings', '/espace/users'])(
    'hors liste blanche "%s" : footer masqué en CSS seulement (max-md:hidden), toujours dans le HTML',
    (path) => {
      pathname = path;
      renderGate();
      const footer = screen.getByTestId('footer-content');
      expect(footer.parentElement).toHaveClass('max-md:hidden');
      // Les liens restent présents dans le HTML malgré le masquage CSS.
      expect(screen.getByRole('link', { name: 'Tarifs' })).toBeInTheDocument();
    },
  );

  it('hors liste blanche : un espaceur réserve exactement la hauteur de --bottom-offset', () => {
    pathname = '/listings';
    const { container } = renderGate();
    const spacer = container.querySelector('[aria-hidden]') as HTMLElement;
    expect(spacer).toBeInTheDocument();
    expect(spacer).toHaveClass('hidden', 'max-md:block');
    expect(spacer.style.height).toBe('var(--bottom-offset, 0px)');
  });

  it.each(['/messages', '/messages/room1'])(
    '"%s" gère déjà elle-même --bottom-offset : footer masqué mais SANS espaceur (éviterait un vide après un contenu déjà pile à la bonne taille)',
    (path) => {
      pathname = path;
      const { container } = renderGate();
      expect(screen.getByTestId('footer-content').parentElement).toHaveClass('max-md:hidden');
      expect(container.querySelector('[aria-hidden]')).not.toBeInTheDocument();
    },
  );

  it('un sous-chemin non listé (ex. "/tarifs-pro") n\'est pas confondu avec "/tarifs"', () => {
    pathname = '/tarifs-pro';
    renderGate();
    expect(screen.getByTestId('footer-content').parentElement).toHaveClass('max-md:hidden');
  });

  it('un éventuel préfixe de langue à deux lettres (ex. "/fr/aide") est retiré avant comparaison', () => {
    pathname = '/fr/aide';
    renderGate();
    expect(screen.getByTestId('footer-content').parentElement).not.toHaveClass('max-md:hidden');
  });

  it('un préfixe de langue non reconnu (ex. "/de/aide") n\'est pas retiré — traité comme un chemin normal, hors liste', () => {
    pathname = '/de/aide';
    renderGate();
    expect(screen.getByTestId('footer-content').parentElement).toHaveClass('max-md:hidden');
  });
});
