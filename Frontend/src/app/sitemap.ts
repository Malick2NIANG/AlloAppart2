import type { MetadataRoute } from 'next';
import type { PaginatedResponse } from '@/types';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://alloappart.sn';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/listings`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/publier`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/sign-in`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/sign-up`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const { api } = await import('@/lib/api');
    const resp = await api.get<PaginatedResponse<{ id: string; updatedAt: string }>>('/listings?limit=500&page=1');
    const listingRoutes: MetadataRoute.Sitemap = (Array.isArray(resp.data) ? resp.data : []).map((l) => ({
      url: `${BASE_URL}/listings/${l.id}`,
      lastModified: new Date(l.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
    return [...staticRoutes, ...listingRoutes];
  } catch {
    return staticRoutes;
  }
}
