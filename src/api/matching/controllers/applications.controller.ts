// Written with the help of Claude
import { Controller } from '@nestjs/common';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { ApplicationsService } from '../../../core/matching/services/applications.service.ts';
import { EventIdParams } from '../../catalog/schemas/events.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { Application, ApplicationIdParams, ApplicationList, CreateApplicationBody } from '../schemas/applications.ts';

const ApplyRequest = { params: EventIdParams, body: CreateApplicationBody } satisfies RequestSchemas;
const GetApplicationRequest = { params: ApplicationIdParams } satisfies RequestSchemas;
const WithdrawRequest = { params: ApplicationIdParams } satisfies RequestSchemas;
const DismissRequest = { params: ApplicationIdParams } satisfies RequestSchemas;

@Controller()
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Endpoint({
    method: 'post',
    path: Routes.events.applications,
    operationId: 'applyToEvent',
    summary: 'Ask for a match at an event',
    description:
      'Join the matching pool of the event with the answers to the matching questions. A single-day event has one ' +
      'session; for an event that runs on several days, `dates` lists the days the user can go, and a match lists ' +
      'the days both users share. The answer says when the next matching round runs, or that a match is ' +
      'proposed at once.',
    tags: ['Matching'],
    access: 'user',
    request: ApplyRequest,
    responses: {
      201: { description: 'The application, waiting in the pool', schema: Application },
      404: { description: 'No event with this id', schema: ErrorResponse },
      409: {
        description: '`ALREADY_APPLIED`: the caller is already in the pool of this event.',
        schema: ErrorResponse,
      },
      422: {
        description:
          '`PROFILE_INCOMPLETE`: the profile lacks a communication format, an interest or a linked account; ' +
          'the app sends the user to complete it. `EVENT_CANCELLED`: the event is cancelled. ' +
          '`APPLICATIONS_CLOSED`: the cutoff of a picked day has passed: an hour before it starts, or for a ' +
          'session of 3 hours or more, 2 hours before it ends. `INVALID_SESSION_DAY`: the event does not run on ' +
          'one of `dates`, one of them is after the catalog window (today and the next 28 days), or the event ' +
          'runs on several days and `dates` is missing.',
        schema: ErrorResponse,
      },
    },
    location: Routes.applications.byId,
  })
  async applyToEvent(
    @Input() { params, body }: RouteInput<typeof ApplyRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Application> {
    return this.applicationsService.apply(account.accountId, { ...body, eventId: params.id });
  }

  @Endpoint({
    method: 'get',
    path: Routes.applications.mine,
    operationId: 'listMyApplications',
    summary: 'List your applications',
    description:
      'The caller’s active applications (in the pool, paired or paused), and those that found no match until the ' +
      'caller dismisses them; soonest first day first.',
    tags: ['Matching'],
    access: 'user',
    responses: {
      200: { description: 'The active applications and those with no match', schema: ApplicationList },
    },
  })
  async listMyApplications(@CurrentAccount() account: AccountCaller): Promise<Application[]> {
    return this.applicationsService.listMine(account.accountId);
  }

  @Endpoint({
    method: 'get',
    path: Routes.applications.byId,
    operationId: 'getApplication',
    summary: 'Get one of your applications',
    description: 'Get one of the caller’s applications, whatever its status.',
    tags: ['Matching'],
    access: 'user',
    request: GetApplicationRequest,
    responses: {
      200: { description: 'The application', schema: Application },
      404: { description: 'No application with this id, or it is not the caller’s own', schema: ErrorResponse },
    },
  })
  async getApplication(
    @Input() { params }: RouteInput<typeof GetApplicationRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Application> {
    return this.applicationsService.getOwn(account.accountId, params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.applications.withdraw,
    operationId: 'withdrawApplication',
    summary: 'Leave the matching pool',
    description:
      'Withdraw one of the caller’s applications; withdrawing it again changes nothing. A proposal still waiting ' +
      'for an answer is cancelled, and the other user returns to the pool. The caller can apply to the same event ' +
      'again later.',
    tags: ['Matching'],
    access: 'user',
    request: WithdrawRequest,
    responses: {
      200: { description: 'The withdrawn application', schema: Application },
      404: { description: 'No application with this id, or it is not the caller’s own', schema: ErrorResponse },
      409: {
        description:
          '`CONFLICT`: the application has a mutual match, or is no longer waiting in the pool or for an answer.',
        schema: ErrorResponse,
      },
    },
  })
  async withdrawApplication(
    @Input() { params }: RouteInput<typeof WithdrawRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Application> {
    return this.applicationsService.withdraw(account.accountId, params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.applications.dismiss,
    operationId: 'dismissApplication',
    summary: 'Dismiss an application with no match',
    description:
      'Take one of the caller’s applications that found no match by its cutoff out of `listMyApplications`. ' +
      'Dismissing it again changes nothing; `getApplication` still returns it.',
    tags: ['Matching'],
    access: 'user',
    request: DismissRequest,
    responses: {
      200: { description: 'The dismissed application', schema: Application },
      404: { description: 'No application with this id, or it is not the caller’s own', schema: ErrorResponse },
      409: { description: '`CONFLICT`: the application has another status than `no_match`.', schema: ErrorResponse },
    },
  })
  async dismissApplication(
    @Input() { params }: RouteInput<typeof DismissRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Application> {
    return this.applicationsService.dismiss(account.accountId, params.id);
  }
}
