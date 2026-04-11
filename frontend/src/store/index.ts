import { create } from 'zustand';
import { Currency } from '../types';

interface AppState {
  currency: Currency;
  projectionYears: number;
  setCurrency: (currency: Currency) => void;
  setProjectionYears: (years: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currency: 'USD',
  projectionYears: 5,
  setCurrency: (currency) => set({ currency }),
  setProjectionYears: (years) => set({ projectionYears: years }),
}));
