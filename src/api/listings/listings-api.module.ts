// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ListingsModule } from '../../core/listings/listings.module.ts';
import { ListingRequestsController } from './controllers/listing-requests.controller.ts';
import { ListingsController } from './controllers/listings.controller.ts';
import { PlacesController } from './controllers/places.controller.ts';

@Module({
  imports: [ListingsModule],
  controllers: [ListingsController, ListingRequestsController, PlacesController],
})
export class ListingsApiModule {}
