import type { MetadataRoute } from 'next';

// Couleurs de marque (Frontend/motion/src/config/brand.ts). Le manifeste n'a
// qu'une seule valeur statique par couleur (voir layout.tsx >
// viewport.themeColor pour la version claire/sombre du reste du site).
const BRAND_GOLD = '#facc15';
// Fond des icônes PWA (écran de démarrage/splash) : même bleu sombre que les
// icônes elles-mêmes (#0f172a), jamais blanc ni transparent — lot « icônes
// PWA ».
const BRAND_BG_DARK = '#0f172a';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AlloAppart',
    short_name: 'AlloAppart',
    description: 'Trouvez votre logement idéal au Sénégal avec la certification AlloVérifié™. Appartements, villas, studios à Dakar et partout au Sénégal.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'fr',
    background_color: BRAND_BG_DARK,
    theme_color: BRAND_GOLD,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
