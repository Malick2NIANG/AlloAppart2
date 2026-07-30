// Enums — alignés exactement sur le schéma Prisma

export type Role = 'LOCATAIRE' | 'BAILLEUR' | 'AGENT_TERRAIN' | 'PRO_AGENCE' | 'ADMIN';

export type ListingType = 'APPARTEMENT' | 'VILLA' | 'STUDIO' | 'CHAMBRE' | 'BUREAU';
export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'RENTED' | 'SUSPENDED';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type EscrowStatus = 'AWAITING_PAYMENT' | 'HELD' | 'RELEASED' | 'REFUNDED';

export type VerifStatus = 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED' | 'DECLINE_PENDING';
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
  isSuspended: boolean;
  agencyName?: string | null;
  agencySlug?: string | null;
  bio?: string | null;
  avatar?: string | null;
  coverageZone?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: string | number;          // Tarif mensuel — Decimal → string via JSON
  pricePerNight?: string | number | null; // Tarif par nuit (optionnel)
  minimumNights?: number | null;          // Durée minimum de séjour en nuits
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
  owner?: Pick<User, 'id' | 'firstName' | 'lastName' | 'agencyName' | 'agencySlug' | 'avatar' | 'roles' | 'phone'>;
  _count?: { reviews: number; bookings?: number };
  avgRating?: number | null;
  verification?: Verification;
  tourUrl?: string | null;
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
  totalAmount: string;    // Decimal → string via JSON
  platformFee?: string;   // commission AlloAppart (10%)
  landlordAmount?: string; // montant net bailleur
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
  tourUrl?: string;
  scheduledAt: string;
  completedAt?: string;
  notes?: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MessageReplyTo {
  id: string;
  content: string;
  senderId: string;
  deletedAt?: string | null;
  sender?: Pick<User, 'id' | 'firstName' | 'lastName' | 'agencyName' | 'roles'>;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  sender?: User;
  content: string;
  readAt?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToId?: string | null;
  replyTo?: MessageReplyTo | null;
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
  listing?: Pick<Listing, 'id' | 'title' | 'city'>;
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

export type SubscriptionPlan = 'STARTER' | 'PRO';
export type SubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

export interface Subscription {
  id: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'agencyName'>;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  monthlyFee: string;
  startDate: string;
  endDate?: string | null;
  paymentRef?: string | null;
  createdAt: string;
  updatedAt: string;
}
