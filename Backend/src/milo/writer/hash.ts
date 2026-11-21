/**
 * Hash déterministe (FNV-1a, 32 bits) — jamais d'aléatoire non reproductible
 * (cf. Milo.md § Writer). Sert à choisir une variante de formulation stable
 * pour une même combinaison de champs, différente pour une combinaison
 * différente — deux annonces similaires mais pas identiques.
 */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Choisit un index de variante déterministe. `salt` isole chaque emplacement
 * de phrase (titre, surface, équipements…) pour que deux emplacements ne
 * retombent pas systématiquement sur la même variante pour un même bien.
 */
export function pickVariant(
  seedText: string,
  salt: string,
  count: number,
): number {
  if (count <= 1) return 0;
  return fnv1a(`${salt}::${seedText}`) % count;
}
