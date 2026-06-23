import { IsString } from 'class-validator';

export class PaydunyaWebhookDto {
  @IsString() data!: string;
}
