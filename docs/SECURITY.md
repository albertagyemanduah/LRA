# Security Guide

## Authentication

- **PocketBase JWT** — all API calls carry a short-lived JWT issued by PocketBase on login.
- **Session timeout** — users are automatically logged out after 30 minutes of inactivity (configurable via `SESSION_TIMEOUT_MS`).
- **OTP verification** — password reset uses a time-limited OTP delivered via email and SMS.
- **MFA** — optional per-user MFA via PocketBase `_mfas` collection.

## Authorization

- **Role-based access control** — seven roles enforced both at the PocketBase collection rule level and in the React frontend (`@/lib/roles.js`).
- **PocketBase access rules** — every collection has explicit `list/view/create/update/delete` rules; no collection defaults to world-readable.
- **ModuleGuard** — React `<ModuleGuard>` component prevents route access for unauthorized roles.

## Data Encryption

- **PocketBase encryption** — `PB_ENCRYPTION_KEY` encrypts sensitive PocketBase fields at rest.
- **HTTPS** — all traffic must go over TLS; HTTP is redirected to HTTPS in `nginx.conf`.
- **Passwords** — PocketBase bcrypt-hashes all user passwords; raw passwords are never stored.

## API Security

- **CORS** — Express API restricts origins to `CORS_ORIGINS`.
- **Rate limiting** — Nginx applies per-IP rate limits to `/hcgi/api/` (10 r/s) and `/hcgi/platform/` (20 r/s).
- **Input validation** — Zod schemas validate all form inputs; PocketBase field constraints enforce server-side validation.

## File Upload Security

- Accepted MIME types restricted (`ALLOWED_MIME_TYPES`).
- Max file size enforced (`MAX_FILE_SIZE`).
- Files stored in PocketBase managed storage; not served from web root.

## Secrets Management

- All secrets live in `.env` (excluded from version control via `.gitignore`).
- On production HPanel, set secrets via **Environment Variables** in the Node.js app settings rather than uploading a `.env` file.
- Rotate `PB_ENCRYPTION_KEY`, `JWT_SECRET`, and `SESSION_SECRET` every 90 days.

## HTTP Security Headers (nginx)

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Audit Trail

Every create, update, delete, login, export, and bulk operation is logged to the `audit_logs` collection with actor, action, entity, timestamp, and IP address.

## Suspension

Admin can suspend user accounts. The `enforce-suspension.pb.js` hook blocks login for suspended users server-side.

## Recommendations

- Enable 2FA on your HPanel and Arkesel accounts.
- Restrict PocketBase Admin UI (`:8090/_/`) to office IP ranges via firewall rules.
- Schedule weekly backups with `scripts/backup.sh`.
- Monitor `logs/api-error.log` for unusual activity.
