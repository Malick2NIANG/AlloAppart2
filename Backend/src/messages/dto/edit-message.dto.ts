import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EditMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) content!: string;
}
