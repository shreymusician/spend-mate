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

const ids: Record<string, string> = {};
let nextMobile = 8000000000;
async function signup(name: string) {
  const r = await request(app).post('/api/auth/register').send({ name, gender: 'male', dob: '1990-01-01', mobile: String(nextMobile++), pin: '4821' });
  ids[name] = r.body.user.id;
  return `Bearer ${r.body.accessToken}`;
}
const tx = (auth: string, body: object) =>
  request(app).post('/api/transactions').set('Authorization', auth).send({ type: 'expense', category: 'food', ...body });

let kid: string, dad: string, stranger: string;
let sharedId: string, privateId: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import('../../app.js')).createApp();
  kid = await signup('kid');
  dad = await signup('dad');
  stranger = await signup('stranger');
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('linking', () => {
  it('rejects bad, own and reused codes', async () => {
    const inv = await request(app).post('/api/family/invites').set('Authorization', kid).send({ role: 'child' });
    expect(inv.status).toBe(201);
    expect(inv.body.code).toMatch(/^[A-Z2-9]{6}$/);

    expect((await request(app).post('/api/family/invites/accept').set('Authorization', dad).send({ code: 'ZZZZZZ' })).status).toBe(400);
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', kid).send({ code: inv.body.code })).status).toBe(400);
    // Own-code attempt must not burn the code.
    const ok = await request(app).post('/api/family/invites/accept').set('Authorization', dad).send({ code: inv.body.code.toLowerCase() });
    expect(ok.status).toBe(201);
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', stranger).send({ code: inv.body.code })).status).toBe(400);
  });

  it('shows each side the other', async () => {
    const d = await request(app).get('/api/family').set('Authorization', dad);
    expect(d.body.children.map((c: { user: { name: string } }) => c.user.name)).toEqual(['kid']);
    const k = await request(app).get('/api/family').set('Authorization', kid);
    expect(k.body.parents.map((c: { user: { name: string } }) => c.user.name)).toEqual(['dad']);
    expect((await request(app).get('/api/family').set('Authorization', stranger)).body).toEqual({ parents: [], children: [] });
  });

  it('refuses a second link between the same two people', async () => {
    const inv = await request(app).post('/api/family/invites').set('Authorization', dad).send({ role: 'parent' });
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', kid).send({ code: inv.body.code })).status).toBe(409);
  });
});

describe('what a parent can see', () => {
  beforeAll(async () => {
    const a = await tx(kid, { amountPaise: 12000, title: 'Lunch', reason: 'With friends', visibility: 'shared' });
    const b = await tx(kid, { amountPaise: 99900, title: 'Surprise gift', visibility: 'private' });
    await request(app).post('/api/transactions').set('Authorization', kid)
      .send({ type: 'income', source: 'parents', amountPaise: 500000, title: 'Pocket money', visibility: 'shared' });
    sharedId = a.body.transaction.id;
    privateId = b.body.transaction.id;
  });
  const asDad = (path: string) => request(app).get(path).set('Authorization', dad);

  it('lists only shared entries', async () => {
    const r = await asDad(`/api/family/children/${ids.kid}/transactions`);
    expect(r.status).toBe(200);
    expect(r.body.transactions.map((t: { title: string }) => t.title).sort()).toEqual(['Lunch', 'Pocket money']);
  });

  it('summary only counts shared entries and exposes no budgets', async () => {
    await request(app).put('/api/budgets').set('Authorization', kid).send({ month: currentMonth(), category: null, limitPaise: 100000 });
    const s = (await asDad(`/api/family/children/${ids.kid}/summary`)).body;
    expect(s.expensePaise).toBe(12000);
    expect(s.incomePaise).toBe(500000);
    expect(s.balancePaise).toBe(488000);
    expect(s.budgets).toEqual([]);
    // The child's own view still includes everything.
    const own = (await request(app).get('/api/analytics/summary').set('Authorization', kid)).body;
    expect(own.expensePaise).toBe(111900);
  });

  it('hides unrelated people’s accounts', async () => {
    expect((await request(app).get(`/api/family/children/${ids.kid}/transactions`).set('Authorization', stranger)).status).toBe(404);
    expect((await request(app).get(`/api/family/children/${ids.kid}/summary`).set('Authorization', stranger)).status).toBe(404);
    // A child cannot use the parent endpoints on their parent.
    expect((await request(app).get(`/api/family/children/${ids.dad}/transactions`).set('Authorization', kid)).status).toBe(404);
  });

  it('is read-only: a parent cannot read or change the child’s entries through normal routes', async () => {
    const patch = (id: string) => request(app).patch(`/api/transactions/${id}`).set('Authorization', dad).send({ title: 'x' });
    expect((await patch(sharedId)).status).toBe(404);
    expect((await request(app).delete(`/api/transactions/${sharedId}`).set('Authorization', dad)).status).toBe(404);
    expect((await request(app).get(`/api/transactions/${sharedId}`).set('Authorization', dad)).status).toBe(404);
  });

  it('follows the child’s sharing choices instantly', async () => {
    await request(app).patch(`/api/transactions/${privateId}`).set('Authorization', kid).send({ visibility: 'shared' });
    let r = await asDad(`/api/family/children/${ids.kid}/transactions?q=gift`);
    expect(r.body.transactions).toHaveLength(1);
    await request(app).patch(`/api/transactions/${privateId}`).set('Authorization', kid).send({ visibility: 'private' });
    r = await asDad(`/api/family/children/${ids.kid}/transactions?q=gift`);
    expect(r.body.transactions).toHaveLength(0);
  });

  it('share-all / hide-all flips existing entries', async () => {
    expect((await request(app).post('/api/family/sharing').set('Authorization', kid).send({ visibility: 'shared' })).body.updated).toBe(3);
    expect((await asDad(`/api/family/children/${ids.kid}/transactions`)).body.transactions).toHaveLength(3);
    await request(app).post('/api/family/sharing').set('Authorization', kid).send({ visibility: 'private' });
    expect((await asDad(`/api/family/children/${ids.kid}/transactions`)).body.transactions).toHaveLength(0);
    await request(app).post('/api/family/sharing').set('Authorization', kid).send({ visibility: 'shared' });
    await request(app).patch(`/api/transactions/${privateId}`).set('Authorization', kid).send({ visibility: 'private' });
  });
});

