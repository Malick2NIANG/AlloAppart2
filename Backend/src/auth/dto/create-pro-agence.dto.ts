import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProAgenceDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) agencyName!: string;
  @IsOptional() @IsString() phone?: string;
}
