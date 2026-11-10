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
    const inv = await request(app).post('/api/family/invites').set('Authorization', kid).send({});
    expect(inv.status).toBe(201);
    expect(inv.body.code).toMatch(/^[A-Z2-9]{6}$/);

    expect((await request(app).post('/api/family/invites/accept').set('Authorization', dad).send({ code: 'ZZZZZZ' })).status).toBe(400);
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', kid).send({ code: inv.body.code, relation: 'child' })).status).toBe(400);
    // Own-code attempt must not burn the code.
    const ok = await request(app).post('/api/family/invites/accept').set('Authorization', dad).send({ code: inv.body.code.toLowerCase(), relation: 'child' });
    expect(ok.status).toBe(201);
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', stranger).send({ code: inv.body.code, relation: 'child' })).status).toBe(400);
  });

  it('shows each side the other', async () => {
    const d = await request(app).get('/api/family').set('Authorization', dad);
    expect(d.body.following.map((c: { user: { name: string } }) => c.user.name)).toEqual(['kid']);
    const k = await request(app).get('/api/family').set('Authorization', kid);
    expect(k.body.sharingWith.map((c: { user: { name: string } }) => c.user.name)).toEqual(['dad']);
    expect((await request(app).get('/api/family').set('Authorization', stranger)).body).toEqual({ sharingWith: [], following: [] });
  });

  it('refuses a second link between the same two people', async () => {
    const inv = await request(app).post('/api/family/invites').set('Authorization', dad).send({});
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', kid).send({ code: inv.body.code, relation: 'parent' })).status).toBe(409);
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
    const r = await asDad(`/api/family/people/${ids.kid}/transactions`);
    expect(r.status).toBe(200);
    expect(r.body.transactions.map((t: { title: string }) => t.title).sort()).toEqual(['Lunch', 'Pocket money']);
  });

  it('summary only counts shared entries and exposes no budgets', async () => {
    await request(app).put('/api/budgets').set('Authorization', kid).send({ month: currentMonth(), category: null, limitPaise: 100000 });
    const s = (await asDad(`/api/family/people/${ids.kid}/summary`)).body;
    expect(s.expensePaise).toBe(12000);
    expect(s.incomePaise).toBe(500000);
    expect(s.balancePaise).toBe(488000);
    expect(s.budgets).toEqual([]);
    // The child's own view still includes everything.
    const own = (await request(app).get('/api/analytics/summary').set('Authorization', kid)).body;
    expect(own.expensePaise).toBe(111900);
  });

  it('hides unrelated people’s accounts', async () => {
    expect((await request(app).get(`/api/family/people/${ids.kid}/transactions`).set('Authorization', stranger)).status).toBe(404);
    expect((await request(app).get(`/api/family/people/${ids.kid}/summary`).set('Authorization', stranger)).status).toBe(404);
    // A child cannot use the parent endpoints on their parent.
    expect((await request(app).get(`/api/family/people/${ids.dad}/transactions`).set('Authorization', kid)).status).toBe(404);
  });

  it('is read-only: a parent cannot read or change the child’s entries through normal routes', async () => {
    const patch = (id: string) => request(app).patch(`/api/transactions/${id}`).set('Authorization', dad).send({ title: 'x' });
    expect((await patch(sharedId)).status).toBe(404);
    expect((await request(app).delete(`/api/transactions/${sharedId}`).set('Authorization', dad)).status).toBe(404);
    expect((await request(app).get(`/api/transactions/${sharedId}`).set('Authorization', dad)).status).toBe(404);
  });

  it('follows the child’s sharing choices instantly', async () => {
    await request(app).patch(`/api/transactions/${privateId}`).set('Authorization', kid).send({ visibility: 'shared' });
    let r = await asDad(`/api/family/people/${ids.kid}/transactions?q=gift`);
    expect(r.body.transactions).toHaveLength(1);
    await request(app).patch(`/api/transactions/${privateId}`).set('Authorization', kid).send({ visibility: 'private' });
    r = await asDad(`/api/family/people/${ids.kid}/transactions?q=gift`);
    expect(r.body.transactions).toHaveLength(0);
  });

  it('share-all / hide-all flips existing entries', async () => {
    expect((await request(app).post('/api/family/sharing').set('Authorization', kid).send({ visibility: 'shared' })).body.updated).toBe(3);
    expect((await asDad(`/api/family/people/${ids.kid}/transactions`)).body.transactions).toHaveLength(3);
    await request(app).post('/api/family/sharing').set('Authorization', kid).send({ visibility: 'private' });
    expect((await asDad(`/api/family/people/${ids.kid}/transactions`)).body.transactions).toHaveLength(0);
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
    const link = (await request(app).get('/api/family').set('Authorization', kid)).body.sharingWith[0].linkId;
    expect((await request(app).delete(`/api/family/links/${link}`).set('Authorization', stranger)).status).toBe(404);
    expect((await request(app).delete(`/api/family/links/${link}`).set('Authorization', kid)).status).toBe(204);

    expect((await request(app).get(`/api/family/people/${ids.kid}/transactions`).set('Authorization', dad)).status).toBe(404);
    expect((await request(app).get(`/api/family/transactions/${sharedId}/comments`).set('Authorization', dad)).status).toBe(404);
    expect((await request(app).get('/api/family').set('Authorization', dad)).body.following).toEqual([]);

    const inv = await request(app).post('/api/family/invites').set('Authorization', dad).send({});
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', kid).send({ code: inv.body.code, relation: 'parent' })).status).toBe(201);
    expect((await request(app).get(`/api/family/people/${ids.kid}/transactions`).set('Authorization', dad)).status).toBe(200);
  });

  it('expired codes do not work', async () => {
    const { Invitation } = await import('./family.models.js');
    const inv = await request(app).post('/api/family/invites').set('Authorization', stranger).send({});
    await Invitation.updateOne({ code: inv.body.code }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', kid).send({ code: inv.body.code, relation: 'parent' })).status).toBe(400);
  });
});

