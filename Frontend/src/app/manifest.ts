import type { MetadataRoute } from 'next';

// Couleurs de marque (Frontend/motion/src/config/brand.ts) — identiques à
// globals.css (--aa-bg clair, BRAND.gold). Le manifeste n'a qu'une seule
// valeur statique par couleur (pas de variante sombre ici ; voir
// layout.tsx > viewport.themeColor pour la version claire/sombre).
const BRAND_GOLD = '#facc15';
const BRAND_BG_LIGHT = '#FAFAFA';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AlloAppart',
    short_name: 'AlloAppart',
    description: 'Trouvez votre logement idéal au Sénégal avec la certification AlloVérifié™. Appartements, villas, studios à Dakar et partout au Sénégal.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'fr',
    background_color: BRAND_BG_LIGHT,
    theme_color: BRAND_GOLD,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
