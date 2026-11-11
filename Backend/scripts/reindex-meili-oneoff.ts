/**
 * Script ponctuel (lot meublé/durée) : relance reindexAll() directement via
 * le contexte Nest, sans passer par l'endpoint POST /search/reindex (réservé
 * ADMIN, JWT non disponible en ligne de commande) — même principe que les
 * autres scripts d'opération directe de ce dossier.
 *
 * Usage : npx ts-node -r tsconfig-paths/register scripts/reindex-meili-oneoff.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SearchService } from '../src/search/search.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const searchService = app.get(SearchService);
  const result = await searchService.reindexAll();
  console.log(`Réindexation Meilisearch : ${result.indexed} annonces indexées.`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
