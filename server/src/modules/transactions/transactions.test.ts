import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { currentMonth } from '../../utils/dates.js';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.MONGODB_URI = 'mongodb://placeholder';
process.env.PIN_PEPPER = 'test-pepper-test-pepper-test-pepper-123';

let mongod: MongoMemoryServer;
let app: import('express').Express;
let A: string; // Authorization headers
let B: string;

let nextMobile = 9000000000;
async function signup(_label: string) {
  const r = await request(app).post('/api/auth/register').send({ name: _label, gender: 'female', dob: '2000-01-01', mobile: String(nextMobile++), pin: '4821' });
  return `Bearer ${r.body.accessToken}`;
}
const post = (auth: string, body: object) => request(app).post('/api/transactions').set('Authorization', auth).send(body);
const month = currentMonth();
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import('../../app.js')).createApp();
  A = await signup('a@example.com');
  B = await signup('b@example.com');
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('transactions', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/api/transactions')).status).toBe(401);
  });

  it('creates an expense with a reason and an income', async () => {
    const e = await post(A, { type: 'expense', amountPaise: 25000, title: 'Lunch', reason: 'After the lab session', category: 'food', occurredAt: day(0) });
    expect(e.status).toBe(201);
    expect(e.body.transaction.reason).toBe('After the lab session');
    const i = await post(A, { type: 'income', amountPaise: 500000, title: 'Pocket money', source: 'parents', occurredAt: day(0) });
    expect(i.status).toBe(201);
    expect(i.body.transaction.source).toBe('parents');
  });

  it('rejects floats, zero, negatives and unknown categories', async () => {
    expect((await post(A, { type: 'expense', amountPaise: 10.5, title: 'x', category: 'food' })).status).toBe(400);
    expect((await post(A, { type: 'expense', amountPaise: 0, title: 'x', category: 'food' })).status).toBe(400);
    expect((await post(A, { type: 'expense', amountPaise: -5, title: 'x', category: 'food' })).status).toBe(400);
    expect((await post(A, { type: 'expense', amountPaise: 100, title: 'x', category: 'nope' })).status).toBe(400);
  });

  it('dedupes double-submitted clientId', async () => {
    const body = { type: 'expense', amountPaise: 9900, title: 'Chai', category: 'food', clientId: 'dup-1' };
    const [r1, r2] = await Promise.all([post(A, body), post(A, body)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 201]);
    expect(r1.body.transaction.id).toBe(r2.body.transaction.id);
    const list = await request(app).get('/api/transactions?q=Chai').set('Authorization', A);
    expect(list.body.transactions).toHaveLength(1);
  });

  it('hides, and refuses to modify, other users’ transactions', async () => {
    const t = await post(A, { type: 'expense', amountPaise: 1000, title: 'Secret snack', category: 'food' });
    const id = t.body.transaction.id;
    expect((await request(app).get(`/api/transactions/${id}`).set('Authorization', B)).status).toBe(404);
    expect((await request(app).patch(`/api/transactions/${id}`).set('Authorization', B).send({ title: 'hax' })).status).toBe(404);
    expect((await request(app).delete(`/api/transactions/${id}`).set('Authorization', B)).status).toBe(404);
    expect((await request(app).get(`/api/transactions/${id}/history`).set('Authorization', B)).status).toBe(404);
    expect((await request(app).get('/api/transactions?q=Secret').set('Authorization', B)).body.transactions).toHaveLength(0);
  });

  it('edits with audit history, then soft-deletes', async () => {
    const t = await post(A, { type: 'expense', amountPaise: 20000, title: 'Books', category: 'education' });
    const id = t.body.transaction.id;
    const u = await request(app).patch(`/api/transactions/${id}`).set('Authorization', A).send({ amountPaise: 22000, reason: 'Edition changed' });
    expect(u.body.transaction.amountPaise).toBe(22000);
    expect((await request(app).patch(`/api/transactions/${id}`).set('Authorization', A).send({ source: 'salary' })).status).toBe(400);
    expect((await request(app).delete(`/api/transactions/${id}`).set('Authorization', A)).status).toBe(204);
    expect((await request(app).get(`/api/transactions/${id}`).set('Authorization', A)).status).toBe(404);
    const h = await request(app).get(`/api/transactions/${id}/history`).set('Authorization', A);
    expect(h.body.history.map((x: { action: string }) => x.action)).toEqual(['delete', 'update', 'create']);
    expect(h.body.history[1].before.amountPaise).toBe(20000);
  });

  it('filters by type, category, amount and date, and paginates', async () => {
    const C = await signup('c@example.com');
    for (let i = 0; i < 5; i++) await post(C, { type: 'expense', amountPaise: 1000 * (i + 1), title: `Item ${i}`, category: i % 2 ? 'food' : 'travel', occurredAt: day(i) });
    const get = (qs: string) => request(app).get(`/api/transactions?${qs}`).set('Authorization', C);
    expect((await get('category=food')).body.transactions).toHaveLength(2);
    expect((await get('minPaise=3000&maxPaise=4000')).body.transactions).toHaveLength(2);
    expect((await get('type=income')).body.transactions).toHaveLength(0);
    expect((await get(`from=${encodeURIComponent(day(2.5))}`)).body.transactions).toHaveLength(3);

    const p1 = (await get('limit=2')).body;
    expect(p1.transactions.map((t: { title: string }) => t.title)).toEqual(['Item 0', 'Item 1']);
    const p2 = (await get(`limit=2&before=${encodeURIComponent(p1.next)}`)).body;
    expect(p2.transactions.map((t: { title: string }) => t.title)).toEqual(['Item 2', 'Item 3']);
    const p3 = (await get(`limit=2&before=${encodeURIComponent(p2.next)}`)).body;
    expect(p3.transactions).toHaveLength(1);
    expect(p3.next).toBeNull();
  });

  it('treats search input as text, not regex', async () => {
    const r = await request(app).get('/api/transactions?q=' + encodeURIComponent('(.*')).set('Authorization', A);
    expect(r.status).toBe(200);
  });
});

