import { Camera, Moon, Smartphone, Sun } from 'lucide-react';
import { useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { YourData } from '@/components/profile/YourData';
import { Card, CardTitle } from '@/components/ui/Card';
import { PageTitle } from '@/components/ui/PageTitle';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { photoToAvatar } from '@/lib/image';
import type { User } from '@/types';

const GENDER_LABEL: Record<User['gender'], string> = { male: 'Male', female: 'Female' };

export function ProfilePage() {
  const { user, device, updatePrefs, setAvatar, logout } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  if (!user) return null;

  const save = async (p: Partial<User['prefs']>) => {
    setErr('');
    try { await updatePrefs(p); } catch { setErr('Couldn’t save that. Please try again.'); }
  };

  async function pick(file: File | undefined) {
    if (!file) return;
    setPhotoErr(''); setPhotoBusy(true);
    try { await setAvatar(await photoToAvatar(file)); toast('Photo updated'); }
    catch (e) { setPhotoErr(e instanceof Error ? e.message : 'Couldn’t save that photo. Please try again.'); }
    finally { setPhotoBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function removePhoto() {
    setPhotoErr(''); setPhotoBusy(true);
    try { await setAvatar(null); toast('Photo removed'); }
    catch { setPhotoErr('Couldn’t remove the photo. Please try again.'); }
    finally { setPhotoBusy(false); }
  }

  return (
    <div className="space-y-5">
      <PageTitle>Profile</PageTitle>

      <Card className="space-y-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy} aria-label={user.avatarUrl ? 'Change profile photo' : 'Add a profile photo'} className="relative shrink-0 rounded-full">
            <Avatar name={user.name} src={user.avatarUrl} size={88} />
            <span className="brand-gradient absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full border-[3px] border-surface text-white dark:border-surface-2"><Camera size={15} aria-hidden /></span>
            {photoBusy && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-[12px] font-semibold text-white">Saving…</span>}
          </button>
          <div className="min-w-0">
            <p className="truncate text-[22px] font-bold tracking-[-0.02em]">{user.name}</p>
            <p className="text-muted tabular-nums">+91 {user.mobile.slice(0, 5)} {user.mobile.slice(5)}</p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div className="flex gap-2">
          <Button variant="secondary" block disabled={photoBusy} onClick={() => fileRef.current?.click()}>{user.avatarUrl ? 'Change photo' : 'Add photo'}</Button>
          {user.avatarUrl && <Button variant="secondary" block disabled={photoBusy} onClick={removePhoto}>Remove photo</Button>}
        </div>
        {photoErr && <p role="alert" className="text-neg">{photoErr}</p>}
      </Card>

      <div>
        <CardTitle>Details</CardTitle>
        <Card className="divide-y divide-line p-0">
          <div className="flex items-center justify-between px-4 py-3.5"><span className="text-muted">Mobile number</span><span className="font-medium tabular-nums">{user.mobile}</span></div>
          <div className="flex items-center justify-between px-4 py-3.5"><span className="text-muted">Gender</span><span className="font-medium">{GENDER_LABEL[user.gender]}</span></div>
        </Card>
      </div>

      <div>
        <CardTitle>Appearance</CardTitle>
        <Card className="space-y-3">
          <Segmented label="Appearance" value={user.prefs.theme} onChange={(theme) => save({ theme })}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Auto' }]} />
          <p className="flex items-center gap-2 text-[14px] text-muted">
            {user.prefs.theme === 'dark' ? <Moon size={16} aria-hidden /> : user.prefs.theme === 'light' ? <Sun size={16} aria-hidden /> : <Smartphone size={16} aria-hidden />}
            {user.prefs.theme === 'system' ? 'Matches your phone’s setting.' : `Always ${user.prefs.theme}.`}
          </p>
          {err && <p role="alert" className="text-neg">{err}</p>}
        </Card>
      </div>

      <YourData />

      {device && (
        <div>
          <CardTitle>This device</CardTitle>
          <Card className="space-y-1">
            <p className="flex items-center gap-2 font-medium"><Smartphone size={18} aria-hidden />{device.label}</p>
            <p className="text-[14px] text-muted">
              {device.remembered ? 'Remembered. Opening SpendMate here takes you straight in, no sign-in needed. Sign out to forget this device.' : 'Not remembered. You’ll sign in again after closing the app.'}
            </p>
          </Card>
        </div>
      )}

      <Button variant="danger" block onClick={logout}>Sign out</Button>
    </div>
  );
}
