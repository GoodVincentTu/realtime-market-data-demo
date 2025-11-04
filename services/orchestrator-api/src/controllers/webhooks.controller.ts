import type { Request, Response } from 'express';
import { WebhookTicksBody, WebhookSymbolsBody } from '../utils/validators.js';
import { ingestTicksSvc, upsertSymbolsWebhookSvc } from '../services/ingest.service.js';

export async function webhookTicksCtrl(req: Request, res: Response) {
  const parsed = WebhookTicksBody.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });

  const { source, items } = parsed.data;
  const result = await ingestTicksSvc(source, items);
  return res.status(202).json(result);
}

export async function webhookSymbolsCtrl(req: Request, res: Response) {
  const parsed = WebhookSymbolsBody.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });

  const { items } = parsed.data;
  const result = await upsertSymbolsWebhookSvc(items);
  return res.status(202).json(result);
}