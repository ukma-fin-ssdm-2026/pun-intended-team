// Written with the help of Claude
import { Module } from '@nestjs/common';
import { SystemModule } from '../../core/system/system.module.ts';
import { SystemController } from './controllers/system.controller.ts';

@Module({
  imports: [SystemModule],
  controllers: [SystemController],
})
export class SystemApiModule {}
