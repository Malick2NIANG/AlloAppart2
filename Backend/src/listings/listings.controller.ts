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
import { type User, Role } from '@prisma/client';

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
  findAllAdmin(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.listingsService.findAll_admin(parseInt(page), parseInt(limit));
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
}
