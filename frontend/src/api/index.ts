/**
 * Local API layer — all operations run on-device.
 * No server dependency. Same interface as before so screens don't change.
 */
import {
  getDB,
  isAuthenticated,
  getProfiles as getStorageProfiles,
  createProfile as createStorageProfile,
  verifyProfilePassword,
  deleteProfileData,
  authenticate,
  authenticateNewProfile,
  Profile,
} from '../services/storage';
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
import Papa from 'papaparse';

// ── Seed data ───────────────────────────────────────────────

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Rent/Mortgage', icon: 'home-outline' },
  { name: 'Utilities', icon: 'flash-outline' },
  { name: 'Groceries', icon: 'cart-outline' },
  { name: 'Transportation', icon: 'car-outline' },
  { name: 'Insurance', icon: 'shield-checkmark-outline' },
  { name: 'Healthcare', icon: 'medkit-outline' },
  { name: 'Entertainment', icon: 'film-outline' },
  { name: 'Dining Out', icon: 'restaurant-outline' },
  { name: 'Education', icon: 'school-outline' },
  { name: 'Shopping', icon: 'bag-outline' },
  { name: 'Subscriptions', icon: 'repeat-outline' },
  { name: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const DEFAULT_INVESTMENT_TYPES = [
  { name: 'Fixed Deposit', icon: 'lock-closed-outline' },
  { name: 'Mutual Funds', icon: 'trending-up-outline' },
  { name: 'Stocks', icon: 'stats-chart-outline' },
  { name: 'PPF', icon: 'shield-outline' },
  { name: 'Savings Account', icon: 'wallet-outline' },
  { name: 'Bonds', icon: 'document-text-outline' },
  { name: 'Real Estate', icon: 'business-outline' },
  { name: 'Gold', icon: 'diamond-outline' },
  { name: 'Cryptocurrency', icon: 'logo-bitcoin' },
  { name: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Rent/Mortgage': ['rent', 'mortgage', 'lease', 'housing', 'apartment'],
  'Utilities': ['electric', 'gas', 'water', 'utility', 'power', 'energy'],
  'Groceries': ['grocery', 'supermarket', 'walmart', 'target', 'costco', 'whole foods', 'kroger', 'aldi', 'food', 'market'],
  'Transportation': ['uber', 'lyft', 'taxi', 'fuel', 'petrol', 'parking', 'toll', 'transit', 'metro', 'bus', 'train'],
  'Insurance': ['insurance', 'geico', 'allstate', 'progressive', 'premium'],
  'Healthcare': ['pharmacy', 'cvs', 'walgreens', 'hospital', 'doctor', 'medical', 'health', 'dental'],
  'Entertainment': ['netflix', 'hulu', 'disney', 'spotify', 'youtube', 'movie', 'cinema', 'game', 'gaming'],
  'Dining Out': ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'pizza', 'doordash', 'chipotle', 'dining'],
  'Education': ['tuition', 'school', 'university', 'course', 'udemy', 'book', 'education'],
  'Shopping': ['amazon', 'ebay', 'shop', 'store', 'mall', 'clothing', 'nike', 'zara', 'best buy'],
  'Subscriptions': ['subscription', 'membership', 'monthly', 'annual', 'prime', 'gym'],
  'Other': [],
};

function uuid(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ── Init ────────────────────────────────────────────────────

export const initializeData = async () => {
  const db = getDB();
  const catCount = await db.expense_categories.count();
  if (catCount === 0) {
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      await db.expense_categories.insert({ id: uuid(), name: cat.name, icon: cat.icon, is_default: true });
    }
  }
  const typeCount = await db.investment_types.count();
  if (typeCount === 0) {
    for (const t of DEFAULT_INVESTMENT_TYPES) {
      await db.investment_types.insert({ id: uuid(), name: t.name, icon: t.icon, is_default: true });
    }
  }
  const existingSettings = await db.settings.findOne({ id: 'app_settings' });
  if (!existingSettings) {
    await db.settings.insert({ id: 'app_settings', projection_years: 5, default_currency: 'USD' });
  }
};

// ── Auth ────────────────────────────────────────────────────

export interface AuthStatus {
  password_set: boolean;
  authenticated: boolean;
  profiles: Profile[];
  has_legacy: boolean;
}

export { Profile } from '../services/storage';

export const getAuthStatus = async (): Promise<AuthStatus> => {
  const profiles = await getStorageProfiles();
  return {
    password_set: profiles.length > 0,
    authenticated: isAuthenticated(),
    profiles,
    has_legacy: false,
  };
};

export const getProfiles = async (): Promise<Profile[]> => getStorageProfiles();

export const createProfile = async (name: string, password: string) => {
  const profile = await createStorageProfile(name, password);
  await authenticateNewProfile(profile.id, password);
  return { message: 'Profile created', profile };
};

export const profileLogin = async (profileId: string, password: string) => {
  const ok = await authenticate(profileId, password);
  if (!ok) throw { response: { data: { detail: 'Incorrect password' } } };
  return { message: 'Login successful' };
};

export const deleteProfile = async (profileId: string) => {
  const ok = await deleteProfileData(profileId);
  if (!ok) throw { response: { data: { detail: 'Profile not found' } } };
  return { message: 'Profile deleted' };
};

export const setupPassword = async (password: string) => {
  return createProfile('Default', password);
};

export const login = async (password: string) => {
  const profiles = await getStorageProfiles();
  if (profiles.length === 0) throw { response: { data: { detail: 'No profiles' } } };
  return profileLogin(profiles[0].id, password);
};

// ── Expense Categories ──────────────────────────────────────

export const getExpenseCategories = async (): Promise<ExpenseCategory[]> => {
  return getDB().expense_categories.find();
};

export const createExpenseCategory = async (data: { name: string; icon?: string }): Promise<ExpenseCategory> => {
  const cat = { id: uuid(), name: data.name, icon: data.icon || 'cash-outline', is_default: false };
  await getDB().expense_categories.insert(cat);
  return cat as ExpenseCategory;
};

export const deleteExpenseCategory = async (id: string) => {
  await getDB().expense_categories.deleteOne({ id, is_default: false });
};

// ── Expenses ────────────────────────────────────────────────

export const getExpenses = async (): Promise<Expense[]> => getDB().expenses.find();

export const createExpense = async (data: any): Promise<Expense> => {
  const expense = { id: uuid(), ...data, created_at: new Date().toISOString() };
  await getDB().expenses.insert(expense);
  return expense;
};

export const updateExpense = async (id: string, data: any): Promise<Expense> => {
  await getDB().expenses.update({ id }, data);
  return (await getDB().expenses.findOne({ id }))!;
};

export const deleteExpense = async (id: string) => {
  await getDB().expenses.deleteOne({ id });
};

// ── Income Sources ──────────────────────────────────────────

export const getIncomeSources = async (): Promise<IncomeSource[]> => getDB().income_sources.find();

export const createIncomeSource = async (data: any): Promise<IncomeSource> => {
  const source = { id: uuid(), ...data, created_at: new Date().toISOString() };
  await getDB().income_sources.insert(source);
  return source;
};

export const updateIncomeSource = async (id: string, data: any): Promise<IncomeSource> => {
  await getDB().income_sources.update({ id }, data);
  return (await getDB().income_sources.findOne({ id }))!;
};

export const deleteIncomeSource = async (id: string) => {
  await getDB().income_sources.deleteOne({ id });
};

// ── Investment Types ────────────────────────────────────────

export const getInvestmentTypes = async (): Promise<InvestmentType[]> => getDB().investment_types.find();

export const createInvestmentType = async (data: { name: string; icon?: string }): Promise<InvestmentType> => {
  const t = { id: uuid(), name: data.name, icon: data.icon || 'trending-up', is_default: false };
  await getDB().investment_types.insert(t);
  return t as InvestmentType;
};

export const deleteInvestmentType = async (id: string) => {
  await getDB().investment_types.deleteOne({ id, is_default: false });
};

// ── Investments ─────────────────────────────────────────────

export const getInvestments = async (): Promise<Investment[]> => getDB().investments.find();

export const createInvestment = async (data: any): Promise<Investment> => {
  const inv = { id: uuid(), ...data, created_at: new Date().toISOString() };
  await getDB().investments.insert(inv);
  return inv;
};

export const updateInvestment = async (id: string, data: any): Promise<Investment> => {
  await getDB().investments.update({ id }, data);
  return (await getDB().investments.findOne({ id }))!;
};

export const deleteInvestment = async (id: string) => {
  await getDB().investments.deleteOne({ id });
};

// ── Settings ────────────────────────────────────────────────

export const getSettings = async (): Promise<Settings> => {
  const s = await getDB().settings.findOne({ id: 'app_settings' });
  return s || { id: 'app_settings', projection_years: 5, default_currency: 'USD' };
};

export const updateSettings = async (data: Partial<Settings>): Promise<Settings> => {
  await getDB().settings.update({ id: 'app_settings' }, data);
  return getSettings();
};

// ── Dashboard ───────────────────────────────────────────────

export const getDashboard = async (currency: Currency = 'USD'): Promise<DashboardData> => {
  const db = getDB();
  const currentYear = new Date().getFullYear();
  const allExpenses = await db.expenses.find({ currency });
  const allIncome = await db.income_sources.find({ currency, is_active: true });
  const allInvestments = await db.investments.find({ currency, is_active: true });

  let totalDebit = 0, totalCredit = 0, totalIncome = 0, totalInv = 0;
  const byCat: Record<string, number> = {};

  for (const e of allExpenses) {
    if (e.start_year <= currentYear) {
      const yrs = currentYear - e.start_year;
      const amt = e.amount * Math.pow(1 + (e.appreciation_rate || 0) / 100, yrs);
      if (e.transaction_type === 'debit') totalDebit += amt;
      else totalCredit += amt;
      byCat[e.category_name] = (byCat[e.category_name] || 0) + amt;
    }
  }

  for (const s of allIncome) {
    if (s.start_year <= currentYear) {
      const yrs = currentYear - s.start_year;
      const amt = s.increment_type === 'percentage'
        ? s.amount * Math.pow(1 + (s.increment_rate || 0) / 100, yrs)
        : s.amount + (s.increment_rate || 0) * yrs;
      totalIncome += amt;
    }
  }

  for (const v of allInvestments) {
    if (v.start_year <= currentYear) {
      const yrs = currentYear - v.start_year;
      totalInv += v.principal * Math.pow(1 + (v.interest_rate || 0) / 100, yrs);
    }
  }

  const netExp = totalDebit - totalCredit;
  return {
    current_year: currentYear,
    currency,
    counts: { expenses: allExpenses.length, income_sources: allIncome.length, investments: allInvestments.length },
    totals: {
      income: +totalIncome.toFixed(2),
      expenses_debit: +totalDebit.toFixed(2),
      expenses_credit: +totalCredit.toFixed(2),
      net_expenses: +netExp.toFixed(2),
      investments: +totalInv.toFixed(2),
      net_savings: +(totalIncome - netExp).toFixed(2),
    },
    expenses_by_category: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, +v.toFixed(2)])),
  };
};

