import type { Request, Response } from 'express';
import { latestTickSvc, tickHistorySvc, tickHistorySvcV2, aggMetricsSvc } from '../services/ticks.service.js';

export async function latestTickCtrl(req: Request, res: Response) {
  const row = await latestTickSvc(req.params.symbol);
  res.json(row);
}

// previous version
export async function tickHistoryCtrl(req: Request, res: Response) {
  // supports ?before= and legacy ?cursor=
  const payload = await tickHistorySvc(req.params.symbol, req.query as Record<string, unknown>);
  res.json(payload); // { items, nextCursor }
}

// current version
export async function tickHistoryCtrlV2(req: Request, res: Response) {
  const payload = await tickHistorySvcV2(req.params.symbol, req.query as Record<string, unknown>);
  res.json(payload);
}

export async function aggMetricsCtrl(req: Request, res: Response) {
  const row = await aggMetricsSvc(req.params.symbol);
  res.json(row);
}