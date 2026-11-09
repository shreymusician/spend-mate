import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/errors.js';
import { MoneyError } from '../utils/money.js';
import { isProd } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'validation', message: 'Please check the highlighted fields', details: err.flatten().fieldErrors },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof MoneyError) {
    res.status(400).json({ error: { code: 'money', message: err.message } });
    return;
  }
  if (err?.code === 11000) {
    res.status(409).json({ error: { code: 'duplicate', message: 'That already exists' } });
    return;
  }
  if (!isProd) console.error(err);
  else console.error('Unhandled error:', err?.message);
  res.status(500).json({ error: { code: 'internal', message: 'Something broke on our side. Try again?' } });
};
