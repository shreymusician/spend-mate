import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { currentMonth } from '../../utils/dates.js';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.PIN_PEPPER = 'test-pepper-test-pepper-test-pepper-123';
process.env.MONGODB_URI = 'mongodb://placeholder';

let mongod: MongoMemoryServer;
let app: import('express').Express;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import('../../app.js')).createApp();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

let mobile = 9300000000;
interface P { auth: string; id: string; name: string; mobile: string }
const person = async (name: string, gender = 'female'): Promise<P> => {
  const m = String(mobile++);
  const r = await request(app).post('/api/auth/register').send({ name, gender, dob: '2001-02-03', mobile: m, pin: '4821' });
  return { auth: `Bearer ${r.body.accessToken}`, id: r.body.user.id, name, mobile: m };
};
const add = (p: P, body: object) => request(app).post('/api/transactions').set('Authorization', p.auth).send({ type: 'expense', category: 'food', amountPaise: 1000, title: 't', ...body });
const exportJson = (p: P) => request(app).get('/api/users/me/export').set('Authorization', p.auth);
const exportCsv = (p: P) => request(app).get('/api/users/me/export?format=csv').set('Authorization', p.auth);
const clear = (p: P, pin: string) => request(app).post('/api/users/me/clear-data').set('Authorization', p.auth).send({ pin });
const count = async (p: P) => (await request(app).get('/api/transactions?limit=100').set('Authorization', p.auth)).body.transactions.length as number;

/** A person with a bit of everything: entries, a budget, a custom category, a parent who commented. */
async function richPerson(name: string) {
  const me = await person(name); const parent = await person(`${name}-parent`, 'male');
  const inv = await request(app).post('/api/family/invites').set('Authorization', me.auth).send({});
  await request(app).post('/api/family/invites/accept').set('Authorization', parent.auth).send({ code: inv.body.code, relation: 'child' });
  await request(app).post('/api/categories').set('Authorization', me.auth).send({ name: 'Pets' });
  const cats = (await request(app).get('/api/categories').set('Authorization', me.auth)).body.categories as { id: string; name: string }[];
  const pets = cats.find((c) => c.name === 'Pets')!.id;
  const lunch = await add(me, { title: 'Lunch', amountPaise: 38050, reason: 'With friends', merchant: 'Cafe', tags: ['college'], visibility: 'shared', occurredAt: '2026-11-09T07:30:00.000Z' });
  await add(me, { title: 'Dog food', amountPaise: 12000, category: pets });
  await request(app).post('/api/transactions').set('Authorization', me.auth).send({ type: 'income', source: 'pocket_money', amountPaise: 500000, title: 'Pocket money' });
  const gone = await add(me, { title: 'Deleted one' });
  await request(app).delete(`/api/transactions/${gone.body.transaction.id}`).set('Authorization', me.auth);
  await request(app).put('/api/budgets').set('Authorization', me.auth).send({ month: currentMonth(), category: null, limitPaise: 600000 });
  await request(app).post(`/api/family/transactions/${lunch.body.transaction.id}/comments`).set('Authorization', parent.auth).send({ body: 'Good choice' });
  return { me, parent };
}