describe('several people linked at once', () => {
  let kid1: string, kid2: string, dad2: string, mom: string;
  const link = async (inviter: string, role: 'parent' | 'child', accepter: string) => {
    const inv = await request(app).post('/api/family/invites').set('Authorization', inviter).send({});
    return request(app).post('/api/family/invites/accept').set('Authorization', accepter).send({ code: inv.body.code, relation: role });
  };

  it('links two children to one parent and two parents to one child', async () => {
    kid1 = await signup('kid1'); kid2 = await signup('kid2'); dad2 = await signup('dad2'); mom = await signup('mom');
    expect((await link(kid1, 'child', dad2)).status).toBe(201);   // kid1 invites dad2
    expect((await link(kid1, 'child', mom)).status).toBe(201);    // kid1 invites mom too
    expect((await link(dad2, 'parent', kid2)).status).toBe(201);  // dad2 invites kid2

    const names = (res: request.Response, k: 'sharingWith' | 'following') => res.body[k].map((l: { user: { name: string } }) => l.user.name).sort();
    expect(names(await request(app).get('/api/family').set('Authorization', dad2), 'following')).toEqual(['kid1', 'kid2']);
    expect(names(await request(app).get('/api/family').set('Authorization', kid1), 'sharingWith')).toEqual(['dad2', 'mom']);
    expect(names(await request(app).get('/api/family').set('Authorization', mom), 'following')).toEqual(['kid1']);
    expect(names(await request(app).get('/api/family').set('Authorization', kid2), 'sharingWith')).toEqual(['dad2']);
  });

  it('does not burn a code when the two are already linked', async () => {
    const inv = await request(app).post('/api/family/invites').set('Authorization', kid1).send({});
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', dad2).send({ code: inv.body.code, relation: 'child' })).status).toBe(409);
    // The same code still works for someone who is not linked yet.
    const third = await signup('dad3');
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', third).send({ code: inv.body.code, relation: 'child' })).status).toBe(201);
  });

  it('overview shows every child’s shared spending, per parent, and nothing private', async () => {
    await tx(kid1, { amountPaise: 20000, title: 'k1 shared', visibility: 'shared' });
    await tx(kid1, { amountPaise: 99900, title: 'k1 secret', visibility: 'private' });
    await tx(kid2, { amountPaise: 5000, title: 'k2 shared', visibility: 'shared' });

    const names = (o: { people: { user: { name: string } }[] }) => o.people.map((c) => c.user.name).sort();
    const spent = (o: { people: { expensePaise: number }[] }) => o.people.reduce((n, c) => n + c.expensePaise, 0);

    const d = (await request(app).get('/api/family/overview').set('Authorization', dad2)).body;
    expect(names(d)).toEqual(['kid1', 'kid2']);
    expect(spent(d)).toBe(25000);
    expect(d.people.flatMap((c: { latest: { title: string }[] }) => c.latest.map((t) => t.title)).sort()).toEqual(['k1 shared', 'k2 shared']);
    expect(JSON.stringify(d)).not.toContain('secret');
    expect(JSON.stringify(d)).not.toContain('budget');

    // mom is linked to kid1 only: she must not see kid2 at all.
    const m = (await request(app).get('/api/family/overview').set('Authorization', mom)).body;
    expect(names(m)).toEqual(['kid1']);
    expect(spent(m)).toBe(20000);
    expect(JSON.stringify(m)).not.toContain('k2 shared');

    // someone who follows nobody simply gets an empty overview
    const k = (await request(app).get('/api/family/overview').set('Authorization', kid1)).body;
    expect(k.people).toEqual([]);
  });

  it('stopping one link only removes that child from that parent', async () => {
    const links = (await request(app).get('/api/family').set('Authorization', dad2)).body.following as { linkId: string; user: { name: string } }[];
    const kid2Link = links.find((l) => l.user.name === 'kid2')!;
    expect((await request(app).delete(`/api/family/links/${kid2Link.linkId}`).set('Authorization', dad2)).status).toBe(204);
    const d = (await request(app).get('/api/family/overview').set('Authorization', dad2)).body;
    expect(d.people.map((c: { user: { name: string } }) => c.user.name)).toEqual(['kid1']);
  });
});

