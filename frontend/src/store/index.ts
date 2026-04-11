import { create } from 'zustand';
import { Currency } from '../types';
import { ThemeMode, Theme, getTheme } from '../theme';

interface AppState {
  currency: Currency;
  projectionYears: number;
  themeMode: ThemeMode;
  theme: Theme;
  setCurrency: (currency: Currency) => void;
  setProjectionYears: (years: number) => void;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currency: 'USD',
  projectionYears: 5,
  themeMode: 'dark',
  theme: getTheme('dark'),
  setCurrency: (currency) => set({ currency }),
  setProjectionYears: (years) => set({ projectionYears: years }),
  toggleTheme: () =>
    set((state) => {
      const newMode = state.themeMode === 'dark' ? 'light' : 'dark';
      return { themeMode: newMode, theme: getTheme(newMode) };
    }),
  setThemeMode: (mode) => set({ themeMode: mode, theme: getTheme(mode) }),
}));
