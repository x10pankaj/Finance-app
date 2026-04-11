import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Currency } from '../types';
import { ThemeMode, Theme, getTheme } from '../theme';

const STORAGE_KEY_THEME = 'budget_tracker_theme';
const STORAGE_KEY_CURRENCY = 'budget_tracker_currency';
const STORAGE_KEY_BIOMETRIC = 'budget_tracker_biometric';
const STORAGE_KEY_AUTOLOCK = 'budget_tracker_autolock_mins';

interface AppState {
  currency: Currency;
  projectionYears: number;
  themeMode: ThemeMode;
  theme: Theme;
  hydrated: boolean;
  biometricEnabled: boolean;
  autoLockMinutes: number; // 0 = disabled
  lastActiveTimestamp: number;
  setCurrency: (currency: Currency) => void;
  setProjectionYears: (years: number) => void;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  setAutoLockMinutes: (mins: number) => void;
  touchActivity: () => void;
  hydrate: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currency: 'USD',
  projectionYears: 5,
  themeMode: 'dark',
  theme: getTheme('dark'),
  hydrated: false,
  biometricEnabled: false,
  autoLockMinutes: 5,
  lastActiveTimestamp: Date.now(),
  setCurrency: (currency) => {
    set({ currency });
    AsyncStorage.setItem(STORAGE_KEY_CURRENCY, currency).catch(() => {});
  },
  setProjectionYears: (years) => set({ projectionYears: years }),
  toggleTheme: () => {
    const newMode = get().themeMode === 'dark' ? 'light' : 'dark';
    set({ themeMode: newMode, theme: getTheme(newMode) });
    AsyncStorage.setItem(STORAGE_KEY_THEME, newMode).catch(() => {});
  },
  setThemeMode: (mode) => {
    set({ themeMode: mode, theme: getTheme(mode) });
    AsyncStorage.setItem(STORAGE_KEY_THEME, mode).catch(() => {});
  },
  setBiometricEnabled: (enabled) => {
    set({ biometricEnabled: enabled });
    AsyncStorage.setItem(STORAGE_KEY_BIOMETRIC, enabled ? '1' : '0').catch(() => {});
  },
  setAutoLockMinutes: (mins) => {
    set({ autoLockMinutes: mins });
    AsyncStorage.setItem(STORAGE_KEY_AUTOLOCK, String(mins)).catch(() => {});
  },
  touchActivity: () => {
    set({ lastActiveTimestamp: Date.now() });
  },
  hydrate: async () => {
    try {
      const [savedTheme, savedCurrency, savedBio, savedLock] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_THEME),
        AsyncStorage.getItem(STORAGE_KEY_CURRENCY),
        AsyncStorage.getItem(STORAGE_KEY_BIOMETRIC),
        AsyncStorage.getItem(STORAGE_KEY_AUTOLOCK),
      ]);
      const updates: Partial<AppState> = { hydrated: true };
      if (savedTheme === 'dark' || savedTheme === 'light') {
        updates.themeMode = savedTheme;
        updates.theme = getTheme(savedTheme);
      }
      if (savedCurrency === 'USD' || savedCurrency === 'INR') {
        updates.currency = savedCurrency;
      }
      if (savedBio !== null) {
        updates.biometricEnabled = savedBio === '1';
      }
      if (savedLock !== null) {
        updates.autoLockMinutes = parseInt(savedLock) || 5;
      }
      set(updates);
    } catch {
      set({ hydrated: true });
    }
  },
}));
