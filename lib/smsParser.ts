// lib/smsParser.ts  v2
// Bank-agnostic SMS parser that handles modern Indian bank transaction formats
// where banks show recipient names instead of raw UPI VPAs.
//
// Supported formats (tested):
//   Kotak  — "Sent Rs.75.00 from Kotak Bank A/c X6396 to UIDAI on 19-08-26. UPI Ref …"
//   Axis   — "INR 20.00 debited\nA/c no. XX9428\nUPI/P2M/628847206459/UOCINDER FLAWAR SHO"
//   ICICI  — "ICICI Bank Acct XX230 debited for Rs\n180.00 on 15-Oct-26; DHANANJAY\nBABAN credited."
//   PNB    — "A/c X1000 debited INR 532.00 Dt 30-10-26 … to Meesho thru UPI:630389…"
//
// Future-proof strategy: all bank patterns live in registered arrays.
// Adding a new bank = add one entry to AMOUNT_PATTERNS + RECIPIENT_PATTERNS.
//
// Zero network calls — pure local regex.

import { VpaType } from '../types/expense';

// ── Transactional SMS Detection ──────────────────────────────────────────────

const DEBIT_KEYWORDS = [
  'sent', 'debited', 'charged', 'paid', 'spent',
  'withdrawn', 'purchase', 'txn', 'transferred',
];
const CREDIT_KEYWORDS = [
  'credited', 'received', 'refund', 'cashback', 'reversed', 'deposited',
];
const CURRENCY_PATTERN = /(?:Rs\.?|₹|INR)\s*[\d,.]+/i;

/**
 * Returns true only for financial debit messages.
 * Drops credits, refunds, and non-financial SMS.
 */
