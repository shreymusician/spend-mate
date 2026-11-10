import { Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { PinPad } from '@/components/ui/PinPad';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useData } from '@/contexts/DataContext';
import { clearFetchCache } from '@/hooks';
import { api, apiFile, ApiError } from '@/lib/api';

type Format = 'csv' | 'json';

/** Hands a file to the browser as a download. */
function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Profile section: download a copy of everything you have recorded, or clear it all (after typing your Secret Pin). */
export function YourData() {
  const toast = useToast();
  const { bump } = useData();
  const [busy, setBusy] = useState<Format | null>(null);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [clearing, setClearing] = useState(false);

  async function download(format: Format) {
    if (busy) return;
    setBusy(format);
    try {
      const { blob, filename } = await apiFile(`/users/me/export?format=${format}`);
      saveFile(blob, filename);
      toast(`Downloaded ${filename}`);
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Couldn’t download. Please try again.'); }
    finally { setBusy(null); }
  }

  function close() { if (!clearing) { setOpen(false); setPin(''); setPinError(''); } }

  async function clearAll() {
    if (pin.length !== 4 || clearing) return;
    setClearing(true); setPinError('');
    try {
      await api('/users/me/clear-data', { method: 'POST', json: { pin } });
      clearFetchCache(); bump();
      setOpen(false); setPin('');
      toast('All your data was cleared');
    } catch (e) {
      setPinError(e instanceof ApiError ? e.message : 'Couldn’t clear your data. Please try again.');
      setPin('');
    } finally { setClearing(false); }
  }

  return (
    <div>
      <CardTitle>Your data</CardTitle>
      <Card className="space-y-3">
        <p className="text-[15px] text-muted">Download a copy of what you have recorded, or clear it all.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={!!busy} onClick={() => download('csv')} className="h-auto min-h-[56px] flex-col gap-0.5 py-2 text-[15px]">
            <FileSpreadsheet size={20} aria-hidden />{busy === 'csv' ? 'Preparing…' : 'Spreadsheet'}
          </Button>
          <Button variant="secondary" disabled={!!busy} onClick={() => download('json')} className="h-auto min-h-[56px] flex-col gap-0.5 py-2 text-[15px]">
            <Download size={20} aria-hidden />{busy === 'json' ? 'Preparing…' : 'Full copy'}
          </Button>
        </div>
        <p className="text-[13px] leading-snug text-muted">The spreadsheet (.csv) opens in Excel or Google Sheets. The full copy (.json) also has your budgets, categories and family details.</p>
        <Button variant="danger" block onClick={() => setOpen(true)}><Trash2 size={18} aria-hidden />Clear all my data</Button>
      </Card>

      <Sheet open={open} onClose={close} title="Clear all my data">
        <div className="space-y-4">
          <div className="rounded-2xl bg-neg/10 px-4 py-3 text-[15px] leading-snug">
            <p className="font-semibold text-neg">This can’t be undone.</p>
            <p className="mt-1">It permanently deletes all your entries, your budgets, your own categories, and the comments on your entries.</p>
            <p className="mt-1 text-muted">Your account, photo, settings, Secret Pin and family connections stay.</p>
          </div>
          <Button variant="secondary" block disabled={!!busy} onClick={() => download('json')}><Download size={18} aria-hidden />{busy === 'json' ? 'Preparing…' : 'Download a copy first'}</Button>
          <div>
            <p className="mb-2 text-center text-[16px] font-semibold">Enter your Secret Pin to confirm</p>
            <PinPad label="Secret Pin" value={pin} onChange={(v) => { setPin(v); setPinError(''); }} error={pinError} disabled={clearing} />
          </div>
          {/* Stays in view at the bottom of the sheet, so it is never hidden below the keypad. */}
          <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-line bg-bg px-5 pb-5 pt-3">
            <Button variant="danger" block disabled={pin.length !== 4 || clearing} onClick={clearAll}>{clearing ? 'Clearing…' : 'Clear everything'}</Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
