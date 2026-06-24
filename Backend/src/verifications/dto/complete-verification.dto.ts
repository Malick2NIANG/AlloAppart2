import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';

export class CompleteVerificationDto {
  @IsOptional()
  @IsUrl()
  reportUrl?: string;

  @IsOptional()
  @IsUrl()
  tourUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photos?: string[];
}
