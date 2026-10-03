// Written with the help of Claude
import { Global, Module } from '@nestjs/common';
import { EventsRepository } from '../core/catalog/repositories/events.repository.js';
import { SessionsRepository } from '../core/identity/repositories/sessions.repository.js';
import { StubEventsRepository } from './stubs/events.repository.js';
import { StubSessionsRepository } from './stubs/sessions.repository.js';

const repositories = [
  { provide: EventsRepository, useClass: StubEventsRepository },
  { provide: SessionsRepository, useClass: StubSessionsRepository },
];

@Global()
@Module({
  providers: repositories,
  exports: repositories.map(({ provide }) => provide),
})
export class InfraModule {}
