import { ChevronRight, Copy, Share2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FamilyComments, ShareNewEntries } from '@/components/family/Sharing';
import { TransactionDetail } from '@/components/finance/TransactionDetail';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useData } from '@/contexts/DataContext';
import { useFetch, usePoll } from '@/hooks';
import { api, ApiError } from '@/lib/api';
import { currentMonth } from '@/lib/dates';
import { directionText, relationOptions, type Relation } from '@/lib/relations';
import { formatPaise } from '@/lib/utils';
import type { FamilyOverview, Transaction } from '@/types';

/** Someone's code, looked up: who made it. */
interface CodePerson { id: string; name: string; avatarUrl: string | null; gender: string }

/** Everything about family lives here: who you follow, who can see you, what you share, and connecting. */
export function FamilyPage() {
  const { family, reloadFamily, bump, version, live } = useData();
  const toast = useToast();
  const nav = useNavigate();
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<CodePerson | null>(null);
  const [relation, setRelation] = useState<Relation | ''>('');
  const [connectError, setConnectError] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState<'shared' | 'private' | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const tick = usePoll(live ? 90_000 : 15_000);
  const ov = useFetch<FamilyOverview>(family.following.length > 0 ? `/family/overview?month=${currentMonth()}` : null, [tick, version, family.following.length]);

  async function makeInvite() {
    try { setInvite(await api('/family/invites', { method: 'POST', json: {} })); }
    catch { toast('Couldn’t make a code. Please try again.'); }
  }

  /** Step 1 of connecting: look the code up, so the person can see who it belongs to. */
  async function lookUp(e: FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true); setCodeError('');
    try {
      const r = await api<{ person: CodePerson }>(`/family/invites/${encodeURIComponent(code.trim())}`);
      setFound(r.person); setRelation(''); setConnectError('');
    } catch (err) { setCodeError(err instanceof ApiError ? err.message : 'Couldn’t check that code. Please try again.'); }
    finally { setBusy(false); }
  }

  /** Step 2: say how you are related, and connect. */
  async function connect() {
    if (busy || !found || !relation) return;
    setBusy(true); setConnectError('');
    try {
      const r = await api<{ relation: string }>('/family/invites/accept', { method: 'POST', json: { code, relation } });
      setFound(null); setCode(''); await reloadFamily(); bump();
      toast(`Connected. ${found.name.split(' ')[0]} is your ${r.relation}`);
    } catch (err) { setConnectError(err instanceof ApiError ? err.message : 'Couldn’t connect. Please try again.'); }
    finally { setBusy(false); }
  }

  async function unlink(linkId: string, message: string) {
    try { await api(`/family/links/${linkId}`, { method: 'DELETE' }); setConfirmUnlink(null); await reloadFamily(); toast(message); }
    catch { toast('Couldn’t do that. Please try again.'); }
  }

  async function setAll(visibility: 'shared' | 'private') {
    try {
      const r = await api<{ updated: number }>('/family/sharing', { method: 'POST', json: { visibility } });
      setConfirmAll(null); bump(); toast(`${r.updated} ${r.updated === 1 ? 'entry' : 'entries'} updated`);
    } catch { toast('Couldn’t do that. Please try again.'); }
  }

  const names = family.sharingWith.map((p) => p.user.name).join(' & ');
  const foundFirst = found?.name.split(' ')[0] ?? '';

  return (
    <div className="space-y-4">
      <PageTitle sub="Connect with your family. Share your spending, or follow theirs.">Family</PageTitle>

      <Card className="space-y-3">
        <CardTitle>Connect with a family member</CardTitle>
        <p className="text-muted">Make a code and give it to them, or type in a code they gave you. You’ll choose how you’re related.</p>
        <Button onClick={makeInvite}>Make a code</Button>
        <form onSubmit={lookUp} className="space-y-2 border-t border-line pt-3" noValidate>
          <Field label="I have a code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(''); }} error={codeError} autoCapitalize="characters" maxLength={12} />
          <Button type="submit" block variant="secondary" disabled={busy || !code.trim()}>Continue</Button>
        </form>
      </Card>

      {family.following.length > 0 && (
        <div className="space-y-3">
          <CardTitle>People you follow</CardTitle>
          {family.following.map((link) => {
            const c = ov.data?.people.find((x) => x.linkId === link.linkId);
            const first = link.user.name.split(' ')[0];
            return (
              <Card key={link.linkId} className="space-y-3 overflow-hidden">
                <button type="button" onClick={() => nav(`/family/${link.user.id}`)} className="flex min-h-14 w-full items-center gap-3 text-left">
                  <Avatar name={link.user.name} src={link.user.avatarUrl} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[19px] font-bold tracking-[-0.02em]">{link.user.name}</span>
                    <span className="block text-[14px] font-semibold text-accent">{link.relation}</span>
                  </span>
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
                    ? <span className="flex gap-2"><Button variant="danger" onClick={() => unlink(link.linkId, 'Stopped following')}>Yes, stop</Button><Button variant="secondary" onClick={() => setConfirmUnlink(null)}>Cancel</Button></span>
                    : <Button variant="link" onClick={() => setConfirmUnlink(link.linkId)} className="text-muted">Stop following</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {family.sharingWith.length > 0 && (
        <Card className="space-y-3">
          <CardTitle>Who can see your entries</CardTitle>
          {family.sharingWith.map((p) => (
            <div key={p.linkId} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={p.user.name} src={p.user.avatarUrl} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-semibold">{p.user.name}</span>
                  <span className="block text-[13px] font-semibold text-accent">{p.relation}</span>
                </span>
              </span>
              {confirmUnlink === p.linkId
                ? <span className="flex gap-2"><Button variant="danger" onClick={() => unlink(p.linkId, 'Sharing stopped')}>Yes, stop</Button><Button variant="secondary" onClick={() => setConfirmUnlink(null)}>Cancel</Button></span>
                : <Button variant="link" onClick={() => setConfirmUnlink(p.linkId)}>Stop sharing</Button>}
            </div>
          ))}
          <p className="text-muted">{names} can only <strong>view</strong> entries you choose to show them. They can’t change anything.</p>
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

      {family.sharingWith.length > 0 && (
        <>
          <ShareNewEntries />
          <FamilyComments />
        </>
      )}

      <TransactionDetail t={selected} onClose={() => setSelected(null)} readOnly />

      <Sheet open={!!invite} onClose={() => setInvite(null)} title="Your code">
        {invite && <InviteCode code={invite.code} expiresAt={invite.expiresAt} />}
      </Sheet>

      <Sheet open={!!found} onClose={() => setFound(null)} title="Connect">
        {found && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={found.name} src={found.avatarUrl} size={56} />
              <div className="min-w-0">
                <p className="truncate text-[20px] font-bold tracking-[-0.02em]">{found.name}</p>
                <p className="text-muted">made this code</p>
              </div>
            </div>
            <Select label={`${foundFirst} is my…`} value={relation} onChange={(v) => setRelation(v as Relation)} options={relationOptions(found.gender)} placeholder="Choose how you are related" />
            {relation && <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[15px] leading-snug">{directionText(relation, foundFirst)}</p>}
            {connectError && <p role="alert" className="font-medium text-neg">{connectError}</p>}
            <Button block disabled={!relation || busy} onClick={connect}>{busy ? 'Connecting…' : 'Connect'}</Button>
          </div>
        )}
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
      <p className="text-muted">Tell them to open SpendMate, tap <strong>Family</strong>, and type this code. They’ll choose how they’re related to you. It works once and expires in {days} days.</p>
      <div className="grid gap-2">
        <Button onClick={async () => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Couldn’t copy. Please read the code out instead.'); } }}><Copy size={20} aria-hidden />Copy message</Button>
        {typeof navigator.share === 'function' && <Button variant="secondary" onClick={() => navigator.share({ text }).catch(() => {})}><Share2 size={20} aria-hidden />Send…</Button>}
      </div>
    </div>
  );
}
