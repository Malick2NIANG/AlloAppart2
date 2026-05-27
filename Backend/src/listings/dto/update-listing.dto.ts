import { PartialType } from '@nestjs/mapped-types';
import { CreateListingDto } from './create-listing.dto';

// `status` est intentionnellement absent — les transitions de statut passent
// par les endpoints dédiés PATCH /:id/activate et PATCH /:id/suspend (ADMIN uniquement).
export class UpdateListingDto extends PartialType(CreateListingDto) {}
