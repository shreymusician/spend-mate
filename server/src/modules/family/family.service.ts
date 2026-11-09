import { randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { audit } from '../audit/audit.model.js';
import { monthlySummary } from '../analytics/analytics.js';
import { Transaction } from '../transactions/transaction.model.js';
import { listTransactions } from '../transactions/transactions.service.js';
import { listQuerySchema } from '../transactions/transactions.validators.js';
import { User } from '../users/user.model.js';
import { Comment, Invitation, Relationship } from './family.models.js';

// No 0/O/1/I/L so codes can be read out over the phone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_TTL_MS = 3 * 86_400_000;
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export type Role = 'parent' | 'child';

export async function createInvite(userId: string, inviterRole: Role) {
  for (let i = 0; i < 5; i++) {
    try {
      const inv = await Invitation.create({ code: makeCode(), inviter: userId, inviterRole, expiresAt: new Date(Date.now() + INVITE_TTL_MS) });
      return { code: inv.code, expiresAt: inv.expiresAt };
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e; // code collision: try another
    }
  }
  throw new Error('Could not generate an invite code');
}

export async function acceptInvite(userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  // Claim atomically so one code can't be used by two people.
  const inv = await Invitation.findOneAndUpdate(
    { code, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date(), usedBy: userId },
    { returnDocument: 'before' },
  );
  if (!inv) throw badRequest('That code isn’t valid or has expired. Ask for a new one.');
  if (String(inv.inviter) === userId) {
    await Invitation.updateOne({ _id: inv._id }, { $unset: { usedAt: 1, usedBy: 1 } });
    throw badRequest('That’s your own code. Share it with the other person.');
  }

  const parent = inv.inviterRole === 'parent' ? String(inv.inviter) : userId;
  const child = inv.inviterRole === 'child' ? String(inv.inviter) : userId;

  // A failed attempt must not burn the code: put it back so it can still be used.
  const release = () => Invitation.updateOne({ _id: inv._id }, { $unset: { usedAt: 1, usedBy: 1 } });

  const existing = await Relationship.findOne({ parent, child });
  if (existing?.status === 'active') { await release(); throw conflict('You’re already linked'); }
  let link;
  try {
    link = existing
      ? await Relationship.findOneAndUpdate({ _id: existing._id }, { status: 'active', createdBy: inv.inviterRole, $unset: { revokedAt: 1, revokedBy: 1 } }, { returnDocument: 'after' })
      : await Relationship.create({ parent, child, createdBy: inv.inviterRole });
  } catch (e) {
    await release();
    if ((e as { code?: number }).code === 11000) throw conflict('You’re already linked'); // two accepts at the same moment
    throw e;
  }
  await audit(userId, 'relationship', link!._id, 'create', undefined, { parent, child });
  return { linkId: String(link!._id) };
}

export async function listLinks(userId: string) {
  const links = await Relationship.find({ status: 'active', $or: [{ parent: userId }, { child: userId }] });
  const ids = links.map((l) => (String(l.parent) === userId ? l.child : l.parent));
  const users = await User.find({ _id: { $in: ids } });
  const person = (id: unknown) => {
    const u = users.find((x) => String(x._id) === String(id));
    return { id: String(id), name: u?.name ?? 'Unknown', avatarUrl: u?.avatarUrl ?? null };
  };
  return {
    parents: links.filter((l) => String(l.child) === userId).map((l) => ({ linkId: String(l._id), user: person(l.parent) })),
    children: links.filter((l) => String(l.parent) === userId).map((l) => ({ linkId: String(l._id), user: person(l.child) })),
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
  await audit(userId, 'relationship', link._id, 'delete', { parent: String(link.parent), child: String(link.child) });
}

/** Throws "not found" unless `parentId` is an active parent of `childId` (no hint that the child exists). */
export async function assertParentOf(parentId: string, childId: string) {
  if (!Types.ObjectId.isValid(childId) || !(await Relationship.exists({ parent: parentId, child: childId, status: 'active' }))) {
    throw notFound('Not found');
  }
}

/** Child controls what's shared: flip every existing entry at once. */
export async function setAllVisibility(userId: string, visibility: 'shared' | 'private') {
  const r = await Transaction.updateMany({ user: userId, deletedAt: null }, { visibility });
  await audit(userId, 'sharing', new Types.ObjectId(userId), 'update', undefined, { visibility, count: r.modifiedCount });
  return { updated: r.modifiedCount };
}

/** A transaction is visible to its owner, or to an active parent when it is shared. */
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
  return { id: String(c._id) };
}

/**
 * Everything a parent's Home and Family screens need in one call: for every child, this month's totals and the
 * latest entries, plus one combined "latest from your children" feed. Shared entries only, never budgets.
 */
export async function familyOverview(parentId: string, month: string) {
  const links = await Relationship.find({ parent: parentId, status: 'active' }).sort({ createdAt: 1 });
  const users = await User.find({ _id: { $in: links.map((l) => l.child) } });
  const children = await Promise.all(links.map(async (l) => {
    const childId = String(l.child);
    const u = users.find((x) => String(x._id) === childId);
    const [sum, recent] = await Promise.all([
      monthlySummary(childId, month, new Date(), { sharedOnly: true }),
      listTransactions(childId, listQuerySchema.parse({ limit: 3 }), { sharedOnly: true }),
    ]);
    return {
      linkId: String(l._id),
      user: { id: childId, name: u?.name ?? 'Unknown', avatarUrl: u?.avatarUrl ?? null },
      incomePaise: sum.incomePaise,
      expensePaise: sum.expensePaise,
      balancePaise: sum.balancePaise,
      latest: recent.transactions,
    };
  }));
  const feed = children
    .flatMap((c) => c.latest.map((t) => ({ ...t, child: { id: c.user.id, name: c.user.name, avatarUrl: c.user.avatarUrl } })))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 8);
  return {
    month,
    children,
    totals: { incomePaise: children.reduce((n, c) => n + c.incomePaise, 0), expensePaise: children.reduce((n, c) => n + c.expensePaise, 0) },
    feed,
  };
}
