import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/navigation/AppShell';
import { AppSkeleton } from '@/components/ui/Skeleton';
import { ToastProvider } from '@/components/ui/Toast';
import { WelcomeGreeting } from '@/components/ui/WelcomeGreeting';
import { useAuth } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { useTheme } from '@/contexts/useTheme';
import { getGuestTheme, setGuestTheme, type ThemePref } from '@/lib/theme';
import { AuthPage } from '@/pages/AuthPage';
import { FamilyPage } from '@/pages/FamilyPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { HomePage } from '@/pages/HomePage';
import { PersonPage } from '@/pages/PersonPage';
import { ProfilePage } from '@/pages/ProfilePage';

export default function App() {
  const { user, loading, greeting, dismissGreeting } = useAuth();
  const [guestTheme, setGuest] = useState<ThemePref>(getGuestTheme);
  useTheme(user?.prefs.theme ?? guestTheme);

  // After signing out, don't leave a stale address like /profile on the landing page.
  useEffect(() => {
    if (!loading && !user && window.location.pathname !== '/') window.history.replaceState(null, '', '/');
  }, [loading, user]);

  // Landing-page toggle: flips between light and dark and remembers it on this device.
  const toggleGuest = useCallback(() => {
    const dark = document.documentElement.classList.contains('dark');
    const next: ThemePref = dark ? 'light' : 'dark';
    setGuestTheme(next);
    setGuest(next);
  }, []);

  if (loading) return <AppSkeleton />;
  if (!user) return <AuthPage isDark={document.documentElement.classList.contains('dark')} onToggleTheme={toggleGuest} />;

  return (
    <DataProvider>
      <AnimatePresence>
        {greeting && <WelcomeGreeting key="greeting" user={user} kind={greeting} onDone={dismissGreeting} />}
      </AnimatePresence>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="family" element={<FamilyPage />} />
              <Route path="family/:personId" element={<PersonPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </DataProvider>
  );
}
