'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import TouchGuard from './TouchGuard';

const goldPin = L.divIcon({
  html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="#b58900" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>`,
  className: '',
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -42],
});

export default function MapViewInner({ lat, lng, title }: { lat: number; lng: number; title?: string }) {
  const t = useTranslations('detail');
  const [isMobile, setIsMobile] = useState(false);
  const [mapActive, setMapActive] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture ponctuelle du viewport au montage (composant ssr:false, pas de risque d'hydratation)
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="relative w-full h-full">
      <MapContainer center={[lat, lng]} zoom={15} className="w-full h-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={goldPin}>
          {title && <Popup><span className="text-sm font-medium">{title}</span></Popup>}
        </Marker>
        {isMobile && <TouchGuard active={mapActive} />}
      </MapContainer>
      {isMobile && !mapActive && (
        <button
          type="button"
          onClick={() => setMapActive(true)}
          className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/5"
        >
          <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
            <i className="fa-solid fa-hand-pointer" />
            {t('tapToInteractMap')}
          </span>
        </button>
      )}
    </div>
  );
}
