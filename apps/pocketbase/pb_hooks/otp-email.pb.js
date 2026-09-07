/// <reference path="../pb_data/types.d.ts" />

// Send OTP email when an otp_sessions record is created
onRecordAfterCreateSuccess((e) => {
  const email = e.record.getString("email");
  const code = e.record.getString("code");
  if (!email || !code) {
    e.next();
    return;
  }

  const message = new MailerMessage({
    from: { name: "Techiman North Land Registry" },
    to: [{ address: email }],
    subject: "Your Login Verification Code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="background:#1a4731;padding:16px 24px;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;margin:0;font-size:18px">Techiman North Land Registry</h1>
          <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px">District Assembly — Secure Login</p>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <p style="color:#374151;margin:0 0 16px">A login attempt was made to your account. Use the code below to complete your sign-in:</p>
          <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:20px;text-align:center;margin:16px 0">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Your verification code</p>
            <p style="margin:0;font-size:36px;font-weight:700;color:#1a4731;letter-spacing:0.25em">${code}</p>
            <p style="margin:8px 0 0;color:#6b7280;font-size:12px">Valid for 10 minutes</p>
          </div>
          <p style="color:#6b7280;font-size:13px;margin:16px 0 0">If you did not attempt to log in, please contact your District Administrator immediately.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
          <p style="color:#9ca3af;font-size:11px;margin:0">Techiman North District Assembly &middot; Land Registry System</p>
        </div>
      </div>
    `,
  });

  try {
    $app.newMailClient().send(message);
  } catch (err) {
    $app.logger().error("OTP email failed", "to", email, "err", String(err));
  }

  e.next();
}, "otp_sessions");

// Send ticket notification email when a ticket is created
onRecordAfterCreateSuccess((e) => {
  const subject = e.record.getString("subject");
  const category = e.record.getString("category");
  const priority = e.record.getString("priority");
  const description = e.record.getString("description");
  const submittedById = e.record.getString("submittedBy");

  if (!submittedById) {
    e.next();
    return;
  }

  try {
    const submitter = $app.findRecordById("users", submittedById);
    const submitterEmail = submitter.getString("email");
    const submitterName = submitter.getString("fullName") || submitter.getString("email");

    // Notify submitter
    if (submitterEmail) {
      const msg = new MailerMessage({
        from: { name: "TNDA Support" },
        to: [{ address: submitterEmail }],
        subject: `Ticket Created: ${subject}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <h2 style="color:#1a4731">Ticket Submitted Successfully</h2>
          <p>Dear ${submitterName},</p>
          <p>Your support ticket has been received and is being reviewed.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Subject</td><td style="padding:8px;border:1px solid #e5e7eb">${subject}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Category</td><td style="padding:8px;border:1px solid #e5e7eb">${category}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Priority</td><td style="padding:8px;border:1px solid #e5e7eb">${priority}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Status</td><td style="padding:8px;border:1px solid #e5e7eb">Open</td></tr>
          </table>
          <p style="color:#6b7280;font-size:13px">You will be notified when your ticket is updated. Thank you for contacting TNDA support.</p>
        </div>`,
      });
      $app.newMailClient().send(msg);
    }

    // Notify admins
    const admins = $app.findRecordsByFilter("users", "role = 'admin'");
    for (const admin of admins) {
      const adminEmail = admin.getString("email");
      if (!adminEmail) continue;
      try {
        const adminMsg = new MailerMessage({
          from: { name: "TNDA System" },
          to: [{ address: adminEmail }],
          subject: `[${priority}] New Ticket: ${subject}`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="color:#1a4731">New Support Ticket Received</h2>
            <p>A new ticket has been submitted by <strong>${submitterName}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Subject</td><td style="padding:8px;border:1px solid #e5e7eb">${subject}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Category</td><td style="padding:8px;border:1px solid #e5e7eb">${category}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Priority</td><td style="padding:8px;border:1px solid #e5e7eb">${priority}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Description</td><td style="padding:8px;border:1px solid #e5e7eb">${description.slice(0, 200)}${description.length > 200 ? "..." : ""}</td></tr>
            </table>
            <p>Please log in to the admin portal to review and assign this ticket.</p>
          </div>`,
        });
        $app.newMailClient().send(adminMsg);
      } catch (_) {}
    }
  } catch (err) {
    $app.logger().error("Ticket notification failed", "err", String(err));
  }

  e.next();
}, "tickets");
