'use client';

import { useState } from 'react';
import ReportModal from './ReportModal';

export default function ReportButton({ listingId, label }: { listingId: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-sub hover:text-red-500 transition-colors flex items-center gap-1.5"
      >
        <i className="fa-regular fa-flag text-xs" />
        {label}
      </button>
      {/* Toujours monté (contrôlé par `open`) — nécessaire pour que
          l'animation de fermeture du BottomSheet puisse jouer (lot 2b). */}
      <ReportModal listingId={listingId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
