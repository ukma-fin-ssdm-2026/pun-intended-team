// Written with the help of Claude
import { Module } from '@nestjs/common';
import { EventsService } from './services/events.service.js';

@Module({
  providers: [EventsService],
  exports: [EventsService],
})
export class CatalogModule {}
