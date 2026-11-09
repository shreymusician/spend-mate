import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env, isProd } from '../../config/env.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler, forbidden } from '../../utils/errors.js';
import * as auth from './auth.service.js';
import { loginSchema, registerSchema, resetPinSchema } from './auth.validators.js';

const COOKIE = 'pv_refresh';
const CSRF_HEADER = 'x-requested-with';
const CSRF_VALUE = 'SpendMate';

const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts. Take a breath and try again soon.' } },
});

const cookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict' as const,
  path: '/api/auth',
};

// "Remember me" on: a long-lived cookie. Off: a session cookie that goes away when the browser closes.
function sendSession(res: Response, s: Awaited<ReturnType<typeof auth.login>>, status = 200) {
  res.cookie(COOKIE, s.refreshToken, s.remember ? { ...cookieOpts, maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 } : cookieOpts);
  res.status(status).json({ accessToken: s.accessToken, user: s.user, device: s.device });
}

export const authRouter = Router();
authRouter.use(limiter);

authRouter.post('/register', validateBody(registerSchema), asyncHandler(async (req, res) => {
  sendSession(res, await auth.register(req.body, req.get('user-agent')), 201);
}));

authRouter.post('/login', validateBody(loginSchema), asyncHandler(async (req, res) => {
  sendSession(res, await auth.login(req.body, req.get('user-agent')));
}));

authRouter.post('/reset-pin', validateBody(resetPinSchema), asyncHandler(async (req, res) => {
  await auth.resetPin(req.body);
  res.status(204).end();
}));

// CSRF defence for cookie-authenticated endpoints: SameSite=Strict plus a custom header
// that cross-site forms cannot set.
const csrf = asyncHandler(async (req, _res, next) => {
  if (req.get(CSRF_HEADER) !== CSRF_VALUE) throw forbidden('Missing CSRF header');
  next();
});

authRouter.post('/refresh', csrf, asyncHandler(async (req, res) => {
  sendSession(res, await auth.refresh(req.cookies?.[COOKIE], req.get('user-agent')));
}));

authRouter.post('/logout', csrf, asyncHandler(async (req, res) => {
  await auth.logout(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, cookieOpts);
  res.status(204).end();
}));
