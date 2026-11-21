import { Module } from '@nestjs/common';
import { MiloController } from './milo.controller';
import { MiloService } from './milo.service';
import { WriterController } from './writer/writer.controller';
import { WriterService } from './writer/writer.service';

@Module({
  controllers: [MiloController, WriterController],
  providers: [MiloService, WriterService],
})
export class MiloModule {}
