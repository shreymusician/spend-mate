import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

const user = { name: 'Asha', gender: 'female', dob: '2005-04-01', mobile: '9876543210', pin: '4821' };
const H = { 'X-Requested-With': 'SpendMate' };
const cookieOf = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
const login = (mobile = user.mobile, pin = user.pin) => request(app).post('/api/auth/login').send({ mobile, pin });

describe('account', () => {
  it('registers with mobile + Secret Pin, never stores or returns the pin', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user).toMatchObject({ name: 'Asha', mobile: '9876543210', gender: 'female' });
    expect(JSON.stringify(res.body)).not.toContain('pin');
    expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/HttpOnly/i);

    const raw = await mongoose.connection.db!.collection('users').findOne({ mobile: user.mobile });
    expect(raw?.pinHash).toMatch(/^\$2[aby]\$/);
    expect(JSON.stringify(raw)).not.toContain('4821');
  });

  it('remembers the light/dark choice made before signing up', async () => {
    const r = await request(app).post('/api/auth/register').send({ ...user, mobile: '9333333333', theme: 'dark' });
    expect(r.body.user.prefs.theme).toBe('dark');
    const d = await request(app).post('/api/auth/register').send({ ...user, mobile: '9444444444' });
    expect(d.body.user.prefs.theme).toBe('light');
  });

  it('accepts +91 / spaced numbers as the same account and rejects duplicates', async () => {
    expect((await request(app).post('/api/auth/register').send({ ...user, mobile: '+91 98765 43210' })).status).toBe(409);
    expect((await login('+91 98765-43210')).status).toBe(200);
  });

  it('validates every field', async () => {
    const bad = (patch: object) => request(app).post('/api/auth/register').send({ ...user, mobile: '9123456789', ...patch });
    expect((await bad({ pin: '123' })).status).toBe(400);
    expect((await bad({ pin: '12345' })).status).toBe(400);
    expect((await bad({ pin: 'abcd' })).status).toBe(400);
    expect((await bad({ mobile: '1234567890' })).status).toBe(400); // must start 6-9
    expect((await bad({ mobile: '98765' })).status).toBe(400);
    expect((await bad({ gender: 'robot' })).status).toBe(400);
    expect((await bad({ gender: undefined })).status).toBe(400);
    expect((await bad({ name: '  ' })).status).toBe(400);
    expect((await bad({ dob: undefined })).status).toBe(400);
    const young = new Date(Date.now() - 10 * 365 * 86_400_000).toISOString();
    expect((await bad({ dob: young })).status).toBe(400);
  });

  it('logs in with mobile + pin, rejects wrong pin and unknown numbers the same way', async () => {
    expect((await login()).status).toBe(200);
    const wrong = await login(user.mobile, '0000');
    const unknown = await login('9000000001', '4821');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('locks the account after 5 wrong pins, even for the right pin, and unlocks later', async () => {
    const u = { ...user, mobile: '9111111111' };
    await request(app).post('/api/auth/register').send(u);
    for (let i = 0; i < 5; i++) expect((await login(u.mobile, '0000')).status).toBe(401);
    const locked = await login(u.mobile, u.pin);
    expect(locked.status).toBe(429);
    expect(locked.body.error.message).toMatch(/wait/i);

    await mongoose.connection.db!.collection('users').updateOne({ mobile: u.mobile }, { $set: { lockedUntil: new Date(Date.now() - 1000) } });
    expect((await login(u.mobile, u.pin)).status).toBe(200);
  });

  it('a successful login resets the wrong-pin counter', async () => {
    const u = { ...user, mobile: '9222222222' };
    await request(app).post('/api/auth/register').send(u);
    for (let i = 0; i < 4; i++) await login(u.mobile, '0000');
    expect((await login(u.mobile, u.pin)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login(u.mobile, '0000')).status).toBe(401);
    expect((await login(u.mobile, u.pin)).status).toBe(200); // still not locked
  });

  it('protects /users/me and serves it with a valid token', async () => {
    expect((await request(app).get('/api/users/me')).status).toBe(401);
    const l = await login();
    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${l.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.mobile).toBe(user.mobile);
  });
});

describe('sessions', () => {
  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const c1 = cookieOf(await login());
    const r1 = await request(app).post('/api/auth/refresh').set(H).set('Cookie', c1);
    expect(r1.status).toBe(200);
    const c2 = cookieOf(r1);
    expect(c2).not.toBe(c1);
    expect((await request(app).post('/api/auth/refresh').set(H).set('Cookie', c1)).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set(H).set('Cookie', c2)).status).toBe(401);
  });

  it('requires the CSRF header on refresh', async () => {
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookieOf(await login()))).status).toBe(403);
  });

  it('logout invalidates the refresh token', async () => {
    const c = cookieOf(await login());
    expect((await request(app).post('/api/auth/logout').set(H).set('Cookie', c)).status).toBe(204);
    expect((await request(app).post('/api/auth/refresh').set(H).set('Cookie', c)).status).toBe(401);
  });
});

