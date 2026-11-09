import { ChevronRight, Copy, Share2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransactionDetail } from '@/components/finance/TransactionDetail';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useData } from '@/contexts/DataContext';
import { useFetch, usePoll } from '@/hooks';
import { api, ApiError } from '@/lib/api';
import { currentMonth } from '@/lib/dates';
import { formatPaise } from '@/lib/utils';
import type { FamilyOverview, Transaction } from '@/types';

type Role = 'parent' | 'child';

export function FamilyPage() {
  const { family, reloadFamily, bump, version } = useData();
  const toast = useToast();
  const nav = useNavigate();
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState<'shared' | 'private' | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const tick = usePoll(15_000);
  const ov = useFetch<FamilyOverview>(family.children.length > 0 ? `/family/overview?month=${currentMonth()}` : null, [tick, version, family.children.length]);

  async function makeInvite(role: Role) {
    try { setInvite(await api('/family/invites', { method: 'POST', json: { role } })); }
    catch { toast('Couldn’t make a code. Please try again.'); }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true); setCodeError('');
    try {
      await api('/family/invites/accept', { method: 'POST', json: { code } });
      setCode(''); await reloadFamily(); toast('Connected');
    } catch (err) { setCodeError(err instanceof ApiError ? err.message : 'Couldn’t connect. Please try again.'); }
    finally { setBusy(false); }
  }

  async function unlink(linkId: string) {
    try { await api(`/family/links/${linkId}`, { method: 'DELETE' }); setConfirmUnlink(null); await reloadFamily(); toast('Sharing stopped'); }
    catch { toast('Couldn’t do that. Please try again.'); }
  }

  async function setAll(visibility: 'shared' | 'private') {
    try {
      const r = await api<{ updated: number }>('/family/sharing', { method: 'POST', json: { visibility } });
      setConfirmAll(null); bump(); toast(`${r.updated} ${r.updated === 1 ? 'entry' : 'entries'} updated`);
    } catch { toast('Couldn’t do that. Please try again.'); }
  }

  const names = family.parents.map((p) => p.user.name).join(' & ');

  return (
    <div className="space-y-4">
      <PageTitle sub="Share your spending with a parent, or follow someone else’s.">Family</PageTitle>

      {family.children.length > 0 && (
        <div className="space-y-3">
          <CardTitle>People you follow</CardTitle>
          {family.children.map((link) => {
            const c = ov.data?.children.find((x) => x.linkId === link.linkId);
            const first = link.user.name.split(' ')[0];
            return (
              <Card key={link.linkId} className="space-y-3 overflow-hidden">
                <button type="button" onClick={() => nav(`/family/${link.user.id}`)} className="flex min-h-14 w-full items-center gap-3 text-left">
                  <Avatar name={link.user.name} src={link.user.avatarUrl} size={48} />
                  <span className="flex-1 truncate text-[19px] font-bold tracking-[-0.02em]">{link.user.name}</span>
                  <ChevronRight size={22} className="text-muted" aria-hidden />
                </button>

                {!c ? <Skeleton className="h-16 w-full" /> : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-[14px] bg-surface-2 p-3"><p className="text-[13px] text-muted">Spent this month</p><p className="text-[19px] font-bold tabular-nums text-neg">{formatPaise(c.expensePaise)}</p></div>
                    <div className="rounded-[14px] bg-surface-2 p-3"><p className="text-[13px] text-muted">Received this month</p><p className="text-[19px] font-bold tabular-nums text-pos">{formatPaise(c.incomePaise)}</p></div>
                  </div>
                )}

                {c && (c.latest.length === 0
                  ? <p className="text-[15px] text-muted">{first} hasn’t shared any entries yet. {first} chooses which entries to show you.</p>
                  : (
                    <div className="-mx-5 border-t border-line">
                      <p className="px-5 pb-0 pt-3 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Latest</p>
                      {c.latest.map((t, i) => <TransactionRow key={t.id} t={t} index={i} onClick={() => setSelected(t)} />)}
                    </div>
                  ))}

                <div className="flex items-center justify-between border-t border-line pt-1">
                  <Button variant="link" onClick={() => nav(`/family/${link.user.id}`)}>See all entries</Button>
                  {confirmUnlink === link.linkId
                    ? <span className="flex gap-2"><Button variant="danger" onClick={() => unlink(link.linkId)}>Yes, stop</Button><Button variant="secondary" onClick={() => setConfirmUnlink(null)}>Cancel</Button></span>
                    : <Button variant="link" onClick={() => setConfirmUnlink(link.linkId)} className="text-muted">Stop following</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {family.parents.length > 0 && (
        <Card className="space-y-3">
          <CardTitle>Who can see your entries</CardTitle>
          {family.parents.map((p) => (
            <div key={p.linkId} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[18px] font-semibold">{p.user.name}</span>
              {confirmUnlink === p.linkId
                ? <span className="flex gap-2"><Button variant="danger" onClick={() => unlink(p.linkId)}>Yes, stop</Button><Button variant="secondary" onClick={() => setConfirmUnlink(null)}>Cancel</Button></span>
                : <Button variant="link" onClick={() => setConfirmUnlink(p.linkId)}>Stop sharing</Button>}
            </div>
          ))}
          <p className="text-muted">{names} can only <strong>view</strong> entries you choose to show them. They can’t change anything. You pick this on each entry.</p>
          {confirmAll ? (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="mb-2 font-medium">{confirmAll === 'shared' ? `Show all your past entries to ${names}?` : `Hide all your past entries from ${names}?`}</p>
              <div className="grid grid-cols-2 gap-2"><Button onClick={() => setAll(confirmAll)}>Yes</Button><Button variant="secondary" onClick={() => setConfirmAll(null)}>Cancel</Button></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirmAll('shared')} className="h-auto min-h-14 py-2 text-[16px]">Show all past entries</Button>
              <Button variant="secondary" onClick={() => setConfirmAll('private')} className="h-auto min-h-14 py-2 text-[16px]">Hide all past entries</Button>
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <CardTitle>Connect with someone</CardTitle>
        <p className="text-muted">Make a code and give it to them, or type in a code they gave you.</p>
        <div className="grid gap-2">
          <Button onClick={() => makeInvite('child')}>I’m a child: invite my parent</Button>
          <Button variant="secondary" onClick={() => makeInvite('parent')}>I’m a parent: invite my child</Button>
        </div>
        <form onSubmit={join} className="space-y-2 border-t border-line pt-3" noValidate>
          <Field label="I have a code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} error={codeError} autoCapitalize="characters" maxLength={12} />
          <Button type="submit" block variant="secondary" disabled={busy || !code.trim()}>Connect</Button>
        </form>
      </Card>

      <TransactionDetail t={selected} onClose={() => setSelected(null)} readOnly />

      <Sheet open={!!invite} onClose={() => setInvite(null)} title="Your code">
        {invite && <InviteCode code={invite.code} expiresAt={invite.expiresAt} />}
      </Sheet>
    </div>
  );
}

function InviteCode({ code, expiresAt }: { code: string; expiresAt: string }) {
  const toast = useToast();
  const text = `Join me on SpendMate. Open the app, go to Family, and enter this code: ${code}`;
  const days = Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
  return (
    <div className="space-y-4 text-center">
      <p className="rounded-2xl bg-surface-2 py-5 text-[40px] font-bold tracking-[0.25em]" aria-label={`Code ${code.split('').join(' ')}`}>{code}</p>
      <p className="text-muted">Tell them to open SpendMate, tap <strong>Family</strong>, and type this code. It works once and expires in {days} days.</p>
      <div className="grid gap-2">
        <Button onClick={async () => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Couldn’t copy. Please read the code out instead.'); } }}><Copy size={20} aria-hidden />Copy message</Button>
        {typeof navigator.share === 'function' && <Button variant="secondary" onClick={() => navigator.share({ text }).catch(() => {})}><Share2 size={20} aria-hidden />Send…</Button>}
      </div>
    </div>
  );
}
