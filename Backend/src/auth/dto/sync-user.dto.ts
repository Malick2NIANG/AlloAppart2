import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SyncUserDto {
  @IsString() @IsNotEmpty() clerkId!: string;
  @IsEmail()               email!: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsOptional() @IsString() phone?: string;
}
