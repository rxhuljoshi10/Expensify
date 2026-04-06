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