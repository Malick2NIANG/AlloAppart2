import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListingHeroCarousel from './ListingHeroCarousel';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) =>
    params ? `${ns}.${key}(${JSON.stringify(params)})` : `${ns}.${key}`,
}));

const PROPS = {
  images: ['https://res.cloudinary.com/demo/image/upload/v1/a.jpg'],
  title: 'Studio à Mermoz',
  city: 'Mermoz',
  price: '85 000 FCFA/mois',
  listingId: 'abc123',
};

afterEach(() => {
  // @ts-expect-error -- nettoyage des surcharges navigator.share/clipboard posées par un test
  delete navigator.share;
  // @ts-expect-error -- idem pour navigator.clipboard
  delete navigator.clipboard;
});

describe('ListingHeroCarousel — bouton Partager (lot « raccourci »)', () => {
  it('absent pour une annonce non publique (brouillon/suspendue)', () => {
    render(<ListingHeroCarousel {...PROPS} isPublic={false} />);
    expect(screen.queryByRole('button', { name: 'detail.shareBtn' })).not.toBeInTheDocument();
  });

  it('présent pour une annonce publique', () => {
    render(<ListingHeroCarousel {...PROPS} isPublic={true} />);
    expect(screen.getAllByRole('button', { name: 'detail.shareBtn' }).length).toBeGreaterThan(0);
  });

  it('appelle navigator.share avec titre/texte/URL canonique quand disponible, jamais le menu de repli', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, writable: true, configurable: true });
    const user = userEvent.setup();
    render(<ListingHeroCarousel {...PROPS} isPublic={true} />);

    const [shareBtn] = screen.getAllByRole('button', { name: 'detail.shareBtn' });
    await user.click(shareBtn);

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const arg = share.mock.calls[0][0];
    expect(arg.title).toBe(PROPS.title);
    expect(arg.url).toContain(`/listings/${PROPS.listingId}`);
    expect(arg.url).not.toContain('?'); // URL canonique — jamais de paramètre de session/tracking
    // Le menu de repli (WhatsApp/Facebook/e-mail/copier) ne doit pas s'ouvrir.
    expect(screen.queryByText('detail.shareWhatsapp')).not.toBeInTheDocument();
  });

  it("repli « copier le lien » (avec confirmation) quand navigator.share est indisponible", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });
    const user = userEvent.setup();
    render(<ListingHeroCarousel {...PROPS} isPublic={true} />);

    const [shareBtn] = screen.getAllByRole('button', { name: 'detail.shareBtn' });
    await user.click(shareBtn);

    const copyItem = await screen.findByText('detail.shareCopy');
    await user.click(copyItem);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`/listings/${PROPS.listingId}`)));
    expect(await screen.findByText('detail.shareCopied')).toBeInTheDocument();
  });
});
