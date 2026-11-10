/**
 * Ways two people in a family can be related, as shown when connecting. The kinds are gender-neutral on the server;
 * the words (Father or Mother, Brother or Sister...) follow the gender of the person being described.
 * Keep this list in step with server/src/modules/family/relations.ts.
 */
export type Relation = 'parent' | 'child' | 'sibling' | 'spouse' | 'grandparent' | 'grandchild' | 'uncle_aunt' | 'nephew_niece' | 'cousin' | 'other';

const OPTIONS: { value: Relation; male: string; female: string }[] = [
  { value: 'parent', male: 'Father', female: 'Mother' },
  { value: 'child', male: 'Son', female: 'Daughter' },
  { value: 'sibling', male: 'Brother', female: 'Sister' },
  { value: 'spouse', male: 'Husband', female: 'Wife' },
  { value: 'grandparent', male: 'Grandfather', female: 'Grandmother' },
  { value: 'grandchild', male: 'Grandson', female: 'Granddaughter' },
  { value: 'uncle_aunt', male: 'Uncle', female: 'Aunt' },
  { value: 'nephew_niece', male: 'Nephew', female: 'Niece' },
  { value: 'cousin', male: 'Cousin', female: 'Cousin' },
  { value: 'other', male: 'Other family member', female: 'Other family member' },
];

/** The choices for "who is this person to you?", worded for their gender. */
export const relationOptions = (gender: string | undefined) =>
  OPTIONS.map((o) => ({ value: o.value, label: gender === 'female' ? o.female : o.male }));

/** Who can see whose shared entries, from the point of view of the person entering the code. */
export function direction(relation: Relation): 'they-see-you' | 'you-see-them' | 'both' {
  if (relation === 'parent' || relation === 'grandparent' || relation === 'uncle_aunt') return 'they-see-you';
  if (relation === 'child' || relation === 'grandchild' || relation === 'nephew_niece') return 'you-see-them';
  return 'both';
}

/** One plain sentence saying what the choice means for sharing. */
export function directionText(relation: Relation, firstName: string): string {
  switch (direction(relation)) {
    case 'they-see-you': return `${firstName} will see the entries you choose to share. You won’t see theirs.`;
    case 'you-see-them': return `You will see the entries ${firstName} chooses to share. They won’t see yours.`;
    default: return `You will each see the entries the other chooses to share.`;
  }
}
