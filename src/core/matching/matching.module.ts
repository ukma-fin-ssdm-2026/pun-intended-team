// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.ts';
import { ProfilesModule } from '../profiles/profiles.module.ts';
import { ApplicationsService } from './services/applications.service.ts';
import { MatchingService } from './services/matching.service.ts';

@Module({
  imports: [CatalogModule, ProfilesModule],
  providers: [MatchingService, ApplicationsService],
  exports: [MatchingService, ApplicationsService],
})
export class MatchingModule {}
