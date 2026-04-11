import axios from 'axios';
import {
  Expense,
  ExpenseCategory,
  IncomeSource,
  Investment,
  InvestmentType,
  Settings,
  DashboardData,
  ProjectionsData,
  Currency,
} from '../types';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Initialize data
export const initializeData = async () => {
  const response = await api.post('/init');
  return response.data;
};

// Expense Categories
export const getExpenseCategories = async (): Promise<ExpenseCategory[]> => {
  const response = await api.get('/expense-categories');
  return response.data;
};

export const createExpenseCategory = async (data: { name: string; icon?: string }): Promise<ExpenseCategory> => {
  const response = await api.post('/expense-categories', data);
  return response.data;
};

export const deleteExpenseCategory = async (id: string): Promise<void> => {
  await api.delete(`/expense-categories/${id}`);
};

// Expenses
export const getExpenses = async (): Promise<Expense[]> => {
  const response = await api.get('/expenses');
  return response.data;
};

export const createExpense = async (data: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> => {
  const response = await api.post('/expenses', data);
  return response.data;
};

export const updateExpense = async (id: string, data: Partial<Expense>): Promise<Expense> => {
  const response = await api.put(`/expenses/${id}`, data);
  return response.data;
};

export const deleteExpense = async (id: string): Promise<void> => {
  await api.delete(`/expenses/${id}`);
};

// Income Sources
export const getIncomeSources = async (): Promise<IncomeSource[]> => {
  const response = await api.get('/income-sources');
  return response.data;
};

export const createIncomeSource = async (data: Omit<IncomeSource, 'id' | 'created_at'>): Promise<IncomeSource> => {
  const response = await api.post('/income-sources', data);
  return response.data;
};

export const updateIncomeSource = async (id: string, data: Partial<IncomeSource>): Promise<IncomeSource> => {
  const response = await api.put(`/income-sources/${id}`, data);
  return response.data;
};

export const deleteIncomeSource = async (id: string): Promise<void> => {
  await api.delete(`/income-sources/${id}`);
};

// Investment Types
export const getInvestmentTypes = async (): Promise<InvestmentType[]> => {
  const response = await api.get('/investment-types');
  return response.data;
};

export const createInvestmentType = async (data: { name: string; icon?: string }): Promise<InvestmentType> => {
  const response = await api.post('/investment-types', data);
  return response.data;
};

export const deleteInvestmentType = async (id: string): Promise<void> => {
  await api.delete(`/investment-types/${id}`);
};

// Investments
export const getInvestments = async (): Promise<Investment[]> => {
  const response = await api.get('/investments');
  return response.data;
};

export const createInvestment = async (data: Omit<Investment, 'id' | 'created_at'>): Promise<Investment> => {
  const response = await api.post('/investments', data);
  return response.data;
};

export const updateInvestment = async (id: string, data: Partial<Investment>): Promise<Investment> => {
  const response = await api.put(`/investments/${id}`, data);
  return response.data;
};

export const deleteInvestment = async (id: string): Promise<void> => {
  await api.delete(`/investments/${id}`);
};

// Settings
export const getSettings = async (): Promise<Settings> => {
  const response = await api.get('/settings');
  return response.data;
};

export const updateSettings = async (data: Partial<Settings>): Promise<Settings> => {
  const response = await api.put('/settings', data);
  return response.data;
};

// Auth
export interface AuthStatus {
  password_set: boolean;
  authenticated: boolean;
}

export const getAuthStatus = async (): Promise<AuthStatus> => {
  const response = await api.get('/auth/status');
  return response.data;
};

export const setupPassword = async (password: string): Promise<any> => {
  const response = await api.post('/auth/setup', { password });
  return response.data;
};

export const login = async (password: string): Promise<any> => {
  const response = await api.post('/auth/login', { password });
  return response.data;
};

// Dashboard
export const getDashboard = async (currency: Currency = 'USD'): Promise<DashboardData> => {
  const response = await api.get('/dashboard', { params: { currency } });
  return response.data;
};

// Projections
export const getProjections = async (years: number = 5, currency: Currency = 'USD'): Promise<ProjectionsData> => {
  const response = await api.get('/projections', { params: { years, currency } });
  return response.data;
};

// Transaction Upload
export interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  suggested_category_id: string;
  suggested_category_name: string;
  confidence: number;
  selected: boolean;
  category_id?: string;
  category_name?: string;
}

export interface UploadResponse {
  message: string;
  transactions: ParsedTransaction[];
  columns_detected: {
    date: string;
    description: string;
    amount: string;
    type: string | null;
  };
}

export interface ImportRequest {
  transactions: ParsedTransaction[];
  currency: Currency;
  start_year: number;
  is_recurring: boolean;
  appreciation_rate: number;
}

export const uploadBankStatement = async (file: FormData): Promise<UploadResponse> => {
  const response = await api.post('/transactions/upload', file, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const importTransactions = async (data: ImportRequest): Promise<any> => {
  const response = await api.post('/transactions/import', data);
  return response.data;
};