describe('categories', () => {
  it('lists defaults, adds custom, uses it, and reassigns to Other on delete', async () => {
    const D = await signup('d@example.com');
    const cat = await request(app).post('/api/categories').set('Authorization', D).send({ name: 'Chai Tapri' });
    expect(cat.status).toBe(201);
    expect((await request(app).get('/api/categories').set('Authorization', D)).body.categories.length).toBe(12);
    expect((await request(app).post('/api/categories').set('Authorization', D).send({ name: 'food' })).status).toBe(400);

    const t = await post(D, { type: 'expense', amountPaise: 1500, title: 'Cutting chai', category: cat.body.category.id });
    expect(t.status).toBe(201);
    // Another user cannot use my custom category.
    expect((await post(B, { type: 'expense', amountPaise: 1500, title: 'x', category: cat.body.category.id })).status).toBe(400);

    await request(app).delete(`/api/categories/${cat.body.category.id}`).set('Authorization', D);
    const after = await request(app).get(`/api/transactions/${t.body.transaction.id}`).set('Authorization', D);
    expect(after.body.transaction.category).toBe('other');
  });
});

describe('analytics + budgets', () => {
  it('computes balance, category totals, budgets and comparisons exactly', async () => {
    const E = await signup('e@example.com');
    await post(E, { type: 'income', amountPaise: 1000000, title: 'Salary', source: 'salary', occurredAt: day(0) });
    await post(E, { type: 'expense', amountPaise: 33333, title: 'Dinner', category: 'food', occurredAt: day(0) });
    await post(E, { type: 'expense', amountPaise: 66667, title: 'Cab', category: 'transport', occurredAt: day(0) });
    // Refund counts as income, and deleted rows are ignored.
    await post(E, { type: 'income', amountPaise: 5000, title: 'Refund', source: 'refund', occurredAt: day(0) });
    const gone = await post(E, { type: 'expense', amountPaise: 999999, title: 'Mistake', category: 'other', occurredAt: day(0) });
    await request(app).delete(`/api/transactions/${gone.body.transaction.id}`).set('Authorization', E);

    expect((await request(app).put('/api/budgets').set('Authorization', E).send({ month, category: null, limitPaise: 200000 })).status).toBe(200);
    // Upsert, not duplicate:
    await request(app).put('/api/budgets').set('Authorization', E).send({ month, category: null, limitPaise: 150000 });
    await request(app).put('/api/budgets').set('Authorization', E).send({ month, category: 'food', limitPaise: 20000 });

    const s = (await request(app).get(`/api/analytics/summary?month=${month}`).set('Authorization', E)).body;
    {
      expect(s.incomePaise).toBe(1005000);
      expect(s.expensePaise).toBe(100000);
      expect(s.byCategory).toEqual([
        { category: 'transport', totalPaise: 66667, count: 1 },
        { category: 'food', totalPaise: 33333, count: 1 },
      ]);
      expect(s.budgets).toHaveLength(2);
      expect(s.budgets.find((b: { category: string | null }) => b.category === null)).toMatchObject({ limitPaise: 150000, spentPaise: 100000 });
      expect(s.budgets.find((b: { category: string | null }) => b.category === 'food')).toMatchObject({ limitPaise: 20000, spentPaise: 33333 });
      expect(s.daily.reduce((a: number, d: { expensePaise: number }) => a + d.expensePaise, 0)).toBe(100000);
    }
    expect(s.balancePaise).toBe(1005000 - 100000);
    expect(s.last7Days).toHaveLength(7);
    expect(s.last7Days.reduce((a: number, d: { expensePaise: number }) => a + d.expensePaise, 0)).toBe(100000);

    const tr = (await request(app).get(`/api/analytics/trend?month=${month}&months=6`).set('Authorization', E)).body.trend;
    expect(tr).toHaveLength(6);
    expect(tr.at(-1).month).toBe(month);
  });

  it('keeps analytics private per user', async () => {
    const F = await signup('f@example.com');
    const s = (await request(app).get(`/api/analytics/summary?month=${month}`).set('Authorization', F)).body;
    expect(s.balancePaise).toBe(0);
    expect(s.byCategory).toEqual([]);
  });

  it('rejects bad months', async () => {
    expect((await request(app).get('/api/analytics/summary?month=2026-13').set('Authorization', A)).status).toBe(400);
  });
});
