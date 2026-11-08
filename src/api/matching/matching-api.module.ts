// Written with the help of Claude
import { Module } from '@nestjs/common';
import { MatchingModule } from '../../core/matching/matching.module.ts';
import { ApplicationsController } from './controllers/applications.controller.ts';

@Module({
  imports: [MatchingModule],
  controllers: [ApplicationsController],
})
export class MatchingApiModule {}
