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

export default function LocationPicker({
  defaultLat = 14.6937,
  defaultLng = -17.4441,
  onChange,
}: {
  defaultLat?: number;
  defaultLng?: number;
  onChange: (lat: number, lng: number) => void;
}) {
  return <Inner defaultLat={defaultLat} defaultLng={defaultLng} onChange={onChange} />;
}
