// Written with the help of Claude
import { Module } from '@nestjs/common';
import { SystemController } from './controllers/system.controller.ts';

@Module({
  controllers: [SystemController],
})
export class SystemApiModule {}
