// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { AccountsOverviewService } from '../../../core/admin/services/accounts-overview.service.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { AccountIdParams, AdminAccountDetails, AdminAccountsPage, ListAccountsQuery } from '../schemas/accounts.ts';

const ListAccountsRequest = { query: ListAccountsQuery } satisfies RequestSchemas;
const GetAccountRequest = { params: AccountIdParams } satisfies RequestSchemas;

@Controller()
export class AdminAccountsController {
  constructor(private readonly accountsOverviewService: AccountsOverviewService) {}

  @Endpoint({
    method: 'get',
    path: Routes.admin.accounts,
    operationId: 'adminListAccounts',
    summary: 'List accounts',
    description:
      'List accounts, newest first: users and administrators, with their profile and organization status. The ' +
      'phone number and the date of birth are never returned, only the age.',
    tags: ['Admin'],
    access: 'admin',
    request: ListAccountsRequest,
    responses: {
      200: { description: 'A page of accounts', schema: AdminAccountsPage },
    },
  })
  async listAccounts(@Input() { query }: RouteInput<typeof ListAccountsRequest>): Promise<AdminAccountsPage> {
    const { limit, offset, ...filter } = query;
    return this.accountsOverviewService.list(filter, { limit, offset });
  }

  @Endpoint({
    method: 'get',
    path: Routes.admin.accountById,
    operationId: 'adminGetAccount',
    summary: 'Get an account',
    description: 'Get one account with its profile, as other users see it, and its organization request.',
    tags: ['Admin'],
    access: 'admin',
    request: GetAccountRequest,
    responses: {
      200: { description: 'The account', schema: AdminAccountDetails },
      404: { description: 'No account with this id, or the caller is not an administrator', schema: ErrorResponse },
    },
  })
  async getAccount(@Input() { params }: RouteInput<typeof GetAccountRequest>): Promise<AdminAccountDetails> {
    return this.accountsOverviewService.get(params.id);
  }
}
