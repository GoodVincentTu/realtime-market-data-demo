import { Router } from 'express';
import { webhookTicksCtrl, webhookSymbolsCtrl } from '../controllers/webhooks.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

export const webhooks = Router();
webhooks.post('/webhooks/ticks', asyncHandler(webhookTicksCtrl));
webhooks.post('/webhooks/symbols', asyncHandler(webhookSymbolsCtrl));