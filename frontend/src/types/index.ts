export type TransactionType = 'credit' | 'debit';
export type Currency = 'USD' | 'INR';
export type IncrementType = 'percentage' | 'fixed';

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  is_default: boolean;
}

export interface Expense {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  amount: number;
  transaction_type: TransactionType;
  appreciation_rate: number;
  start_year: number;
  currency: Currency;
  is_recurring: boolean;
  created_at: string;
}

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  increment_rate: number;
  increment_type: IncrementType;
  start_year: number;
  currency: Currency;
  is_active: boolean;
  created_at: string;
}

export interface InvestmentType {
  id: string;
  name: string;
  icon: string;
  is_default: boolean;
}

export interface Investment {
  id: string;
  name: string;
  type_id: string;
  type_name: string;
  principal: number;
  interest_rate: number;
  start_year: number;
  currency: Currency;
  is_active: boolean;
  created_at: string;
}

export interface Settings {
  id: string;
  projection_years: number;
  default_currency: Currency;
}

export interface DashboardData {
  current_year: number;
  currency: Currency;
  counts: {
    expenses: number;
    income_sources: number;
    investments: number;
  };
  totals: {
    income: number;
    expenses_debit: number;
    expenses_credit: number;
    net_expenses: number;
    investments: number;
    net_savings: number;
  };
  expenses_by_category: Record<string, number>;
}

export interface YearProjection {
  year: number;
  total_income: number;
  total_expenses_credit: number;
  total_expenses_debit: number;
  net_expenses: number;
  total_investments: number;
  net_savings: number;
  expense_breakdown: Array<{
    name: string;
    category: string;
    amount: number;
    type: TransactionType;
  }>;
  income_breakdown: Array<{
    name: string;
    amount: number;
  }>;
  investment_breakdown: Array<{
    name: string;
    type: string;
    principal: number;
    current_value: number;
    growth: number;
  }>;
}

export interface ProjectionsData {
  currency: Currency;
  years: number;
  projections: YearProjection[];
}
