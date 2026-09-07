/**
 * SMS route — Arkesel gateway (v1 API).
 *
 * Phone numbers are normalised to Ghana international format (233XXXXXXXXX)
 * so that MTN (024/025/054/055/059), AT/Airtel (020/050), Vodafone, and
 * Telecel numbers are all delivered correctly.
 */

const ARKESEL_API_KEY = "SmpUeUFsRWZsd3BKZGJ6bElMang";
const ARKESEL_BASE = "https://sms.arkesel.com/sms/api";

// Registered sender / message IDs
export const SENDER_IDS = {
  default: "TeNDA PPD",
  transfer: "Transfer",
};

/**
 * Normalize a raw phone string to Arkesel-compatible format (no leading +).
 * Ghana rules:
 *   +233XXXXXXXXX → 233XXXXXXXXX  (strip +)
 *    233XXXXXXXXX → 233XXXXXXXXX  (already correct)
 *     0XXXXXXXXX  → 233XXXXXXXXX  (replace leading 0 with 233)
 *      XXXXXXXXX  → 233XXXXXXXXX  (bare 9-digit → prepend 233)
 *
 * Returns null when the input cannot be mapped to a plausible Ghana number.
 */
function normalizePhone(raw) {
  if (!raw) return null;

  // strip whitespace, dashes, dots, parentheses
  let s = String(raw).replace(/[\s\-().]/g, "");

  // remove leading +
  if (s.startsWith("+")) s = s.slice(1);

  if (s.startsWith("233")) {
    // must be 12 digits total (233 + 9)
    return s.length === 12 ? s : null;
  }

  if (s.startsWith("0") && s.length === 10) {
    // local 0XXXXXXXXX → 233XXXXXXXXX
    return "233" + s.slice(1);
  }

  if (/^\d{9}$/.test(s)) {
    // bare 9-digit
    return "233" + s;
  }

  return null; // unrecognised format
}

/**
 * POST /sms
 * Body: { to: string, message: string, senderId?: string }
 */
export default async (req, res) => {
  const { to, message, senderId } = req.body;

  if (!to || !message) {
    return res.status(422).json({ error: "to and message are required" });
  }

  const phone = normalizePhone(to);
  if (!phone) {
    return res.status(422).json({
      error: `Invalid phone number: "${to}". Expected Ghana format (e.g. 024XXXXXXX, 020XXXXXXX, +233XXXXXXXXX).`,
    });
  }

  const from = SENDER_IDS[senderId] || senderId || SENDER_IDS.default;

  const url = [
    ARKESEL_BASE,
    `?action=send-sms`,
    `&api_key=${ARKESEL_API_KEY}`,
    `&to=${encodeURIComponent(phone)}`,
    `&from=${encodeURIComponent(from)}`,
    `&sms=${encodeURIComponent(message)}`,
  ].join("");

  let data;
  try {
    const response = await fetch(url);
    data = await response.json().catch(() => ({}));

    // Arkesel v1 returns a JSON body even for errors; check the code field.
    // Successful responses have code "ok" or a numeric "100".
    const code = String(data?.code ?? "").toLowerCase();
    const success = code === "ok" || code === "100" || response.ok;

    if (!success) {
      const errMsg = data?.message || data?.detail || `HTTP ${response.status}`;
      console.error(`[SMS] Delivery to ${phone} failed: ${errMsg}`, data);
      return res.status(502).json({ error: errMsg, detail: data, phone, from });
    }
  } catch (err) {
    console.error(`[SMS] Network error sending to ${phone}:`, err);
    return res.status(502).json({ error: `SMS gateway unreachable: ${err.message}` });
  }

  console.info(`[SMS] Sent to ${phone} via "${from}"`);
  res.json({ success: true, data, phone, from });
};
