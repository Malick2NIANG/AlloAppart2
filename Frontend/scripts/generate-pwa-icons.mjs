// Génère les icônes PWA à partir du logo officiel (Frontend/public/images/LOGO.png,
// 500×500, non déformé ni modifié) via sharp (déjà fourni par Next.js).
// Sorties dans Frontend/public/icons/. À relancer manuellement si le logo change
// (pas de build step automatique — fichiers générés commités comme assets statiques).
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOGO = join(ROOT, 'public/images/LOGO.png');
const OUT_DIR = join(ROOT, 'public/icons');

// Couleurs de marque (Frontend/motion/src/config/brand.ts) — fond opaque
// requis pour l'icône maskable (Android peut découper n'importe quelle
// forme sur un fond transparent) et recommandé pour apple-touch-icon
// (iOS ne gère pas bien la transparence). BRAND.surface = blanc : fait
// ressortir le logo doré, cohérent avec le thème clair du site.
const BRAND_SURFACE = '#FFFFFF';

mkdirSync(OUT_DIR, { recursive: true });

async function simpleResize(size, filename) {
  // Redimensionnement direct, sans recadrage ni déformation (logo déjà
  // carré 500×500) — transparence conservée.
  await sharp(LOGO)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(OUT_DIR, filename));
  console.log('✓', filename, `${size}x${size}`);
}

async function withOpaqueBackground(canvasSize, logoRatio, filename) {
  // Logo centré sur un fond opaque, avec marge de sécurité (logoRatio = part
  // du canevas occupée par le logo ; le reste est la marge de sécurité).
  const logoSize = Math.round(canvasSize * logoRatio);
  const logoBuffer = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: BRAND_SURFACE,
    },
  })
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png()
    .toFile(join(OUT_DIR, filename));
  console.log('✓', filename, `${canvasSize}x${canvasSize} (fond opaque, logo à ${Math.round(logoRatio * 100)}%)`);
}

await simpleResize(192, 'icon-192.png');
await simpleResize(512, 'icon-512.png');
// Icône maskable : zone de sécurité recommandée ~80% de "safe zone" centrale
// (spec maskable icons) → logo à 60% du canevas pour rester confortablement
// dans cette zone après découpe (cercle, superellipse, etc. selon l'OS).
await withOpaqueBackground(512, 0.6, 'icon-maskable-512.png');
// apple-touch-icon : pas de découpe algorithmique arbitraire (iOS applique
// son propre masque fixe), marge plus réduite suffit.
await withOpaqueBackground(180, 0.82, 'apple-touch-icon.png');

console.log('\nIcônes PWA générées dans', OUT_DIR);
