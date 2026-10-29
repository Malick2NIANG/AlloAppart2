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
  { name: 'VDN', region: 'Dakar', needsValidation: true },
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

  // ── Thiès ──────────────────────────────────────────────────────────
  { name: 'Saly', region: 'Thiès', needsValidation: true },
  { name: 'Somone', region: 'Thiès', needsValidation: true },
  { name: 'Ngaparou', region: 'Thiès', needsValidation: true },
  { name: 'Popenguine', region: 'Thiès', needsValidation: true },
  { name: 'Mbour', region: 'Thiès', needsValidation: true },
  { name: 'Joal-Fadiouth', region: 'Thiès', needsValidation: true },
];
