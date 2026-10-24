/**
 * Formats de diffusion. Seul le 16:9 est rendu pour l'instant.
 * Les variantes 9:16 (TikTok / Reels / Stories) et 1:1 (Instagram) sont
 * préparées : toute la mise en page est exprimée par rapport au CENTRE de
 * l'image et bornée par une safe zone centrale de 1080 px de large, donc
 * elle tient déjà dans un cadre 1080×1080. Pour un nouveau format :
 *   1. ajouter une entrée ici,
 *   2. ajuster ses offsets verticaux (layout),
 *   3. déclarer une <Composition> de plus dans Root.tsx.
 */
export type FormatId = '16x9' | '9x16' | '1x1';

export type Layout = {
  /** Offsets verticaux (px) par rapport au centre de l'image. */
  act1: { headline: number; lines: number };
  act2: { logo: number; headline: number; sub: number; badge: number };
  act3: { title: number; grid: number; columns: 1 | 2 };
  act4: { logo: number; slogan: number; cta: number; tagline: number };
};

export type Format = {
  id: FormatId;
  width: number;
  height: number;
  /** Largeur de la safe zone centrale (éléments essentiels). */
  safeWidth: number;
  layout: Layout;
};

export const FORMATS: Record<FormatId, Format> = {
  '16x9': {
    id: '16x9',
    width: 1920,
    height: 1080,
    safeWidth: 1080,
    layout: {
      act1: { headline: -120, lines: 120 },
      act2: { logo: -165, headline: 20, sub: 92, badge: 196 },
      act3: { title: -318, grid: 30, columns: 2 },
      act4: { logo: -230, slogan: -20, cta: 160, tagline: 250 },
    },
  },
  // Préparés, non rendus pour l'instant (valeurs de départ à affiner).
  '9x16': {
    id: '9x16',
    width: 1080,
    height: 1920,
    safeWidth: 960,
    layout: {
      act1: { headline: -120, lines: 110 },
      act2: { logo: -300, headline: -20, sub: 70, badge: 200 },
      act3: { title: -690, grid: 40, columns: 1 },
      act4: { logo: -380, slogan: -80, cta: 150, tagline: 250 },
    },
  },
  '1x1': {
    id: '1x1',
    width: 1080,
    height: 1080,
    safeWidth: 960,
    layout: {
      act1: { headline: -120, lines: 120 },
      act2: { logo: -165, headline: 20, sub: 92, badge: 196 },
      act3: { title: -318, grid: 30, columns: 2 },
      act4: { logo: -230, slogan: -20, cta: 160, tagline: 250 },
    },
  },
};
