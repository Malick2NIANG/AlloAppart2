import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) content!: string;
  @IsString() @IsOptional() replyToId?: string;
}
