import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/** Parses and replaces req.body / req.query with the validated value. */
export const validateBody =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) return next(r.error);
    req.body = r.data;
    next();
  };
