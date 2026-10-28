// Written with the help of Claude
import { Module } from '@nestjs/common';
import { IdentityModule } from '../../core/identity/identity.module.ts';
import { AuthController } from './controllers/auth.controller.ts';

@Module({
  imports: [IdentityModule],
  controllers: [AuthController],
})
export class IdentityApiModule {}
