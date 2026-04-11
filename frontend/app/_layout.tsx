import { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '../src/store';
import { LockScreen } from '../src/components/LockScreen';
import { initializeData } from '../src/api';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { theme, hydrate, autoLockMinutes, touchActivity, lastActiveTimestamp } = useAppStore();
  const [unlocked, setUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);
  const backgroundTimestamp = useRef<number>(0);

  useEffect(() => {
    hydrate();
  }, []);

  const handleUnlock = useCallback(() => {
    initializeData().catch(console.error);
    touchActivity();
    setUnlocked(true);
  }, [touchActivity]);

  // Auto-lock: check on app foreground return
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/active/) && nextState.match(/inactive|background/)) {
        // Going to background — record timestamp
        backgroundTimestamp.current = Date.now();
      }

      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // Returning from background — check elapsed time
        if (unlocked && autoLockMinutes > 0 && backgroundTimestamp.current > 0) {
          const elapsed = (Date.now() - backgroundTimestamp.current) / 1000 / 60;
          if (elapsed >= autoLockMinutes) {
            setUnlocked(false);
          }
        }
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [unlocked, autoLockMinutes]);

  // Auto-lock: periodic inactivity check while app is open
  useEffect(() => {
    if (!unlocked || autoLockMinutes <= 0) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - useAppStore.getState().lastActiveTimestamp) / 1000 / 60;
      if (elapsed >= autoLockMinutes) {
        setUnlocked(false);
      }
    }, 30_000); // check every 30 seconds

    return () => clearInterval(interval);
  }, [unlocked, autoLockMinutes]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      {!unlocked ? (
        <LockScreen onUnlock={handleUnlock} />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      )}
    </QueryClientProvider>
  );
}
