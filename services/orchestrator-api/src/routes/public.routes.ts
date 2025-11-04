import { Router } from 'express';
import { listSymbolsCtrl } from '../controllers/symbols.controller.js';
// previous version
// import { latestTickCtrl, tickHistoryCtrl, aggMetricsCtrl } from '../controllers/ticks.controller.js';
import { latestTickCtrl, tickHistoryCtrlV2, aggMetricsCtrl } from '../controllers/ticks.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

export const pub = Router();
pub.get('/symbols', asyncHandler(listSymbolsCtrl));
pub.get('/ticks/:symbol', asyncHandler(latestTickCtrl));
// previous version
// pub.get('/ticks/:symbol/history', asyncHandler(tickHistoryCtrl));
pub.get('/ticks/:symbol/history', asyncHandler(tickHistoryCtrlV2));
pub.get('/metrics/:symbol', asyncHandler(aggMetricsCtrl));