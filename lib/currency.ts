// lib/currency.ts

// Store: ₹480.50 → 48050 (integer paise, never float)
export const rupeesToPaise = (rupees: number): number =>
    Math.round(rupees * 100);

// Display: 48050 → '₹480'
export const formatAmount = (paise: number, currency = 'INR'): string =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.round(paise) / 100);