// Thin re-export — importer depuis '@/types' ou '@/types/listing' est équivalent
export type { Listing, ListingType, ListingStatus, ListingsResponse, ListingPriceUnit, ListingPriceAmount } from './index';
export { priceToNumber, ownerFullName, getListingPriceAmounts } from './index';
import type { User } from './index';
export type ListingOwner = Pick<User, 'id' | 'firstName' | 'lastName' | 'phone'>;
