import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { TransactionSheet } from '@/components/finance/TransactionSheet';
import { Amount } from '@/components/ui/Amount';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useData } from '@/contexts/DataContext';
import { api } from '@/lib/api';
import { findCategory, METHOD_LABEL, SOURCE_LABEL } from '@/lib/categories';
import type { Comment, Transaction } from '@/types';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

interface Props {
  t: Transaction | null;
  onClose: () => void;
  /** A parent looking at a child's entry: no edit/delete, but can leave comments. */
  readOnly?: boolean;
}

export function TransactionDetail({ t, onClose, readOnly }: Props) {
  const { categories, bump } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [shown, setShown] = useState<Transaction | null>(t);

  // Keep the last entry rendered while the sheet slides away.
  useEffect(() => { if (t) { setShown(t); setConfirm(false); } }, [t]);

  if (!shown) return null;
  const cat = findCategory(categories, shown.category);

  async function remove() {
    try { await api(`/transactions/${shown!.id}`, { method: 'DELETE' }); bump(); toast('Deleted'); onClose(); }
    catch { toast('Couldn’t delete. Please try again.'); }
  }

  const rows: [string, string][] = [
    shown.type === 'income' ? ['From', SOURCE_LABEL[shown.source ?? 'other']!] : ['Category', cat.name],
    ['Paid by', METHOD_LABEL[shown.paymentMethod]!],
    ['Date', when(shown.occurredAt)],
    ...(shown.merchant ? [['Shop or person', shown.merchant] as [string, string]] : []),
    ...(shown.tags.length ? [['Tags', shown.tags.join(', ')] as [string, string]] : []),
    ...(!readOnly ? [['Who can see it', shown.visibility === 'shared' ? 'You and your family' : 'Only you'] as [string, string]] : []),
  ];

  return (
    <>
      <Sheet open={!!t && !editing} onClose={onClose} title={shown.title}>
        <Amount paise={shown.amountPaise} kind={shown.type} className="text-4xl font-bold" />
        {shown.reason && (
          <div className="mt-4 rounded-xl bg-surface-2 p-4">
            <p className="text-[15px] font-semibold text-muted">Reason</p>
            <p>{shown.reason}</p>
          </div>
        )}
        <dl className="mt-3 divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>

        {(readOnly || shown.visibility === 'shared') && <Comments txId={shown.id} canWrite={!!readOnly} />}

        {!readOnly && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            {confirm ? <Button variant="danger" onClick={remove}>Yes, delete</Button> : <Button variant="danger" onClick={() => setConfirm(true)}>Delete</Button>}
          </div>
        )}
      </Sheet>
      {!readOnly && <TransactionSheet open={editing} editing={shown} onClose={() => { setEditing(false); onClose(); }} />}
    </>
  );
}

function Comments({ txId, canWrite }: { txId: string; canWrite: boolean }) {
  const [list, setList] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setList((await api<{ comments: Comment[] }>(`/family/transactions/${txId}/comments`)).comments); } catch { setList([]); }
  }, [txId]);
  const { version } = useData();
  useEffect(() => { load(); }, [load, version]); // version changes when the server says something moved

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setError('');
    try { await api(`/family/transactions/${txId}/comments`, { method: 'POST', json: { body: text.trim() } }); setText(''); await load(); }
    catch { setError('Couldn’t send. Please try again.'); }
    finally { setBusy(false); }
  }

  if (!canWrite && list.length === 0) return null;
  return (
    <section className="mt-4" aria-label="Comments">
      <h3 className="mb-2 text-[15px] font-semibold text-muted">Comments</h3>
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id} className="rounded-xl bg-surface-2 p-3">
            <p className="text-sm text-muted">{c.author} · {when(c.at)}</p>
            <p>{c.body}</p>
          </li>
        ))}
      </ul>
      {canWrite && (
        <form onSubmit={send} className="mt-3 space-y-2">
          <Field label="Add a comment" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} error={error} />
          <Button type="submit" block variant="secondary" disabled={busy || !text.trim()}>Send comment</Button>
        </form>
      )}
    </section>
  );
}
