import { Module } from '@nestjs/common';
import { MiloController } from './milo.controller';
import { MiloService } from './milo.service';

@Module({
  controllers: [MiloController],
  providers: [MiloService],
})
export class MiloModule {}
