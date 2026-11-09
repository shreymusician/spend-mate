import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/errors.js';

export interface AuthPayload {
  sub: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export const signAccessToken = (userId: string) =>
  jwt.sign({ sub: userId } satisfies AuthPayload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL_SEC });

export function verifyAccessToken(token: string): AuthPayload {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
    if (!p.sub) throw new Error('no sub');
    return p;
  } catch {
    throw unauthorized('Session expired');
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(unauthorized());
  try {
    req.userId = verifyAccessToken(h.slice(7)).sub;
    next();
  } catch (e) {
    next(e);
  }
};
