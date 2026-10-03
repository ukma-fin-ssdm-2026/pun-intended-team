// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../../core/catalog/catalog.module.js';
import { AdminCategoriesController } from './controllers/admin-categories.controller.js';
import { CategoriesController } from './controllers/categories.controller.js';
import { EventsController } from './controllers/events.controller.js';

@Module({
  imports: [CatalogModule],
  controllers: [EventsController, CategoriesController, AdminCategoriesController],
})
export class CatalogApiModule {}
