import { ArrayMinSize, IsArray, IsString, IsUrl, MinLength } from 'class-validator';

export class ReportDisputeDto {
  @IsString()
  @MinLength(10)
  reason!: string;

  // Photos/vidéos justificatives — URLs Cloudinary déjà uploadées via /upload
  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  evidence!: string[];
}
