// Written with the help of Claude
import { Controller } from '@nestjs/common';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { MatchesService } from '../../../core/matching/services/matches.service.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { Match, MatchContacts, MatchIdParams, MatchList } from '../schemas/matches.ts';

const MatchRequest = { params: MatchIdParams } satisfies RequestSchemas;

const notTheCallers = {
  description: 'No match with this id, or the caller is not one of its two users',
  schema: ErrorResponse,
};

const noLongerOpen = {
  description: '`CONFLICT`: the proposal is no longer waiting for answers: declined, expired, cancelled or mutual.',
  schema: ErrorResponse,
};

@Controller()
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Endpoint({
    method: 'get',
    path: Routes.matches.mine,
    operationId: 'listMyMatches',
    summary: 'List your matches',
    description:
      'The caller’s proposals still waiting for answers and their mutual matches, soonest shared day first. ' +
      'A proposal past its `validUntil` shows as `expired`.',
    tags: ['Matching'],
    access: 'user',
    responses: {
      200: { description: 'The pending and mutual matches', schema: MatchList },
    },
  })
  async listMyMatches(@CurrentAccount() account: AccountCaller): Promise<Match[]> {
    return this.matchesService.listMine(account.accountId);
  }

  @Endpoint({
    method: 'get',
    path: Routes.matches.byId,
    operationId: 'getMatch',
    summary: 'Get one of your matches',
    description: 'One of the caller’s matches, whatever its status, with the other user’s profile but no contacts.',
    tags: ['Matching'],
    access: 'user',
    request: MatchRequest,
    responses: {
      200: { description: 'The match', schema: Match },
      404: notTheCallers,
    },
  })
  async getMatch(
    @Input() { params }: RouteInput<typeof MatchRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Match> {
    return this.matchesService.getOwn(account.accountId, params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.matches.accept,
    operationId: 'acceptMatch',
    summary: 'Accept a proposed match',
    description:
      'Accept the proposal. Once the other user accepts too, the match is `mutual` and both see the contacts. ' +
      'Accepting again changes nothing.',
    tags: ['Matching'],
    access: 'user',
    request: MatchRequest,
    responses: {
      200: { description: 'The match, `accepted` or `mutual`', schema: Match },
      404: notTheCallers,
      409: noLongerOpen,
    },
  })
  async acceptMatch(
    @Input() { params }: RouteInput<typeof MatchRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Match> {
    return this.matchesService.accept(account.accountId, params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.matches.decline,
    operationId: 'declineMatch',
    summary: 'Decline a proposed match',
    description:
      'Decline the proposal, even after accepting it. Both users return to the pool and are never proposed to ' +
      'each other again at this event. Declining again changes nothing; a mutual match can no longer be declined.',
    tags: ['Matching'],
    access: 'user',
    request: MatchRequest,
    responses: {
      200: { description: 'The declined match', schema: Match },
      404: notTheCallers,
      409: noLongerOpen,
    },
  })
  async declineMatch(
    @Input() { params }: RouteInput<typeof MatchRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Match> {
    return this.matchesService.decline(account.accountId, params.id);
  }

  @Endpoint({
    method: 'get',
    path: Routes.matches.contacts,
    operationId: 'getMatchContacts',
    summary: 'Get the contacts of a mutual match',
    description:
      'How to reach the other user, once both accepted. Before that, and for a match that did not go ahead, the ' +
      'answer is `404`, as for a match that does not exist (SEC-001).',
    tags: ['Matching'],
    access: 'user',
    request: MatchRequest,
    responses: {
      200: { description: 'The other user’s contacts', schema: MatchContacts },
      404: { description: 'No mutual match with this id that the caller is part of', schema: ErrorResponse },
    },
  })
  async getMatchContacts(
    @Input() { params }: RouteInput<typeof MatchRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<MatchContacts> {
    return this.matchesService.getContacts(account.accountId, params.id);
  }
}
