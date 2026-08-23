import { IsIn } from 'class-validator';

export type DisputeDecision = 'RELEASE' | 'REFUND';

export class ResolveDisputeDto {
  @IsIn(['RELEASE', 'REFUND'])
  decision!: DisputeDecision;
}
