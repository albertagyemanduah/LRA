/// <reference path="../pb_data/types.d.ts" />

const ARKESEL_API_KEY = "SmpUeUFsRWZsd3BKZGJ6bElMang";
const SENDER_ID = "TeNDA PPD";

/**
 * Normalize a raw Ghana phone number to international format without +.
 * Handles: +233XXXXXXXXX, 233XXXXXXXXX, 0XXXXXXXXX, bare 9-digit.
 */
function normalizeGhanaPhone(raw) {
  if (!raw) return null;
  var s = String(raw).replace(/[\s\-().]/g, "");
  if (s.charAt(0) === "+") s = s.slice(1);
  if (s.startsWith("233")) return s.length === 12 ? s : null;
  if (s.charAt(0) === "0" && s.length === 10) return "233" + s.slice(1);
  if (/^\d{9}$/.test(s)) return "233" + s;
  return null;
}

function sendSmsArkesel(phone, message) {
  if (!phone) return;
  try {
    const p = normalizeGhanaPhone(phone);
    if (!p) {
      $app.logger().warn("SMS skipped — invalid Ghana number", "raw", phone);
      return;
    }
    const url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${ARKESEL_API_KEY}&to=${encodeURIComponent(p)}&from=${encodeURIComponent(SENDER_ID)}&sms=${encodeURIComponent(message)}`;
    $http.send({ url, method: "GET" });
  } catch (err) {
    $app.logger().error("SMS send failed in password reset hook", "err", String(err));
  }
}

onMailerRecordPasswordResetSend((e) => {
  const appUrl = $app.settings().meta.appUrl || "https://tenda.gov.gh";
  const link = `${appUrl}/forgot-password?token=${e.meta.token}`;
  const phone = e.record.get("phone") || e.record.get("whatsappNumber") || "";

  // ── Email ──────────────────────────────────────────────────────────────────
  e.message.from.name = "Techiman North Land Registry";
  e.message.subject = "Reset Your Land Registry Password";
  e.message.html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:#1e3a8a;padding:20px 24px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:20px;">Techiman North District Assembly</h1>
        <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">Land Registry System</p>
      </div>
      <div style="background:#f8fafc;padding:28px 24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
        <h2 style="color:#1e293b;margin:0 0 12px;">Password Reset Request</h2>
        <p style="color:#475569;margin:0 0 20px;line-height:1.6;">
          We received a request to reset your password for the Techiman North Land Registry System.
          Click the button below to set a new password. This link is valid for <strong>30 minutes</strong>.
        </p>
        <a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
          Reset My Password
        </a>
        <p style="color:#475569;font-size:13px;margin:16px 0 4px;">Or copy this link:</p>
        <p style="color:#1e3a8a;font-size:12px;word-break:break-all;margin:0 0 20px;">${link}</p>
        <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;">
          If you did not request a password reset, you can safely ignore this email.
          Your password will not change unless you follow the link above.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
        <p style="color:#94a3b8;font-size:11px;margin:0;">
          Techiman North District Assembly &bull; Land Administration Division<br/>
          Tuobodom, Bono East Region, Ghana &bull; Sender: TeNDA PPD
        </p>
      </div>
    </div>
  `;

  // ── SMS ────────────────────────────────────────────────────────────────────
  if (phone) {
    const smsMsg = `TeNDA PPD: Reset your Land Registry password (expires 30min): ${link}`;
    sendSmsArkesel(phone, smsMsg);
  }

  e.next();
}, "users");
