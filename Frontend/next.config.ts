import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  devIndicators: false,
  // Build autonome (server.js minimal + deps nécessaires uniquement) —
  // requis pour une image Docker de prod légère, voir Frontend/Dockerfile.
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: '**.clerk.com' },
      // Manquait alors que BookingCard.tsx (et désormais AdminListingCard dans
      // espace/listings/page.tsx) l'utilisent déjà comme image de repli quand
      // une annonce n'a aucune photo — sans cette entrée, next/image rejette
      // cette URL au runtime (hostname non autorisé) dès qu'une annonce sans
      // photo apparaît, plantant le rendu de la carte.
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
