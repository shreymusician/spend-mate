import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.js';
import { budgetsRouter } from './modules/budgets/budgets.js';
import { familyRouter } from './modules/family/family.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { transactionsRouter } from './modules/transactions/transactions.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  if (env.NODE_ENV !== 'test') app.use(morgan('tiny'));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/budgets', budgetsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/family', familyRouter);

  // In production one server delivers both the API and the app, so they share one address. That is what lets the
  // strict same-site sign-in cookie and the live connection work with no cross-site settings.
  const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
  if (isProd && existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h', setHeaders: (res, p) => { if (p.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
    // Any other page address (like /history) is a screen inside the app: send the app and let it route.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(`${dist}/index.html`);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
