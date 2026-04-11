import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '../src/store';
import { LockScreen } from '../src/components/LockScreen';
import { initializeData } from '../src/api';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { theme, hydrate } = useAppStore();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    hydrate();
  }, []);

  const handleUnlock = () => {
    // Initialize data after auth
    initializeData().catch(console.error);
    setUnlocked(true);
  };

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
