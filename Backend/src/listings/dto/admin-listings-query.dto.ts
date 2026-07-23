import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../auth/dto/pagination.dto';

export class AdminListingsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  city?: string;
}
