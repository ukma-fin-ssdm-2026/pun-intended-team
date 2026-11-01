// Written with the help of Claude
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { IdentityModule } from '../core/identity/identity.module.ts';
import { InfraModule } from '../infra/infra.module.ts';
import { AdminApiModule } from './admin/admin-api.module.ts';
import { CatalogApiModule } from './catalog/catalog-api.module.ts';
import { ApiExceptionFilter } from './common/api-exception.filter.ts';
import { AuthGuard } from './common/auth.ts';
import { authRateLimitPerMinute } from './common/config.ts';
import { IdentityApiModule } from './identity/identity-api.module.ts';
import { ListingsApiModule } from './listings/listings-api.module.ts';
import { ModerationApiModule } from './moderation/moderation-api.module.ts';
import { ProfilesApiModule } from './profiles/profiles-api.module.ts';
import { SystemApiModule } from './system/system-api.module.ts';

@Module({
  imports: [
    // Counted in this process's memory: a stand-in until the load balancer limits per IP (ADR-002).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: authRateLimitPerMinute }]),
    InfraModule,
    IdentityModule,
    SystemApiModule,
    IdentityApiModule,
    CatalogApiModule,
    ListingsApiModule,
    ProfilesApiModule,
    ModerationApiModule,
    AdminApiModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
