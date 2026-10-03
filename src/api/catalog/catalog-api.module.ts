// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../../core/catalog/catalog.module.js';
import { EventsController } from './controllers/events.controller.js';

@Module({
  imports: [CatalogModule],
  controllers: [EventsController],
})
export class CatalogApiModule {}
