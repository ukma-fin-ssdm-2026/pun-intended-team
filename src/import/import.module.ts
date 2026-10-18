// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../core/catalog/catalog.module.ts';
import { InfraModule } from '../infra/infra.module.ts';

/** The import service (CMP-03): `core` and `infra` without the HTTP layer. */
@Module({ imports: [InfraModule, CatalogModule] })
export class ImportModule {}
