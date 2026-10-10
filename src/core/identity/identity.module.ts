// Written with the help of Claude
import { Module } from '@nestjs/common';
import { AccountsService } from './services/accounts.service.ts';
import { AuthService } from './services/auth.service.ts';

@Module({
  providers: [AuthService, AccountsService],
  exports: [AuthService, AccountsService],
})
export class IdentityModule {}
