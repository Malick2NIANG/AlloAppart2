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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../auth/dto/pagination.dto';
import { type User, Role, ListingStatus } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { PaydunyaWebhookDto } from '../payments/dto/paydunya-webhook.dto';

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
  findAllAdmin(
    @Query() dto: PaginationDto,
    @Query('status') status?: string,
    @Query('city') city?: string,
  ) {
    const listingStatus = Object.values(ListingStatus).includes(status as ListingStatus)
      ? (status as ListingStatus)
      : undefined;
    return this.listingsService.findAll_admin(dto.page ?? 1, dto.limit ?? 20, listingStatus, city);
  }

  @Get('mine')
  findMine(@CurrentUser() user: User) {
    return this.listingsService.findMine(user.id);
  }

  @Get('favorites')
  findFavorites(@CurrentUser() user: User) {
    return this.listingsService.findFavorites(user.id);
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

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Public()
  @Post('webhook/boost/paydunya')
  boostWebhookPaydunya(@Body() dto: PaydunyaWebhookDto) {
    return this.listingsService.handleBoostWebhookPayDunya(dto);
  }
}
