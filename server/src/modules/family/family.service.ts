import { randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { commentAdded, linkChanged, sharingChanged } from '../../realtime/notify.js';
import { audit } from '../audit/audit.model.js';
import { monthlySummary } from '../analytics/analytics.js';
import { Transaction } from '../transactions/transaction.model.js';
import { listTransactions } from '../transactions/transactions.service.js';
import { listQuerySchema } from '../transactions/transactions.validators.js';
import { User } from '../users/user.model.js';
import { Comment, Invitation, Relationship } from './family.models.js';
import { INVERSE, plan, relationLabel, type Relation } from './relations.js';

// No 0/O/1/I/L so codes can be read out over the phone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_TTL_MS = 3 * 86_400_000;
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export async function createInvite(userId: string) {
  for (let i = 0; i < 5; i++) {
    try {
      const inv = await Invitation.create({ code: makeCode(), inviter: userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) });
      return { code: inv.code, expiresAt: inv.expiresAt };
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e; // code collision: try another
    }
  }
  throw new Error('Could not generate an invite code');
}

const BAD_CODE = 'That code isn’t valid or has expired. Ask for a new one.';

/** Who made this code? Lets the person entering it see a name and photo, and choose how they are related, before connecting. */
export async function previewInvite(userId: string, rawCode: string) {
  const inv = await Invitation.findOne({ code: rawCode.trim().toUpperCase(), usedAt: null, expiresAt: { $gt: new Date() } });
  if (!inv) throw badRequest(BAD_CODE);
  if (String(inv.inviter) === userId) throw badRequest('That’s your own code. Share it with the other person.');
  const u = await User.findById(inv.inviter);
  if (!u) throw badRequest(BAD_CODE);
  return { person: { id: String(u._id), name: u.name, avatarUrl: u.avatarUrl ?? null, gender: u.gender } };
}

/**
 * `userId` typed in a code and said the code's owner is their `relation` (a father, a sister, a spouse...).
 * That decides who can view whom: see relations.ts.
 */
export async function acceptInvite(userId: string, rawCode: string, relationInput?: Relation) {
  const code = rawCode.trim().toUpperCase();
  // Claim atomically so one code can't be used by two people.
  const inv = await Invitation.findOneAndUpdate(
    { code, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date(), usedBy: userId },
    { returnDocument: 'before' },
  );
  if (!inv) throw badRequest(BAD_CODE);
  // A failed attempt must not burn the code: put it back so it can still be used.
  const release = () => Invitation.updateOne({ _id: inv._id }, { $unset: { usedAt: 1, usedBy: 1 } });
  const inviter = String(inv.inviter);
  if (inviter === userId) { await release(); throw badRequest('That’s your own code. Share it with the other person.'); }

  // Codes made before relationships existed said whether the inviter was the parent or the child.
  const relation = relationInput ?? (inv.inviterRole as Relation | undefined);
  if (!relation) { await release(); throw badRequest('Please choose how you are related.'); }

  // To change how two people are linked, they unlink first: one link at a time between the same two people.
  const already = await Relationship.exists({ status: 'active', $or: [{ parent: inviter, child: userId }, { parent: userId, child: inviter }] });
  if (already) { await release(); throw conflict('You’re already linked'); }

  const docs = [];
  try {
    for (const l of plan(inviter, userId, relation)) {
      docs.push(await Relationship.findOneAndUpdate(
        { parent: l.viewer, child: l.owner },
        { $set: { status: 'active', rel: l.kind, createdBy: l.viewer === inviter ? 'parent' : 'child' }, $unset: { revokedAt: 1, revokedBy: 1 } },
        { upsert: true, returnDocument: 'after' },
      ));
    }
  } catch (e) {
    await release();
    if ((e as { code?: number }).code === 11000) throw conflict('You’re already linked'); // two accepts at the same moment
    throw e;
  }
  for (const d of docs) await audit(userId, 'relationship', d!._id, 'create', undefined, { viewer: String(d!.parent), owner: String(d!.child), kind: d!.rel });
  linkChanged(inviter, userId);
  const them = await User.findById(inviter);
  return { linkId: String(docs[0]!._id), person: { id: inviter, name: them?.name ?? 'Unknown' }, relation: relationLabel(relation, them?.gender) };
}

/**
 * My connections, in two lists: the people who can see what I share, and the people whose shared entries I can see.
 * A brother or spouse appears in both. Each has the word for what they are to me (Father, Sister, Husband...).
 */
export async function listLinks(userId: string) {
  const links = await Relationship.find({ status: 'active', $or: [{ parent: userId }, { child: userId }] });
  const ids = links.map((l) => (String(l.parent) === userId ? l.child : l.parent));
  const users = await User.find({ _id: { $in: ids } });
  const find = (id: unknown) => users.find((x) => String(x._id) === String(id));
  const person = (id: unknown) => {
    const u = find(id);
    return { id: String(id), name: u?.name ?? 'Unknown', avatarUrl: u?.avatarUrl ?? null };
  };
  return {
    // they view me: `rel` is what they are to me
    sharingWith: links.filter((l) => String(l.child) === userId).map((l) => ({ linkId: String(l._id), user: person(l.parent), relation: relationLabel((l.rel ?? 'parent') as Relation, find(l.parent)?.gender) })),
    // I view them: `rel` is what I am to them, so what they are to me is the opposite
    following: links.filter((l) => String(l.parent) === userId).map((l) => ({ linkId: String(l._id), user: person(l.child), relation: relationLabel(INVERSE[(l.rel ?? 'parent') as Relation], find(l.child)?.gender) })),
  };
}

