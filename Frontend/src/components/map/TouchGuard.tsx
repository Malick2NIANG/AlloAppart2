'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Désactive les gestes tactiles (glisser/pincer-zoomer) de la carte tant
 * qu'elle n'a pas été "activée" par un tap — évite que la carte capture le
 * défilement vertical de la page sur mobile (lot 2b, réutilisé lot 3a). À
 * monter uniquement sous 768px par le parent ; sans effet sur le clic
 * (`useMapEvents({ click })` reste actif), donc compatible avec une carte où
 * taper place un repère (`LocationPickerInner`) comme avec une carte en
 * lecture seule (`MapViewInner`).
 */
export default function TouchGuard({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (active) {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
    }
  }, [active, map]);
  return null;
}
