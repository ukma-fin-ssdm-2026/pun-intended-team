// Written with the help of Claude
import { Module } from '@nestjs/common';
import { MatchingService } from './services/matching.service.ts';

@Module({
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
