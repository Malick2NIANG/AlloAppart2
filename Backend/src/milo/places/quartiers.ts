/**
 * Quartiers et communes RÉELS et bien connus — saisis à la main par Malick
 * (lot 2b), en complément de places.data.ts (généré depuis
 * Frontend/src/lib/regions.ts, qui ne couvre que 14 régions + quelques
 * villes/highlights). Chaque entrée n'est rattachée à une région que
 * lorsqu'elle est certaine ; rien n'est inventé. `needsValidation: true`
 * sur toute la liste : à valider par Malick avant de la considérer
 * définitivement fiable.
 */
export interface Quartier {
  name: string;
  region: string;
  needsValidation: true;
}

export const QUARTIERS: Quartier[] = [
  // ── Dakar ──────────────────────────────────────────────────────────
  { name: 'Plateau', region: 'Dakar', needsValidation: true },
  { name: 'Médina', region: 'Dakar', needsValidation: true },
  { name: 'Fann', region: 'Dakar', needsValidation: true },
  { name: 'Point E', region: 'Dakar', needsValidation: true },
  { name: 'Mermoz', region: 'Dakar', needsValidation: true },
  { name: 'Sacré-Cœur', region: 'Dakar', needsValidation: true },
  // Quartier composé distinct de "Mermoz" seul (lot 7, règle 1.c) — les deux
  // noms restent aussi valables séparément ci-dessus.
  { name: 'Mermoz Sacré-Cœur', region: 'Dakar', needsValidation: true },
  { name: 'Ouakam', region: 'Dakar', needsValidation: true },
  { name: 'Ngor', region: 'Dakar', needsValidation: true },
  { name: 'Yoff', region: 'Dakar', needsValidation: true },
  { name: 'Almadies', region: 'Dakar', needsValidation: true },
  { name: 'Liberté', region: 'Dakar', needsValidation: true },
  { name: 'HLM', region: 'Dakar', needsValidation: true },
  { name: 'Grand Yoff', region: 'Dakar', needsValidation: true },
  { name: 'Parcelles Assainies', region: 'Dakar', needsValidation: true },
  { name: "Patte d'Oie", region: 'Dakar', needsValidation: true },
  { name: 'Castors', region: 'Dakar', needsValidation: true },
  { name: 'Sicap', region: 'Dakar', needsValidation: true },
  { name: 'Bopp', region: 'Dakar', needsValidation: true },
  { name: 'Colobane', region: 'Dakar', needsValidation: true },
  { name: 'Hann', region: 'Dakar', needsValidation: true },
  { name: 'Gueule Tapée', region: 'Dakar', needsValidation: true },
  { name: 'Ouest Foire', region: 'Dakar', needsValidation: true },
  // VDN retiré (lot 7, règle 1.b) : axe routier qui traverse plusieurs
  // quartiers, jamais un cityContains fiable — déplacé vers
  // places/landmarks.ts (ambiguïté "landmark" au lieu d'un faux filtre).
  { name: 'Amitié', region: 'Dakar', needsValidation: true },
  { name: 'Grand Dakar', region: 'Dakar', needsValidation: true },
  { name: 'Dieuppeul', region: 'Dakar', needsValidation: true },
  { name: 'Derklé', region: 'Dakar', needsValidation: true },
  { name: 'Cambérène', region: 'Dakar', needsValidation: true },
  { name: 'Yeumbeul', region: 'Dakar', needsValidation: true },
  { name: 'Thiaroye', region: 'Dakar', needsValidation: true },
  { name: 'Keur Massar', region: 'Dakar', needsValidation: true },
  { name: 'Malika', region: 'Dakar', needsValidation: true },
  { name: 'Golf', region: 'Dakar', needsValidation: true },
  { name: 'Rufisque', region: 'Dakar', needsValidation: true },
  { name: 'Bargny', region: 'Dakar', needsValidation: true },
  { name: 'Diamniadio', region: 'Dakar', needsValidation: true },
  { name: 'Guédiawaye', region: 'Dakar', needsValidation: true },
  { name: 'Pikine', region: 'Dakar', needsValidation: true },
  // ── Dakar — complément lot 7 bis (règle E), needsValidation partout ──
  { name: 'Mamelles', region: 'Dakar', needsValidation: true },
  { name: 'Maristes', region: 'Dakar', needsValidation: true },
  { name: 'Bel-Air', region: 'Dakar', needsValidation: true },
  { name: 'Fass', region: 'Dakar', needsValidation: true },
  { name: 'Mbao', region: 'Dakar', needsValidation: true },
  { name: 'Sangalkam', region: 'Dakar', needsValidation: true },
  { name: 'Bambilor', region: 'Dakar', needsValidation: true },
  { name: 'Lac Rose', region: 'Dakar', needsValidation: true },
  // ── Dakar — complément lot 7 ter (règle 3, audit des régions) : toutes
  // dans le département de Rufisque (région de Dakar), d'après le
  // découpage administratif (Rufisque, Bargny, Diamniadio, Sangalkam,
  // Bambilor ci-dessus en faisaient déjà partie, confirmés corrects).
  { name: 'Sébikotane', region: 'Dakar', needsValidation: true },
  { name: 'Yenne', region: 'Dakar', needsValidation: true },
  { name: 'Kounoune', region: 'Dakar', needsValidation: true },
  // Toubab Dialaw CORRIGÉ (lot 7 ter) : département de Rufisque (commune
  // de Yène), région de Dakar — pas Thiès comme précédemment saisi.
  { name: 'Toubab Dialaw', region: 'Dakar', needsValidation: true },

  // ── Dakar — complément « quartiers complémentaires » ──────────────────
  { name: 'Keur Gorgui', region: 'Dakar', needsValidation: true },
  // Composé distinct de "Keur Gorgui" seul (même principe que "Mermoz
  // Sacré-Cœur") — les deux restent aussi valables séparément.
  { name: 'Cité Keur Gorgui', region: 'Dakar', needsValidation: true },
  // Composé distinct de "Sicap" seul (déjà listé ci-dessus).
  { name: 'Sicap Baobab', region: 'Dakar', needsValidation: true },
  { name: 'Nord Foire', region: 'Dakar', needsValidation: true },
  { name: 'Dalifort', region: 'Dakar', needsValidation: true },
  { name: 'Sahm', region: 'Dakar', needsValidation: true },
  { name: 'Hamo', region: 'Dakar', needsValidation: true },
  { name: 'Zone B', region: 'Dakar', needsValidation: true },
  { name: 'Gibraltar', region: 'Dakar', needsValidation: true },
  { name: 'Médina Gounass', region: 'Dakar', needsValidation: true },
  // Composé distinct de "Golf" seul (déjà listé ci-dessus).
  { name: 'Golf Sud', region: 'Dakar', needsValidation: true },
  { name: 'Jaxaay', region: 'Dakar', needsValidation: true },
  { name: 'Tivaoune Peulh', region: 'Dakar', needsValidation: true },
  { name: 'Niacoulrab', region: 'Dakar', needsValidation: true },
  { name: 'Cité Djily Mbaye', region: 'Dakar', needsValidation: true },
  { name: 'Cité Comico', region: 'Dakar', needsValidation: true },
  { name: 'Wakhinane Nimzatt', region: 'Dakar', needsValidation: true },

  // ── Thiès ──────────────────────────────────────────────────────────
  { name: 'Saly', region: 'Thiès', needsValidation: true },
  { name: 'Somone', region: 'Thiès', needsValidation: true },
  { name: 'Ngaparou', region: 'Thiès', needsValidation: true },
  { name: 'Popenguine', region: 'Thiès', needsValidation: true },
  { name: 'Mbour', region: 'Thiès', needsValidation: true },
  { name: 'Joal-Fadiouth', region: 'Thiès', needsValidation: true },
  // Joal et Fadiouth cités séparément aussi (village-pont relié à Joal par
  // une passerelle, parfois nommé seul — lot 7 bis, règle E).
  { name: 'Joal', region: 'Thiès', needsValidation: true },
  { name: 'Fadiouth', region: 'Thiès', needsValidation: true },
  { name: 'Warang', region: 'Thiès', needsValidation: true },
  { name: 'Pointe Sarène', region: 'Thiès', needsValidation: true },
  // Pout et Sindia ajoutés (lot 7 ter, règle 3) : département de Thiès
  // (Pout) et de Mbour (Sindia), région de Thiès.
  { name: 'Pout', region: 'Thiès', needsValidation: true },
  { name: 'Sindia', region: 'Thiès', needsValidation: true },

  // ── Thiès — complément « quartiers complémentaires » ──────────────────
  { name: 'Nianing', region: 'Thiès', needsValidation: true },
  { name: 'Mbodiène', region: 'Thiès', needsValidation: true },
  // Composé distinct de "Saly" seul (déjà listé ci-dessus).
  { name: 'Saly Portudal', region: 'Thiès', needsValidation: true },
];
