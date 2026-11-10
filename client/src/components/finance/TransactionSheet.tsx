import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { TextArea } from '@/components/ui/TextArea';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { api, ApiError } from '@/lib/api';
import { iconFor, METHOD_LABEL, SOURCE_LABEL } from '@/lib/categories';
import { toLocalInput } from '@/lib/dates';
import { paiseToInput, rupeesToPaise } from '@/lib/money';
import { cn, newId } from '@/lib/utils';
import { INCOME_SOURCES, PAYMENT_METHODS, type IncomeSource, type PaymentMethod, type Transaction } from '@/types';

type Kind = 'expense' | 'income';

interface Props {
  open: boolean;
  onClose: () => void;
  kind?: Kind;
  /** When set, the sheet edits this entry instead of creating one. */
  editing?: Transaction | null;
}

/**
 * Adding an entry should take a few seconds: type the amount, tap a category, Save.
 * Everything else (reason, how it was paid, date, tags) is tucked under "More options". This form is purely personal:
 * who may see an entry is decided in the Family tab, never here.
 */
export function TransactionSheet({ open, onClose, kind = 'expense', editing }: Props) {
  const { categories, family, bump } = useData();
  const { user } = useAuth();
  const toast = useToast();
  // New entries follow the "share new entries" choice made in the Family tab (and only matter once a parent is linked).
  const shareByDefault = family.sharingWith.length > 0 && user?.prefs.shareNewEntries !== false;

  const blank = () => ({
    amount: '', title: '', reason: '', category: 'food', source: 'pocket_money' as IncomeSource,
    method: 'upi' as PaymentMethod, merchant: '', tags: '', when: toLocalInput(new Date()),
  });
  const [f, setF] = useState(blank());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const clientId = useRef('');
  const isExpense = (editing?.type ?? kind) === 'expense';

  // Reset whenever the sheet opens. A fresh clientId per open means a double-tap can't save twice.
  useEffect(() => {
    if (!open) return;
    clientId.current = newId();
    setErrors({});
    setMore(!!editing); // editing shows every field; adding starts minimal
    if (editing) {
      setF({
        amount: paiseToInput(editing.amountPaise), title: editing.title, reason: editing.reason, category: editing.category,
        source: editing.source ?? 'other', method: editing.paymentMethod, merchant: editing.merchant ?? '',
        tags: editing.tags.join(', '), when: toLocalInput(new Date(editing.occurredAt)),
      });
    } else setF(blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    const paise = rupeesToPaise(f.amount);
    if (!paise || paise <= 0) errs.amount = 'Please enter an amount, like 250 or 250.50';
    if (new Date(f.when).getTime() > Date.now() + 60_000) errs.when = 'That date is in the future';
    setErrors(errs);
    if (errs.when) setMore(true);
    if (Object.keys(errs).length) return;

    // The name is optional: when left empty, the category (or source) is used, so the list still reads well.
    const fallback = isExpense ? categories.find((c) => c.id === f.category)?.name ?? 'Spending' : SOURCE_LABEL[f.source] ?? 'Money received';
    const body = {
      amountPaise: paise,
      title: f.title.trim() || fallback,
      reason: f.reason.trim(),
      paymentMethod: f.method,
      merchant: f.merchant.trim(),
      tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
      occurredAt: new Date(f.when).toISOString(),
      ...(isExpense ? { category: f.category } : { source: f.source }),
    };
    setBusy(true);
    try {
      if (editing) await api(`/transactions/${editing.id}`, { method: 'PATCH', json: body });
      else await api('/transactions', { method: 'POST', json: { type: isExpense ? 'expense' : 'income', clientId: clientId.current, visibility: shareByDefault ? 'shared' : 'private', ...body } });
      bump();
      toast(editing ? 'Changes saved' : isExpense ? 'Spending saved' : 'Money received saved');
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Couldn’t reach the server. Nothing was lost — please try again.' });
    } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit entry' : isExpense ? 'Add spending' : 'Add money received'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Amount (₹)" inputMode="decimal" placeholder="250" value={f.amount} onChange={(e) => set('amount', e.target.value)} error={errors.amount} autoFocus />

        {isExpense ? (
          <div>
            <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Category</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const Icon = iconFor(c.icon);
                return <Chip key={c.id} active={f.category === c.id} onClick={() => set('category', c.id)}><Icon size={16} aria-hidden />{c.name}</Chip>;
              })}
            </div>
          </div>
        ) : (
          <Select label="Source" value={f.source} onChange={(v) => set('source', v as IncomeSource)} options={INCOME_SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s]! }))} />
        )}

        <Field label={isExpense ? 'What was it for? (optional)' : 'Who gave it? (optional)'} value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={80} />

        <div>
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
            className="flex min-h-11 w-full items-center justify-between rounded-[14px] px-1 text-[16px] font-medium text-accent">
            More options
            <ChevronDown size={20} aria-hidden className={cn('transition-transform duration-300', more && 'rotate-180')} />
          </button>
          {more && (
            <div className="mt-2 space-y-4">
              <TextArea label={isExpense ? 'Why did you spend it?' : 'Note'} value={f.reason} onChange={(e) => set('reason', e.target.value)} maxLength={500} />
              <Select label="Paid by" value={f.method} onChange={(v) => set('method', v as PaymentMethod)} options={PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m]! }))} />
              <Field label="Date and time" type="datetime-local" value={f.when} onChange={(e) => set('when', e.target.value)} error={errors.when} />
              <Field label="Shop or person" value={f.merchant} onChange={(e) => set('merchant', e.target.value)} maxLength={60} />
              <Field label="Tags" hint="Separate with commas" value={f.tags} onChange={(e) => set('tags', e.target.value)} />
            </div>
          )}
        </div>

        {errors.form && <p role="alert" className="font-medium text-neg">{errors.form}</p>}
        <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-line bg-surface px-5 pb-5 pt-3">
          <Button type="submit" block disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Sheet>
  );
}