describe('comments', () => {
  it('parent can comment on shared entries; child reads them; strangers cannot', async () => {
    const c = await request(app).post(`/api/family/transactions/${sharedId}/comments`).set('Authorization', dad).send({ body: 'Nice, but eat at home sometimes' });
    expect(c.status).toBe(201);
    const k = await request(app).get(`/api/family/transactions/${sharedId}/comments`).set('Authorization', kid);
    expect(k.body.comments).toMatchObject([{ body: 'Nice, but eat at home sometimes', author: 'dad', mine: false }]);
    expect((await request(app).get(`/api/family/transactions/${sharedId}/comments`).set('Authorization', stranger)).status).toBe(404);
    expect((await request(app).post(`/api/family/transactions/${sharedId}/comments`).set('Authorization', stranger).send({ body: 'hi' })).status).toBe(404);
  });

  it('child cannot post as a parent, and private entries cannot be commented on', async () => {
    expect((await request(app).post(`/api/family/transactions/${sharedId}/comments`).set('Authorization', kid).send({ body: 'hi' })).status).toBe(400);
    expect((await request(app).post(`/api/family/transactions/${privateId}/comments`).set('Authorization', dad).send({ body: 'hi' })).status).toBe(404);
    expect((await request(app).get(`/api/family/transactions/${privateId}/comments`).set('Authorization', dad)).status).toBe(404);
  });
});

