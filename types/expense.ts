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

// ── SMS Auto-Expense types ───────────────────────────────────────────

export type VpaType = 'personal' | 'dynamic_qr' | 'brand';
export type PendingStatus = 'pending' | 'processed' | 'expired';

export interface PendingSmsExpense {
  id: string;
  user_id: string;
  raw_sms: string;
  amount: number;       // in paise
  raw_vpa: string | null;
  vpa_type: VpaType;
  parsed_date: string | null;
  status: PendingStatus;
  created_at: string;
  expires_at: string;
}

export interface MerchantMapping {
  id: string;
  user_id: string;
  raw_vpa: string;
  friendly_name: string;
  category: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
}