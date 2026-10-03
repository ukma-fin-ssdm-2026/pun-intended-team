// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ListingsModule } from '../../core/listings/listings.module.js';
import { ListingsController } from './controllers/listings.controller.js';

@Module({
  imports: [ListingsModule],
  controllers: [ListingsController],
})
export class ListingsApiModule {}
