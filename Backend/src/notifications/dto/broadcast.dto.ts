import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export type BroadcastSegment =
  | 'ALL'
  | 'BAILLEURS'
  | 'LOCATAIRES'
  | 'PRO_AGENCES'
  | 'AGENTS_TERRAIN';

export class BroadcastDto {
  @IsString() @IsNotEmpty() @MaxLength(50) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) message!: string;
  @IsEnum(['ALL', 'BAILLEURS', 'LOCATAIRES', 'PRO_AGENCES', 'AGENTS_TERRAIN'])
  segment!: BroadcastSegment;
}
