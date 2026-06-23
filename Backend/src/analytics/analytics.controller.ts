import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Roles(Role.LOCATAIRE)
  @Get('locataire')
  getLocataireStats(@CurrentUser() user: User) {
    return this.analyticsService.getLocataireStats(user.id);
  }

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

  @Roles(Role.ADMIN)
  @Get('admin/extended')
  getAdminExtended(@CurrentUser() user: User) {
    return this.analyticsService.getAdminExtended(user);
  }

  @Roles(Role.ADMIN)
  @Get('admin/alerts')
  getAdminAlerts(@CurrentUser() user: User) {
    return this.analyticsService.getAdminAlerts(user);
  }
}
