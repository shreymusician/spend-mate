import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { MONTH_RE, currentMonth, istOffsetMs, lastMonths, monthRange, previousMonth } from '../../utils/dates.js';
import { asyncHandler } from '../../utils/errors.js';
import { Budget } from '../budgets/budgets.js';
import { Transaction } from '../transactions/transaction.model.js';

const TZ = 'Asia/Kolkata';
const istDay = (d: Date) => new Date(d.getTime() + istOffsetMs).toISOString().slice(0, 10);

interface Totals { incomePaise: number; expensePaise: number }

type Scope = Record<string, unknown>; // extra $match fields, e.g. { visibility: 'shared' }

async function totalsBetween(user: Types.ObjectId, scope: Scope, start?: Date, end?: Date): Promise<Totals> {
  const match: Record<string, unknown> = { user, deletedAt: null, ...scope };
  if (start && end) match.occurredAt = { $gte: start, $lt: end };
  const rows = await Transaction.aggregate<{ _id: string; total: number }>([
    { $match: match },
    { $group: { _id: '$type', total: { $sum: '$amountPaise' } } },
  ]);
  const get = (t: string) => rows.find((r) => r._id === t)?.total ?? 0;
  return { incomePaise: get('income'), expensePaise: get('expense') };
}

async function dailyExpenses(user: Types.ObjectId, scope: Scope, start: Date, end: Date) {
  const rows = await Transaction.aggregate<{ _id: string; total: number }>([
    { $match: { user, deletedAt: null, ...scope, type: 'expense', occurredAt: { $gte: start, $lt: end } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: TZ } }, total: { $sum: '$amountPaise' } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.total]));
}

/** `sharedOnly` = what a linked parent may see: shared entries only, and no budgets. */
export async function monthlySummary(userId: string, month: string, now = new Date(), opts: { sharedOnly?: boolean } = {}) {
  const user = new Types.ObjectId(userId);
  const scope: Scope = opts.sharedOnly ? { visibility: 'shared' } : {};
  const { start, end } = monthRange(month);
  const prev = monthRange(previousMonth(month));

  const [month_, prevTotals, allTime, byCat, daily, budgets] = await Promise.all([
    totalsBetween(user, scope, start, end),
    totalsBetween(user, scope, prev.start, prev.end),
    totalsBetween(user, scope),
    Transaction.aggregate<{ _id: string; total: number; count: number }>([
      { $match: { user, deletedAt: null, ...scope, type: 'expense', occurredAt: { $gte: start, $lt: end } } },
      { $group: { _id: '$category', total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    dailyExpenses(user, scope, start, end),
    opts.sharedOnly ? Promise.resolve([]) : Budget.find({ user, month }),
  ]);

  // Calendar for the month, zero-filled, so charts have no gaps.
  const days: { date: string; expensePaise: number }[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) {
    const date = istDay(new Date(t));
    days.push({ date, expensePaise: daily.get(date) ?? 0 });
  }

  // Last 7 IST days ending today (may cross months), queried directly.
  const todayStart = new Date(Date.parse(`${istDay(now)}T00:00:00.000Z`) - istOffsetMs);
  const weekStart = new Date(todayStart.getTime() - 6 * 86_400_000);
  const weekMap = await dailyExpenses(user, scope, weekStart, new Date(todayStart.getTime() + 86_400_000));
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = istDay(new Date(weekStart.getTime() + i * 86_400_000));
    return { date, expensePaise: weekMap.get(date) ?? 0 };
  });

  const spentByCat = new Map(byCat.map((c) => [c._id, c.total]));
  return {
    month,
    incomePaise: month_.incomePaise,
    expensePaise: month_.expensePaise,
    balancePaise: allTime.incomePaise - allTime.expensePaise, // all-time, not just this month
    totalIncomePaise: allTime.incomePaise,
    totalExpensePaise: allTime.expensePaise,
    previousMonth: { month: previousMonth(month), ...prevTotals },
    byCategory: byCat.map((c) => ({ category: c._id, totalPaise: c.total, count: c.count })),
    daily: days,
    last7Days,
    budgets: (budgets as Awaited<ReturnType<typeof Budget.find>>).map((b) => ({
      id: String(b._id),
      category: b.category,
      limitPaise: b.limitPaise,
      spentPaise: b.category ? spentByCat.get(b.category) ?? 0 : month_.expensePaise,
    })),
  };
}

export async function trend(userId: string, month: string, months: number, opts: { sharedOnly?: boolean } = {}) {
  const user = new Types.ObjectId(userId);
  const scope: Scope = opts.sharedOnly ? { visibility: 'shared' } : {};
  const list = lastMonths(month, months);
  const start = monthRange(list[0]!).start;
  const end = monthRange(month).end;
  const rows = await Transaction.aggregate<{ _id: { m: string; t: string }; total: number }>([
    { $match: { user, deletedAt: null, ...scope, occurredAt: { $gte: start, $lt: end } } },
    { $group: { _id: { m: { $dateToString: { format: '%Y-%m', date: '$occurredAt', timezone: TZ } }, t: '$type' }, total: { $sum: '$amountPaise' } } },
  ]);
  return list.map((m) => ({
    month: m,
    incomePaise: rows.find((r) => r._id.m === m && r._id.t === 'income')?.total ?? 0,
    expensePaise: rows.find((r) => r._id.m === m && r._id.t === 'expense')?.total ?? 0,
  }));
}

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

const monthQ = z.string().regex(MONTH_RE).default(() => currentMonth());

analyticsRouter.get('/summary', asyncHandler(async (req, res) => {
  res.json(await monthlySummary(req.userId!, monthQ.parse(req.query.month)));
}));

analyticsRouter.get('/trend', asyncHandler(async (req, res) => {
  const months = z.coerce.number().int().min(2).max(24).default(12).parse(req.query.months);
  res.json({ trend: await trend(req.userId!, monthQ.parse(req.query.month), months) });
}));
