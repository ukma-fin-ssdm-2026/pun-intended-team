// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ImportModule } from '../core/import/import.module.ts';
import { ImportInfraModule } from '../infra/import-infra.module.ts';

/** The import service (CMP-03): the import module of `core` with its own `infra`, without the API's modules. */
@Module({ imports: [ImportInfraModule, ImportModule] })
export class ImportAppModule {}