describe('download my data', () => {
  it('needs you to be signed in', async () => {
    expect((await request(app).get('/api/users/me/export')).status).toBe(401);
    expect((await request(app).get('/api/users/me/export?format=csv')).status).toBe(401);
  });

  it('gives a full copy: entries, budgets, categories, settings, connections and comments', async () => {
    const { me } = await richPerson('Asha');
    const r = await exportJson(me);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/application\/json/);
    expect(r.headers['content-disposition']).toMatch(/^attachment; filename="spendmate-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(r.headers['cache-control']).toBe('no-store');
    const d = JSON.parse(r.text);
    expect(d.app).toBe('SpendMate');
    expect(d.profile).toMatchObject({ name: 'Asha', mobile: me.mobile, gender: 'female', dateOfBirth: '2001-02-03' });
    // entries are readable, in rupees, with names rather than ids; deleted ones are left out
    expect(d.entries.map((e: { title: string }) => e.title).sort()).toEqual(['Dog food', 'Lunch', 'Pocket money']);
    const lunch = d.entries.find((e: { title: string }) => e.title === 'Lunch');
    expect(lunch).toMatchObject({ type: 'spent', amountRupees: 380.5, amountPaise: 38050, category: 'Food', paidBy: 'UPI', shopOrPerson: 'Cafe', reason: 'With friends', tags: ['college'], sharedWithFamily: true, dateIst: '2026-11-09 13:00' });
    expect(d.entries.find((e: { title: string }) => e.title === 'Dog food').category).toBe('Pets');
    expect(d.entries.find((e: { title: string }) => e.title === 'Pocket money')).toMatchObject({ type: 'received', source: 'Pocket money', category: null });
    expect(d.customCategories).toMatchObject([{ name: 'Pets' }]);
    expect(d.budgets).toMatchObject([{ month: currentMonth(), category: 'Whole month', limitRupees: 6000 }]);
    expect(d.family.canSeeMyEntries).toEqual([{ name: 'Asha-parent', relation: 'Father' }]);
    expect(d.commentsFromFamily).toMatchObject([{ from: 'Asha-parent', onEntry: 'Lunch', comment: 'Good choice' }]);
  });

  it('never includes the Secret Pin, login tokens, or anyone else’s data', async () => {
    const { me } = await richPerson('Ben');
    const stranger = await person('Stranger');
    await add(stranger, { title: 'Stranger secret' });
    const text = (await exportJson(me)).text + (await exportCsv(me)).text;
    expect(text).not.toMatch(/pinHash|bcrypt|\$2[aby]\$|4821|refresh|token|passwordHash/i);
    expect(text).not.toContain('Stranger secret');
    expect(text).not.toContain(stranger.id);
  });

  it('an empty account still downloads, with empty lists', async () => {
    const empty = await person('Empty');
    const d = JSON.parse((await exportJson(empty)).text);
    expect(d.entries).toEqual([]);
    expect(d.budgets).toEqual([]);
    expect(d.customCategories).toEqual([]);
    const csv = (await exportCsv(empty)).text;
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(1); // just the header row
  });

  it('gives a spreadsheet that opens correctly', async () => {
    const { me } = await richPerson('Cara');
    const r = await exportCsv(me);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/csv; charset=utf-8/);
    expect(r.headers['content-disposition']).toMatch(/^attachment; filename="spendmate-entries-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(r.text.charCodeAt(0)).toBe(0xfeff); // byte-order mark, so Excel reads ₹ properly
    const lines = r.text.slice(1).split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Date (IST),Type,Title,Category or source,Amount (₹),Paid by,Shop or person,Reason,Tags,Shared with family');
    expect(lines).toHaveLength(4); // header + 3 entries (the deleted one is not there)
    expect(lines).toContain('2026-11-09 13:00,Spent,Lunch,Food,380.50,UPI,Cafe,With friends,college,Yes');
    expect(lines.some((l) => l.includes('Received,Pocket money,Pocket money,5000.00'))).toBe(true);
  });

  it('keeps awkward text in one cell, and never lets a cell run as a formula', async () => {
    const me = await person('Dee');
    await add(me, { title: 'Tea, snacks', reason: 'He said "hello"\nthen left', merchant: '=HYPERLINK("http://evil")' });
    await add(me, { title: '+1 gift', reason: '@cmd', merchant: '-2+3' });
    const csv = (await exportCsv(me)).text;
    // quoted, with the inner quotes doubled and the line break kept inside the cell
    expect(csv).toContain('"Tea, snacks"');
    expect(csv).toContain('"He said ""hello""\nthen left"');
    // anything starting with = + - @ gets a leading apostrophe so spreadsheets show it as plain text
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain("'+1 gift");
    expect(csv).toContain(",'@cmd,");
    expect(csv).toContain(",'-2+3,");
    expect(csv).not.toMatch(/(^|,|\r\n)[=+\-@]/m);
  });
});

