export interface User {
  id: string;
  name: string;
  mobile: string;
  gender: 'male' | 'female';
  avatarUrl: string | null;
  isMinor: boolean;
  prefs: { theme: 'dark' | 'light' | 'system'; tone: 'playful' | 'neutral'; pushEnabled: boolean; shareNewEntries?: boolean };
}

/** This phone or computer, as the server detected it. */
export interface Device { label: string; remembered: boolean }

export interface SessionResponse {
  accessToken: string;
  user: User;
  device: Device;
}

export const PAYMENT_METHODS = ['upi', 'cash', 'card', 'netbanking', 'wallet', 'other'] as const;
export const INCOME_SOURCES = ['pocket_money', 'parents', 'salary', 'scholarship', 'freelance', 'refund', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type IncomeSource = (typeof INCOME_SOURCES)[number];

export interface Category { id: string; name: string; icon: string; color: string; custom: boolean }

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amountPaise: number;
  title: string;
  reason: string;
  category: string;
  source: IncomeSource | null;
  paymentMethod: PaymentMethod;
  merchant: string | null;
  tags: string[];
  occurredAt: string;
  visibility: 'private' | 'shared';
}

export interface BudgetRow { id: string; category: string | null; limitPaise: number; spentPaise: number }

export interface Summary {
  month: string;
  incomePaise: number;
  expensePaise: number;
  balancePaise: number;
  previousMonth: { month: string; incomePaise: number; expensePaise: number };
  byCategory: { category: string; totalPaise: number; count: number }[];
  daily: { date: string; expensePaise: number }[];
  last7Days: { date: string; expensePaise: number }[];
  budgets: BudgetRow[];
}

export interface TrendPoint { month: string; incomePaise: number; expensePaise: number }

/** A connection. `relation` is what that person is to you: Father, Sister, Husband... */
export interface FamilyLink {
  linkId: string;
  /** The word for what they are to you: Father, Sister, Husband... */
  relation: string;
  /** The same thing as a kind (parent, sibling, spouse...), which decides where they sit in the family tree. */
  kind: string;
  /** The person being viewed has switched this viewer's access off (the connection itself stays). */
  paused: boolean;
  user: { id: string; name: string; avatarUrl: string | null };
}
/** `sharingWith`: people who can see what you share. `following`: people whose shared entries you can see. */
export interface FamilyLinks { sharingWith: FamilyLink[]; following: FamilyLink[] }

/** A note a family member wrote on a shared entry. */
export interface Comment { id: string; body: string; at: string; author: string; mine: boolean }

/** Someone you follow, with this month's totals from the entries they share. */
export interface PersonOverview {
  linkId: string;
  relation: string;
  user: { id: string; name: string; avatarUrl: string | null };
  incomePaise: number;
  expensePaise: number;
  balancePaise: number;
  latest: Transaction[];
}
export interface FamilyOverview { month: string; people: PersonOverview[] }
