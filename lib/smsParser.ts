// lib/smsParser.ts
// Pure TypeScript module for local SMS filtering, VPA classification, and deduplication.
// No network calls — this runs entirely on-device.

import { VpaType } from '../types/expense';

// ── Transactional SMS Detection ──────────────────────────────────────

/** Keywords indicating money was SENT (debit) */
const DEBIT_KEYWORDS = [
  'sent', 'debited', 'charged', 'paid', 'spent',
  'withdrawn', 'purchase', 'txn', 'transferred',
];

/** Keywords indicating money was RECEIVED (credit) — we exclude these */
const CREDIT_KEYWORDS = [
  'credited', 'received', 'refund', 'cashback',
  'reversed', 'deposited',
];

/** Currency indicators */
const CURRENCY_PATTERN = /(?:Rs\.?|₹|INR)\s*[\d,.]+/i;

/**
 * Determines whether an SMS body is a financial transaction (debit).
 * Returns false for credit/refund messages and non-financial SMS.
 */
export function isTransactionalSms(body: string): boolean {
  const lower = body.toLowerCase();

  // Must contain a currency amount
  if (!CURRENCY_PATTERN.test(body)) return false;

  // Exclude credit/refund messages
  if (CREDIT_KEYWORDS.some(kw => lower.includes(kw))) return false;

  // Must contain at least one debit keyword
  return DEBIT_KEYWORDS.some(kw => lower.includes(kw));
}

// ── VPA Classification ───────────────────────────────────────────────

export interface VpaClassification {
  handle: string;
  bank: string;
  type: VpaType;
  raw: string;
}

/**
 * Classifies a UPI VPA into one of three buckets:
 * - personal: person-to-person (ok* bank, 10-digit phone, ybl/paytm/ibl/apl)
 * - dynamic_qr: unrecognizable dynamic QR code VPA
 * - brand: recognizable business/brand
 */
export function classifyVpa(vpa: string): VpaClassification {
  const atIndex = vpa.indexOf('@');
  if (atIndex === -1) {
    // Not a valid VPA format — treat as brand
    return { handle: vpa, bank: '', type: 'brand', raw: vpa };
  }

  const handle = vpa.substring(0, atIndex).toLowerCase();
  const bank = vpa.substring(atIndex + 1).toLowerCase();

  // ── Personal detection ──────────────────────────────────────────────
  // 1. Handle is a 10-digit phone number
  const isPhoneNumber = /^\d{10}$/.test(handle);

  // 2. Bank has "ok" prefix (oksbi, okaxis, okicici, etc.)
  const isOkBank = bank.startsWith('ok');

  // 3. Common P2P bank suffixes (PhonePe, Paytm, iMobile, Amazon Pay)
  const p2pBanks = ['ybl', 'paytm', 'ibl', 'apl'];
  const isP2pBank = p2pBanks.includes(bank);

  if (isPhoneNumber || isOkBank || isP2pBank) {
    return { handle, bank, type: 'personal', raw: vpa };
  }

  // ── Dynamic QR detection ────────────────────────────────────────────
  // 1. Handle contains "qr"
  const hasQr = handle.includes('qr');

  // 2. Handle starts with "bharatpe"
  const isBharatPe = handle.startsWith('bharatpe');

  // 3. Handle is long random alphanumeric (10+ chars, mix of letters and digits)
  const isGibberish = /^[a-z0-9]{10,}$/.test(handle)
    && /[a-z]/.test(handle)
    && /\d/.test(handle);

  // 4. Handle starts with "paytm" but is not just "paytm" (e.g., paytmqr6h6pev)
  const isPaytmQr = handle.startsWith('paytm') && handle.length > 5;

  if (hasQr || isBharatPe || isGibberish || isPaytmQr) {
    return { handle, bank, type: 'dynamic_qr', raw: vpa };
  }

  // ── Brand (everything else) ─────────────────────────────────────────
  return { handle, bank, type: 'brand', raw: vpa };
}

// ── Local Field Extraction ───────────────────────────────────────────

export interface BasicSmsFields {
  amount: number;       // in rupees
  vpa: string | null;
  date: string | null;  // YYYY-MM-DD
}

/**
 * Extracts basic fields (amount, VPA, date) from SMS body using regex.
 * This is a fast local fallback — the Gemini edge function provides
 * more accurate results when online.
 */
export function extractBasicFields(body: string): BasicSmsFields | null {
  // ── Amount extraction ───────────────────────────────────────────────
  // Matches: Rs.30.00, Rs 150, ₹250.50, INR 1,200.00
  const amountMatch = body.match(/(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) return null;

  // ── VPA extraction ──────────────────────────────────────────────────
  // Matches: something@something (UPI VPA pattern)
  const vpaMatch = body.match(/(?:to\s+)?([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i);
  const vpa = vpaMatch ? vpaMatch[1].replace(/[.,]+$/, '') : null;

  // ── Date extraction ─────────────────────────────────────────────────
  // Matches common Indian bank date formats:
  // DD-MM-YY, DD/MM/YYYY, DD-Mon-YY, DD-Mon-YYYY
  let date: string | null = null;

  // Format: DD-MM-YY or DD/MM/YY or DD-MM-YYYY or DD/MM/YYYY
  const numDateMatch = body.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (numDateMatch) {
    const day = numDateMatch[1].padStart(2, '0');
    const month = numDateMatch[2].padStart(2, '0');
    let year = numDateMatch[3];
    if (year.length === 2) year = '20' + year;
    date = `${year}-${month}-${day}`;
  }

  // Format: DD-Mon-YY or DD-Mon-YYYY (e.g., 25-Jul-26)
  if (!date) {
    const monthNames: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const monDateMatch = body.match(/(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})/);
    if (monDateMatch) {
      const day = monDateMatch[1].padStart(2, '0');
      const mon = monthNames[monDateMatch[2].toLowerCase()] ?? '01';
      let year = monDateMatch[3];
      if (year.length === 2) year = '20' + year;
      date = `${year}-${mon}-${day}`;
    }
  }

  return { amount, vpa, date };
}

// ── Deduplication ────────────────────────────────────────────────────

/**
 * Generates a deduplication key from transaction fields.
 * Two SMS messages with the same key within a 30-minute window
 * are considered duplicates (e.g., UPI confirm + bank debit alert).
 */
export function generateDedupKey(
  amount: number,
  date: string | null,
  vpa: string | null,
): string {
  return `${amount}|${date ?? 'unknown'}|${(vpa ?? 'unknown').toLowerCase()}`;
}

/**
 * Cleans up a VPA handle into a displayable merchant name.
 * e.g., "swiggy" → "Swiggy", "paytmqr6h6pev" → "Paytm QR (6h6pev...)"
 */
export function formatMerchantFromVpa(handle: string, type: VpaType): string {
  if (type === 'brand') {
    // Capitalize first letter
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }

  if (type === 'dynamic_qr') {
    if (handle.includes('qr')) {
      // Extract prefix before "qr" and the QR code portion
      const qrIdx = handle.indexOf('qr');
      const prefix = handle.substring(0, qrIdx);
      const code = handle.substring(qrIdx + 2);
      const displayPrefix = prefix
        ? prefix.charAt(0).toUpperCase() + prefix.slice(1)
        : 'QR';
      const shortCode = code.length > 6 ? code.substring(0, 6) + '...' : code;
      return `${displayPrefix} QR (${shortCode})`;
    }
    // Generic gibberish
    const short = handle.length > 8 ? handle.substring(0, 8) + '...' : handle;
    return `Unknown (${short})`;
  }

  // Personal — just capitalize
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}
