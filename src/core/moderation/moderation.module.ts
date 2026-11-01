// Written with the help of Claude
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.ts';
import { ProfilesModule } from '../profiles/profiles.module.ts';
import { ModerationService } from './services/moderation.service.ts';

@Module({
  imports: [IdentityModule, ProfilesModule],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
