/**
 * Quartiers et communes RÉELS et bien connus — saisis à la main par Malick
 * (lot 2b), en complément de places.data.ts (généré depuis
 * Frontend/src/lib/regions.ts, qui ne couvre que 14 régions + quelques
 * villes/highlights). Chaque entrée n'est rattachée à une région que
 * lorsqu'elle est certaine ; rien n'est inventé. Liste validée par Malick
 * (21/11/2026).
 */
export interface Quartier {
  name: string;
  region: string;
}

export const QUARTIERS: Quartier[] = [
  // ── Dakar ──────────────────────────────────────────────────────────
  { name: 'Plateau', region: 'Dakar' },
  { name: 'Médina', region: 'Dakar' },
  { name: 'Fann', region: 'Dakar' },
  { name: 'Point E', region: 'Dakar' },
  { name: 'Mermoz', region: 'Dakar' },
  { name: 'Sacré-Cœur', region: 'Dakar' },
  // Quartier composé distinct de "Mermoz" seul (lot 7, règle 1.c) — les deux
  // noms restent aussi valables séparément ci-dessus.
  { name: 'Mermoz Sacré-Cœur', region: 'Dakar' },
  { name: 'Ouakam', region: 'Dakar' },
  { name: 'Ngor', region: 'Dakar' },
  { name: 'Yoff', region: 'Dakar' },
  { name: 'Almadies', region: 'Dakar' },
  { name: 'Liberté', region: 'Dakar' },
  { name: 'HLM', region: 'Dakar' },
  { name: 'Grand Yoff', region: 'Dakar' },
  { name: 'Parcelles Assainies', region: 'Dakar' },
  { name: "Patte d'Oie", region: 'Dakar' },
  { name: 'Castors', region: 'Dakar' },
  { name: 'Sicap', region: 'Dakar' },
  { name: 'Bopp', region: 'Dakar' },
  { name: 'Colobane', region: 'Dakar' },
  { name: 'Hann', region: 'Dakar' },
  { name: 'Gueule Tapée', region: 'Dakar' },
  { name: 'Ouest Foire', region: 'Dakar' },
  // VDN retiré (lot 7, règle 1.b) : axe routier qui traverse plusieurs
  // quartiers, jamais un cityContains fiable — déplacé vers
  // places/landmarks.ts (ambiguïté "landmark" au lieu d'un faux filtre).
  { name: 'Amitié', region: 'Dakar' },
  { name: 'Grand Dakar', region: 'Dakar' },
  { name: 'Dieuppeul', region: 'Dakar' },
  { name: 'Derklé', region: 'Dakar' },
  { name: 'Cambérène', region: 'Dakar' },
  { name: 'Yeumbeul', region: 'Dakar' },
  { name: 'Thiaroye', region: 'Dakar' },
  { name: 'Keur Massar', region: 'Dakar' },
  { name: 'Malika', region: 'Dakar' },
  { name: 'Golf', region: 'Dakar' },
  { name: 'Rufisque', region: 'Dakar' },
  { name: 'Bargny', region: 'Dakar' },
  { name: 'Diamniadio', region: 'Dakar' },
  { name: 'Guédiawaye', region: 'Dakar' },
  { name: 'Pikine', region: 'Dakar' },
  // ── Dakar — complément lot 7 bis (règle E) ──
  { name: 'Mamelles', region: 'Dakar' },
  { name: 'Maristes', region: 'Dakar' },
  { name: 'Bel-Air', region: 'Dakar' },
  { name: 'Fass', region: 'Dakar' },
  { name: 'Mbao', region: 'Dakar' },
  { name: 'Sangalkam', region: 'Dakar' },
  { name: 'Bambilor', region: 'Dakar' },
  { name: 'Lac Rose', region: 'Dakar' },
  // ── Dakar — complément lot 7 ter (règle 3, audit des régions) : toutes
  // dans le département de Rufisque (région de Dakar), d'après le
  // découpage administratif (Rufisque, Bargny, Diamniadio, Sangalkam,
  // Bambilor ci-dessus en faisaient déjà partie, confirmés corrects).
  { name: 'Sébikotane', region: 'Dakar' },
  { name: 'Yenne', region: 'Dakar' },
  { name: 'Kounoune', region: 'Dakar' },
  // Toubab Dialaw CORRIGÉ (lot 7 ter) : département de Rufisque (commune
  // de Yène), région de Dakar — pas Thiès comme précédemment saisi.
  { name: 'Toubab Dialaw', region: 'Dakar' },

  // ── Dakar — complément « quartiers complémentaires » ──────────────────
  { name: 'Keur Gorgui', region: 'Dakar' },
  // Composé distinct de "Keur Gorgui" seul (même principe que "Mermoz
  // Sacré-Cœur") — les deux restent aussi valables séparément.
  { name: 'Cité Keur Gorgui', region: 'Dakar' },
  // Composé distinct de "Sicap" seul (déjà listé ci-dessus).
  { name: 'Sicap Baobab', region: 'Dakar' },
  { name: 'Nord Foire', region: 'Dakar' },
  { name: 'Dalifort', region: 'Dakar' },
  { name: 'Sahm', region: 'Dakar' },
  { name: 'Hamo', region: 'Dakar' },
  { name: 'Zone B', region: 'Dakar' },
  { name: 'Gibraltar', region: 'Dakar' },
  { name: 'Médina Gounass', region: 'Dakar' },
  // Composé distinct de "Golf" seul (déjà listé ci-dessus).
  { name: 'Golf Sud', region: 'Dakar' },
  { name: 'Jaxaay', region: 'Dakar' },
  { name: 'Tivaoune Peulh', region: 'Dakar' },
  { name: 'Niacoulrab', region: 'Dakar' },
  { name: 'Cité Djily Mbaye', region: 'Dakar' },
  { name: 'Cité Comico', region: 'Dakar' },
  { name: 'Wakhinane Nimzatt', region: 'Dakar' },

  // ── Thiès ──────────────────────────────────────────────────────────
  { name: 'Saly', region: 'Thiès' },
  { name: 'Somone', region: 'Thiès' },
  { name: 'Ngaparou', region: 'Thiès' },
  { name: 'Popenguine', region: 'Thiès' },
  { name: 'Mbour', region: 'Thiès' },
  { name: 'Joal-Fadiouth', region: 'Thiès' },
  // Joal et Fadiouth cités séparément aussi (village-pont relié à Joal par
  // une passerelle, parfois nommé seul — lot 7 bis, règle E).
  { name: 'Joal', region: 'Thiès' },
  { name: 'Fadiouth', region: 'Thiès' },
  { name: 'Warang', region: 'Thiès' },
  { name: 'Pointe Sarène', region: 'Thiès' },
  // Pout et Sindia ajoutés (lot 7 ter, règle 3) : département de Thiès
  // (Pout) et de Mbour (Sindia), région de Thiès.
  { name: 'Pout', region: 'Thiès' },
  { name: 'Sindia', region: 'Thiès' },

  // ── Thiès — complément « quartiers complémentaires » ──────────────────
  { name: 'Nianing', region: 'Thiès' },
  { name: 'Mbodiène', region: 'Thiès' },
  // Composé distinct de "Saly" seul (déjà listé ci-dessus).
  { name: 'Saly Portudal', region: 'Thiès' },
];
