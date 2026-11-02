/**
 * Patches the AMOUNT_PATTERN section in withSmsReceiver.js with the new
 * multi-bank pattern arrays. Handles backslash escaping correctly.
 *
 * Run from project root: node scripts/patch_sms_plugin.js
 */

const fs = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, '..', 'plugins', 'withSmsReceiver.js');
let src = fs.readFileSync(pluginPath, 'utf8');

// ── The OLD single-pattern line we're removing ────────────────────────────────
const OLD_AMOUNT_PATTERN = /    private val AMOUNT_PATTERN = Regex\(.+?\n/;

// ── Check it exists ──────────────────────────────────────────────────────────
if (!OLD_AMOUNT_PATTERN.test(src)) {
  console.log('AMOUNT_PATTERN line not found — may already be patched. Checking for AMOUNT_PATTERNS...');
  if (src.includes('private val AMOUNT_PATTERNS')) {
    console.log('Already patched. Nothing to do.');
    process.exit(0);
  } else {
    console.error('ERROR: Could not find AMOUNT_PATTERN or AMOUNT_PATTERNS. Manual fix needed.');
    process.exit(1);
  }
}

// ── New declarations to insert in place of AMOUNT_PATTERN ────────────────────
// Each \\s in JS template literal source → \s in the JS string value → correct in Kotlin raw string
// So we write the exact bytes that should appear in the JS template literal source.
// In this script, we're constructing those bytes using JS string operations.

// Helper: build a Kotlin Regex() declaration inside the JS template literal.
// Inside the JS template literal, Kotlin raw-string backslashes need to be doubled.
// e.g. Kotlin regex \s (one backslash) → needs \\s in the JS template literal
// We represent these as actual JS string characters since we're writing with fs.writeFileSync.
function kRegex(pattern, options) {
  const optPart = options ? `, RegexOption.${options}` : '';
  return `Regex("""${pattern}"""${optPart})`;
}

const bs = '\\'; // one backslash character

const NEW_DECLARATIONS = `    // Multi-bank amount extraction — specific patterns before generic fallback
    private val AMOUNT_PATTERNS = listOf(
        ${kRegex(`[Ss]ent${bs}${bs}s+Rs${bs}.?${bs}${bs}s*([${bs}${bs}d,]+(?:${bs}.${bs}${bs}d{1,2})?)`)},
        ${kRegex(`INR${bs}${bs}s+([${bs}${bs}d,]+(?:${bs}.${bs}${bs}d{1,2})?)${bs}${bs}s+debited`, 'IGNORE_CASE')},
        ${kRegex(`debited${bs}${bs}s+for${bs}${bs}s+Rs${bs}.?${bs}${bs}s*([${bs}${bs}d,]+(?:${bs}.${bs}${bs}d{1,2})?)`, 'IGNORE_CASE')},
        ${kRegex(`debited${bs}${bs}s+INR${bs}${bs}s+([${bs}${bs}d,]+(?:${bs}.${bs}${bs}d{1,2})?)`, 'IGNORE_CASE')},
        ${kRegex(`(?:Rs${bs}.?|₹|INR)${bs}${bs}s*([${bs}${bs}d,]+(?:${bs}.${bs}${bs}d{1,2})?)`, 'IGNORE_CASE')}
    )

    // UPI transaction reference number patterns
    private val UPI_REF_PATTERNS = listOf(
        ${kRegex(`UPI${bs}${bs}s+Ref${bs}${bs}s+(${bs}${bs}d+)`, 'IGNORE_CASE')},
        ${kRegex(`UPI/P2[MA]/(${bs}${bs}d+)`, 'IGNORE_CASE')},
        ${kRegex(`UPI:(${bs}${bs}d+)`, 'IGNORE_CASE')},
        ${kRegex(`UPI[:/\s]+(${bs}${bs}d{10,})`, 'IGNORE_CASE')}
    )

    // Recipient name extraction — Kotak, PNB, ICICI, Axis UPI path
    private val RECIPIENT_PATTERNS = listOf(
        ${kRegex(`${bs}${bs}bto${bs}${bs}s+(.+?)${bs}${bs}s+on${bs}${bs}s+${bs}${bs}d{1,2}[-/]`, 'IGNORE_CASE')},
        ${kRegex(`${bs}${bs}bto${bs}${bs}s+(.+?)${bs}${bs}s+thru${bs}${bs}s+UPI`, 'IGNORE_CASE')},
        ${kRegex(`;${bs}${bs}s*(.+?)${bs}${bs}s+credited`, 'IGNORE_CASE')},
        ${kRegex(`UPI/P2[MA]/${bs}${bs}d+/(.+?)(?=${bs}${bs}s+(?:Not${bs}${bs}s+you|SMS${bs}${bs}s+BLOCK|${bs}${bs}d{2}-${bs}${bs}d{2})|${bs}${bs}z)`, 'IGNORE_CASE')}
    )

    private val MERCHANT_KEYWORDS = setOf(
        "SHOP", "STORE", "MART", "DAIRY", "MEDICAL", "TRADERS", "TRADING",
        "ENTERPRISES", "ENTERPRISE", "SERVICES", "SERVICE", "FOODS", "FOOD",
        "RESTAURANT", "CAFE", "HOTEL", "PHARMACY", "HOSPITAL", "CLINIC",
        "PETROL", "FUEL", "MOTORS", "ELECTRONICS", "MOBILE", "TELECOM",
        "MARKET", "BAZAAR", "AGENCIES", "AGENCY", "ASSOCIATES", "INDUSTRIES",
        "HOUSE", "CENTRE", "CENTER", "VENDORS", "SUPPLIER", "WHOLESALE",
        "RETAIL", "SHO", "SHOPPE", "EMPORIUM", "COLLECTIONS", "FASHIONS",
        "HARDWARE", "AUTO", "GENERAL", "JEWELLERS", "JEWELS", "OPTICAL"
    )

    private val KNOWN_BRANDS = setOf(
        "SWIGGY", "ZOMATO", "AMAZON", "FLIPKART", "MEESHO", "MYNTRA", "NYKAA",
        "AJIO", "BLINKIT", "ZEPTO", "INSTAMART", "DUNZO", "BIGBASKET",
        "OLA", "UBER", "RAPIDO", "IRCTC", "MAKEMYTRIP", "GOIBIBO", "REDBUS",
        "NETFLIX", "HOTSTAR", "JIOCINEMA", "SPOTIFY", "UIDAI", "EPFO",
        "PAYTM", "PHONEPE", "GPAY", "GOOGLEPAY", "CRED", "GROWW", "ZERODHA",
        "AIRTEL", "JIO", "BSNL", "VODAFONE", "IDEA"
    )

`;

src = src.replace(OLD_AMOUNT_PATTERN, NEW_DECLARATIONS);

fs.writeFileSync(pluginPath, src, 'utf8');
console.log('✅ withSmsReceiver.js patched successfully!');
console.log('   → Removed: AMOUNT_PATTERN (old single-pattern)');
console.log('   → Added:   AMOUNT_PATTERNS, UPI_REF_PATTERNS, RECIPIENT_PATTERNS,');
console.log('              MERCHANT_KEYWORDS, KNOWN_BRANDS');
console.log('');
console.log('Next step: npx expo prebuild --platform android && npx expo run:android');
