// Written with the help of Claude
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { IdentityModule } from '../core/identity/identity.module.js';
import { InfraModule } from '../infra/infra.module.js';
import { CatalogApiModule } from './catalog/catalog-api.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { AuthGuard } from './common/auth.js';
import { SystemApiModule } from './system/system-api.module.js';

@Module({
  imports: [InfraModule, IdentityModule, SystemApiModule, CatalogApiModule],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
