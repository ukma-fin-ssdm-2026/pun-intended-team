// Written with the help of Claude
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { InfraModule } from '../infra/infra.module.js';
import { CatalogApiModule } from './catalog/catalog-api.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { SystemApiModule } from './system/system-api.module.js';

@Module({
  imports: [InfraModule, SystemApiModule, CatalogApiModule],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
