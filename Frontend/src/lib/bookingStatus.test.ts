import { describe, expect, it } from 'vitest';
import type { BookingStatus } from '@/types';
import {
  bookingStatusGroup,
  BOOKING_STATUS_STYLES,
  PENDING_STATUSES,
  ACTIVE_STATUSES,
  ARCHIVED_STATUSES,
} from './bookingStatus';

// Les 9 statuts de réservation couvrent les deux flux (nuitée et bail
// mensuel) — le regroupement en 3 catégories (pending/active/archived) doit
// couvrir chacun d'eux exactement une fois. Un statut oublié tomberait
// silencieusement dans "archived" (comportement par défaut de
// bookingStatusGroup), d'où l'intérêt de vérifier chaque statut explicitement
// plutôt que de se fier au regroupement par défaut.
const ALL_STATUSES: BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'ACTIVE',
  'TERMINATED',
];

describe('bookingStatusGroup', () => {
  it.each(PENDING_STATUSES)('classe %s comme "pending"', (status) => {
    expect(bookingStatusGroup(status)).toBe('pending');
  });

  it.each(ACTIVE_STATUSES)('classe %s comme "active"', (status) => {
    expect(bookingStatusGroup(status)).toBe('active');
  });

  it.each(ARCHIVED_STATUSES)('classe %s comme "archived"', (status) => {
    expect(bookingStatusGroup(status)).toBe('archived');
  });

  it('couvre bien les 9 statuts connus, sans doublon ni oubli', () => {
    const covered = [
      ...PENDING_STATUSES,
      ...ACTIVE_STATUSES,
      ...ARCHIVED_STATUSES,
    ];
    expect(covered.sort()).toEqual([...ALL_STATUSES].sort());
    expect(new Set(covered).size).toBe(ALL_STATUSES.length);
  });
});

describe('BOOKING_STATUS_STYLES', () => {
  it('définit une classe de style pour chacun des 9 statuts', () => {
    for (const status of ALL_STATUSES) {
      expect(BOOKING_STATUS_STYLES[status]).toBeTruthy();
    }
  });
});
