import { Router } from 'express';
import { liveness, readiness } from '../controllers/health.controller.js';
import { promMetrics } from '../controllers/metrics.controller.js';
export const ops = Router();
ops.get('/health/liveness', liveness);
ops.get('/health/readiness', readiness);
ops.get('/ops/metrics', promMetrics);