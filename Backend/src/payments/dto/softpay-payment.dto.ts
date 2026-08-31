import { IsString, MinLength } from 'class-validator';

export class SoftpayPaymentDto {
  @IsString()
  @MinLength(10)
  paymentToken!: string;

  @IsString()
  @MinLength(8)
  phone!: string;
}
