// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { BackupsService } from '../../../core/admin/services/backups.service.ts';
import { Endpoint } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { BackupHistory } from '../schemas/backups.ts';

@Controller()
export class AdminBackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Endpoint({
    method: 'get',
    path: Routes.admin.backups,
    operationId: 'adminListBackups',
    summary: 'List the nightly database backups',
    description:
      'Tell whether the nightly database backups are up to date and list the last 30 nights. A failed night carries ' +
      'a reason code only; hosts, users and error messages stay in the server log.',
    tags: ['Admin'],
    access: 'admin',
    responses: {
      200: { description: 'The status and the last nights', schema: BackupHistory },
    },
  })
  async listBackups(): Promise<BackupHistory> {
    return this.backupsService.history();
  }
}
