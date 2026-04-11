// Ink Wash Light theme based on Figma Combination 8
// Palette: #252525, #CFCFCF, #7D7D7D, #545454

export type ThemeMode = 'dark' | 'light';

export interface Theme {
  mode: ThemeMode;
  colors: {
    background: string;
    card: string;
    surface: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    accent: string;
    accentBg: string;
    income: string;
    expense: string;
    investment: string;
    tabBar: string;
    tabBarBorder: string;
    tabBarActive: string;
    tabBarInactive: string;
    modalOverlay: string;
    inputBg: string;
    inputBorder: string;
    toggleBg: string;
    toggleActive: string;
    fabBg: string;
    shadow: string;
    statusCard1: string;
    statusCard2: string;
    statusCard3: string;
    statusCard4: string;
  };
}

export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    background: '#0c0c0c',
    card: '#1a1a1a',
    surface: '#2a2a2a',
    text: '#ffffff',
    textSecondary: '#888888',
    textMuted: '#666666',
    border: '#333333',
    accent: '#4CAF50',
    accentBg: '#4CAF5020',
    income: '#4CAF50',
    expense: '#f44336',
    investment: '#2196F3',
    tabBar: '#0c0c0c',
    tabBarBorder: '#1a1a1a',
    tabBarActive: '#4CAF50',
    tabBarInactive: '#888888',
    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    inputBg: '#2a2a2a',
    inputBorder: '#333333',
    toggleBg: '#333333',
    toggleActive: '#4CAF50',
    fabBg: '#4CAF50',
    shadow: '#000000',
    statusCard1: '#4CAF5020',
    statusCard2: '#f4433620',
    statusCard3: '#2196F320',
    statusCard4: '#FF980020',
  },
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    background: '#F5F0EB',
    card: '#FFFFFF',
    surface: '#E8E4DF',
    text: '#252525',
    textSecondary: '#7D7D7D',
    textMuted: '#ABABAB',
    border: '#CFCFCF',
    accent: '#545454',
    accentBg: '#54545415',
    income: '#2E7D32',
    expense: '#C62828',
    investment: '#1565C0',
    tabBar: '#FFFFFF',
    tabBarBorder: '#CFCFCF',
    tabBarActive: '#252525',
    tabBarInactive: '#7D7D7D',
    modalOverlay: 'rgba(37, 37, 37, 0.5)',
    inputBg: '#F5F0EB',
    inputBorder: '#CFCFCF',
    toggleBg: '#CFCFCF',
    toggleActive: '#545454',
    fabBg: '#252525',
    shadow: '#7D7D7D',
    statusCard1: '#2E7D3215',
    statusCard2: '#C6282815',
    statusCard3: '#1565C015',
    statusCard4: '#E6510015',
  },
};

export const getTheme = (mode: ThemeMode): Theme => {
  return mode === 'dark' ? darkTheme : lightTheme;
};