describe('unlinking', () => {
  it('stops access immediately, for either side, and can be re-linked', async () => {
    const link = (await request(app).get('/api/family').set('Authorization', kid)).body.parents[0].linkId;
    expect((await request(app).delete(`/api/family/links/${link}`).set('Authorization', stranger)).status).toBe(404);
    expect((await request(app).delete(`/api/family/links/${link}`).set('Authorization', kid)).status).toBe(204);

    expect((await request(app).get(`/api/family/children/${ids.kid}/transactions`).set('Authorization', dad)).status).toBe(404);
    expect((await request(app).get(`/api/family/transactions/${sharedId}/comments`).set('Authorization', dad)).status).toBe(404);
    expect((await request(app).get('/api/family').set('Authorization', dad)).body.children).toEqual([]);

    const inv = await request(app).post('/api/family/invites').set('Authorization', dad).send({ role: 'parent' });
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', kid).send({ code: inv.body.code })).status).toBe(201);
    expect((await request(app).get(`/api/family/children/${ids.kid}/transactions`).set('Authorization', dad)).status).toBe(200);
  });

  it('expired codes do not work', async () => {
    const { Invitation } = await import('./family.models.js');
    const inv = await request(app).post('/api/family/invites').set('Authorization', stranger).send({ role: 'parent' });
    await Invitation.updateOne({ code: inv.body.code }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', kid).send({ code: inv.body.code })).status).toBe(400);
  });
});

describe('several people linked at once', () => {
  let kid1: string, kid2: string, dad2: string, mom: string;
  const link = async (inviter: string, role: 'parent' | 'child', accepter: string) => {
    const inv = await request(app).post('/api/family/invites').set('Authorization', inviter).send({ role });
    return request(app).post('/api/family/invites/accept').set('Authorization', accepter).send({ code: inv.body.code });
  };

  it('links two children to one parent and two parents to one child', async () => {
    kid1 = await signup('kid1'); kid2 = await signup('kid2'); dad2 = await signup('dad2'); mom = await signup('mom');
    expect((await link(kid1, 'child', dad2)).status).toBe(201);   // kid1 invites dad2
    expect((await link(kid1, 'child', mom)).status).toBe(201);    // kid1 invites mom too
    expect((await link(dad2, 'parent', kid2)).status).toBe(201);  // dad2 invites kid2

    const names = (res: request.Response, k: 'parents' | 'children') => res.body[k].map((l: { user: { name: string } }) => l.user.name).sort();
    expect(names(await request(app).get('/api/family').set('Authorization', dad2), 'children')).toEqual(['kid1', 'kid2']);
    expect(names(await request(app).get('/api/family').set('Authorization', kid1), 'parents')).toEqual(['dad2', 'mom']);
    expect(names(await request(app).get('/api/family').set('Authorization', mom), 'children')).toEqual(['kid1']);
    expect(names(await request(app).get('/api/family').set('Authorization', kid2), 'parents')).toEqual(['dad2']);
  });

  it('does not burn a code when the two are already linked', async () => {
    const inv = await request(app).post('/api/family/invites').set('Authorization', kid1).send({ role: 'child' });
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', dad2).send({ code: inv.body.code })).status).toBe(409);
    // The same code still works for someone who is not linked yet.
    const third = await signup('dad3');
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', third).send({ code: inv.body.code })).status).toBe(201);
  });

  it('overview shows every child’s shared spending, per parent, and nothing private', async () => {
    await tx(kid1, { amountPaise: 20000, title: 'k1 shared', visibility: 'shared' });
    await tx(kid1, { amountPaise: 99900, title: 'k1 secret', visibility: 'private' });
    await tx(kid2, { amountPaise: 5000, title: 'k2 shared', visibility: 'shared' });

    const d = (await request(app).get('/api/family/overview').set('Authorization', dad2)).body;
    expect(d.children.map((c: { user: { name: string } }) => c.user.name).sort()).toEqual(['kid1', 'kid2']);
    expect(d.totals.expensePaise).toBe(25000);
    expect(d.feed.map((t: { title: string }) => t.title).sort()).toEqual(['k1 shared', 'k2 shared']);
    expect(JSON.stringify(d)).not.toContain('secret');
    expect(JSON.stringify(d)).not.toContain('budget');
    expect(d.feed[0].child.name).toMatch(/kid/);

    // mom is linked to kid1 only: she must not see kid2 at all.
    const m = (await request(app).get('/api/family/overview').set('Authorization', mom)).body;
    expect(m.children.map((c: { user: { name: string } }) => c.user.name)).toEqual(['kid1']);
    expect(m.totals.expensePaise).toBe(20000);
    expect(JSON.stringify(m)).not.toContain('k2 shared');

    // a child (no children of their own) simply gets an empty overview
    const k = (await request(app).get('/api/family/overview').set('Authorization', kid1)).body;
    expect(k.children).toEqual([]);
  });

  it('stopping one link only removes that child from that parent', async () => {
    const links = (await request(app).get('/api/family').set('Authorization', dad2)).body.children as { linkId: string; user: { name: string } }[];
    const kid2Link = links.find((l) => l.user.name === 'kid2')!;
    expect((await request(app).delete(`/api/family/links/${kid2Link.linkId}`).set('Authorization', dad2)).status).toBe(204);
    const d = (await request(app).get('/api/family/overview').set('Authorization', dad2)).body;
    expect(d.children.map((c: { user: { name: string } }) => c.user.name)).toEqual(['kid1']);
  });
});
