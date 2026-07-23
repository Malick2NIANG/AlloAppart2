import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateListingDto } from './create-listing.dto';

// `status` est intentionnellement absent — les transitions de statut passent
// par les endpoints dédiés /publish, /unpublish, /activate, /suspend.
export class UpdateListingDto extends PartialType(OmitType(CreateListingDto, ['status'] as const)) {}
