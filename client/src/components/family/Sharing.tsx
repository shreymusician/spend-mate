import { MessageCircleHeart } from 'lucide-react';
import { useState } from 'react';
import { Amount } from '@/components/ui/Amount';
import { Card, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useFetch } from '@/hooks';
import { api } from '@/lib/api';
import { dayLabel } from '@/lib/dates';
import type { Transaction } from '@/types';

/* Everything about who sees your money lives here, in the Family tab. Home, History and the entry forms stay purely personal. */

/** The default for new entries: shown to family, or kept private until you choose. */
export function ShareNewEntries() {
  const { user, updatePrefs } = useAuth();
  const toast = useToast();
  if (!user) return null;
  return (
    <Switch
      label="Share new entries"
      checked={user.prefs.shareNewEntries !== false}
      onChange={(v) => { updatePrefs({ shareNewEntries: v }).catch(() => toast('Couldn’t save that. Please try again.')); }}
    />
  );
}

/** Your latest entries with a switch on each: choose, one by one, what family can see. */
export function EntryVisibility() {
  const { version } = useData();
  const toast = useToast();
  const list = useFetch<{ transactions: Transaction[] }>('/transactions?limit=30', [version]);
  // Flips instantly on screen, and goes back if saving fails.
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const rows = list.data?.transactions ?? [];

  async function set(t: Transaction, shared: boolean) {
    setLocal((s) => ({ ...s, [t.id]: shared }));
    try { await api(`/transactions/${t.id}`, { method: 'PATCH', json: { visibility: shared ? 'shared' : 'private' } }); }
    catch { setLocal((s) => ({ ...s, [t.id]: !shared })); toast('Couldn’t change that. Please try again.'); }
  }

  if (list.data && rows.length === 0) return null;
  return (
    <div>
      <CardTitle>Choose what family sees</CardTitle>
      <Card className="divide-y divide-line p-0">
        {!list.data && <p className="px-4 py-6 text-center text-muted">Loading…</p>}
        {rows.map((t) => {
          const on = local[t.id] ?? t.visibility === 'shared';
          return (
            <div key={t.id} className="flex min-h-[64px] items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{t.title}</span>
                <span className="block text-[13px] text-muted">{dayLabel(t.occurredAt)} · <Amount paise={t.amountPaise} kind={t.type} className="font-semibold" /></span>
              </span>
              <Toggle checked={on} onChange={(v) => set(t, v)} label={`Show “${t.title}” to family`} />
            </div>
          );
        })}
      </Card>
    </div>
  );
}

interface FamilyComment { id: string; body: string; at: string; author: string; entry: { id: string; title: string; amountPaise: number; type: 'income' | 'expense' } }

/** What parents have written on your entries. */
export function FamilyComments() {
  const { version } = useData();
  const list = useFetch<{ comments: FamilyComment[] }>('/family/comments', [version]);
  const comments = list.data?.comments ?? [];
  if (comments.length === 0) return null;
  return (
    <div>
      <CardTitle>Comments from family</CardTitle>
      <Card className="divide-y divide-line p-0">
        {comments.map((c) => (
          <div key={c.id} className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-[13px] text-muted"><MessageCircleHeart size={14} aria-hidden />{c.author} on “{c.entry.title}” · {dayLabel(c.at)}</p>
            <p className="mt-0.5 text-[16px]">{c.body}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}
