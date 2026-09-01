import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  listingId!: string;

  @IsDateString()
  startDate!: string;

  // Obligatoire : sans date de fin, le calcul de prix (jours de séjour)
  // retombait sur un forfait d'un seul jour côté service, sous-facturant
  // largement tout séjour sans durée définie.
  @IsDateString()
  endDate!: string;
}
