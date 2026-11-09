import {
  Bed, Bus, CircleEllipsis, Clapperboard, GraduationCap, HeartPulse, Plane, ShoppingBag, Smartphone, Tag, User, Utensils, Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '@/types';

const icons: Record<string, LucideIcon> = {
  utensils: Utensils, bus: Bus, 'graduation-cap': GraduationCap, 'shopping-bag': ShoppingBag, clapperboard: Clapperboard,
  'heart-pulse': HeartPulse, plane: Plane, bed: Bed, smartphone: Smartphone, user: User, 'circle-ellipsis': CircleEllipsis, tag: Tag,
};

export const iconFor = (name: string): LucideIcon => icons[name] ?? Tag;
export const incomeIcon = Wallet;

export const SOURCE_LABEL: Record<string, string> = {
  pocket_money: 'Pocket money', parents: 'From family', salary: 'Salary', scholarship: 'Scholarship',
  freelance: 'Freelance', refund: 'Refund', other: 'Other',
};
export const METHOD_LABEL: Record<string, string> = { upi: 'UPI', cash: 'Cash', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', other: 'Other' };

export const findCategory = (cats: Category[], id: string): Category =>
  cats.find((c) => c.id === id) ?? { id, name: 'Other', icon: 'circle-ellipsis', color: '#9ca3af', custom: false };
