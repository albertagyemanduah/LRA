# PHP + Bootstrap 5 Admin Console — build plan & status

_Direction (2026-09-11): build a **new server-rendered PHP + Bootstrap 5 admin UI**
on the existing PHP `api/` layer + MySQL. The React SPA (`apps/web`), PocketBase
and the Express service become reference-only. MySQL is unchanged._

Mounted at `http://localhost/LRA/` (XAMPP). Front controller: `index.php` + `.htaccess`
at the repo root. All new code lives in **`app/`**.

## Architecture

| Piece | Location | Purpose |
|---|---|---|
| Front controller | `index.php` | boots `app/bootstrap.php`, runs the router |
| Bootstrap | `app/bootstrap.php` | config, DB (`database/connection.php`), autoloader, session, helpers, resolve user/tenant/branding |
| Router | `app/lib/Router.php` + `app/routes.php` | `{param}` path routing to `[Controller, method]` |
| Controllers | `app/controllers/*.php` | one per module, extend `App\Controller` |
| Views | `app/views/*.php` | `layout.php` (Bootstrap 5 shell) + per-module folders |
| Libs | `app/lib/*.php` | `Auth`, `Repo` (tenant-scoped CRUD), `Csrf`, `Flash`, `Validator`, `Upload`, `Mailer`, `Sms`, `Notify`, `People`, `ParcelId`, `Branding`, `Audit` |
| Assets | `app/assets/{css,js,img}` | `app.css` theme layer, `app.js` progressive enhancement |

Data access goes through `App\Repo`, which appends a workspace clause to every
query (super_admin exempt) — the same isolation model as `api/lib/guard.php`.
Column names are validated against `INFORMATION_SCHEMA` before touching SQL.

## Setup (first run)

```bash
# 1. database
mysql -u root -e "CREATE DATABASE lra CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root lra < database/schema.sql
mysql -u root lra < database/seed.sql

# 2. accounts + demo content
DB_DATABASE=lra php database/seed-accounts.php     # 7 role logins, password: Password123!
DB_DATABASE=lra php database/seed-demo.php          # sample parcels, payments, etc.

# 3. open
#   http://localhost/LRA/            public landing
#   http://localhost/LRA/login       staff sign-in
```

Demo logins (all `Password123!`): `superadmin@lra.test`, `admin@lra.test`,
`planning@lra.test`, `survey@lra.test`, `registrar@lra.test`, `finance@lra.test`,
`customary@lra.test`.

## Module status

| Module | Route prefix | Status |
|---|---|---|
| Auth (login / logout / forgot / reset) | `/login` … | ✅ done |
| Public landing + land verification portal | `/`, `/verify` | ✅ done |
| Dashboard (aggregates + chart) | `/dashboard` | ✅ done |
| **Land Parcels** (list, filter, search, CSV export/import, register, workflow, edit, change-requests, certificate) | `/parcels` | ✅ done |
| Land Transfers (approval workflow, ownership history) | `/transfers` | ⏳ next |
| Approvals inbox (edit / delete requests) | `/approvals` | ⏳ next |
| Documents library (upload, verify, versions) | `/documents` | ⏳ next |
| Payments & Invoices (record, receipt, export) | `/payments` | ⏳ next |
| Surveys | `/surveys` | ⏳ next |
| Staff / Users (create, roles, suspend, reset) | `/users` | ⏳ next |
| Administrative Structure (offices → councils → communities → sectors) | `/structure` | ⏳ next |
| Verification Codes + logs | `/verification-codes` | ⏳ next |
| News CMS | `/news` | ⏳ |
| Support Tickets + comments | `/tickets` | ⏳ |
| Staff Chat (polling) | `/chat` | ⏳ |
| Reports & Analytics (financial, ownership, exports) | `/reports` | ⏳ |
| SMS console (Arkesel) | `/sms` | ⏳ |
| Audit log viewer | `/audit` | ⏳ |
| Notifications + preferences (poll) | `/notifications` | ⏳ |
| Workspace Settings (branding, profile) | `/settings` | ⏳ |
| Platform Console (super_admin: workspaces, plans, billing) | `/platform` | ⏳ |
| My Profile / change password | `/profile` | ⏳ |

Unbuilt routes return a friendly "module not available yet" page, not a 500.

## Backend gaps still to close (from `GAP_ANALYSIS.md`, adapted)

- **Notification engine** — `App\Notify` covers in-app + SMS + email honouring
  `notification_preferences` and quiet hours; still to port the finer land-event
  rules from `apps/pocketbase/pb_hooks/land-notifications.pb.js`.
- **Email transport** — `App\Mailer` does SMTP or writes to `storage/mail/` when
  unconfigured (local dev). No PHPMailer dependency.
- **SMS** — `App\Sms` (Arkesel v1); logs to `sms_logs`; no-ops with a log line
  when `ARKESEL_API_KEY` is unset.
- **Public verify-code / public-stats** — implemented directly in PHP
  (`PublicController`), so the broken Express versions are not needed.
- **Exports / imports** — parcels CSV done; full DB export + platform SQL mirror
  still to add under `/platform`.
- **OTP / MFA at login** — not yet ported (schema table `otp_sessions` exists).
- **Integrated AI assistant** — out of scope for this UI; leave on Express if wanted.
