// Written with the help of Claude
import { type DynamicModule, Module } from '@nestjs/common';
import { ImportScheduleModule } from '../core/import/import-schedule.module.ts';
import { ImportModule } from '../core/import/import.module.ts';
import { ImportInfraModule } from '../infra/import-infra.module.ts';

/** The import service (CMP-03): the import module of `core` with its own `infra`, without the API's modules. */
@Module({})
export class ImportAppModule {
  /** One run of every provider, then exit; no job queue. */
  static once(): DynamicModule {
    return { module: ImportAppModule, imports: [ImportInfraModule, ImportModule] };
  }

  /** The long-running process: runs each provider's `import.run` job on its schedule (HLD I3). */
  static worker(): DynamicModule {
    return { module: ImportAppModule, imports: [ImportInfraModule.withJobQueue(), ImportScheduleModule] };
  }
}
