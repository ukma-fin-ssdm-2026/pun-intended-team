// Written with the help of Claude
import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service.ts';

@Module({
  providers: [AuthService],
  exports: [AuthService],
})
export class IdentityModule {}
