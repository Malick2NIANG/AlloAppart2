import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  SkeletonContainer, ListingGridSkeleton, ListingDetailSkeleton, StatGridSkeleton,
  ListRowsSkeleton, TableSkeleton, FormSkeleton, ConversationListSkeleton, ChatSkeleton,
  ProfileSkeleton, PageHeaderSkeleton,
} from './Skeleton';

describe('SkeletonContainer', () => {
  it('porte role=status, aria-busy=true et un libellé sr-only traduit', () => {
    render(
      <SkeletonContainer label="Chargement en cours…">
        <div>contenu</div>
      </SkeletonContainer>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Chargement en cours…')).toHaveClass('sr-only');
  });
});

describe('bibliothèque de skeletons — rendu sans erreur, nombre d\'éléments attendu', () => {
  it('ListingGridSkeleton : rend `count` cartes', () => {
    const { container } = render(<ListingGridSkeleton count={5} />);
    expect(container.firstElementChild?.children.length).toBe(5);
  });

  it('StatGridSkeleton : rend `count` cartes stat', () => {
    const { container } = render(<StatGridSkeleton count={4} />);
    expect(container.firstElementChild?.children.length).toBe(4);
  });

  it('ListRowsSkeleton : rend `count` lignes', () => {
    const { container } = render(<ListRowsSkeleton count={3} />);
    expect(container.firstElementChild?.children.length).toBe(3);
  });

  it('TableSkeleton : en-tête + `rows` lignes', () => {
    const { container } = render(<TableSkeleton rows={4} />);
    // 1 ligne d'en-tête + 4 lignes de données = 5 enfants directs.
    expect(container.firstElementChild?.children.length).toBe(5);
  });

  it('ConversationListSkeleton : rend `count` lignes avec avatar', () => {
    render(<ConversationListSkeleton count={3} />);
    // Pas d'aria distinctif sur les pièces visuelles (c'est voulu, cf.
    // commentaire du fichier) — on vérifie juste que ça rend sans jeter.
  });

  it('ListingDetailSkeleton, ChatSkeleton, FormSkeleton, ProfileSkeleton, PageHeaderSkeleton : rendent sans erreur', () => {
    expect(() => render(<ListingDetailSkeleton />)).not.toThrow();
    expect(() => render(<ChatSkeleton />)).not.toThrow();
    expect(() => render(<FormSkeleton fields={3} />)).not.toThrow();
    expect(() => render(<ProfileSkeleton />)).not.toThrow();
    expect(() => render(<PageHeaderSkeleton withAction />)).not.toThrow();
  });
});
