import { MessageCircleHeart } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useFetch } from '@/hooks';
import { dayLabel } from '@/lib/dates';

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
