import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { FilterListingsDto } from './dto/filter-listings.dto';
import { AdminListingsQueryDto } from './dto/admin-listings-query.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role, ListingStatus } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Public()
  @Get()
  findAll(@Query() filters: FilterListingsDto) {
    return this.listingsService.findAll(filters);
  }

  @Roles(Role.ADMIN)
  @Get('all')
  findAllAdmin(@Query() dto: AdminListingsQueryDto) {
    const listingStatus = Object.values(ListingStatus).includes(dto.status as ListingStatus)
      ? (dto.status as ListingStatus)
      : undefined;
    return this.listingsService.findAll_admin(dto.page ?? 1, dto.limit ?? 20, listingStatus, dto.city);
  }

  @Get('mine')
  findMine(@CurrentUser() user: User) {
    return this.listingsService.findMine(user.id);
  }

  @Get('favorites')
  findFavorites(@CurrentUser() user: User) {
    return this.listingsService.findFavorites(user.id);
  }

  @Roles(Role.ADMIN)
  @Get('reports')
  findAllReports() {
    return this.listingsService.findAllReports();
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Patch(':id/unpublish')
  unpublish(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.unpublishListing(id, user.id);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Patch(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.publishListing(id, user.id);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Patch(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.archiveListing(id, user.id);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Patch(':id/restore')
  restore(
    @Param('id') id: string,
    @Body('status') status: 'DRAFT' | 'ACTIVE',
    @CurrentUser() user: User,
  ) {
    return this.listingsService.restoreListing(id, user.id, status ?? 'DRAFT');
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @Public()
  @Get(':id/similar')
  findSimilar(@Param('id') id: string) {
    return this.listingsService.findSimilar(id);
  }

  @Get(':id/favorite')
  checkFavorite(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService
      .isFavorite(id, user.id)
      .then((favorited) => ({ favorited }));
  }

  @Post(':id/favorite')
  addFavorite(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.addFavorite(id, user.id);
  }

  @Delete(':id/favorite')
  removeFavorite(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.removeFavorite(id, user.id);
  }

  @Throttle({ default: { ttl: 3_600_000, limit: 5 } }) // 5 signalements par heure par IP
  @Post(':id/report')
  reportListing(
    @Param('id') id: string,
    @Body() dto: CreateReportDto,
    @CurrentUser() user: User,
  ) {
    return this.listingsService.reportListing(id, user.id, dto);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateListingDto) {
    return this.listingsService.create(user.id, dto);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.update(id, user, dto);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.remove(id, user);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE, Role.ADMIN)
  @Post(':id/boost')
  boost(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.boost(id, user);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Roles(Role.BAILLEUR, Role.PRO_AGENCE, Role.ADMIN)
  @Post(':id/boost/verify')
  verifyBoost(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.verifyBoost(id, user.id);
  }

  @Roles(Role.ADMIN, Role.AGENT_TERRAIN)
  @Patch(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.activateListing(id, user);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.suspendListing(id, user);
  }

  // Body non typé par un DTO class-validator : voir la note équivalente dans
  // PaymentsController.webhookPaydunya — même raison.
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Public()
  @Post('webhook/boost/paydunya')
  boostWebhookPaydunya(@Body() body: Record<string, unknown>) {
    return this.listingsService.handleBoostWebhookPayDunya(body);
  }
}
