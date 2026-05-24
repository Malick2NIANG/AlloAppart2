import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Get('owner')
  getOwnerStats(@CurrentUser() user: User) {
    return this.analyticsService.getOwnerStats(user.id);
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  getAdminStats(@CurrentUser() user: User) {
    return this.analyticsService.getAdminStats(user);
  }
}
