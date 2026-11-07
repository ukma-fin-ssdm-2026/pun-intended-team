// Written with the help of Claude
import { Module } from '@nestjs/common';
import { HealthService } from './services/health.service.ts';

@Module({
  providers: [HealthService],
  exports: [HealthService],
})
export class SystemModule {}
