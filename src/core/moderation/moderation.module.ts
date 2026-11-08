// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.ts';
import { IdentityModule } from '../identity/identity.module.ts';
import { ListingsModule } from '../listings/listings.module.ts';
import { ProfilesModule } from '../profiles/profiles.module.ts';
import { ModerationService } from './services/moderation.service.ts';
import { OrganizationReviewService } from './services/organization-review.service.ts';

@Module({
  imports: [IdentityModule, ProfilesModule, ListingsModule, CatalogModule],
  providers: [ModerationService, OrganizationReviewService],
  exports: [ModerationService, OrganizationReviewService],
})
export class ModerationModule {}
