// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ProfilesModule } from '../../core/profiles/profiles.module.ts';
import { ProfilesController } from './controllers/profiles.controller.ts';

@Module({
  imports: [ProfilesModule],
  controllers: [ProfilesController],
})
export class ProfilesApiModule {}