describe('family details live in the Family tab', () => {
  it('a child can read what parents wrote on their entries, and only their own', async () => {
    const child = await signup('cc1'); const parent = await signup('pp1'); const other = await signup('oo1');
    const inv = await request(app).post('/api/family/invites').set('Authorization', child).send({});
    await request(app).post('/api/family/invites/accept').set('Authorization', parent).send({ code: inv.body.code, relation: 'child' });
    const e = await tx(child, { amountPaise: 38000, title: 'Lunch', visibility: 'shared' });
    await request(app).post(`/api/family/transactions/${e.body.transaction.id}/comments`).set('Authorization', parent).send({ body: 'Good choice' });

    const mine = await request(app).get('/api/family/comments').set('Authorization', child);
    expect(mine.status).toBe(200);
    expect(mine.body.comments).toHaveLength(1);
    expect(mine.body.comments[0]).toMatchObject({ body: 'Good choice', author: 'pp1', entry: { title: 'Lunch', amountPaise: 38000 } });

    // nobody else sees them, and you must be signed in
    expect((await request(app).get('/api/family/comments').set('Authorization', other)).body.comments).toEqual([]);
    expect((await request(app).get('/api/family/comments').set('Authorization', parent)).body.comments).toEqual([]);
    expect((await request(app).get('/api/family/comments')).status).toBe(401);
  });

  it('remembers the "share new entries" choice, on by default', async () => {
    const u = await signup('dd1');
    const me = async () => (await request(app).get('/api/users/me').set('Authorization', u)).body.user.prefs.shareNewEntries;
    expect(await me()).toBe(true);
    const r = await request(app).patch('/api/users/me/prefs').set('Authorization', u).send({ shareNewEntries: false });
    expect(r.status).toBe(200);
    expect(await me()).toBe(false);
    expect((await request(app).patch('/api/users/me/prefs').set('Authorization', u).send({ shareNewEntries: 'yes' })).status).toBe(400);
  });
});

