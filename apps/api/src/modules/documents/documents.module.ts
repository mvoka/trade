import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PortfolioService } from './portfolio.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, PortfolioService],
  exports: [DocumentsService, PortfolioService],
})
export class DocumentsModule {}
