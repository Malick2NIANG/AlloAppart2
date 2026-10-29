import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch } from 'meilisearch';
import {
  ALLOWED_FILTER_FIELDS,
  ALLOWED_SORT_FIELDS,
  SEARCH_SYNONYMS,
} from './search.constants';

interface GeoSearchDto {
  lat: number;
  lng: number;
  radius?: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private meilisearch: MeiliSearch;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.meilisearch = new MeiliSearch({
      host:
        this.config.get<string>('MEILISEARCH_HOST') ?? 'http://localhost:7700',
      apiKey: this.config.get<string>('MEILISEARCH_MASTER_KEY'),
    });
  }

  /**
   * Lot 6b — l'audit a constaté que SearchController accepte filter/sort
   * mais que l'index Meilisearch n'a jamais déclaré filterableAttributes/
   * sortableAttributes : toute requête filter=... ou sort=... échouait
   * silencieusement contre Meilisearch et retombait sur le fallback Prisma
   * de fullTextSearch (le filtre/tri perdait alors toute pertinence de
   * recherche texte). updateSettings est idempotent côté Meilisearch — sans
   * effet si déjà configuré ainsi, donc appelable à chaque démarrage sans
   * risque. Ne bloque jamais le démarrage de l'app si Meilisearch est
   * injoignable (même tolérance que fullTextSearch).
   */
  async onModuleInit(): Promise<void> {
    try {
      const index = this.meilisearch.index('listings');
      await index.updateSettings({
        filterableAttributes: ALLOWED_FILTER_FIELDS,
        sortableAttributes: ALLOWED_SORT_FIELDS,
        synonyms: SEARCH_SYNONYMS,
      });
      this.logger.log(
        'Index Meilisearch "listings" configuré (filterable/sortable/synonymes).',
      );
    } catch (err) {
      this.logger.warn(
        `Configuration Meilisearch au démarrage échouée (non bloquant) : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async fullTextSearch(q: string, filters?: string, sort?: string[]) {
    try {
      const index = this.meilisearch.index('listings');
      return await index.search(q, {
        filter: filters,
        sort: sort ?? ['boostScore:desc', 'createdAt:desc'],
        limit: 20,
      });
    } catch {
      this.logger.warn('Meilisearch indisponible, fallback Prisma');
      const listings = await this.prisma.listing.findMany({
        where: {
          status: 'ACTIVE',
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { description: { contains: q, mode: 'insensitive' } },
                  { city: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ boostScore: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      });
      return { hits: listings, estimatedTotalHits: listings.length };
    }
  }

  async indexListing(listing: {
    id: string;
    title: string;
    description: string;
    type: string;
    city: string;
    region: string;
    price: { toNumber(): number } | number;
    isVerified: boolean;
    boostScore: number;
    createdAt: Date;
    lat: number | null;
    lng: number | null;
  }) {
    const index = this.meilisearch.index('listings');
    await index.addDocuments([
      {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        type: listing.type,
        city: listing.city,
        region: listing.region,
        price:
          typeof listing.price === 'number'
            ? listing.price
            : listing.price.toNumber(),
        isVerified: listing.isVerified,
        boostScore: listing.boostScore,
        createdAt: listing.createdAt.toISOString(),
        _geo:
          listing.lat != null && listing.lng != null
            ? { lat: listing.lat, lng: listing.lng }
            : undefined,
      },
    ]);
  }

  async deleteListingFromIndex(id: string) {
    const index = this.meilisearch.index('listings');
    await index.deleteDocument(id);
  }

  async geoSearch(params: GeoSearchDto) {
    const { lat, lng, radius = 5000 } = params;

    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        price: number;
        city: string;
        lat: number;
        lng: number;
        is_verified: boolean;
        distance_meters: number;
      }>
    >`
      SELECT
        id,
        title,
        price,
        city,
        lat,
        lng,
        "isVerified" AS is_verified,
        ST_Distance(
          ST_MakePoint(lng, lat)::geography,
          ST_MakePoint(${lng}, ${lat})::geography
        ) AS distance_meters
      FROM listings
      WHERE status = 'ACTIVE'
        AND ST_DWithin(
          ST_MakePoint(lng, lat)::geography,
          ST_MakePoint(${lng}, ${lat})::geography,
          ${radius}
        )
      ORDER BY "boostScore" DESC, "createdAt" DESC
      LIMIT 50
    `;

    return results;
  }

  async reindexAll(): Promise<{ indexed: number }> {
    const listings = await this.prisma.listing.findMany({
      where: { status: 'ACTIVE' },
    });
    const index = this.meilisearch.index('listings');
    await index.deleteAllDocuments();
    if (listings.length > 0) {
      await index.addDocuments(
        listings.map((l) => ({
          id: l.id,
          title: l.title,
          description: l.description,
          type: l.type,
          city: l.city,
          region: l.region,
          price:
            typeof l.price === 'number'
              ? l.price
              : (l.price as { toNumber(): number }).toNumber(),
          isVerified: l.isVerified,
          boostScore: l.boostScore,
          createdAt: l.createdAt.toISOString(),
          _geo:
            l.lat != null && l.lng != null
              ? { lat: l.lat, lng: l.lng }
              : undefined,
        })),
      );
    }
    this.logger.log(`Reindex complet : ${listings.length} annonces indexees`);
    return { indexed: listings.length };
  }
}
