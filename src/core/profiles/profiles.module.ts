// Written with the help of Claude
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.ts';
import { ImagesModule } from '../images/images.module.ts';
import { ProfilesService } from './services/profiles.service.ts';

@Module({
  imports: [IdentityModule, ImagesModule],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
