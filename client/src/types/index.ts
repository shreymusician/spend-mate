export interface User {
  id: string;
  name: string;
  mobile: string;
  gender: 'male' | 'female';
  avatarUrl: string | null;
  isMinor: boolean;
  prefs: { theme: 'dark' | 'light' | 'system'; tone: 'playful' | 'neutral'; pushEnabled: boolean };
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

export interface FamilyLink { linkId: string; user: { id: string; name: string; avatarUrl: string | null } }
export interface FamilyLinks { parents: FamilyLink[]; children: FamilyLink[] }
export interface Comment { id: string; body: string; at: string; author: string; mine: boolean }

/** A parent's view of one child: shared entries only. */
export interface ChildOverview {
  linkId: string;
  user: { id: string; name: string; avatarUrl: string | null };
  incomePaise: number;
  expensePaise: number;
  balancePaise: number;
  latest: Transaction[];
}
export interface FamilyOverview {
  month: string;
  children: ChildOverview[];
  totals: { incomePaise: number; expensePaise: number };
  feed: (Transaction & { child: { id: string; name: string; avatarUrl: string | null } })[];
}
