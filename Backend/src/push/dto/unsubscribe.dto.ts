import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UnsubscribeDto {
  @IsString() @IsNotEmpty() @MaxLength(500) endpoint!: string;
}
