import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Roles(Role.ADMIN)
  @Get('all')
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.reviewsService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Roles(Role.LOCATAIRE)
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.id, dto);
  }

  /** Avis rédigés par le locataire connecté */
  @Get('mine')
  findMine(@CurrentUser() user: User) {
    return this.reviewsService.findMine(user.id);
  }

  /** Avis reçus sur les annonces du bailleur connecté */
  @Get('bailleur/me')
  findByOwner(@CurrentUser() user: User) {
    return this.reviewsService.findByOwner(user.id);
  }

  @Public()
  @Get('listing/:id')
  findByListing(@Param('id') id: string, @Query('page') page?: string) {
    return this.reviewsService.findByListing(id, page ? parseInt(page) : 1);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() admin: User) {
    return this.reviewsService.remove(id, admin);
  }
}
