// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.ts';
import { IdentityModule } from '../identity/identity.module.ts';
import { MatchingModule } from '../matching/matching.module.ts';
import { ModerationModule } from '../moderation/moderation.module.ts';
import { StatsService } from './services/stats.service.ts';

@Module({
  imports: [IdentityModule, CatalogModule, MatchingModule, ModerationModule],
  providers: [StatsService],
  exports: [StatsService],
})
export class AdminModule {}
