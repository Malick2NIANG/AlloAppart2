import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentType } from '@prisma/client';

/** Un document du dossier locataire (pièce d'identité, revenus, garant). */
export class BookingDocumentInputDto {
  @IsEnum(DocumentType)
  type!: DocumentType;

  @IsUrl()
  @Matches(/^https:\/\/res\.cloudinary\.com\//, {
    message: 'Le document doit être hébergé sur Cloudinary',
  })
  fileUrl!: string;
}

export class CreateMonthlyBookingDto {
  @IsUUID()
  @IsNotEmpty()
  listingId!: string;

  /** Date d'entrée souhaitée. Pas de date de fin : le bail mensuel est ouvert. */
  @IsDateString()
  moveInDate!: string;

  /** Dossier locataire — optionnel à la création, complétable avant approbation. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingDocumentInputDto)
  documents?: BookingDocumentInputDto[];
}
