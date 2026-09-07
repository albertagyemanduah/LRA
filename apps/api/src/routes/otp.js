import pocketbaseClient from "../utils/pocketbaseClient.js";

const ARKESEL_API_KEY = "SmpUeUFsRWZsd3BKZGJ6bElMang";
const ARKESEL_BASE = "https://sms.arkesel.com/sms/api";
const SENDER_ID = "TeNDA PPD";
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds between OTP sends

/**
 * Normalize a Ghana phone number to international format (no +).
 * Returns null if unrecognisable.
 */
function normalizePhone(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/[\s\-().]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("233")) return s.length === 12 ? s : null;
  if (s.startsWith("0") && s.length === 10) return "233" + s.slice(1);
  if (/^\d{9}$/.test(s)) return "233" + s;
  return null;
}

async function sendSms(to, message) {
  if (!to) return;
  const phone = normalizePhone(to);
  if (!phone) return;
  const url = `${ARKESEL_BASE}?action=send-sms&api_key=${ARKESEL_API_KEY}&to=${encodeURIComponent(phone)}&from=${encodeURIComponent(SENDER_ID)}&sms=${encodeURIComponent(message)}`;
  try {
    await fetch(url);
  } catch (_) {}
}

export const sendOtp = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(422).json({ error: "userId is required" });

  // Get user info
  let user;
  try {
    user = await pocketbaseClient.collection("users").getOne(userId);
  } catch (_) {
    return res.status(404).json({ error: "User not found" });
  }

  // Cooldown check — prevent duplicate OTP within 60 seconds
  try {
    const recent = await pocketbaseClient.collection("otp_sessions").getList(1, 1, {
      filter: `userId = "${userId}" && used = false`,
      sort: "-created",
      requestKey: `otp-cooldown-${userId}`,
    });
    if (recent.items.length > 0) {
      const lastCreated = new Date(recent.items[0].created).getTime();
      const elapsed = Date.now() - lastCreated;
      if (elapsed < OTP_COOLDOWN_MS) {
        const remaining = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({
          error: `Please wait ${remaining}s before requesting a new code.`,
          retryAfter: remaining,
        });
      }
    }
  } catch (_) {}

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Save OTP to PocketBase
  await pocketbaseClient.collection("otp_sessions").create({
    userId,
    email: user.email || "",
    // Only store the SMS phone, never WhatsApp
    phone: user.phone || "",
    code,
    expiresAt,
    used: false,
  });

  const smsPhone = user.phone;
  const otpMsg = `TeNDA Login Code: ${code}. Valid for 10 minutes. Do not share this code.`;

  // 1. Primary contact — always send (SMS) if present
  let primarySent = false;
  if (smsPhone) {
    await sendSms(smsPhone, otpMsg);
    primarySent = true;
  }

  // WhatsApp is NOT used as an OTP delivery channel. OTP is delivered only via
  // the primary SMS contact and email (email is sent by the otp-email hook).
  const whatsappSent = false;

  // 2. Email — sent by the PocketBase otp-email hook on record create
  const emailSent = !!(user.email);

  const maskPhone = (raw) => {
    if (!raw) return null;
    const n = normalizePhone(raw) || raw;
    return String(n).slice(0, 5) + "****" + String(n).slice(-2);
  };

  res.json({
    success: true,
    emailSent,
    primarySent,
    whatsappSent,
    // keep legacy fields for any older clients
    smsSent: primarySent,
    maskedEmail: user.email ? user.email.replace(/(.{2}).+(@.+)/, "$1***$2") : null,
    maskedPrimary: maskPhone(smsPhone),
    maskedWhatsapp: null,
    maskedPhone: maskPhone(smsPhone),
    channels: [
      emailSent ? "email" : null,
      primarySent ? "primary" : null,
    ].filter(Boolean),
  });
};

export const verifyOtp = async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return res.status(422).json({ error: "userId and code are required" });

  // Find matching session
  let sessions;
  try {
    sessions = await pocketbaseClient.collection("otp_sessions").getFullList({
      filter: `userId = "${userId}" && code = "${code}" && used = false`,
      sort: "-created",
      requestKey: `otp-verify-${userId}`,
    });
  } catch (_) {
    return res.status(400).json({ error: "Invalid code" });
  }

  if (!sessions || sessions.length === 0) {
    return res.status(400).json({ error: "Invalid or expired code" });
  }

  const session = sessions[0];
  const expiry = new Date(session.expiresAt).getTime();
  if (Date.now() > expiry) {
    return res.status(400).json({ error: "Code has expired. Please request a new one." });
  }

  // Mark as used
  try {
    await pocketbaseClient.collection("otp_sessions").update(session.id, { used: true });
  } catch (_) {}

  res.json({ success: true, verified: true });
};
