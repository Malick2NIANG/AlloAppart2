import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { BookingsService } from './bookings.service';
import { PdfService } from '../pdf/pdf.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateMonthlyBookingDto } from './dto/create-monthly-booking.dto';
import { ReportDisputeDto } from './dto/report-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role, BookingStatus } from '@prisma/client';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly pdfService: PdfService,
  ) {}

  @Roles(Role.ADMIN)
  @Get('all')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const bookingStatus = Object.values(BookingStatus).includes(
      status as BookingStatus,
    )
      ? (status as BookingStatus)
      : undefined;
    return this.bookingsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      bookingStatus,
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.LOCATAIRE)
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.LOCATAIRE)
  @Post('monthly')
  createMonthly(
    @CurrentUser() user: User,
    @Body() dto: CreateMonthlyBookingDto,
  ) {
    return this.bookingsService.createMonthlyRequest(user.id, dto);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Patch(':id/approve')
  approveMonthly(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.approveMonthlyRequest(id, user.id);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Patch(':id/reject')
  rejectMonthly(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.rejectMonthlyRequest(id, user.id);
  }

  @Patch(':id/terminate-lease')
  terminateLease(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.terminateLease(id, user);
  }

  @Get('mine')
  findMine(@CurrentUser() user: User) {
    return this.bookingsService.findMine(user.id);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE, Role.ADMIN)
  @Get('received')
  findReceived(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bookingsService.findReceived(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Public()
  @Get('listing/:listingId/availability')
  getAvailability(@Param('listingId') listingId: string) {
    return this.bookingsService.getAvailability(listingId);
  }

  @Get(':id/receipt')
  async getReceipt(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const booking = await this.bookingsService.findOneForReceipt(id, user.id);
    const pdf = await this.pdfService.generateReceipt(booking);
    const filename = 'recu-' + id.slice(0, 8).toUpperCase() + '.pdf';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Patch(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.complete(id, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.findOne(id, user.id);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.confirm(id, user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.cancel(id, user);
  }

  // Signalement de non-conformité — Article 9 des CGU, fenêtre de 24h
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Roles(Role.LOCATAIRE)
  @Patch(':id/report-dispute')
  reportDispute(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ReportDisputeDto,
  ) {
    return this.bookingsService.reportDispute(id, user.id, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/resolve-dispute')
  resolveDispute(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.bookingsService.resolveDispute(id, user, dto);
  }
}
