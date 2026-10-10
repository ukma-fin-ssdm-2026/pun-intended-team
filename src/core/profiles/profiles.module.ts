// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ProfilesService } from './services/profiles.service.ts';

@Module({
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
