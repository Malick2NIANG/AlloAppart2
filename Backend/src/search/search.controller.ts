import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { Public } from '../common/decorators/public.decorator';

const ALLOWED_FILTER_FIELDS = [
  'type',
  'city',
  'region',
  'isVerified',
  'boostScore',
  'price',
];
const ALLOWED_SORT_FIELDS = ['boostScore', 'createdAt', 'price'];

function validateMeilisearchFilter(filter: string): void {
  const fieldPattern = /([a-zA-Z_][a-zA-Z0-9_.]*)\s*[=<>!]/g;
  let match: RegExpExecArray | null;
  while ((match = fieldPattern.exec(filter)) !== null) {
    if (!ALLOWED_FILTER_FIELDS.includes(match[1])) {
      throw new BadRequestException(
        `Champ de filtre non autorisé : ${match[1]}`,
      );
    }
  }
}

function validateMeilisearchSort(sortFields: string[]): void {
  for (const field of sortFields) {
    const fieldName = field.replace(/:asc|:desc/gi, '');
    if (!ALLOWED_SORT_FIELDS.includes(fieldName)) {
      throw new BadRequestException(`Champ de tri non autorisé : ${fieldName}`);
    }
  }
}

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
    if (filter) validateMeilisearchFilter(filter);
    const sortFields = sort ? sort.split(',') : undefined;
    if (sortFields) validateMeilisearchSort(sortFields);
    return this.searchService.fullTextSearch(q ?? '', filter, sortFields);
  }

  @Public()
  @Get('geo')
  geoSearch(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      throw new BadRequestException(
        'Latitude invalide (doit être entre -90 et 90)',
      );
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      throw new BadRequestException(
        'Longitude invalide (doit être entre -180 et 180)',
      );
    }
    return this.searchService.geoSearch({
      lat: latNum,
      lng: lngNum,
      radius: radius ? parseInt(radius, 10) : 5000,
    });
  }
}
