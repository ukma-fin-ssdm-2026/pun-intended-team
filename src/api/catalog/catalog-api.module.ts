// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../../core/catalog/catalog.module.ts';
import { AdminCategoriesController } from './controllers/admin-categories.controller.ts';
import { CategoriesController } from './controllers/categories.controller.ts';
import { EventsController } from './controllers/events.controller.ts';

@Module({
  imports: [CatalogModule],
  controllers: [EventsController, CategoriesController, AdminCategoriesController],
})
export class CatalogApiModule {}
