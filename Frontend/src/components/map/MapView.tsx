'use client';

import dynamic from 'next/dynamic';

const Inner = dynamic(() => import('./MapViewInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-bg animate-pulse rounded-2xl flex items-center justify-center">
      <i className="fa-solid fa-map-location-dot text-2xl text-sub/30" />
    </div>
  ),
});

export default function MapView({ lat, lng, title }: { lat: number; lng: number; title?: string }) {
  return <Inner lat={lat} lng={lng} title={title} />;
}
