// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ImagesModule } from '../../core/images/images.module.ts';
import { ImagesController } from './controllers/images.controller.ts';

@Module({
  imports: [ImagesModule],
  controllers: [ImagesController],
})
export class ImagesApiModule {}
