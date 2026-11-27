// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.ts';
import { ImagesModule } from '../images/images.module.ts';
import { ProfilesModule } from '../profiles/profiles.module.ts';
import { ListingsService } from './services/listings.service.ts';
import { PlacesService } from './services/places.service.ts';

@Module({
  imports: [CatalogModule, ProfilesModule, ImagesModule],
  providers: [ListingsService, PlacesService],
  exports: [ListingsService, PlacesService],
})
export class ListingsModule {}
