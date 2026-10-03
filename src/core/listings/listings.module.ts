// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { ListingsService } from './services/listings.service.js';

@Module({
  imports: [CatalogModule, ProfilesModule],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
