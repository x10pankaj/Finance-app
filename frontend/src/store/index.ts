import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Currency } from '../types';
import { ThemeMode, Theme, getTheme } from '../theme';

const STORAGE_KEY_THEME = 'budget_tracker_theme';
const STORAGE_KEY_CURRENCY = 'budget_tracker_currency';

interface AppState {
  currency: Currency;
  projectionYears: number;
  themeMode: ThemeMode;
  theme: Theme;
  hydrated: boolean;
  setCurrency: (currency: Currency) => void;
  setProjectionYears: (years: number) => void;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currency: 'USD',
  projectionYears: 5,
  themeMode: 'dark',
  theme: getTheme('dark'),
  hydrated: false,
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
  hydrate: async () => {
    try {
      const [savedTheme, savedCurrency] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_THEME),
        AsyncStorage.getItem(STORAGE_KEY_CURRENCY),
      ]);
      const updates: Partial<AppState> = { hydrated: true };
      if (savedTheme === 'dark' || savedTheme === 'light') {
        updates.themeMode = savedTheme;
        updates.theme = getTheme(savedTheme);
      }
      if (savedCurrency === 'USD' || savedCurrency === 'INR') {
        updates.currency = savedCurrency;
      }
      set(updates);
    } catch {
      set({ hydrated: true });
    }
  },
}));