describe('relatives of every kind', () => {
  type Person = { auth: string; id: string; name: string };
  let seq = 0;
  /** A fresh account with a chosen gender. */
  const person = async (name: string, gender: 'male' | 'female'): Promise<Person> => {
    const n = `${name}${seq++}`;
    const r = await request(app).post('/api/auth/register').send({ name: n, gender, dob: '1990-01-01', mobile: String(nextMobile++), pin: '4821' });
    return { auth: `Bearer ${r.body.accessToken}`, id: r.body.user.id, name: n };
  };
  /** `inviter` makes a code; `acceptor` enters it and says the inviter is their `relation`. */
  const connect = async (inviter: Person, acceptor: Person, relation?: string) => {
    const inv = await request(app).post('/api/family/invites').set('Authorization', inviter.auth).send({});
    const res = await request(app).post('/api/family/invites/accept').set('Authorization', acceptor.auth).send({ code: inv.body.code, ...(relation && { relation }) });
    return { res, code: inv.body.code as string };
  };
  const lists = async (p: Person) => (await request(app).get('/api/family').set('Authorization', p.auth)).body as {
    sharingWith: { user: { id: string }; relation: string; linkId: string }[]; following: { user: { id: string }; relation: string; linkId: string }[];
  };
  const seen = (l: { user: { id: string }; relation: string }[]) => Object.fromEntries(l.map((x) => [x.user.id, x.relation]));

  it('the elder sees the younger one: "my father" means he can see what I share', async () => {
    const me = await person('me', 'female'); const father = await person('father', 'male');
    expect((await connect(me, father, 'child')).res.status).toBe(201); // I made the code; he says I am his child
    const dad = await lists(father); const mine = await lists(me);
    expect(seen(dad.following)).toEqual({ [me.id]: 'Daughter' });
    expect(dad.sharingWith).toEqual([]);
    expect(seen(mine.sharingWith)).toEqual({ [father.id]: 'Father' });
    expect(mine.following).toEqual([]);
  });

  it('the other way round: the code owner is the elder', async () => {
    const mother = await person('mother', 'female'); const son = await person('son', 'male');
    expect((await connect(mother, son, 'parent')).res.status).toBe(201); // she made the code; he says she is his parent
    expect(seen((await lists(mother)).following)).toEqual({ [son.id]: 'Son' });
    expect(seen((await lists(son)).sharingWith)).toEqual({ [mother.id]: 'Mother' });
  });

  it('siblings, spouses and cousins see each other, and the names follow the gender', async () => {
    for (const [relation, male, female] of [['sibling', 'Brother', 'Sister'], ['spouse', 'Husband', 'Wife'], ['cousin', 'Cousin', 'Cousin']] as const) {
      const a = await person('a', 'male'); const b = await person('b', 'female');
      expect((await connect(a, b, relation)).res.status).toBe(201);
      const la = await lists(a); const lb = await lists(b);
      // both directions exist, each with the other's name for them
      expect(seen(la.following)).toEqual({ [b.id]: female });
      expect(seen(la.sharingWith)).toEqual({ [b.id]: female });
      expect(seen(lb.following)).toEqual({ [a.id]: male });
      expect(seen(lb.sharingWith)).toEqual({ [a.id]: male });
    }
  });

  it('grandparents and uncles or aunts are elders; grandchildren, nephews and nieces are younger', async () => {
    const gran = await person('gran', 'female'); const grandson = await person('grandson', 'male');
    await connect(gran, grandson, 'grandparent');
    expect(seen((await lists(gran)).following)).toEqual({ [grandson.id]: 'Grandson' });
    expect(seen((await lists(grandson)).sharingWith)).toEqual({ [gran.id]: 'Grandmother' });

    const niece = await person('niece', 'female'); const uncle = await person('uncle', 'male');
    await connect(niece, uncle, 'nephew_niece'); // I made the code, he says I am his niece
    expect(seen((await lists(uncle)).following)).toEqual({ [niece.id]: 'Niece' });
    expect(seen((await lists(niece)).sharingWith)).toEqual({ [uncle.id]: 'Uncle' });

    const kid = await person('kid', 'male'); const gp = await person('gp', 'male');
    await connect(kid, gp, 'grandchild'); // he says I am his grandchild
    expect(seen((await lists(gp)).following)).toEqual({ [kid.id]: 'Grandson' });
    expect(seen((await lists(kid)).sharingWith)).toEqual({ [gp.id]: 'Grandfather' });
  });

  it('a relative can read what is shared with them, and only that', async () => {
    const sis = await person('sis', 'female'); const bro = await person('bro', 'male');
    await connect(sis, bro, 'sibling');
    await tx(sis.auth, { amountPaise: 1000, title: 'sis shared', visibility: 'shared' });
    await tx(sis.auth, { amountPaise: 2000, title: 'sis private', visibility: 'private' });
    await tx(bro.auth, { amountPaise: 3000, title: 'bro shared', visibility: 'shared' });
    const titles = async (viewer: Person, owner: Person) =>
      (await request(app).get(`/api/family/people/${owner.id}/transactions`).set('Authorization', viewer.auth)).body.transactions?.map((t: { title: string }) => t.title) ?? null;
    expect(await titles(bro, sis)).toEqual(['sis shared']);
    expect(await titles(sis, bro)).toEqual(['bro shared']);
  });

  it('ending one direction leaves the other direction alone', async () => {
    const a = await person('a', 'male'); const b = await person('b', 'male');
    await connect(a, b, 'sibling');
    const mine = await lists(a);
    expect((await request(app).delete(`/api/family/links/${mine.sharingWith[0]!.linkId}`).set('Authorization', a.auth)).status).toBe(204); // b can no longer see me
    expect((await lists(a)).sharingWith).toEqual([]);
    expect(seen((await lists(a)).following)).toEqual({ [b.id]: 'Brother' }); // I still see b
  });

  it('only one link at a time between two people, in either direction, and the code is not wasted', async () => {
    const a = await person('a', 'male'); const b = await person('b', 'female');
    expect((await connect(a, b, 'sibling')).res.status).toBe(201);
    const second = await connect(a, b, 'spouse');
    expect(second.res.status).toBe(409);
    // the same code still works for someone else
    const c = await person('c', 'male');
    const r = await request(app).post('/api/family/invites/accept').set('Authorization', c.auth).send({ code: second.code, relation: 'cousin' });
    expect(r.status).toBe(201);
    // and a link in the opposite direction counts too
    const d = await person('d', 'male'); const e = await person('e', 'male');
    await connect(d, e, 'child');
    expect((await connect(e, d, 'child')).res.status).toBe(409);
  });

  it('the person entering a code must say how they are related, and only with a real kind', async () => {
    const a = await person('a', 'male'); const b = await person('b', 'male');
    const none = await connect(a, b);
    expect(none.res.status).toBe(400);
    expect(none.res.body.error.message).toMatch(/related/i);
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', b.auth).send({ code: none.code, relation: 'frenemy' })).status).toBe(400);
    // the code survived both failures
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', b.auth).send({ code: none.code, relation: 'sibling' })).status).toBe(201);
  });

  it('shows who made a code before connecting', async () => {
    const maker = await person('maker', 'female'); const other = await person('other', 'male');
    const inv = await request(app).post('/api/family/invites').set('Authorization', maker.auth).send({});
    const seeIt = (who: Person, code: string) => request(app).get(`/api/family/invites/${code}`).set('Authorization', who.auth);
    const ok = await seeIt(other, inv.body.code.toLowerCase());
    expect(ok.status).toBe(200);
    expect(ok.body.person).toMatchObject({ id: maker.id, name: maker.name, gender: 'female' });
    expect((await seeIt(maker, inv.body.code)).status).toBe(400);  // your own code
    expect((await seeIt(other, 'ZZZZZZ')).status).toBe(400);       // no such code
    expect((await request(app).get(`/api/family/invites/${inv.body.code}`)).status).toBe(401);
    // looking does not use the code up
    expect((await request(app).post('/api/family/invites/accept').set('Authorization', other.auth).send({ code: inv.body.code, relation: 'sibling' })).status).toBe(201);
    expect((await seeIt(await person('late', 'male'), inv.body.code)).status).toBe(400); // now used
  });

  it('codes made before relationships existed still connect, as parent and child', async () => {
    const { Invitation } = await import('./family.models.js');
    const kidP = await person('oldkid', 'male'); const parentP = await person('oldparent', 'female');
    await Invitation.create({ code: 'OLDKID', inviter: kidP.id, inviterRole: 'child', expiresAt: new Date(Date.now() + 60_000) });
    const r = await request(app).post('/api/family/invites/accept').set('Authorization', parentP.auth).send({ code: 'OLDKID' });
    expect(r.status).toBe(201);
    expect(seen((await lists(parentP)).following)).toEqual({ [kidP.id]: 'Son' });
    expect(seen((await lists(kidP)).sharingWith)).toEqual({ [parentP.id]: 'Mother' });
  });
});

