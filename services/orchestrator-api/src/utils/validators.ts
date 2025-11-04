import { z } from 'zod';

export const TickItem = z.object({
  idempotencyKey: z.string().min(1).optional(),
  symbol: z.string().min(1),
  price: z.number().positive(),
  ts: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  volume: z.number().nonnegative().optional(),
  source: z.string().optional()
});

export const WebhookTicksBody = z.object({
  source: z.string().min(1),
  items: z.array(TickItem).min(1)
});

export const WebhookSymbolsBody = z.object({
  items: z.array(z.object({
    symbol: z.string().min(1),
    base: z.string().min(1),
    quote: z.string().min(1),
    active: z.boolean().default(true)
  })).min(1)
});