import apiServerClient from "@/lib/apiServerClient";
import { normalizeGhanaPhone, detectGhanaNetwork, filterValidGhanaPhones } from "@/lib/phoneUtils";

// Central message / sender ID registry — used by every SMS the app sends.
export const MESSAGE_IDS = {
  default: "TeNDA PPD",
  transfer: "Transfer",
};

export const SMS_SIGNATURE = `- ${MESSAGE_IDS.default}`;

// Re-export utilities for consumers that import from messaging
export { normalizeGhanaPhone, detectGhanaNetwork, filterValidGhanaPhones };

/**
 * Send an SMS through the Arkesel gateway.
 * The phone number is normalised to Ghana international format before sending,
 * so MTN (024/025/054/055/059) and AT (020/050) numbers are always delivered.
 *
 * @param {string} to - raw phone number in any Ghana format
 * @param {string} message - SMS body
 * @param {"default"|"transfer"} senderId - registered message ID
 * @returns {Promise<boolean>} true on success
 */
export async function sendSms(to, message, senderId = "default") {
  if (!to || !message) return false;

  // Normalise the number locally so we can log a meaningful value if it fails.
  const normalized = normalizeGhanaPhone(to);
  if (!normalized) {
    console.warn(`[SMS] Skipping invalid number: "${to}"`);
    return false;
  }

  const network = detectGhanaNetwork(to);

  try {
    await apiServerClient.fetch("/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Pass the already-normalised number; the server will normalise again
      // (idempotent) and add proper error handling.
      body: JSON.stringify({ to: normalized, message, senderId }),
    });
    console.info(`[SMS] Sent to ${normalized} (${network})`);
    return true;
  } catch (err) {
    console.error(`[SMS] Send failed to ${normalized} (${network}):`, err);
    return false;
  }
}

/**
 * Send the same SMS to multiple contact numbers, skipping WhatsApp numbers
 * and invalid/empty entries. De-duplicates by normalised number.
 *
 * @param {string[]} numbers - raw phone numbers (primary, alternate, alternate2, etc.)
 * @param {string} message
 * @param {"default"|"transfer"} senderId
 * @returns {Promise<{sent: number, failed: number}>}
 */
export async function sendSmsToContacts(numbers, message, senderId = "default") {
  // Normalise and de-duplicate
  const seen = new Set();
  const unique = numbers
    .filter(Boolean)
    .map((n) => normalizeGhanaPhone(n))
    .filter((n) => n && !seen.has(n) && seen.add(n));

  let sent = 0;
  let failed = 0;

  for (const phone of unique) {
    const ok = await sendSms(phone, message, senderId);
    ok ? sent++ : failed++;
  }

  return { sent, failed };
}

export default sendSms;
