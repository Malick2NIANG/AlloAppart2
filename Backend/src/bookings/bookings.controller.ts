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
import { Public } from '../common/decorators/public.decorator';
import { BookingsService } from './bookings.service';
import { PdfService } from '../pdf/pdf.service';
import { CreateBookingDto } from './dto/create-booking.dto';
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
    const bookingStatus = Object.values(BookingStatus).includes(status as BookingStatus)
      ? (status as BookingStatus)
      : undefined;
    return this.bookingsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      bookingStatus,
    );
  }

  @Roles(Role.LOCATAIRE)
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.id, dto);
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
    const pdf = this.pdfService.generateReceipt(booking);
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

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.cancel(id, user);
  }
}
