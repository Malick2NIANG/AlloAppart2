import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

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
  findReceived(@CurrentUser() user: User) {
    return this.bookingsService.findReceived(user.id);
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

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE, Role.ADMIN)
  @Patch(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.complete(id, user);
  }
}
