import { IsDateString, IsOptional, IsString } from 'class-validator';

// Édition d'une demande AlloVérifié par le demandeur (bailleur/agence) —
// uniquement possible tant que la demande est REQUESTED (pas encore
// assignée à un agent). preferredAgentId accepte une chaîne vide pour
// repasser sur "pas de préférence", comme dans CreateVerificationDto côté
// front (form.preferredAgentId === '').
export class UpdateVerificationDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  preferredAgentId?: string;
}
