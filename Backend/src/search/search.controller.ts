import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  search(
    @Query('q') q: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
  ) {
    return this.searchService.fullTextSearch(
      q ?? '',
      filter,
      sort ? sort.split(',') : undefined,
    );
  }

  @Public()
  @Get('geo')
  geoSearch(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.searchService.geoSearch({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius: radius ? parseInt(radius) : 5000,
    });
  }
}