describe('clear all my data', () => {
  it('needs you signed in, and a Secret Pin of the right shape', async () => {
    const me = await person('Eve');
    expect((await request(app).post('/api/users/me/clear-data').send({ pin: '4821' })).status).toBe(401);
    for (const pin of ['12', 'abcd', '12345', '']) expect((await clear(me, pin)).status).toBe(400);
    expect((await request(app).post('/api/users/me/clear-data').set('Authorization', me.auth).send({})).status).toBe(400);
  });

  it('does nothing with a wrong Secret Pin, and does not sign you out', async () => {
    const { me } = await richPerson('Fay');
    const r = await clear(me, '0000');
    expect(r.status).toBe(403);
    expect(r.body.error.message).toMatch(/isn.t your Secret Pin/i);
    expect(await count(me)).toBe(3);
    expect((await request(app).get('/api/users/me').set('Authorization', me.auth)).status).toBe(200); // still signed in
  });

  it('locks the account after too many wrong Pins, just like signing in', async () => {
    const me = await person('Gus');
    await add(me, { title: 'keep me' });
    for (let i = 0; i < 5; i++) expect((await clear(me, '1111')).status).toBe(403);
    const locked = await clear(me, '4821'); // even the right Pin is refused while locked
    expect(locked.status).toBe(429);
    expect(await count(me)).toBe(1);
  });

  it('with the right Pin, clears everything that is money data, for good', async () => {
    const { me } = await richPerson('Hana');
    const before = JSON.parse((await exportJson(me)).text);
    expect(before.entries).toHaveLength(3);

    const r = await clear(me, '4821');
    expect(r.status).toBe(200);
    expect(r.body.cleared).toEqual({ entries: 4, budgets: 1, categories: 1, comments: 1 }); // the 4 includes the one deleted earlier

    expect(await count(me)).toBe(0);
    const after = JSON.parse((await exportJson(me)).text);
    expect(after.entries).toEqual([]);
    expect(after.budgets).toEqual([]);
    expect(after.customCategories).toEqual([]);
    expect(after.commentsFromFamily).toEqual([]);
    const cats = (await request(app).get('/api/categories').set('Authorization', me.auth)).body.categories as { custom: boolean }[];
    expect(cats.some((c) => c.custom)).toBe(false);
    // really gone from the database, not just hidden
    const raw = mongoose.connection.db!;
    const mineId = new mongoose.Types.ObjectId(me.id);
    expect(await raw.collection('transactions').countDocuments({ user: mineId })).toBe(0);
    expect(await raw.collection('budgets').countDocuments({ user: mineId })).toBe(0);
    expect(await raw.collection('auditlogs').countDocuments({ actor: mineId, entity: 'transaction' })).toBe(0);
  });

  it('keeps the account, the Secret Pin, the settings and the family connections', async () => {
    const { me, parent } = await richPerson('Ivy');
    await request(app).patch('/api/users/me/prefs').set('Authorization', me.auth).send({ theme: 'dark' });
    await clear(me, '4821');
    const profile = (await request(app).get('/api/users/me').set('Authorization', me.auth)).body.user;
    expect(profile).toMatchObject({ name: 'Ivy', mobile: me.mobile });
    expect(profile.prefs.theme).toBe('dark');
    expect((await request(app).post('/api/auth/login').send({ mobile: me.mobile, pin: '4821' })).status).toBe(200); // same Pin still works
    const fam = (await request(app).get('/api/family').set('Authorization', me.auth)).body;
    expect(fam.sharingWith).toHaveLength(1); // the parent is still connected
    // ...but now has nothing of theirs to see
    const seen = await request(app).get(`/api/family/people/${me.id}/transactions`).set('Authorization', parent.auth);
    expect(seen.status).toBe(200);
    expect(seen.body.transactions).toEqual([]);
  });

  it('only ever touches the person’s own data', async () => {
    const { me } = await richPerson('Jo');
    const other = await richPerson('Kit');
    await clear(me, '4821');
    expect(await count(other.me)).toBe(3);
    const d = JSON.parse((await exportJson(other.me)).text);
    expect(d.budgets).toHaveLength(1);
    expect(d.customCategories).toHaveLength(1);
    expect(d.commentsFromFamily).toHaveLength(1);
  });

  it('can be used again straight away, including the same custom category name', async () => {
    const { me } = await richPerson('Lou');
    await clear(me, '4821');
    expect((await add(me, { title: 'Fresh start', amountPaise: 500 })).status).toBe(201);
    expect((await request(app).post('/api/categories').set('Authorization', me.auth).send({ name: 'Pets' })).status).toBe(201);
    expect(await count(me)).toBe(1);
  });

  it('clearing an already empty account is fine', async () => {
    const me = await person('Moe');
    const r = await clear(me, '4821');
    expect(r.status).toBe(200);
    expect(r.body.cleared).toEqual({ entries: 0, budgets: 0, categories: 0, comments: 0 });
  });
});
