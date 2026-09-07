/**
 * Ghana phone number utilities — parsing, validation, network detection,
 * and normalization for Arkesel SMS delivery.
 *
 * Ghana network prefixes (first 3 digits after country code):
 *   MTN:      024, 025, 054, 055, 059
 *   AirtelTigo (AT): 020, 050
 *   Vodafone: 021, 026
 *   Telecel:  027, 028
 */

const GHANA_MTN      = ["024", "025", "054", "055", "059"];
const GHANA_AT       = ["020", "050"];
const GHANA_VODAFONE = ["021", "026"];
const GHANA_TELECEL  = ["027", "028"];

const ALL_GHANA = [...GHANA_MTN, ...GHANA_AT, ...GHANA_VODAFONE, ...GHANA_TELECEL];

/**
 * Normalise a raw phone number string to E.164-without-plus format.
 * Returns null when the input cannot be a valid Ghana number.
 *
 * Handles:
 *   - "+233XXXXXXXXX"  → "233XXXXXXXXX"
 *   - "233XXXXXXXXX"   → "233XXXXXXXXX"
 *   - "0XXXXXXXXX"     → "233XXXXXXXXX"
 *   - "XXXXXXXXX" (9d) → "233XXXXXXXXX"
 */
export function normalizeGhanaPhone(raw) {
  if (!raw) return null;

  // strip all whitespace, dashes, dots, parentheses
  let s = String(raw).replace(/[\s\-().]/g, "");

  // remove leading +
  if (s.startsWith("+")) s = s.slice(1);

  // "233XXXXXXXXX" → already international (12 digits)
  if (s.startsWith("233")) {
    return s.length === 12 ? s : null;
  }

  // "0XXXXXXXXX" → replace leading 0 with 233 (→ 12 digits)
  if (s.startsWith("0") && s.length === 10) {
    return "233" + s.slice(1);
  }

  // bare 9-digit local number without leading 0
  if (/^\d{9}$/.test(s)) {
    return "233" + s;
  }

  return null;
}

/**
 * Returns true when the number is a valid 10-digit Ghanaian local number
 * OR a valid international +233 number.
 */
export function isValidGhanaPhone(raw) {
  return normalizeGhanaPhone(raw) !== null;
}

/**
 * Detect the network operator for a Ghana phone number.
 * Returns "MTN" | "AT" | "Vodafone" | "Telecel" | "Unknown".
 */
export function detectGhanaNetwork(raw) {
  const normalized = normalizeGhanaPhone(raw);
  if (!normalized) return "Unknown";

  // local prefix = the 3 digits after country code (233)
  const prefix = "0" + normalized.slice(3, 6); // e.g. "024"

  if (GHANA_MTN.includes(prefix))      return "MTN";
  if (GHANA_AT.includes(prefix))       return "AT";
  if (GHANA_VODAFONE.includes(prefix)) return "Vodafone";
  if (GHANA_TELECEL.includes(prefix))  return "Telecel";
  return "Unknown";
}

/**
 * Filter an array of raw phone strings to only those that parse as valid Ghana numbers,
 * returning their normalized form (233XXXXXXXXX).
 */
export function filterValidGhanaPhones(numbers) {
  return numbers
    .map((n) => normalizeGhanaPhone(n))
    .filter(Boolean);
}
