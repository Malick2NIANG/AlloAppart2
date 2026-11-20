import { describe, it, expect, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('@/lib/pricing', () => ({
  fetchPublicPricing: async () => null,
}));

describe('tarifs/page — generateMetadata (lot « boutons retour »)', () => {
  it('URL canonique toujours /tarifs, jamais ?from=aide&sujet=... (statique, ne lit pas searchParams)', async () => {
    const { generateMetadata } = await import('./page');
    const metadata = await generateMetadata();
    expect(metadata.alternates?.canonical).toBe('/tarifs');
  });
});
