import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SyncUserDto {
  @IsString() @IsNotEmpty() clerkId!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
  @IsOptional() @IsString() phone?: string;
}
