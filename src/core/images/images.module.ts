// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ImagesService } from './services/images.service.ts';

@Module({
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
