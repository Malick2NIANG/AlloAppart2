import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from '@prisma/client';

export class InitiateSubscriptionDto {
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;
}
