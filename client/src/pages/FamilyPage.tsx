import { Copy, Share2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Access } from '@/components/family/Access';
import { FamilyTree } from '@/components/family/FamilyTree';
import { FamilyComments } from '@/components/family/Sharing';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useData } from '@/contexts/DataContext';
import { useFetch, usePoll } from '@/hooks';
import { api, ApiError } from '@/lib/api';
import { currentMonth } from '@/lib/dates';
import { directionText, relationOptions, type Relation } from '@/lib/relations';
import type { FamilyOverview } from '@/types';

/** Someone's code, looked up: who made it. */
interface CodePerson { id: string; name: string; avatarUrl: string | null; gender: string }

/** Everything about family lives here: connecting, the family tree, and who can see your entries. */
export function FamilyPage() {
  const { family, reloadFamily, bump, version, live } = useData();
  const toast = useToast();
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<CodePerson | null>(null);
  const [relation, setRelation] = useState<Relation | ''>('');
  const [connectError, setConnectError] = useState('');
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

  // This month's spending of the people you follow: shown under their photo in the tree.
  const spent: Record<string, number> = Object.fromEntries((ov.data?.people ?? []).map((p) => [p.user.id, p.expensePaise]));
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

      <FamilyTree spent={spent} />

      <Access />

      {family.sharingWith.length > 0 && <FamilyComments />}

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
