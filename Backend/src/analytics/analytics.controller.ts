import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { PdfService } from '../pdf/pdf.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly pdfService: PdfService,
  ) {}

  @Roles(Role.LOCATAIRE)
  @Get('locataire')
  getLocataireStats(@CurrentUser() user: User) {
    return this.analyticsService.getLocataireStats(user.id);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Get('owner/report')
  async getOwnerReport(
    @CurrentUser() user: User,
    @Query('month') month: string,
    @Res() res: Response,
  ) {
    const data = await this.analyticsService.getOwnerMonthlyReport(user.id, month);
    const pdf  = await this.pdfService.generateMonthlyReport(data);
    const filename = `rapport-${month}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      pdf.length,
    });
    res.end(pdf);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Get('owner/monthly')
  getOwnerMonthlyStats(@CurrentUser() user: User) {
    return this.analyticsService.getOwnerMonthlyStats(user.id);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Get('owner')
  getOwnerStats(@CurrentUser() user: User) {
    return this.analyticsService.getOwnerStats(user.id);
  }

  @Roles(Role.PRO_AGENCE)
  @Get('vitrine')
  getVitrineStats(@CurrentUser() user: User) {
    return this.analyticsService.getVitrineStats(user.id);
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
