/**
 * How two people in a family are related, and what that means for who can see whose shared entries.
 *
 * A relationship is picked as "this person is my ___". Each kind has an opposite (parent and child, grandparent and
 * grandchild, uncle/aunt and nephew/niece); brothers, sisters, spouses, cousins and "other" are the same both ways.
 * The kinds are gender-neutral; the words people see (Father or Mother, Brother or Sister...) come from the other
 * person's gender.
 *
 * Who can view whom:
 *  - an elder (parent, grandparent, uncle or aunt) can view the younger one's shared entries,
 *  - peers (sibling, spouse, cousin, other) can view each other's shared entries.
 * Viewing is always read-only, and the person being viewed still chooses what is shared.
 */
export const RELATIONS = ['parent', 'child', 'sibling', 'spouse', 'grandparent', 'grandchild', 'uncle_aunt', 'nephew_niece', 'cousin', 'other'] as const;
export type Relation = (typeof RELATIONS)[number];

export const INVERSE: Record<Relation, Relation> = {
  parent: 'child', child: 'parent',
  grandparent: 'grandchild', grandchild: 'grandparent',
  uncle_aunt: 'nephew_niece', nephew_niece: 'uncle_aunt',
  sibling: 'sibling', spouse: 'spouse', cousin: 'cousin', other: 'other',
};

const LABEL: Record<Relation, [male: string, female: string]> = {
  parent: ['Father', 'Mother'],
  child: ['Son', 'Daughter'],
  sibling: ['Brother', 'Sister'],
  spouse: ['Husband', 'Wife'],
  grandparent: ['Grandfather', 'Grandmother'],
  grandchild: ['Grandson', 'Granddaughter'],
  uncle_aunt: ['Uncle', 'Aunt'],
  nephew_niece: ['Nephew', 'Niece'],
  cousin: ['Cousin', 'Cousin'],
  other: ['Family member', 'Family member'],
};

/** "Father" / "Mother" for someone who is a `relation` to me, given their gender. */
export const relationLabel = (relation: Relation, gender: string | undefined) => LABEL[relation][gender === 'female' ? 1 : 0];

const ELDERS: Relation[] = ['parent', 'grandparent', 'uncle_aunt'];
const YOUNGERS: Relation[] = ['child', 'grandchild', 'nephew_niece'];

/** What a stored link says the *viewer* is to the *owner* (an elder kind or a peer kind). */
export type ViewerKind = 'parent' | 'grandparent' | 'uncle_aunt' | 'sibling' | 'spouse' | 'cousin' | 'other';

export interface LinkPlan { viewer: string; owner: string; kind: ViewerKind }

/**
 * `inviter` shared a code and `acceptor` entered it, saying the inviter is their `relation`.
 * Returns the view-links to create: one for elder/younger pairs, two for peers.
 */
export function plan(inviter: string, acceptor: string, relation: Relation): LinkPlan[] {
  if (ELDERS.includes(relation)) return [{ viewer: inviter, owner: acceptor, kind: relation as ViewerKind }]; // the inviter is the elder
  if (YOUNGERS.includes(relation)) return [{ viewer: acceptor, owner: inviter, kind: INVERSE[relation] as ViewerKind }]; // the acceptor is the elder
  return [
    { viewer: inviter, owner: acceptor, kind: relation as ViewerKind },
    { viewer: acceptor, owner: inviter, kind: relation as ViewerKind },
  ];
}

/** From the acceptor's side: if the other person is my elder they will see what I share, if younger I will see theirs. */
export function direction(relation: Relation): 'they-see-you' | 'you-see-them' | 'both' {
  if (ELDERS.includes(relation)) return 'they-see-you';
  if (YOUNGERS.includes(relation)) return 'you-see-them';
  return 'both';
}
