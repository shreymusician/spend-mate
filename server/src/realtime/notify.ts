import { Relationship } from '../modules/family/family.models.js';
import { publish } from './hub.js';

/** Who can see me, and whom I can see, right now. */
async function linked(userId: string) {
  const rows = await Relationship.find({ status: 'active', $or: [{ parent: userId }, { child: userId }] });
  const viewers = rows.filter((r) => String(r.child) === userId && !r.paused).map((r) => String(r.parent));
  const following = rows.filter((r) => String(r.parent) === userId).map((r) => String(r.child));
  return { viewers, following };
}

const safe = (p: Promise<void>) => { p.catch(() => { /* a failed nudge must never break the request */ }); };

/**
 * An entry was added, changed or deleted. People who can see me are nudged only when the entry is (or just stopped being)
 * shared, so a private entry never even causes a blip on anyone else's phone.
 */
export function transactionChanged(ownerId: string, o: { shared: boolean; txId: string }) {
  publish([ownerId], { type: 'update', topics: ['transactions'], txId: o.txId });
  if (!o.shared) return;
  safe((async () => { publish((await linked(ownerId)).viewers, { type: 'update', topics: ['transactions'], txId: o.txId }); })());
}

/** "Show all / hide all", or a change in what is shared. */
export function sharingChanged(ownerId: string) {
  publish([ownerId], { type: 'update', topics: ['transactions'] });
  safe((async () => { publish((await linked(ownerId)).viewers, { type: 'update', topics: ['transactions'] }); })());
}

/** Two people were linked or unlinked. */
export function linkChanged(a: string, b: string) {
  publish([a, b], { type: 'update', topics: ['family', 'transactions'] });
}

/** A family member commented on a shared entry. */
export function commentAdded(ownerId: string, authorId: string, txId: string) {
  publish([ownerId, authorId], { type: 'update', topics: ['comments'], txId });
}

/** A name or photo changed: everyone linked to this person should see it. */
export function profileChanged(userId: string) {
  publish([userId], { type: 'update', topics: ['family'] });
  safe((async () => { const l = await linked(userId); publish([...l.viewers, ...l.following], { type: 'update', topics: ['family'] }); })());
}
