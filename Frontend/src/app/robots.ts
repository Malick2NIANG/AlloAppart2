import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://alloappart.sn';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/bailleur/',
          '/locataire/',
          '/admin/',
          '/agent/',
          '/espace',
          '/onboarding',
          '/profil',
          '/sign-in',
          '/sign-up',
          '/api/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