// ── Projections ─────────────────────────────────────────────

export const getProjections = async (years: number = 5, currency: Currency = 'USD'): Promise<ProjectionsData> => {
  const db = getDB();
  const currentYear = new Date().getFullYear();
  const expenses = await db.expenses.find({ currency });
  const incomeSources = await db.income_sources.find({ currency, is_active: true });
  const investments = await db.investments.find({ currency, is_active: true });

  const projections = [];
  for (let offset = 0; offset < years; offset++) {
    const year = currentYear + offset;
    let totalCredit = 0, totalDebit = 0, totalIncome = 0, totalInv = 0;
    const eBd: any[] = [], iBd: any[] = [], invBd: any[] = [];

    for (const e of expenses) {
      if (e.start_year <= year && (e.is_recurring !== false)) {
        const yrs = year - e.start_year;
        const amt = e.amount * Math.pow(1 + (e.appreciation_rate || 0) / 100, yrs);
        if (e.transaction_type === 'credit') totalCredit += amt;
        else totalDebit += amt;
        eBd.push({ name: e.name, category: e.category_name, amount: +amt.toFixed(2), type: e.transaction_type });
      }
    }
    for (const s of incomeSources) {
      if (s.start_year <= year) {
        const yrs = year - s.start_year;
        const amt = s.increment_type === 'percentage'
          ? s.amount * Math.pow(1 + (s.increment_rate || 0) / 100, yrs)
          : s.amount + (s.increment_rate || 0) * yrs;
        totalIncome += amt;
        iBd.push({ name: s.name, amount: +amt.toFixed(2) });
      }
    }
    for (const v of investments) {
      if (v.start_year <= year) {
        const yrs = year - v.start_year;
        const amt = v.principal * Math.pow(1 + (v.interest_rate || 0) / 100, yrs);
        totalInv += amt;
        invBd.push({ name: v.name, type: v.type_name, principal: v.principal, current_value: +amt.toFixed(2), growth: +(amt - v.principal).toFixed(2) });
      }
    }
    const netExp = totalDebit - totalCredit;
    projections.push({
      year,
      total_income: +totalIncome.toFixed(2),
      total_expenses_credit: +totalCredit.toFixed(2),
      total_expenses_debit: +totalDebit.toFixed(2),
      net_expenses: +netExp.toFixed(2),
      total_investments: +totalInv.toFixed(2),
      net_savings: +(totalIncome - netExp).toFixed(2),
      expense_breakdown: eBd,
      income_breakdown: iBd,
      investment_breakdown: invBd,
    });
  }
  return { currency, years, projections };
};

