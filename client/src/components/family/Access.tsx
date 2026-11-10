import { motion } from 'framer-motion';
import { useState } from 'react';
import { ShareNewEntries } from '@/components/family/Sharing';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useData } from '@/contexts/DataContext';
import { api } from '@/lib/api';

/**
 * Who can see your entries, one switch per person. Switching someone off pauses what they see straight away (they see
 * nothing of yours) without ending the connection; switch them back on and everything you share is visible again.
 */
export function Access() {
  const { family, reloadFamily, bump } = useData();
  const toast = useToast();
  // Flips on screen at once; goes back if saving fails.
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState<'shared' | 'private' | null>(null);
  const people = family.sharingWith;
  const names = people.map((p) => p.user.name.split(' ')[0]).join(' & ');

  async function setAccess(linkId: string, allowed: boolean, name: string) {
    setLocal((s) => ({ ...s, [linkId]: allowed }));
    try {
      await api(`/family/links/${linkId}`, { method: 'PATCH', json: { access: allowed } });
      await reloadFamily();
      toast(allowed ? `${name} can see your entries again` : `${name} can no longer see your entries`);
    } catch {
      toast('Couldn’t change that. Please try again.');
    } finally {
      setLocal((s) => { const { [linkId]: _drop, ...rest } = s; return rest; });
    }
  }

  async function remove(linkId: string) {
    try { await api(`/family/links/${linkId}`, { method: 'DELETE' }); setConfirmRemove(null); await reloadFamily(); toast('Sharing stopped'); }
    catch { toast('Couldn’t do that. Please try again.'); }
  }

  async function setAll(visibility: 'shared' | 'private') {
    try {
      const r = await api<{ updated: number }>('/family/sharing', { method: 'POST', json: { visibility } });
      setConfirmAll(null); bump(); toast(`${r.updated} ${r.updated === 1 ? 'entry' : 'entries'} updated`);
    } catch { toast('Couldn’t do that. Please try again.'); }
  }

  return (
    <div className="space-y-3">
      <CardTitle>Access</CardTitle>
      {people.length === 0 ? (
        <Card><p className="text-muted">Nobody can see your entries yet. When someone connects with you in a way that lets them see your entries, they will appear here with a switch.</p></Card>
      ) : (
        <>
          <Card className="divide-y divide-line p-0">
            {people.map((p, i) => {
              const allowed = local[p.linkId] ?? !p.paused;
              const first = p.user.name.split(' ')[0]!;
              return (
                <motion.div key={p.linkId} className="px-4 py-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.user.name} src={p.user.avatarUrl} size={46} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[17px] font-semibold leading-tight">{p.user.name}</p>
                      <p className="text-[13px] font-semibold leading-tight text-accent">{p.relation}</p>
                      <p className="mt-0.5 text-[13px] leading-tight text-muted">{allowed ? 'Can see what you share' : 'Paused: sees nothing'}</p>
                    </div>
                    <Toggle checked={allowed} onChange={(v) => setAccess(p.linkId, v, first)} label={`Let ${p.user.name} see my entries`} />
                  </div>
                  <div className="mt-1 flex justify-end">
                    {confirmRemove === p.linkId
                      ? <span className="flex gap-2"><Button variant="danger" onClick={() => remove(p.linkId)}>Yes, remove</Button><Button variant="secondary" onClick={() => setConfirmRemove(null)}>Cancel</Button></span>
                      : <Button variant="link" onClick={() => setConfirmRemove(p.linkId)} className="min-h-9 text-[14px] text-muted">Remove {first}’s access for good</Button>}
                  </div>
                </motion.div>
              );
            })}
          </Card>

          <ShareNewEntries />

          <Card className="space-y-3">
            <p className="text-muted">{names} can only <strong>view</strong> the entries you share. They can’t change anything.</p>
            {confirmAll ? (
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="mb-2 font-medium">{confirmAll === 'shared' ? `Share all your past entries with ${names}?` : `Hide all your past entries from ${names}?`}</p>
                <div className="grid grid-cols-2 gap-2"><Button onClick={() => setAll(confirmAll)}>Yes</Button><Button variant="secondary" onClick={() => setConfirmAll(null)}>Cancel</Button></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setConfirmAll('shared')} className="h-auto min-h-14 py-2 text-[16px]">Show all past entries</Button>
                <Button variant="secondary" onClick={() => setConfirmAll('private')} className="h-auto min-h-14 py-2 text-[16px]">Hide all past entries</Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