export function isTransactionalSms(body: string): boolean {
  const lower = body.toLowerCase();
  if (!CURRENCY_PATTERN.test(body)) return false;
  if (CREDIT_KEYWORDS.some(kw => lower.includes(kw))) return false;
  return DEBIT_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Unified Parse Result ─────────────────────────────────────────────────────

export interface SmsParseResult {
  amount: number;                    // in rupees
  recipientName: string | null;      // payee / merchant name extracted from SMS
  upiRef: string | null;             // UPI transaction reference number
  date: string | null;               // YYYY-MM-DD
  vpaType: 'P2A' | 'P2M' | null;    // from UPI path if present (most reliable signal)
}

// ── Normalization ────────────────────────────────────────────────────────────

/**
 * Collapse newlines, tabs, and consecutive spaces into a single space.
 * Modern bank SMS are multi-line; normalizing lets one regex match across
 * line breaks (e.g. ICICI "Rs\n180.00", Axis name spanning lines).
 */
function normalize(raw: string): string {
  return raw.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

// ── Amount Extraction ────────────────────────────────────────────────────────
// Each pattern targets one specific bank. The generic fallback at the end
// catches any future banks we haven't profiled yet.

const AMOUNT_PATTERNS: RegExp[] = [
  /[Ss]ent\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/,            // Kotak: "Sent Rs.75.00"
  /INR\s+([\d,]+(?:\.\d{1,2})?)\s+debited/i,             // Axis:  "INR 20.00 debited"
  /debited\s+for\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i,     // ICICI: "debited for Rs 180.00"
  /debited\s+INR\s+([\d,]+(?:\.\d{1,2})?)/i,             // PNB:   "debited INR 532.00"
  /(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,           // Generic fallback
];

function extractAmount(body: string): number | null {
  for (const pat of AMOUNT_PATTERNS) {
    const m = body.match(pat);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

// ── UPI Reference Extraction ─────────────────────────────────────────────────

const UPI_REF_PATTERNS: RegExp[] = [
  /UPI\s+Ref\s+(\d+)/i,       // Kotak:     "UPI Ref 659720760792"
  /UPI\/P2[MA]\/(\d+)/i,      // Axis:      "UPI/P2M/628847206459"
  /UPI:(\d+)/i,               // ICICI/PNB: "UPI:665449857666"
  /UPI[:/\s]+(\d{10,})/i,     // Generic
];

function extractUpiRef(body: string): string | null {
  for (const pat of UPI_REF_PATTERNS) {
    const m = body.match(pat);
    if (m) return m[1];
  }
  return null;
}

// ── Recipient Name Extraction ────────────────────────────────────────────────
// To add a new bank: add one entry describing where the payee name appears
// relative to surrounding tokens in the normalized SMS.

const RECIPIENT_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // Kotak: "Sent Rs.75.00 from Kotak Bank A/c X6396 to UIDAI on 19-08-26"
  { name: 'kotak_to_on',    re: /\bto\s+(.+?)\s+on\s+\d{1,2}[-/]/i },

  // PNB: "to Meesho thru UPI" / "to RAHUL SANTOSH J thru UPI"
  { name: 'pnb_to_thru',   re: /\bto\s+(.+?)\s+thru\s+UPI/i },

  // ICICI: "; DHANANJAY BABAN credited"
  { name: 'icici_semi',    re: /;\s*(.+?)\s+credited/i },

  // Axis UPI path (P2M or P2A): everything after the last slash up to a stop token
  // e.g. "UPI/P2M/628847206459/UOCINDER FLAWAR SHO Not you?"
  //      "UPI/P2A/665036259709/ARVA GANGULY 15-10-26"
  { name: 'axis_upi',      re: /UPI\/P2[MA]\/\d+\/(.+?)(?=\s+(?:Not\s+you|SMS\s+BLOCK|\d{2}-\d{2})|$)/i },
];

function extractRecipient(body: string): string | null {
  for (const { re } of RECIPIENT_PATTERNS) {
    const m = body.match(re);
    if (m) {
      const raw = m[1].trim().replace(/\s+/g, ' ');
      if (raw.length > 0 && raw.length < 80) return raw;
    }
  }
  return null;
}

// ── Date Extraction ──────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseRawDate(raw: string): string | null {
  // DD-MM-YY / DD-MM-YYYY / DD/MM/YY / DD/MM/YYYY
  const num = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (num) {
    const d = num[1].padStart(2, '0');
    const mo = num[2].padStart(2, '0');
    const yr = num[3].length === 2 ? '20' + num[3] : num[3];
    return `${yr}-${mo}-${d}`;
  }
  // DD-Mon-YY / DD-Mon-YYYY (e.g. 15-Oct-26)
  const mon = raw.match(/(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})/);
  if (mon) {
    const d = mon[1].padStart(2, '0');
    const mo = MONTH_MAP[mon[2].toLowerCase()] ?? '01';
    const yr = mon[3].length === 2 ? '20' + mon[3] : mon[3];
    return `${yr}-${mo}-${d}`;
  }
  return null;
}

const DATE_ANCHOR_PATTERNS: RegExp[] = [
  /\bon\s+(\d{1,2}[-/]\d{2}[-/]\d{2,4})/i,          // "on 19-08-26"
  /\bon\s+(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})/i,    // "on 15-Oct-26"
  /\bDt\s+(\d{1,2}[-/]\d{2}[-/]\d{2,4})/i,          // "Dt 30-10-26"
  /(\d{1,2}[-/]\d{2}[-/]\d{2,4})/,                   // Generic: first date-like string
];

function extractDate(body: string): string | null {
  for (const pat of DATE_ANCHOR_PATTERNS) {
    const m = body.match(pat);
    if (m) {
      const parsed = parseRawDate(m[1]);
      if (parsed) return parsed;
    }
  }
  return null;
}

// ── VPA Type from UPI Path ───────────────────────────────────────────────────

/**
 * P2M (Peer-to-Merchant) and P2A (Peer-to-Address / person) appear in the
 * UPI transaction path that Axis Bank includes verbatim in their SMS.
 * This is the most reliable classification signal when present.
 */
function detectVpaType(body: string): 'P2A' | 'P2M' | null {
  if (/UPI\/P2M\//i.test(body)) return 'P2M';
  if (/UPI\/P2A\//i.test(body)) return 'P2A';
  return null;
}

// ── Main Extractor ───────────────────────────────────────────────────────────

/**
 * Extract structured fields from any modern Indian bank transaction SMS.
 *
 * Adding support for a new bank format:
 *   1. Add amount regex to AMOUNT_PATTERNS
 *   2. Add recipient regex to RECIPIENT_PATTERNS
 *   3. Date and UPI ref patterns are usually already covered
 *
 * Returns null only when the amount (mandatory) cannot be extracted.
 */
export function extractSmsFields(rawBody: string): SmsParseResult | null {
  const body = normalize(rawBody);

  const amount = extractAmount(body);
  if (!amount) return null;

  return {
    amount,
    recipientName: extractRecipient(body),
    upiRef: extractUpiRef(body),
    date: extractDate(body),
    vpaType: detectVpaType(body),
  };
}

// ── Recipient Classification ─────────────────────────────────────────────────

/** Business-indicator keywords — override "looks like a human name" heuristic. */
const MERCHANT_KEYWORDS = new Set([
  'SHOP', 'STORE', 'MART', 'DAIRY', 'MEDICAL', 'TRADERS', 'TRADING',
  'ENTERPRISES', 'ENTERPRISE', 'SERVICES', 'SERVICE', 'FOODS', 'FOOD',
  'RESTAURANT', 'CAFE', 'HOTEL', 'PHARMACY', 'HOSPITAL', 'CLINIC',
  'PETROL', 'FUEL', 'MOTORS', 'ELECTRONICS', 'MOBILE', 'TELECOM',
  'MARKET', 'BAZAAR', 'AGENCIES', 'AGENCY', 'ASSOCIATES', 'INDUSTRIES',
  'HOUSE', 'CENTRE', 'CENTER', 'VENDORS', 'SUPPLIER', 'WHOLESALE',
  'RETAIL', 'SHO', 'SHOPPE', 'EMPORIUM', 'COLLECTIONS', 'FASHIONS',
  'HARDWARE', 'AUTO', 'GENERAL', 'JEWELLERS', 'JEWELS', 'OPTICAL',
  'STEEL', 'CEMENT', 'CHEMICALS', 'REALTY', 'BUILDERS', 'CONSTRUCTIONS',
]);

/** Known e-commerce / service brands that appear as a single word. */
const KNOWN_BRANDS = new Set([
  'SWIGGY', 'ZOMATO', 'AMAZON', 'FLIPKART', 'MEESHO', 'MYNTRA', 'NYKAA',
  'AJIO', 'BLINKIT', 'ZEPTO', 'INSTAMART', 'DUNZO', 'BIGBASKET',
  'OLA', 'UBER', 'RAPIDO', 'BOUNCE', 'YULU',
  'IRCTC', 'MAKEMYTRIP', 'GOIBIBO', 'REDBUS',
  'NETFLIX', 'HOTSTAR', 'JIOCINEMA', 'SPOTIFY',
  'UIDAI', 'EPFO', 'GSTN',
  'PAYTM', 'PHONEPE', 'GPAY', 'GOOGLEPAY', 'CRED', 'GROWW', 'ZERODHA',
  'AIRTEL', 'JIO', 'BSNL', 'VODAFONE', 'IDEA',
]);

/**
 * Classify whether the extracted recipient is a person (P2P) or a business.
 *
 * Priority (highest confidence first):
 *   1. UPI path type: P2M → merchant, P2A → personal  (always correct when present)
 *   2. KNOWN_BRANDS exact match                         (curated list)
 *   3. MERCHANT_KEYWORDS in any word                    (heuristic)
 *   4. 2–4 all-alpha words → personal                  (human name heuristic)
 *   5. Default: merchant                               (safer for categorization)
 */
export function classifyRecipient(
  name: string | null,
  vpaType: 'P2A' | 'P2M' | null,
): 'personal' | 'merchant' {
  // 1. UPI path type — most reliable
  if (vpaType === 'P2M') return 'merchant';
  if (vpaType === 'P2A') return 'personal';

  if (!name) return 'merchant';

  const upper = name.trim().toUpperCase();
  const words = upper.split(/\s+/).filter(Boolean);

  // 2. Known brand
  if (KNOWN_BRANDS.has(upper) || (words.length === 1 && KNOWN_BRANDS.has(words[0]))) {
    return 'merchant';
  }

  // 3. Business keyword in any word
  if (words.some(w => MERCHANT_KEYWORDS.has(w))) return 'merchant';

  // 4. Human name: 2–4 all-alpha words (handles initials like "RAHUL SANTOSH J")
  if (words.length >= 2 && words.length <= 4 && words.every(w => /^[A-Z]+$/.test(w))) {
    return 'personal';
  }

  // 5. Default to merchant
  return 'merchant';
}

// ── Deduplication ────────────────────────────────────────────────────────────

/**
 * Generate a deduplication key.
 * Prefers UPI reference number (globally unique) when available.
 * Falls back to amount+date+name for SMS that omit the UPI ref.
 */
export function generateDedupKey(
  amount: number,
  date: string | null,
  upiRef: string | null,
  recipientName: string | null,
): string {
  if (upiRef) return `upi:${upiRef}`;
  return `${amount}|${date ?? 'unknown'}|${(recipientName ?? 'unknown').toLowerCase()}`;
}

// ── Legacy VPA API (backward compatibility) ──────────────────────────────────
// processSms() falls back to these only when extractSmsFields() returns null,
// i.e. for very old-format VPA-based SMS that still have "@" patterns.

export { VpaType };

export interface VpaClassification {
  handle: string;
  bank: string;
  type: VpaType;
  raw: string;
}

export function classifyVpa(vpa: string): VpaClassification {
  const atIndex = vpa.indexOf('@');
  if (atIndex === -1) return { handle: vpa, bank: '', type: 'brand', raw: vpa };

  const handle = vpa.substring(0, atIndex).toLowerCase();
  const bank = vpa.substring(atIndex + 1).toLowerCase();

  const isPhoneNumber = /^\d{10}$/.test(handle);
  const isOkBank = bank.startsWith('ok');
  const isP2pBank = ['ybl', 'paytm', 'ibl', 'apl'].includes(bank);
  if (isPhoneNumber || isOkBank || isP2pBank) return { handle, bank, type: 'personal', raw: vpa };

  const hasQr = handle.includes('qr');
  const isBharatPe = handle.startsWith('bharatpe');
  const isGibberish = /^[a-z0-9]{10,}$/.test(handle) && /[a-z]/.test(handle) && /\d/.test(handle);
  const isPaytmQr = handle.startsWith('paytm') && handle.length > 5;
  if (hasQr || isBharatPe || isGibberish || isPaytmQr) return { handle, bank, type: 'dynamic_qr', raw: vpa };

  return { handle, bank, type: 'brand', raw: vpa };
}

export function formatMerchantFromVpa(handle: string, type: VpaType): string {
  if (type === 'brand') return handle.charAt(0).toUpperCase() + handle.slice(1);
  if (type === 'dynamic_qr') {
    if (handle.includes('qr')) {
      const qrIdx = handle.indexOf('qr');
      const prefix = handle.substring(0, qrIdx);
      const code = handle.substring(qrIdx + 2);
      const displayPrefix = prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : 'QR';
      const shortCode = code.length > 6 ? code.substring(0, 6) + '...' : code;
      return `${displayPrefix} QR (${shortCode})`;
    }
    const short = handle.length > 8 ? handle.substring(0, 8) + '...' : handle;
    return `Unknown (${short})`;
  }
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}

/** @deprecated — use extractSmsFields() */
export interface BasicSmsFields {
  amount: number;
  vpa: string | null;
  date: string | null;
}

/** @deprecated — use extractSmsFields(); kept for any Kotlin module compatibility */
export function extractBasicFields(body: string): BasicSmsFields | null {
  const normalized = normalize(body);
  const amountMatch = normalized.match(/(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) return null;
  const vpaMatch = body.match(/(?:to\s+)?([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i);
  const vpa = vpaMatch ? vpaMatch[1].replace(/[.,]+$/, '') : null;
  return { amount, vpa, date: extractDate(normalized) };
}