describe('forgot Secret Pin', () => {
  const reset = (body: object) => request(app).post('/api/auth/reset-pin').send(body);
  const make = async (mobile: string) => { await request(app).post('/api/auth/register').send({ ...user, mobile, dob: '2005-04-01' }); };

  it('resets with the right date of birth: old Pin stops working, new one works', async () => {
    await make('9712345601');
    expect((await reset({ mobile: '9712345601', dob: '2005-04-01', pin: '7390' })).status).toBe(204);
    expect((await login('9712345601', '4821')).status).toBe(401);
    expect((await login('9712345601', '7390')).status).toBe(200);
  });

  it('signs out every device after a reset', async () => {
    await make('9712345602');
    const cookie = cookieOf(await login('9712345602'));
    await reset({ mobile: '9712345602', dob: '2005-04-01', pin: '7390' });
    expect((await request(app).post('/api/auth/refresh').set(H).set('Cookie', cookie)).status).toBe(401);
  });

  it('rejects a wrong date of birth, and answers identically for an unknown number', async () => {
    await make('9777777777');
    const wrong = await reset({ mobile: '9777777777', dob: '2005-04-02', pin: '7390' });
    const unknown = await reset({ mobile: '9000000002', dob: '2005-04-01', pin: '7390' });
    expect(wrong.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    expect((await login('9777777777', '4821')).status).toBe(200); // Pin unchanged
  });

  it('validates the new Pin and date format', async () => {
    await make('9888888888');
    expect((await reset({ mobile: '9888888888', dob: '2005-04-01', pin: '12' })).status).toBe(400);
    expect((await reset({ mobile: '9888888888', dob: 'April 1', pin: '7390' })).status).toBe(400);
  });

  it('locks after 5 wrong dates of birth, so it cannot be used to guess the birthday', async () => {
    await make('9999999999');
    for (let i = 0; i < 5; i++) expect((await reset({ mobile: '9999999999', dob: '1999-01-01', pin: '7390' })).status).toBe(400);
    const locked = await reset({ mobile: '9999999999', dob: '2005-04-01', pin: '7390' }); // even the right date
    expect(locked.status).toBe(429);
    expect((await login('9999999999', '4821')).status).toBe(429); // sign-in is locked too
  });
});


describe('remember me and device', () => {
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
  const mob = { ...user, mobile: '9611111101' };
  const setCookie = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[])[0]!;

  it('detects the device and keeps a long-lived cookie when remembered', async () => {
    await request(app).post('/api/auth/register').send(mob);
    const res = await request(app).post('/api/auth/login').set('User-Agent', ANDROID).send({ mobile: mob.mobile, pin: mob.pin, remember: true });
    expect(res.body.device).toEqual({ label: 'Chrome on Android', remembered: true });
    expect(setCookie(res)).toMatch(/Max-Age=\d+/i);
  });

  it('uses a session-only cookie and short server expiry when not remembered', async () => {
    const res = await request(app).post('/api/auth/login').set('User-Agent', ANDROID).send({ mobile: mob.mobile, pin: mob.pin, remember: false });
    expect(res.body.device.remembered).toBe(false);
    expect(setCookie(res)).not.toMatch(/Max-Age|Expires=(?!Thu, 01 Jan 1970)/i);
    const row = await mongoose.connection.db!.collection('refreshtokens').find({ remember: false }).sort({ createdAt: -1 }).limit(1).next();
    expect(row!.expiresAt.getTime() - Date.now()).toBeLessThan(25 * 3_600_000);
  });

  it('keeps the choice when the session is refreshed', async () => {
    const login2 = await request(app).post('/api/auth/login').set('User-Agent', ANDROID).send({ mobile: mob.mobile, pin: mob.pin, remember: false });
    const r = await request(app).post('/api/auth/refresh').set(H).set('Cookie', cookieOf(login2)).set('User-Agent', ANDROID);
    expect(r.status).toBe(200);
    expect(r.body.device).toEqual({ label: 'Chrome on Android', remembered: false });
    expect(setCookie(r)).not.toMatch(/Max-Age/i);
  });

  it('remembers by default when the choice is not sent', async () => {
    const res = await login(mob.mobile, mob.pin);
    expect(res.body.device.remembered).toBe(true);
  });
});

describe('profile photo', () => {
  // 1x1 PNG
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const mob = { ...user, mobile: '9611111102' };
  let token = '';
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('saves, returns and removes a photo', async () => {
    token = (await request(app).post('/api/auth/register').send(mob)).body.accessToken;
    const put = await request(app).put('/api/users/me/avatar').set(auth()).send({ image: PNG });
    expect(put.status).toBe(200);
    expect(put.body.user.avatarUrl).toBe(PNG);
    expect((await request(app).get('/api/users/me').set(auth())).body.user.avatarUrl).toBe(PNG);
    const del = await request(app).delete('/api/users/me/avatar').set(auth());
    expect(del.body.user.avatarUrl).toBeNull();
  });

  it('rejects SVG, non-images, oversized and fake files', async () => {
    const bad = (image: string) => request(app).put('/api/users/me/avatar').set(auth()).send({ image });
    expect((await bad('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).status).toBe(400);
    expect((await bad('https://example.com/a.png')).status).toBe(400);
    expect((await bad('data:image/png;base64,' + 'A'.repeat(95_000))).status).toBe(400);
    // Looks like a PNG by its label but is plain text inside.
    expect((await bad('data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64'))).status).toBe(400);
    expect((await request(app).put('/api/users/me/avatar').send({ image: PNG })).status).toBe(401);
  });
});
