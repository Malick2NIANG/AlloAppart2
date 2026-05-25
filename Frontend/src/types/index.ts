// Enums — alignés exactement sur le schéma Prisma

export type Role = 'LOCATAIRE' | 'BAILLEUR' | 'AGENT_TERRAIN' | 'PRO_AGENCE' | 'ADMIN';

export type ListingType = 'APPARTEMENT' | 'VILLA' | 'STUDIO' | 'CHAMBRE' | 'BUREAU';
export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'RENTED' | 'SUSPENDED';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type EscrowStatus = 'AWAITING_PAYMENT' | 'HELD' | 'RELEASED' | 'REFUNDED';

export type VerifStatus = 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';
export type AuditType = 'BASIC' | 'FULL';

export interface User {
  id: string;
  clerkId: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: string | number; // Decimal → string via JSON
  type: ListingType;
  status: ListingStatus;
  isVerified: boolean;
  verifiedAt?: string | null;
  lat: number;
  lng: number;
  city: string;
  region: string;
  address?: string | null;
  rooms?: number | null;
  beds?: number | null;
  baths?: number | null;
  surface?: number | null;
  boostUntil?: string | null;
  boostScore: number;
  images: string[];
  amenities: string[];
  ownerId: string;
  owner?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  _count?: { reviews: number };
  avgRating?: number | null;
  verification?: Verification;
  reviews?: Review[];
  createdAt: string;
  updatedAt: string;
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

export function priceToNumber(price: string | number): number {
  return typeof price === 'string' ? parseFloat(price) : price;
}

export function ownerFullName(owner?: Pick<User, 'firstName' | 'lastName'> | null): string {
  if (!owner) return '';
  return `${owner.firstName} ${owner.lastName}`.trim();
}

export interface Booking {
  id: string;
  listingId: string;
  listing?: Listing;
  tenantId: string;
  tenant?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  startDate: string;
  endDate?: string;
  totalAmount: string; // Decimal → string via JSON
  status: BookingStatus;
  escrowStatus: EscrowStatus;
  paymentRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalListings: number;
  publishedListings: number;
  totalBookings: number;
  confirmedBookings: number;
  totalRevenue: string;
  pendingVerifications: number;
  completedVerifications: number;
}

export interface Verification {
  id: string;
  listingId: string;
  listing?: Listing;
  agentId?: string | null;
  agent?: User;
  status: VerifStatus;
  auditType: AuditType;
  reportUrl?: string;
  scheduledAt: string;
  completedAt?: string;
  notes?: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  sender?: User;
  content: string;
  readAt?: string;
  createdAt: string;
}

export interface MessageRoom {
  id: string;
  listingId: string;
  listing?: Listing;
  participants: User[];
  messages?: Message[];
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  listingId: string;
  authorId: string;
  author?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export type ListingsResponse = PaginatedResponse<Listing>;
