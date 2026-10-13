'use client';

import dynamic from 'next/dynamic';

const Inner = dynamic(() => import('./LocationPickerInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-bg animate-pulse rounded-2xl flex items-center justify-center">
      <i className="fa-solid fa-map-location-dot text-2xl text-sub/30" />
    </div>
  ),
});

/** Demande de recentrage venant du formulaire (ex. choix d'une région). `nonce` change à chaque demande. */
export interface MapFocus {
  lat: number;
  lng: number;
  zoom: number;
  nonce: number;
}

export default function LocationPicker({
  defaultLat = 14.6937,
  defaultLng = -17.4441,
  onChange,
  focus,
  highlight,
}: {
  defaultLat?: number;
  defaultLng?: number;
  onChange: (lat: number, lng: number) => void;
  /** Recentre la carte et déplace le repère (choix d'une région dans le formulaire). */
  focus?: MapFocus;
  /** Contour GeoJSON (Feature) à surligner — la région choisie. */
  highlight?: unknown;
}) {
  return (
    <Inner
      defaultLat={defaultLat}
      defaultLng={defaultLng}
      onChange={onChange}
      focus={focus}
      highlight={highlight}
    />
  );
}
