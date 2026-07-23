import { Module } from '@nestjs/common';
import { AgencesService } from './agences.service';
import { AgencesController } from './agences.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AgencesController],
  providers: [AgencesService],
  exports: [AgencesService],
})
export class AgencesModule {}
