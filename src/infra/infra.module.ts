// Written with the help of Claude
import { Global, Module } from '@nestjs/common';
import { EventsRepository } from '../core/catalog/repositories/events.repository.js';
import { StubEventsRepository } from './stubs/events.repository.js';

@Global()
@Module({
  providers: [{ provide: EventsRepository, useClass: StubEventsRepository }],
  exports: [EventsRepository],
})
export class InfraModule {}
