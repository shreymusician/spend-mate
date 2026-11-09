import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { WebSocket } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.PIN_PEPPER = 'test-pepper-test-pepper-test-pepper-123';
process.env.MONGODB_URI = 'mongodb://placeholder';

let mongod: MongoMemoryServer;
let server: Server;
let stop: () => void;
let app: import('express').Express;
let port = 0;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import('../app.js')).createApp();
  const { attachRealtime } = await import('./hub.js');
  server = createServer(app);
  stop = attachRealtime(server).close;
  await new Promise<void>((r) => server.listen(0, r));
  port = (server.address() as AddressInfo).port;
});
afterAll(async () => {
  stop();
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
});

let mobile = 9100000000;
const signup = async (name: string) => {
  const r = await request(app).post('/api/auth/register').send({ name, gender: 'male', dob: '1990-01-01', mobile: String(mobile++), pin: '4821' });
  return { auth: `Bearer ${r.body.accessToken}`, token: r.body.accessToken as string, id: r.body.user.id as string };
};

type Msg = { type: string; topics?: string[]; txId?: string };
/** Opens a live connection and collects what it receives. */
async function listen(token: string | null) {
  const ws = new WebSocket(`ws://localhost:${port}/api/realtime`);
  const got: Msg[] = [];
  let closed: number | null = null;
  ws.on('message', (d) => got.push(JSON.parse(d.toString())));
  ws.on('close', (code) => { closed = code; });
  await new Promise<void>((r, j) => { ws.on('open', () => r()); ws.on('error', j); });
  if (token) ws.send(JSON.stringify({ type: 'auth', token }));
  return { ws, got, closed: () => closed, ready: async () => { for (let i = 0; i < 50 && !got.some((m) => m.type === 'ready'); i++) await sleep(20); } };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const quiet = () => sleep(250);
const tx = (auth: string, body: object) => request(app).post('/api/transactions').set('Authorization', auth).send({ type: 'expense', category: 'food', amountPaise: 1000, title: 't', ...body });
const link = async (child: string, parent: string) => {
  const inv = await request(app).post('/api/family/invites').set('Authorization', child).send({ role: 'child' });
  await request(app).post('/api/family/invites/accept').set('Authorization', parent).send({ code: inv.body.code });
};

describe('live connection', () => {
  it('accepts a valid token and rejects bad, missing or late ones', async () => {
    const a = await signup('a');
    const ok = await listen(a.token); await ok.ready();
    expect(ok.got[0]).toEqual({ type: 'ready' });

    const bad = await listen('not-a-token'); await sleep(200);
    expect(bad.closed()).toBe(4001);

    const none = await listen(null); await sleep(5400);
    expect(none.closed()).toBe(4001); // never signed in: dropped after the timeout
    ok.ws.close();
  }, 15_000);

  it('only accepts the connection on its own path', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/somewhere-else`);
    const err = await new Promise<boolean>((r) => { ws.on('error', () => r(true)); ws.on('open', () => r(false)); });
    expect(err).toBe(true);
  });
});

describe('who is told what', () => {
  it('nudges the owner’s other devices, and a parent only for shared entries', async () => {
    const kid = await signup('kid'); const dad = await signup('dad'); const other = await signup('stranger');
    await link(kid.auth, dad.auth);
    const kidPhone = await listen(kid.token); const kidLaptop = await listen(kid.token);
    const dadPhone = await listen(dad.token); const stranger = await listen(other.token);
    await Promise.all([kidPhone.ready(), kidLaptop.ready(), dadPhone.ready(), stranger.ready()]);
    for (const c of [kidPhone, kidLaptop, dadPhone, stranger]) c.got.length = 0;

    // A private entry: the child's devices hear about it, the parent hears nothing at all.
    await tx(kid.auth, { visibility: 'private' }); await quiet();
    expect(kidPhone.got).toHaveLength(1);
    expect(kidLaptop.got).toHaveLength(1);
    expect(dadPhone.got).toHaveLength(0);

    // A shared entry reaches the parent too.
    const shared = await tx(kid.auth, { visibility: 'shared' }); await quiet();
    expect(dadPhone.got.map((m) => m.topics)).toEqual([['transactions']]);

    // Hiding it again also tells the parent (so it disappears from their screen).
    await request(app).patch(`/api/transactions/${shared.body.transaction.id}`).set('Authorization', kid.auth).send({ visibility: 'private' }); await quiet();
    expect(dadPhone.got).toHaveLength(2);

    // Someone unrelated hears nothing, ever.
    expect(stranger.got).toHaveLength(0);
    // And the nudge carries no data.
    expect(JSON.stringify(dadPhone.got)).not.toMatch(/amount|title|name/i);
    for (const c of [kidPhone, kidLaptop, dadPhone, stranger]) c.ws.close();
  });

  it('tells both people when they are linked or unlinked', async () => {
    const kid = await signup('kid2'); const mom = await signup('mom');
    const k = await listen(kid.token); const m = await listen(mom.token);
    await Promise.all([k.ready(), m.ready()]);
    await link(kid.auth, mom.auth); await quiet();
    expect(k.got.at(-1)?.topics).toContain('family');
    expect(m.got.at(-1)?.topics).toContain('family');
    k.got.length = 0; m.got.length = 0;
    const links = (await request(app).get('/api/family').set('Authorization', kid.auth)).body.parents as { linkId: string }[];
    await request(app).delete(`/api/family/links/${links[0]!.linkId}`).set('Authorization', kid.auth); await quiet();
    expect(k.got.at(-1)?.topics).toContain('family');
    expect(m.got.at(-1)?.topics).toContain('family');
    k.ws.close(); m.ws.close();
  });

  it('tells the child when a parent comments', async () => {
    const kid = await signup('kid3'); const dad = await signup('dad3');
    await link(kid.auth, dad.auth);
    const e = await tx(kid.auth, { visibility: 'shared' });
    const k = await listen(kid.token); await k.ready(); k.got.length = 0;
    await request(app).post(`/api/family/transactions/${e.body.transaction.id}/comments`).set('Authorization', dad.auth).send({ body: 'ok' }); await quiet();
    expect(k.got).toEqual([{ type: 'update', topics: ['comments'], txId: e.body.transaction.id }]);
    k.ws.close();
  });

  it('stops following people once their link is gone', async () => {
    const kid = await signup('kid4'); const dad = await signup('dad4');
    await link(kid.auth, dad.auth);
    const links = (await request(app).get('/api/family').set('Authorization', kid.auth)).body.parents as { linkId: string }[];
    await request(app).delete(`/api/family/links/${links[0]!.linkId}`).set('Authorization', kid.auth);
    const d = await listen(dad.token); await d.ready(); d.got.length = 0;
    await tx(kid.auth, { visibility: 'shared' }); await quiet();
    expect(d.got).toHaveLength(0);
    d.ws.close();
  });
});

describe('sessions', () => {
  it('disconnects every live connection when the Secret Pin is reset', async () => {
    const u = { name: 'rp', gender: 'male', dob: '1990-01-01', mobile: '9199999999', pin: '4821' };
    const r = await request(app).post('/api/auth/register').send(u);
    const c = await listen(r.body.accessToken); await c.ready();
    await request(app).post('/api/auth/reset-pin').send({ mobile: u.mobile, dob: u.dob, pin: '7390' });
    await sleep(250);
    expect(c.closed()).toBe(4001);
  });

  it('limits how many connections one person can keep open', async () => {
    const u = await signup('many');
    const all = [];
    for (let i = 0; i < 8; i++) { const c = await listen(u.token); await c.ready(); all.push(c); }
    await sleep(200);
    expect(all.filter((c) => c.closed() === 4002).length).toBe(2);
    all.forEach((c) => c.ws.close());
  });
});
