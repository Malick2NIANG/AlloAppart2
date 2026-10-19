/**
 * Convertit une coordonnée en espace client (pixels CSS, ex. `event.clientX`)
 * en coordonnée dans le repère interne d'un canvas, à partir du rectangle
 * affiché (`getBoundingClientRect`) et de la taille intrinsèque du canvas
 * (attribut `width`/`height`). Identité si le canvas est affiché à sa taille
 * intrinsèque (`rectSize === canvasSize`) — c'est le cas à partir de 768px
 * dans PhotoCropper/AvatarCropper, qui gardent leur taille d'affichage fixe
 * à ce seuil ; la conversion ne change donc rien au-delà.
 */
export function pointerToCanvas(
  clientPos: number,
  rectStart: number,
  rectSize: number,
  canvasSize: number,
): number {
  if (rectSize === 0) return 0;
  return ((clientPos - rectStart) * canvasSize) / rectSize;
}
