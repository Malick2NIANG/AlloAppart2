import { IsUUID } from 'class-validator';

export class AssignAgentDto {
  @IsUUID() agentId!: string;
}
