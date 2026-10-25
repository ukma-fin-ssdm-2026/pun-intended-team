// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ImportModule } from '../core/import/import.module.ts';
import { ImportInfraModule } from '../infra/import-infra.module.ts';
import { InfraModule } from '../infra/infra.module.ts';

/** The import service (CMP-03): the import module of `core` with its `infra`, without the HTTP layer. */
@Module({ imports: [InfraModule, ImportInfraModule, ImportModule] })
export class ImportAppModule {}
