// Written with the help of Claude
import { Router } from 'express';
import { eventsController } from './events.controller.js';
import { systemController } from './system.controller.js';

export const apiRouter = Router();

apiRouter.use(systemController);
apiRouter.use(eventsController);
