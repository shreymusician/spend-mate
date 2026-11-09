import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useData } from '@/contexts/DataContext';
import { api, ApiError } from '@/lib/api';
import { monthLabel } from '@/lib/dates';
import { rupeesToPaise } from '@/lib/money';
import { formatPaise } from '@/lib/utils';
import type { BudgetRow } from '@/types';

interface Props { open: boolean; onClose: () => void; month: string; budgets: BudgetRow[] }

export function BudgetSheet({ open, onClose, month, budgets }: Props) {
  const { categories, bump } = useData();
  const toast = useToast();
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    const paise = rupeesToPaise(amount);
    if (!paise) return setError('Please enter a limit, like 5000');
    setBusy(true); setError('');
    try {
      await api('/budgets', { method: 'PUT', json: { month, category: category || null, limitPaise: paise } });
      setAmount(''); bump(); toast('Budget saved');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Couldn’t save. Please try again.'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    try { await api(`/budgets/${id}`, { method: 'DELETE' }); bump(); } catch { setError('Couldn’t remove that. Please try again.'); }
  }

  const nameOf = (id: string | null) => (id ? categories.find((c) => c.id === id)?.name ?? 'Category' : 'Whole month');

  return (
    <Sheet open={open} onClose={onClose} title={`Budget · ${monthLabel(month)}`}>
      <p className="mb-4 text-muted">A budget is the most you plan to spend. Only you can see your budgets.</p>
      <form onSubmit={save} className="space-y-4" noValidate>
        <Select label="Budget for" value={category} onChange={setCategory}
          options={[{ value: '', label: 'The whole month' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        <Field label="Limit (₹)" inputMode="decimal" placeholder="5000" value={amount} onChange={(e) => setAmount(e.target.value)} error={error} />
        <Button type="submit" block disabled={busy}>{busy ? 'Saving…' : 'Save budget'}</Button>
      </form>
      {budgets.length > 0 && (
        <ul className="mt-5 divide-y divide-line">
          {budgets.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3">
              <span>{nameOf(b.category)} · <span className="font-semibold">{formatPaise(b.limitPaise)}</span></span>
              <Button variant="link" onClick={() => remove(b.id)} className="text-neg">Remove</Button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
