'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MapFocus } from './LocationPicker';
import TouchGuard from './TouchGuard';

const goldPin = L.divIcon({
  html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="#b58900" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>`,
  className: '',
  iconSize: [28, 40],
  iconAnchor: [14, 40],
});

function ClickLayer({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Recentre la carte quand le formulaire le demande (nouveau `nonce`). */
function FocusLayer({ focus, onFocused }: { focus?: MapFocus; onFocused: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    onFocused(focus.lat, focus.lng);
    map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);
  return null;
}

export default function LocationPickerInner({
  defaultLat,
  defaultLng,
  onChange,
  focus,
  highlight,
}: {
  defaultLat: number;
  defaultLng: number;
  onChange: (lat: number, lng: number) => void;
  focus?: MapFocus;
  highlight?: unknown;
}) {
  const [pos, setPos] = useState<[number, number]>([defaultLat, defaultLng]);
  const t = useTranslations('detail');
  const [isMobile, setIsMobile] = useState(false);
  const [mapActive, setMapActive] = useState(false);

  // Même garde tactile que la fiche annonce (MapViewInner/TouchGuard) :
  // évite que glisser pour placer le repère capture le défilement vertical
  // de la page. Le clic (`ClickLayer`) reste actif en permanence — un tap
  // sur l'overlay active juste le pan/zoom, un tap suivant sur la carte
  // place le repère. Sans effet ≥768px (overlay non monté).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture ponctuelle du viewport au montage (composant ssr:false, pas de risque d'hydratation)
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handlePick = (lat: number, lng: number) => {
    const rounded: [number, number] = [Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6];
    setPos(rounded);
    onChange(rounded[0], rounded[1]);
  };

  return (
    <div className="relative w-full h-full">
      <div className="pointer-events-none absolute top-2 left-1/2 z-[1000] -translate-x-1/2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/90 px-3 py-1 text-xs text-gray-800 shadow backdrop-blur-sm">
          <i className="fa-solid fa-location-crosshairs text-gold-dark text-[10px]" />
          Cliquez pour placer votre bien
        </span>
      </div>
      <MapContainer center={pos} zoom={13} scrollWheelZoom className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Limites : <a href="https://www.geoboundaries.org">geoBoundaries</a> (CC BY 3.0 IGO)'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {Boolean(highlight) && (
          <GeoJSON
            // La clé force le redessin quand la région change.
            key={JSON.stringify((highlight as { properties?: unknown }).properties ?? 'r')}
            data={highlight as GeoJSON.GeoJsonObject}
            style={{ color: '#b58900', weight: 2, dashArray: '6 4', fillOpacity: 0.05 }}
            interactive={false}
          />
        )}
        <ClickLayer onPick={handlePick} />
        <FocusLayer focus={focus} onFocused={(lat, lng) => setPos([lat, lng])} />
        <Marker position={pos} icon={goldPin} />
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
