// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.ts';
import { ImagesModule } from '../images/images.module.ts';
import { NotificationsModule } from '../notifications/notifications.module.ts';
import { ProfilesModule } from '../profiles/profiles.module.ts';
import { ListingRequestsService } from './services/listing-requests.service.ts';
import { ListingsService } from './services/listings.service.ts';
import { PlacesService } from './services/places.service.ts';

@Module({
  imports: [CatalogModule, ProfilesModule, ImagesModule, NotificationsModule],
  providers: [ListingsService, ListingRequestsService, PlacesService],
  exports: [ListingsService, ListingRequestsService, PlacesService],
})
export class ListingsModule {}
