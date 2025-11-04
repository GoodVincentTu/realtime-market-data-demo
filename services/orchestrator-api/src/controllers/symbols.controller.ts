import type { Request, Response } from 'express';
import { listSymbolsSvc } from '../services/symbols.service.js';

export async function listSymbolsCtrl(_req: Request, res: Response) {
  const rows = await listSymbolsSvc();
  res.json(rows);
}