// ── Transaction Upload ──────────────────────────────────────

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
  columns_detected: { date: string; description: string; amount: string; type: string | null };
}

export interface ImportRequest {
  transactions: any[];
  currency: Currency;
  start_year: number;
  is_recurring: boolean;
  appreciation_rate: number;
}

async function categorizeTransaction(description: string): Promise<{ id: string; name: string; confidence: number }> {
  const categories = await getExpenseCategories();
  const catMap = new Map(categories.map((c) => [c.name, c]));
  const descLower = description.toLowerCase();
  let best: ExpenseCategory | null = null;
  let bestConf = 0;

  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const cat = catMap.get(catName);
    if (!cat) continue;
    for (const kw of keywords) {
      if (descLower.includes(kw)) {
        const conf = Math.min((kw.length / descLower.length) * 200, 95);
        if (conf > bestConf) { bestConf = conf; best = cat; }
      }
    }
  }
  if (!best) {
    best = catMap.get('Other') || categories[0] || null;
    bestConf = 10;
  }
  return { id: best?.id || '', name: best?.name || 'Other', confidence: +bestConf.toFixed(1) };
}

export const uploadBankStatement = async (formData: FormData): Promise<UploadResponse> => {
  // Extract file from FormData
  let csvText = '';
  
  // Try to get file from FormData parts
  const parts = (formData as any)._parts;
  if (parts && parts.length > 0) {
    const file = parts[0][1];
    if (file?.uri) {
      // On native, read from URI using fetch
      try {
        const response = await fetch(file.uri);
        csvText = await response.text();
      } catch {
        throw { response: { data: { detail: 'Could not read file' } } };
      }
    }
  }

  if (!csvText) {
    throw { response: { data: { detail: 'Could not read file content' } } };
  }

  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (!result.data || result.data.length === 0) {
    throw { response: { data: { detail: 'No valid data found in file' } } };
  }

  const headers = Object.keys(result.data[0] as any).map((h) => h.toLowerCase().trim());
  const dateVars = ['date', 'transaction date', 'trans date', 'posting date'];
  const descVars = ['description', 'desc', 'narrative', 'particulars', 'details', 'memo'];
  const amtVars = ['amount', 'value', 'sum', 'transaction amount'];
  const typeVars = ['type', 'transaction type', 'dr/cr'];

  let dateCol = '', descCol = '', amountCol = '', typeCol: string | null = null;
  const origHeaders = Object.keys(result.data[0] as any);

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!dateCol && dateVars.some((v) => h.includes(v))) dateCol = origHeaders[i];
    if (!descCol && descVars.some((v) => h.includes(v))) descCol = origHeaders[i];
    if (!amountCol && amtVars.some((v) => h.includes(v))) amountCol = origHeaders[i];
    if (!typeCol && typeVars.some((v) => h.includes(v))) typeCol = origHeaders[i];
  }
  if (!dateCol) dateCol = origHeaders[0];
  if (!descCol) descCol = origHeaders[1];
  if (!amountCol) amountCol = origHeaders[2];

  const parsed: ParsedTransaction[] = [];
  for (const row of result.data as any[]) {
    const desc = String(row[descCol] || 'Unknown');
    let amtStr = String(row[amountCol] || '').replace(/[,$₹()]/g, '').trim();
    if (!amtStr) continue;
    const amount = Math.abs(parseFloat(amtStr));
    if (isNaN(amount)) continue;

    let tt: 'credit' | 'debit' = parseFloat(amtStr) > 0 ? 'credit' : 'debit';
    if (typeCol && row[typeCol]) {
      const tv = String(row[typeCol]).toLowerCase();
      tt = ['credit', 'cr', 'deposit'].some((t) => tv.includes(t)) ? 'credit' : 'debit';
    }

    const cat = await categorizeTransaction(desc);
    parsed.push({
      id: uuid(),
      date: String(row[dateCol] || ''),
      description: desc,
      amount: +amount.toFixed(2),
      transaction_type: tt,
      suggested_category_id: cat.id,
      suggested_category_name: cat.name,
      confidence: cat.confidence,
      selected: true,
    });
  }

  if (parsed.length === 0) {
    throw { response: { data: { detail: 'No valid transactions found' } } };
  }

  return {
    message: `Parsed ${parsed.length} transactions`,
    transactions: parsed,
    columns_detected: { date: dateCol, description: descCol, amount: amountCol, type: typeCol },
  };
};

