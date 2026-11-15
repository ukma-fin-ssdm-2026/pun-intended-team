// Written with the help of Claude
import { Module } from '@nestjs/common';
import { MatchingModule } from '../../core/matching/matching.module.ts';
import { ApplicationsController } from './controllers/applications.controller.ts';
import { MatchesController } from './controllers/matches.controller.ts';

@Module({
  imports: [MatchingModule],
  controllers: [ApplicationsController, MatchesController],
})
export class MatchingApiModule {}
