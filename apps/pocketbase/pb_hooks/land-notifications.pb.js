/// <reference path="../pb_data/types.d.ts" />

// Land lifecycle notifications — SMS + Email
//   1. Registration  → notify land owner (applicant) when a parcel is created
//   2. Transfer approval → notify old owner AND new owner
//   3. Edit approval     → notify land owner
// Each message includes the relevant land details and the acting officer's
// name + contact. SMS is delivered via Arkesel; email via the built-in mailer.
//
// IMPORTANT: Each callback is fully self-contained. PocketBase runs hook
// callbacks in an isolated JSVM scope, so helpers/consts declared at the file
// top level are NOT accessible inside callbacks. Every helper used below is
// defined inside the callback that uses it.

// ── 1. REGISTRATION notification (parcel created) ─────────────────────────
onRecordAfterCreateSuccess((e) => {
  const LN_ARKESEL_KEY = "SmpUeUFsRWZsd3BKZGJ6bElMang";
  const LN_SENDER_ID = "TeNDA PPD";
  const LN_APP_NAME = "Techiman North Land Registry";

  const lnNormalizePhone = (raw) => {
    if (!raw) return null;
    var s = String(raw).replace(/[\s\-().]/g, "");
    if (s.charAt(0) === "+") s = s.slice(1);
    if (s.startsWith("233")) return s.length === 12 ? s : null;
    if (s.charAt(0) === "0" && s.length === 10) return "233" + s.slice(1);
    if (/^\d{9}$/.test(s)) return "233" + s;
    return null;
  };
  const lnSendSms = (phone, message) => {
    if (!phone || !message) return;
    try {
      const p = lnNormalizePhone(phone);
      if (!p) { $app.logger().warn("land-notif SMS skipped — invalid number", "raw", phone); return; }
      const url = "https://sms.arkesel.com/sms/api?action=send-sms&api_key=" +
        LN_ARKESEL_KEY + "&to=" + encodeURIComponent(p) +
        "&from=" + encodeURIComponent(LN_SENDER_ID) + "&sms=" + encodeURIComponent(message);
      $http.send({ url: url, method: "GET" });
    } catch (err) { $app.logger().error("land-notif SMS failed", "err", String(err)); }
  };
  const lnSendEmail = (toEmail, subject, html) => {
    if (!toEmail) return;
    try {
      const msg = new MailerMessage({ from: { name: LN_APP_NAME }, to: [{ address: toEmail }], subject: subject, html: html });
      $app.newMailClient().send(msg);
    } catch (err) { $app.logger().error("land-notif email failed", "to", toEmail, "err", String(err)); }
  };
  const lnUserSummary = (id) => {
    if (!id) return null;
    try {
      const u = $app.findRecordById("users", id);
      return { name: u.getString("fullName") || u.getString("name") || u.getString("email") || "", email: u.getString("email") || "", phone: u.getString("phone") || u.getString("whatsappNumber") || "", role: u.getString("role") || "" };
    } catch (_) { return null; }
  };
  const lnFmtDate = (iso) => {
    if (!iso) return "—";
    try { const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso; return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" }); } catch (_) { return iso; }
  };
  const lnEmailShell = (title, bodyHtml) => {
    return '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">' +
      '<div style="background:#1e3a8a;padding:20px 24px;border-radius:12px 12px 0 0">' +
      '<h1 style="color:#fff;margin:0;font-size:20px">' + LN_APP_NAME + '</h1>' +
      '<p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Techiman North District Assembly — Land Administration</p>' +
      '</div><div style="background:#f8fafc;padding:28px 24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">' +
      '<h2 style="color:#1e293b;margin:0 0 12px">' + title + '</h2>' + bodyHtml +
      '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>' +
      '<p style="color:#94a3b8;font-size:11px;margin:0">Techiman North District Assembly &bull; Land Administration Division<br/>' +
      'Tuobodom, Bono East Region, Ghana &bull; Sender: ' + LN_SENDER_ID + '</p></div></div>';
  };

  try {
    const parcel = {
      parcelNumber: e.record.getString("parcelNumber") || "—",
      plotNumber: e.record.getString("plotNumber") || "—",
      block: e.record.getString("block") || "—",
      community: e.record.getString("community") || "—",
      areaCouncil: e.record.getString("areaCouncil") || "—",
      sector: e.record.getString("sector") || "—",
      applicantName: e.record.getString("applicantName") || "",
      contactPhone: e.record.getString("contactPhone") || "",
      applicantEmail: e.record.getString("applicantEmail") || "",
      allocationDate: e.record.getString("allocationDate") || "",
      registrationDate: e.record.getString("registrationDate") || "",
    };
    const ownerId = e.record.getString("owner");
    const officer = lnUserSummary(ownerId);

    if (!parcel.contactPhone && !parcel.applicantEmail) { e.next(); return; }

    const ownerName = parcel.applicantName || "Land Owner";
    const officerName = (officer && officer.name) ? officer.name : "Registration Officer";
    const officerPhone = (officer && officer.phone) ? officer.phone : "—";
    const officerEmail = (officer && officer.email) ? officer.email : "—";
    const landStr = "Parcel " + parcel.parcelNumber + ", Plot " + parcel.plotNumber + "/" + parcel.block +
      ", " + parcel.community + " (" + parcel.areaCouncil + ")";
    const regDate = lnFmtDate(parcel.registrationDate) || lnFmtDate(e.record.getString("created"));

    const sms = LN_APP_NAME + ": Land registered successfully. " + ownerName + ", " + landStr +
      ". Reg date: " + regDate + ". Officer: " + officerName + ", " + officerPhone +
      ". Ref: " + parcel.parcelNumber + ".";
    lnSendSms(parcel.contactPhone, sms);

    if (parcel.applicantEmail) {
      const body =
        '<p>Dear ' + ownerName + ',</p>' +
        '<p>Your land has been successfully registered with the Techiman North District Assembly Land Registry.</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Parcel Number</td><td style="padding:8px;border:1px solid #e5e7eb">' + parcel.parcelNumber + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Plot / Block</td><td style="padding:8px;border:1px solid #e5e7eb">' + parcel.plotNumber + ' / ' + parcel.block + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Community</td><td style="padding:8px;border:1px solid #e5e7eb">' + parcel.community + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Area Council</td><td style="padding:8px;border:1px solid #e5e7eb">' + parcel.areaCouncil + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Registration Date</td><td style="padding:8px;border:1px solid #e5e7eb">' + regDate + '</td></tr>' +
        '</table>' +
        '<h3 style="color:#1e3a8a;margin-top:20px">Registration Officer</h3>' +
        '<p style="margin:4px 0"><strong>Name:</strong> ' + officerName + '<br/>' +
        '<strong>Phone:</strong> ' + officerPhone + '<br/>' +
        '<strong>Email:</strong> ' + officerEmail + '</p>' +
        '<p style="color:#6b7280;font-size:13px;margin-top:16px">Keep this reference safe. For any enquiry, contact the registration officer above or visit your nearest District Assembly office.</p>';
      lnSendEmail(parcel.applicantEmail, "Land Registration Confirmed — " + parcel.parcelNumber, lnEmailShell("Land Registration Confirmed", body));
    }
  } catch (err) {
    $app.logger().error("land-notif registration hook failed", "err", String(err));
  }
  e.next();
}, "parcels");

// ── 2. TRANSFER approval/rejection notification ───────────────────────────
onRecordAfterUpdateSuccess((e) => {
  const LN_ARKESEL_KEY = "SmpUeUFsRWZsd3BKZGJ6bElMang";
  const LN_SENDER_ID = "TeNDA PPD";
  const LN_APP_NAME = "Techiman North Land Registry";

  const lnNormalizePhone = (raw) => {
    if (!raw) return null;
    var s = String(raw).replace(/[\s\-().]/g, "");
    if (s.charAt(0) === "+") s = s.slice(1);
    if (s.startsWith("233")) return s.length === 12 ? s : null;
    if (s.charAt(0) === "0" && s.length === 10) return "233" + s.slice(1);
    if (/^\d{9}$/.test(s)) return "233" + s;
    return null;
  };
  const lnSendSms = (phone, message) => {
    if (!phone || !message) return;
    try {
      const p = lnNormalizePhone(phone);
      if (!p) { $app.logger().warn("land-notif SMS skipped — invalid number", "raw", phone); return; }
      const url = "https://sms.arkesel.com/sms/api?action=send-sms&api_key=" +
        LN_ARKESEL_KEY + "&to=" + encodeURIComponent(p) +
        "&from=" + encodeURIComponent(LN_SENDER_ID) + "&sms=" + encodeURIComponent(message);
      $http.send({ url: url, method: "GET" });
    } catch (err) { $app.logger().error("land-notif SMS failed", "err", String(err)); }
  };
  const lnSendEmail = (toEmail, subject, html) => {
    if (!toEmail) return;
    try {
      const msg = new MailerMessage({ from: { name: LN_APP_NAME }, to: [{ address: toEmail }], subject: subject, html: html });
      $app.newMailClient().send(msg);
    } catch (err) { $app.logger().error("land-notif email failed", "to", toEmail, "err", String(err)); }
  };
  const lnUserSummary = (id) => {
    if (!id) return null;
    try {
      const u = $app.findRecordById("users", id);
      return { name: u.getString("fullName") || u.getString("name") || u.getString("email") || "", email: u.getString("email") || "", phone: u.getString("phone") || u.getString("whatsappNumber") || "", role: u.getString("role") || "" };
    } catch (_) { return null; }
  };
  const lnParcelSummary = (id) => {
    if (!id) return null;
    try {
      const p = $app.findRecordById("parcels", id);
      return { parcelNumber: p.getString("parcelNumber") || "—", plotNumber: p.getString("plotNumber") || "—", block: p.getString("block") || "—", community: p.getString("community") || "—", areaCouncil: p.getString("areaCouncil") || "—", sector: p.getString("sector") || "—", applicantName: p.getString("applicantName") || "", contactPhone: p.getString("contactPhone") || "", applicantEmail: p.getString("applicantEmail") || "", allocationDate: p.getString("allocationDate") || "", registrationDate: p.getString("registrationDate") || "" };
    } catch (_) { return null; }
  };
  const lnFmtDate = (iso) => {
    if (!iso) return "—";
    try { const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso; return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" }); } catch (_) { return iso; }
  };
  const lnLandLine = (parcel) => {
    if (!parcel) return "";
    return "Parcel " + parcel.parcelNumber + ", Plot " + parcel.plotNumber + "/" + parcel.block +
      ", " + parcel.community + " (" + parcel.areaCouncil + ")";
  };
  const lnEmailShell = (title, bodyHtml) => {
    return '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">' +
      '<div style="background:#1e3a8a;padding:20px 24px;border-radius:12px 12px 0 0">' +
      '<h1 style="color:#fff;margin:0;font-size:20px">' + LN_APP_NAME + '</h1>' +
      '<p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Techiman North District Assembly — Land Administration</p>' +
      '</div><div style="background:#f8fafc;padding:28px 24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">' +
      '<h2 style="color:#1e293b;margin:0 0 12px">' + title + '</h2>' + bodyHtml +
      '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>' +
      '<p style="color:#94a3b8;font-size:11px;margin:0">Techiman North District Assembly &bull; Land Administration Division<br/>' +
      'Tuobodom, Bono East Region, Ghana &bull; Sender: ' + LN_SENDER_ID + '</p></div></div>';
  };

  try {
    const txStatus = e.record.getString("status");
    if (txStatus !== "approved" && txStatus !== "rejected") { e.next(); return; }

    if (txStatus === "rejected") {
      const parcelR = lnParcelSummary(e.record.getString("parcel"));
      const fromOwnerR = lnUserSummary(e.record.getString("fromOwner"));
      const officerR = lnUserSummary(e.record.getString("reviewedBy"));
      const initiatorName = (fromOwnerR && fromOwnerR.name) ? fromOwnerR.name : (parcelR ? parcelR.applicantName : "Land Owner");
      const initiatorPhone = (fromOwnerR && fromOwnerR.phone) ? fromOwnerR.phone : (parcelR ? parcelR.contactPhone : "");
      const initiatorEmail = (fromOwnerR && fromOwnerR.email) ? fromOwnerR.email : (parcelR ? parcelR.applicantEmail : "");
      const officerNameR = (officerR && officerR.name) ? officerR.name : "Reviewing Officer";
      const officerPhoneR = (officerR && officerR.phone) ? officerR.phone : "—";
      const reviewComment = e.record.getString("reviewComment") || "No reason provided";
      const landStrR = lnLandLine(parcelR);
      lnSendSms(initiatorPhone,
        LN_APP_NAME + ": Land transfer REJECTED. " + initiatorName + ", your transfer request for " + landStrR +
        " was rejected. Reason: " + reviewComment + ". Officer: " + officerNameR + ", " + officerPhoneR + ".");
      if (initiatorEmail) {
        const body = '<p>Dear ' + initiatorName + ',</p>' +
          '<p>Your land transfer request has been <strong style="color:#dc2626">REJECTED</strong>.</p>' +
          '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
          '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Land</td><td style="padding:8px;border:1px solid #e5e7eb">' + landStrR + '</td></tr>' +
          '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Rejection Reason</td><td style="padding:8px;border:1px solid #e5e7eb">' + reviewComment + '</td></tr>' +
          '</table><p>Please contact the reviewing officer for further assistance.</p>' +
          '<h3 style="color:#1e3a8a;margin-top:20px">Reviewing Officer</h3>' +
          '<p style="margin:4px 0"><strong>Name:</strong> ' + officerNameR + '<br/><strong>Phone:</strong> ' + officerPhoneR + '</p>';
        lnSendEmail(initiatorEmail, "Land Transfer Rejected", lnEmailShell("Land Transfer Rejected", body));
      }
      e.next(); return;
    }

    const parcel = lnParcelSummary(e.record.getString("parcel"));
    const oldOwner = lnUserSummary(e.record.getString("fromOwner"));
    const newOwnerUser = lnUserSummary(e.record.getString("toOwnerUser"));
    const officer = lnUserSummary(e.record.getString("reviewedBy"));

    const newOwnerName = (newOwnerUser && newOwnerUser.name) ? newOwnerUser.name : (e.record.getString("toOwnerName") || "New Owner");
    const newOwnerPhone = (newOwnerUser && newOwnerUser.phone) ? newOwnerUser.phone : (e.record.getString("toOwnerPhone") || "");
    const newOwnerEmail = (newOwnerUser && newOwnerUser.email) ? newOwnerUser.email : "";
    const oldOwnerName = (oldOwner && oldOwner.name) ? oldOwner.name : (parcel ? parcel.applicantName : "Previous Owner");
    const oldOwnerPhone = (oldOwner && oldOwner.phone) ? oldOwner.phone : (parcel ? parcel.contactPhone : "");
    const oldOwnerEmail = (oldOwner && oldOwner.email) ? oldOwner.email : (parcel ? parcel.applicantEmail : "");
    const officerName = (officer && officer.name) ? officer.name : "Approving Officer";
    const officerPhone = (officer && officer.phone) ? officer.phone : "—";
    const officerEmail = (officer && officer.email) ? officer.email : "—";
    const cert = e.record.getString("certificateNumber") || "—";
    const landStr = lnLandLine(parcel);
    const transferDate = lnFmtDate(e.record.getString("updated") || e.record.getString("created"));

    lnSendSms(oldOwnerPhone,
      LN_APP_NAME + ": Transfer APPROVED. " + oldOwnerName + ", your land (" + landStr +
      ") is now transferred to " + newOwnerName + " (" + newOwnerPhone + "). Cert: " + cert +
      ". Officer: " + officerName + ", " + officerPhone + ".");
    lnSendSms(newOwnerPhone,
      LN_APP_NAME + ": Transfer APPROVED. " + newOwnerName + ", you are now the registered owner of " + landStr +
      ". Transferred from " + oldOwnerName + " (" + oldOwnerPhone + "). Cert: " + cert +
      ". Officer: " + officerName + ", " + officerPhone + ".");

    if (oldOwnerEmail) {
      const body = '<p>Dear ' + oldOwnerName + ',</p>' +
        '<p>Your land transfer request has been <strong style="color:#16a34a">APPROVED</strong>. Ownership has been officially transferred.</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Land</td><td style="padding:8px;border:1px solid #e5e7eb">' + landStr + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">New Owner</td><td style="padding:8px;border:1px solid #e5e7eb">' + newOwnerName + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">New Owner Contact</td><td style="padding:8px;border:1px solid #e5e7eb">' + newOwnerPhone + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Certificate No.</td><td style="padding:8px;border:1px solid #e5e7eb">' + cert + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Transfer Date</td><td style="padding:8px;border:1px solid #e5e7eb">' + transferDate + '</td></tr>' +
        '</table>' +
        '<h3 style="color:#1e3a8a;margin-top:20px">Approving Officer</h3>' +
        '<p style="margin:4px 0"><strong>Name:</strong> ' + officerName + '<br/><strong>Phone:</strong> ' + officerPhone + '<br/><strong>Email:</strong> ' + officerEmail + '</p>';
      lnSendEmail(oldOwnerEmail, "Land Transfer Approved — " + (parcel ? parcel.parcelNumber : ""), lnEmailShell("Land Transfer Approved", body));
    }
    if (newOwnerEmail) {
      const body = '<p>Dear ' + newOwnerName + ',</p>' +
        '<p>You are now the registered owner of a land parcel. The transfer has been <strong style="color:#16a34a">APPROVED</strong> by the District Assembly.</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Land</td><td style="padding:8px;border:1px solid #e5e7eb">' + landStr + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Previous Owner</td><td style="padding:8px;border:1px solid #e5e7eb">' + oldOwnerName + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Previous Owner Contact</td><td style="padding:8px;border:1px solid #e5e7eb">' + oldOwnerPhone + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Certificate No.</td><td style="padding:8px;border:1px solid #e5e7eb">' + cert + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Transfer Date</td><td style="padding:8px;border:1px solid #e5e7eb">' + transferDate + '</td></tr>' +
        '</table>' +
        '<h3 style="color:#1e3a8a;margin-top:20px">Approving Officer</h3>' +
        '<p style="margin:4px 0"><strong>Name:</strong> ' + officerName + '<br/><strong>Phone:</strong> ' + officerPhone + '<br/><strong>Email:</strong> ' + officerEmail + '</p>';
      lnSendEmail(newOwnerEmail, "Land Transfer Approved — You Are Now the Owner", lnEmailShell("Land Transfer Approved", body));
    }
  } catch (err) {
    $app.logger().error("land-notif transfer hook failed", "err", String(err));
  }
  e.next();
}, "land_transfers");

// ── 3. EDIT approval/rejection notification ────────────────────────────────
onRecordAfterUpdateSuccess((e) => {
  const LN_ARKESEL_KEY = "SmpUeUFsRWZsd3BKZGJ6bElMang";
  const LN_SENDER_ID = "TeNDA PPD";
  const LN_APP_NAME = "Techiman North Land Registry";

  const lnNormalizePhone = (raw) => {
    if (!raw) return null;
    var s = String(raw).replace(/[\s\-().]/g, "");
    if (s.charAt(0) === "+") s = s.slice(1);
    if (s.startsWith("233")) return s.length === 12 ? s : null;
    if (s.charAt(0) === "0" && s.length === 10) return "233" + s.slice(1);
    if (/^\d{9}$/.test(s)) return "233" + s;
    return null;
  };
  const lnSendSms = (phone, message) => {
    if (!phone || !message) return;
    try {
      const p = lnNormalizePhone(phone);
      if (!p) { $app.logger().warn("land-notif SMS skipped — invalid number", "raw", phone); return; }
      const url = "https://sms.arkesel.com/sms/api?action=send-sms&api_key=" +
        LN_ARKESEL_KEY + "&to=" + encodeURIComponent(p) +
        "&from=" + encodeURIComponent(LN_SENDER_ID) + "&sms=" + encodeURIComponent(message);
      $http.send({ url: url, method: "GET" });
    } catch (err) { $app.logger().error("land-notif SMS failed", "err", String(err)); }
  };
  const lnSendEmail = (toEmail, subject, html) => {
    if (!toEmail) return;
    try {
      const msg = new MailerMessage({ from: { name: LN_APP_NAME }, to: [{ address: toEmail }], subject: subject, html: html });
      $app.newMailClient().send(msg);
    } catch (err) { $app.logger().error("land-notif email failed", "to", toEmail, "err", String(err)); }
  };
  const lnUserSummary = (id) => {
    if (!id) return null;
    try {
      const u = $app.findRecordById("users", id);
      return { name: u.getString("fullName") || u.getString("name") || u.getString("email") || "", email: u.getString("email") || "", phone: u.getString("phone") || u.getString("whatsappNumber") || "", role: u.getString("role") || "" };
    } catch (_) { return null; }
  };
  const lnParcelSummary = (id) => {
    if (!id) return null;
    try {
      const p = $app.findRecordById("parcels", id);
      return { parcelNumber: p.getString("parcelNumber") || "—", plotNumber: p.getString("plotNumber") || "—", block: p.getString("block") || "—", community: p.getString("community") || "—", areaCouncil: p.getString("areaCouncil") || "—", sector: p.getString("sector") || "—", applicantName: p.getString("applicantName") || "", contactPhone: p.getString("contactPhone") || "", applicantEmail: p.getString("applicantEmail") || "", allocationDate: p.getString("allocationDate") || "", registrationDate: p.getString("registrationDate") || "" };
    } catch (_) { return null; }
  };
  const lnFmtDate = (iso) => {
    if (!iso) return "—";
    try { const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso; return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" }); } catch (_) { return iso; }
  };
  const lnLandLine = (parcel) => {
    if (!parcel) return "";
    return "Parcel " + parcel.parcelNumber + ", Plot " + parcel.plotNumber + "/" + parcel.block +
      ", " + parcel.community + " (" + parcel.areaCouncil + ")";
  };
  const lnEmailShell = (title, bodyHtml) => {
    return '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">' +
      '<div style="background:#1e3a8a;padding:20px 24px;border-radius:12px 12px 0 0">' +
      '<h1 style="color:#fff;margin:0;font-size:20px">' + LN_APP_NAME + '</h1>' +
      '<p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Techiman North District Assembly — Land Administration</p>' +
      '</div><div style="background:#f8fafc;padding:28px 24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">' +
      '<h2 style="color:#1e293b;margin:0 0 12px">' + title + '</h2>' + bodyHtml +
      '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>' +
      '<p style="color:#94a3b8;font-size:11px;margin:0">Techiman North District Assembly &bull; Land Administration Division<br/>' +
      'Tuobodom, Bono East Region, Ghana &bull; Sender: ' + LN_SENDER_ID + '</p></div></div>';
  };

  try {
    const erStatus = e.record.getString("status");
    if (erStatus !== "approved" && erStatus !== "rejected") { e.next(); return; }

    if (erStatus === "rejected") {
      const parcelR2 = lnParcelSummary(e.record.getString("parcel"));
      const ownerR2 = lnUserSummary(e.record.getString("requestedBy"));
      const officerR2 = lnUserSummary(e.record.getString("reviewedBy"));
      const ownerNameR2 = (parcelR2 && parcelR2.applicantName) ? parcelR2.applicantName : ((ownerR2 && ownerR2.name) ? ownerR2.name : "Land Owner");
      const ownerPhoneR2 = (parcelR2 && parcelR2.contactPhone) ? parcelR2.contactPhone : ((ownerR2 && ownerR2.phone) ? ownerR2.phone : "");
      const ownerEmailR2 = (parcelR2 && parcelR2.applicantEmail) ? parcelR2.applicantEmail : ((ownerR2 && ownerR2.email) ? ownerR2.email : "");
      const officerNameR2 = (officerR2 && officerR2.name) ? officerR2.name : "Reviewing Officer";
      const officerPhoneR2 = (officerR2 && officerR2.phone) ? officerR2.phone : "—";
      const reviewCommentR2 = e.record.getString("reviewComment") || "No reason provided";
      const landStrR2 = lnLandLine(parcelR2);
      const editType = e.record.getString("type") || "edit";
      lnSendSms(ownerPhoneR2,
        LN_APP_NAME + ": Land " + editType + " REJECTED. " + ownerNameR2 + ", your " + editType + " request for " + landStrR2 +
        " was rejected. Reason: " + reviewCommentR2 + ". Officer: " + officerNameR2 + ", " + officerPhoneR2 + ".");
      if (ownerEmailR2) {
        const body = '<p>Dear ' + ownerNameR2 + ',</p>' +
          '<p>Your land ' + editType + ' request has been <strong style="color:#dc2626">REJECTED</strong>.</p>' +
          '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
          '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Land</td><td style="padding:8px;border:1px solid #e5e7eb">' + landStrR2 + '</td></tr>' +
          '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Rejection Reason</td><td style="padding:8px;border:1px solid #e5e7eb">' + reviewCommentR2 + '</td></tr>' +
          '</table><h3 style="color:#1e3a8a;margin-top:20px">Reviewing Officer</h3>' +
          '<p style="margin:4px 0"><strong>Name:</strong> ' + officerNameR2 + '<br/><strong>Phone:</strong> ' + officerPhoneR2 + '</p>';
        lnSendEmail(ownerEmailR2, "Land " + editType + " Request Rejected", lnEmailShell("Land Request Rejected", body));
      }
      e.next(); return;
    }

    const parcel = lnParcelSummary(e.record.getString("parcel"));
    const owner = lnUserSummary(e.record.getString("requestedBy"));
    const officer = lnUserSummary(e.record.getString("reviewedBy"));
    const ownerName = (parcel && parcel.applicantName) ? parcel.applicantName : ((owner && owner.name) ? owner.name : "Land Owner");
    const ownerPhone = (parcel && parcel.contactPhone) ? parcel.contactPhone : ((owner && owner.phone) ? owner.phone : "");
    const ownerEmail = (parcel && parcel.applicantEmail) ? parcel.applicantEmail : ((owner && owner.email) ? owner.email : "");
    const officerName = (officer && officer.name) ? officer.name : "Approving Officer";
    const officerPhone = (officer && officer.phone) ? officer.phone : "—";
    const officerEmail = (officer && officer.email) ? officer.email : "—";
    const landStr = lnLandLine(parcel);
    const editDate = lnFmtDate(e.record.getString("updated") || e.record.getString("created"));

    var changesText = "";
    var changesHtml = "";
    try {
      const changes = e.record.get("proposedChanges");
      if (changes) {
        const obj = (typeof changes === "string") ? JSON.parse(changes) : changes;
        const entries = [];
        for (var k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k)) {
            entries.push(k.replace(/([A-Z])/g, " $1") + ": " + String(obj[k]));
          }
        }
        changesText = entries.join(", ");
        changesHtml = '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
          entries.map(function (en) {
            var parts = en.split(": ");
            return '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">' + parts[0] + '</td><td style="padding:8px;border:1px solid #e5e7eb">' + (parts[1] || "") + '</td></tr>';
          }).join("") + '</table>';
      }
    } catch (_) {}
    if (!changesText) { changesText = "land record details updated"; changesHtml = '<p>Land record details were updated.</p>'; }

    lnSendSms(ownerPhone,
      LN_APP_NAME + ": Land edit APPROVED. " + ownerName + ", " + landStr + " updated: " + changesText +
      ". Officer: " + officerName + ", " + officerPhone + ".");
    if (ownerEmail) {
      const body = '<p>Dear ' + ownerName + ',</p>' +
        '<p>A requested edit to your land record has been <strong style="color:#16a34a">APPROVED</strong> and applied.</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Land</td><td style="padding:8px;border:1px solid #e5e7eb">' + landStr + '</td></tr>' +
        '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Date</td><td style="padding:8px;border:1px solid #e5e7eb">' + editDate + '</td></tr>' +
        '</table>' +
        '<h3 style="color:#1e3a8a;margin-top:20px">Approved Changes</h3>' + changesHtml +
        '<h3 style="color:#1e3a8a;margin-top:20px">Approving Officer</h3>' +
        '<p style="margin:4px 0"><strong>Name:</strong> ' + officerName + '<br/><strong>Phone:</strong> ' + officerPhone + '<br/><strong>Email:</strong> ' + officerEmail + '</p>';
      lnSendEmail(ownerEmail, "Land Edit Approved — " + (parcel ? parcel.parcelNumber : ""), lnEmailShell("Land Edit Approved", body));
    }
  } catch (err) {
    $app.logger().error("land-notif edit hook failed", "err", String(err));
  }
  e.next();
}, "land_edit_requests");