export const importTransactions = async (request: ImportRequest) => {
  const db = getDB();
  let expCount = 0, incCount = 0;

  for (const t of request.transactions) {
    if (!t.selected) continue;
    const tt = String(t.transaction_type || 'debit').toLowerCase();

    if (tt === 'credit' && (t.amount || 0) > 1000) {
      await db.income_sources.insert({
        id: uuid(), name: String(t.description || 'Imported').slice(0, 100),
        amount: t.amount, increment_rate: 0, increment_type: 'percentage',
        start_year: request.start_year, currency: request.currency,
        is_active: true, created_at: new Date().toISOString(),
      });
      incCount++;
    } else {
      await db.expenses.insert({
        id: uuid(), name: String(t.description || 'Imported').slice(0, 100),
        category_id: t.category_id || t.suggested_category_id || '',
        category_name: t.category_name || t.suggested_category_name || 'Other',
        amount: t.amount, transaction_type: tt === 'credit' ? 'credit' : 'debit',
        appreciation_rate: request.appreciation_rate, start_year: request.start_year,
        currency: request.currency, is_recurring: request.is_recurring,
        created_at: new Date().toISOString(),
      });
      expCount++;
    }
  }

  return {
    message: `Imported ${expCount} expenses and ${incCount} income`,
    expenses_count: expCount,
    income_count: incCount,
  };
};
