import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { MiloModule } from '../src/milo/milo.module';
import type { ParseQueryResponse } from '../src/milo/milo.service';

function body(res: request.Response): ParseQueryResponse {
  return res.body as ParseQueryResponse;
}

describe('POST /search/parse-query (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        MiloModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requête FR : 200, understood=true, filtres corrects', async () => {
    const res = await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: 'F3 climatise a louer sous 400 000', defaultLocale: 'fr' })
      .expect(200);

    expect(body(res).understood).toBe(true);
    expect(body(res).detectedLanguage).toBe('fr');
    expect(body(res).strictFilters).toMatchObject({
      minRooms: 3,
      maxRooms: 3,
      maxPrice: 400000,
    });
  });

  it('requête EN : 200, understood=true, langue en', async () => {
    const res = await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({
        text: 'I am looking for an apartment for rent in Dakar',
        defaultLocale: 'fr',
      })
      .expect(200);

    expect(body(res).detectedLanguage).toBe('en');
    expect(body(res).understood).toBe(true);
  });

  it('requête mélangée FR/EN : 200, filtres des deux dictionnaires', async () => {
    const res = await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: '2 bedrooms a Dakar sous 300k', defaultLocale: 'fr' })
      .expect(200);

    expect(body(res).strictFilters.minBeds).toBe(2);
    expect(body(res).strictFilters.maxPrice).toBe(300000);
  });

  it('texte vide : 200, understood=false', async () => {
    const res = await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: '', defaultLocale: 'fr' })
      .expect(200);

    expect(body(res).understood).toBe(false);
    expect(body(res).strictFilters).toEqual({});
  });

  it("texte fait d'espaces seulement : 200, understood=false", async () => {
    const res = await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: '    ', defaultLocale: 'en' })
      .expect(200);

    expect(body(res).understood).toBe(false);
  });

  it('champ defaultLocale manquant : 400', async () => {
    await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: 'villa' })
      .expect(400);
  });

  it('champ text manquant : 400', async () => {
    await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ defaultLocale: 'fr' })
      .expect(400);
  });

  it('defaultLocale invalide (ni fr ni en) : 400', async () => {
    await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: 'villa', defaultLocale: 'xx' })
      .expect(400);
  });

  it('text de type incorrect (nombre) : 400', async () => {
    await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: 12345, defaultLocale: 'fr' })
      .expect(400);
  });

  it('texte de plus de 300 caractères : 400', async () => {
    await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: 'a'.repeat(301), defaultLocale: 'fr' })
      .expect(400);
  });

  it('texte de exactement 300 caractères : 200 (limite acceptée)', async () => {
    await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: 'a'.repeat(300), defaultLocale: 'fr' })
      .expect(200);
  });

  it('champ inconnu (whitelist) : 400', async () => {
    await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: 'villa', defaultLocale: 'fr', admin: true })
      .expect(400);
  });

  it('ambiguïté (deux transactions) : conflit dans ambiguities, transactionType absent', async () => {
    const res = await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: 'louer et acheter', defaultLocale: 'fr' })
      .expect(200);

    expect(body(res).strictFilters.transactionType).toBeUndefined();
    expect(body(res).ambiguities).toContain('transactionType');
  });

  it("n'inclut jamais d'annonce dans la réponse, seulement des filtres", async () => {
    const res = await request(app.getHttpServer())
      .post('/search/parse-query')
      .send({ text: 'F3 a louer a Dakar', defaultLocale: 'fr' })
      .expect(200);

    const raw = res.body as Record<string, unknown>;
    expect(raw.data).toBeUndefined();
    expect(raw.listings).toBeUndefined();
    expect(Object.keys(raw).sort()).toEqual(
      [
        'ambiguities',
        'detectedLanguage',
        'languageConfidence',
        'languageMethod',
        'softPreferences',
        'strictFilters',
        'understood',
        'unmatchedTokens',
      ].sort(),
    );
  });

  describe('limite de débit dédiée (30/min)', () => {
    it('refuse au-delà de 30 requêtes par minute sur cette route (429)', async () => {
      let sawTooManyRequests = false;
      for (let i = 0; i < 35; i++) {
        const res = await request(app.getHttpServer())
          .post('/search/parse-query')
          .send({ text: `requete ${i}`, defaultLocale: 'fr' });
        if (res.status === 429) {
          sawTooManyRequests = true;
          break;
        }
      }
      expect(sawTooManyRequests).toBe(true);
    });
  });
});
