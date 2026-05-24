import { IsOptional, IsString } from 'class-validator';

export class CinetpayWebhookDto {
  @IsString() cpm_site_id!: string;
  @IsString() cpm_trans_id!: string;
  @IsString() cpm_trans_date!: string;
  @IsString() cpm_amount!: string;
  @IsString() cpm_currency!: string;
  @IsString() cpm_result!: string;
  @IsString() signature!: string;
  @IsString() payment_method!: string;
  @IsOptional() @IsString() cel_phone_num?: string;
  @IsOptional() @IsString() cpm_phone_prefixe?: string;
  @IsOptional() @IsString() cpm_language?: string;
  @IsOptional() @IsString() cpm_version?: string;
  @IsOptional() @IsString() cpm_payment_config?: string;
  @IsOptional() @IsString() cpm_page_action?: string;
  @IsOptional() @IsString() cpm_custom?: string;
  @IsOptional() @IsString() cpm_designation?: string;
  @IsOptional() @IsString() cpm_error_message?: string;
}