export async function removeLink(userId: string, linkId: string) {
  if (!Types.ObjectId.isValid(linkId)) throw notFound();
  const link = await Relationship.findOneAndUpdate(
    { _id: linkId, status: 'active', $or: [{ parent: userId }, { child: userId }] },
    { status: 'revoked', revokedAt: new Date(), revokedBy: userId },
    { returnDocument: 'after' },
  );
  if (!link) throw notFound('Link not found');
  await audit(userId, 'relationship', link._id, 'delete', { viewer: String(link.parent), owner: String(link.child) });
  linkChanged(String(link.parent), String(link.child));
}

/** Throws "not found" unless `viewerId` may view `ownerId`'s shared entries (no hint that the person exists). */
export async function assertViewerOf(viewerId: string, ownerId: string) {
  if (!Types.ObjectId.isValid(ownerId) || !(await Relationship.exists({ parent: viewerId, child: ownerId, status: 'active' }))) {
    throw notFound('Not found');
  }
}

/** You control what's shared: flip every existing entry at once. */
export async function setAllVisibility(userId: string, visibility: 'shared' | 'private') {
  const r = await Transaction.updateMany({ user: userId, deletedAt: null }, { visibility });
  await audit(userId, 'sharing', new Types.ObjectId(userId), 'update', undefined, { visibility, count: r.modifiedCount });
  sharingChanged(userId);
  return { updated: r.modifiedCount };
}

/** A transaction is visible to its owner, or to someone allowed to view them when it is shared. */
async function viewableTransaction(userId: string, txId: string) {
  if (!Types.ObjectId.isValid(txId)) throw notFound();
  const tx = await Transaction.findOne({ _id: txId, deletedAt: null });
  if (!tx) throw notFound();
  if (String(tx.user) === userId) return { tx, isOwner: true };
  if (tx.visibility === 'shared' && (await Relationship.exists({ parent: userId, child: tx.user, status: 'active' }))) return { tx, isOwner: false };
  throw notFound();
}

export async function listComments(userId: string, txId: string) {
  const { tx } = await viewableTransaction(userId, txId);
  const rows = await Comment.find({ transaction: tx._id }).sort({ createdAt: 1 }).limit(100);
  const authors = await User.find({ _id: { $in: rows.map((r) => r.author) } });
  return rows.map((r) => ({
    id: String(r._id),
    body: r.body,
    at: r.createdAt,
    author: authors.find((a) => String(a._id) === String(r.author))?.name ?? 'Unknown',
    mine: String(r.author) === userId,
  }));
}

/** Only a linked parent can comment, and only on entries the child chose to share. */
export async function addComment(userId: string, txId: string, body: string) {
  const { tx, isOwner } = await viewableTransaction(userId, txId);
  if (isOwner) throw badRequest('Only a parent can comment on an entry');
  const c = await Comment.create({ transaction: tx._id, author: userId, body });
  commentAdded(String(tx.user), userId, String(tx._id));
  return { id: String(c._id) };
}

/**
 * Everything a parent's Home and Family screens need in one call: for every child, this month's totals and the
 * latest entries, plus one combined "latest from your children" feed. Shared entries only, never budgets.
 */
export async function familyOverview(viewerId: string, month: string) {
  const links = await Relationship.find({ parent: viewerId, status: 'active' }).sort({ createdAt: 1 });
  const users = await User.find({ _id: { $in: links.map((l) => l.child) } });
  const people = await Promise.all(links.map(async (l) => {
    const personId = String(l.child);
    const u = users.find((x) => String(x._id) === personId);
    const [sum, recent] = await Promise.all([
      monthlySummary(personId, month, new Date(), { sharedOnly: true }),
      listTransactions(personId, listQuerySchema.parse({ limit: 3 }), { sharedOnly: true }),
    ]);
    return {
      linkId: String(l._id),
      user: { id: personId, name: u?.name ?? 'Unknown', avatarUrl: u?.avatarUrl ?? null },
      // what they are to me: the opposite of what I am to them
      relation: relationLabel(INVERSE[(l.rel ?? 'parent') as Relation], u?.gender),
      incomePaise: sum.incomePaise,
      expensePaise: sum.expensePaise,
      balancePaise: sum.balancePaise,
      latest: recent.transactions,
    };
  }));
  return { month, people };
}

/** What family have written on my entries, newest first: for the Family tab, so entry screens stay personal. */
export async function commentsOnMine(userId: string) {
  const mine = await Transaction.find({ user: userId, deletedAt: null }).sort({ occurredAt: -1 }).limit(300).select('title amountPaise type');
  if (mine.length === 0) return [];
  const byId = new Map(mine.map((t) => [String(t._id), t]));
  const rows = await Comment.find({ transaction: { $in: mine.map((t) => t._id) } }).sort({ createdAt: -1 }).limit(20);
  const authors = await User.find({ _id: { $in: rows.map((r) => r.author) } });
  return rows.map((r) => {
    const t = byId.get(String(r.transaction))!;
    return {
      id: String(r._id),
      body: r.body,
      at: r.createdAt,
      author: authors.find((a) => String(a._id) === String(r.author))?.name ?? 'Unknown',
      entry: { id: String(t._id), title: t.title, amountPaise: t.amountPaise, type: t.type },
    };
  });
}
