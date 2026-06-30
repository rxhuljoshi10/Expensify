// types/expense.ts
export type Category = string;

export interface UserCategory {
    id: string;
    user_id: string;
    name: string;
    icon: string;       // Ionicons icon name
    color: string;      // Hex color code
    last_used_at?: string;
    created_at?: string;
}

export interface ExpenseItem {
    name: string;
    amount: number;    // unit price in rupees (raw from receipt, NOT paise)
    quantity?: number;
}

export interface Expense {
    id: string;
    user_id: string;
    amount: number;        // stored in paise — ₹480 = 48000
    category: Category;
    merchant: string;
    description?: string;
    expense_date: string;  // 'YYYY-MM-DD'
    created_at: string;
    source?: string;
    attachment_url?: string | null; // path in Supabase Storage (receipt photo)
    items?: ExpenseItem[] | null;   // structured line items from scanned receipt
}

export interface CreateExpenseInput {
    amount: number;        // still in paise
    category: Category;
    merchant: string;
    description?: string;
    expense_date: string;
    attachment_url?: string | null;
    items?: ExpenseItem[] | null;
    source?: string;
}

// Add to types/expense.ts
export interface Budget {
    id: string;
    user_id: string;
    month: string;          // 'YYYY-MM' format e.g. '2026-04'
    total_budget: number;   // in paise
    category_budgets?: Record<string, number>;
    alert_at_pct: number;
    alerted_80: boolean;
    alerted_100: boolean;
}


// types/expense.ts — add these
export type GroupRole = 'owner' | 'member';

export interface GroupMember {
  user_id: string;
  name: string;
  email: string;
  role: GroupRole;
  joined_at: string;
}

export interface FamilyGroup {
  id: string;
  owner_id: string;
  name: string;
  invite_code: string;
  members: GroupMember[];
  created_at: string;
}


export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringExpense {
  id: string;
  user_id: string;
  amount: number;        // in paise
  merchant: string;
  category: Category;
  frequency: RecurringFrequency;
  next_due_date: string; // 'YYYY-MM-DD'
  is_active: boolean;
  created_at: string;
}

export interface CreateRecurringInput {
  amount: number;
  merchant: string;
  category: Category;
  frequency: RecurringFrequency;
  next_due_date: string;
}