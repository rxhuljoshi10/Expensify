// types/expense.ts
export type Category =
    | 'Food' | 'Transport' | 'Shopping' | 'Health'
    | 'Entertainment' | 'Home' | 'Education' | 'Bills'
    | 'Personal' | 'Travel' | 'Fitness' | 'Other';

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
}

export interface CreateExpenseInput {
    amount: number;        // still in paise
    category: Category;
    merchant: string;
    description?: string;
    expense_date: string;
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