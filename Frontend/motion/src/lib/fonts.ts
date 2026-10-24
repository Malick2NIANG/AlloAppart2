/**
 * Polices identiques au frontend (src/app/layout.tsx → next/font/google) :
 *   Poppins 500 / 600 / 700            — titres
 *   Inter   400 / 500 / 600 / 700 / 800 — textes & UI
 *
 * Les fichiers .woff2 (sous-ensembles latin + latin-ext, licence SIL OFL)
 * sont embarqués dans motion/public/fonts : le rendu est 100 % hors-ligne,
 * déterministe, et ne dépend d'aucun CDN au moment de l'export.
 * Remotion attend leur chargement (delayRender) avant chaque capture.
 */
import { continueRender, delayRender, staticFile } from 'remotion';

const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

const FACES: Array<{ family: 'Poppins' | 'Inter'; file: string; weights: number[] }> = [
  { family: 'Poppins', file: 'poppins', weights: [500, 600, 700] },
  { family: 'Inter', file: 'inter', weights: [400, 500, 600, 700, 800] },
];

let loaded = false;

export const loadBrandFonts = () => {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const handle = delayRender('Chargement des polices Poppins / Inter');
  const faces: FontFace[] = [];
  for (const { family, file, weights } of FACES) {
    for (const w of weights) {
      for (const [subset, range] of [
        ['latin', LATIN],
        ['latin-ext', LATIN_EXT],
      ] as const) {
        faces.push(
          new FontFace(family, `url(${staticFile(`fonts/${file}-${subset}-${w}-normal.woff2`)}) format('woff2')`, {
            weight: String(w),
            style: 'normal',
            unicodeRange: range,
            display: 'block',
          }),
        );
      }
    }
  }
  Promise.all(faces.map((f) => f.load()))
    .then((ok) => {
      ok.forEach((f) => document.fonts.add(f));
      return document.fonts.ready;
    })
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error('Polices AlloAppart introuvables', err);
      continueRender(handle);
    });
};

loadBrandFonts();
