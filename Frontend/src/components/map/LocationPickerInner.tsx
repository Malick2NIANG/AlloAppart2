'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useState } from 'react';

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

export default function LocationPickerInner({
  defaultLat,
  defaultLng,
  onChange,
}: {
  defaultLat: number;
  defaultLng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const [pos, setPos] = useState<[number, number]>([defaultLat, defaultLng]);

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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickLayer onPick={handlePick} />
        <Marker position={pos} icon={goldPin} />
      </MapContainer>
    </div>
  );
}
