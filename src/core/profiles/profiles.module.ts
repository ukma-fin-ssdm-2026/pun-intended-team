// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ProfilesService } from './services/profiles.service.js';

@Module({
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
