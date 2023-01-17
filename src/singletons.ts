import { Logger } from 'tslog';

import MessageService from './services/message.service';
import CommandService from './services/command.service';
import apiAdaptersGenerator from './adapters/all.adapter';
import CommandController from './controllers/command.controller';
import { HelperService } from './services/helper.service';
import { ActionService } from './services/action.service';
import { ActionController } from './controllers/action.controller';

// create singletons
// apiAdaptersGenerator creates array of adapters
const apiAdapters = apiAdaptersGenerator();
const logger = new Logger();
const messageService = new MessageService();
const helperService = new HelperService();

// services
const actionService = new ActionService(messageService, logger, helperService);

const commandService = new CommandService(
  messageService,
  logger,
  apiAdapters,
  helperService,
);

// controllers
export const commandController = new CommandController(commandService);
export const actionController = new ActionController(actionService);
