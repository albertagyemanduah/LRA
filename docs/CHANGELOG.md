# Changelog

All notable changes to the Techiman North Land Registry are documented here.

---

## [2.5.0] — 2026-08-05

### Added
- Multi-format export (CSV, XLS, XLSX, PDF) with Active-only / All-including-hidden scope
- Advanced import (CSV, XLS, XLSX) with drag-and-drop, sheet picker, step logging, validation report, import history
- Duplicate checker disabled during import (all records inserted fresh)
- Deployment configuration files: `.env.example`, `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `ecosystem.config.cjs`, `scripts/`
- Documentation: `README.md`, `docs/DEPLOYMENT.md`, `docs/HPANEL_GUIDE.md`, `docs/SECURITY.md`

---

## [2.4.0] — 2026-08-05

### Added
- Complete parcel system wipe (AdminDataManagementPage): count, confirm, cascade delete, counter reset, wipe log/report
- Hidden lands visibility: prominent alert banner, export with hidden status, dashboard KPI card, reports stats

---

## [2.3.0] — 2026-08-05

### Fixed
- Import matching error — case-insensitive, whitespace-normalized record lookup

### Added
- Replace-on-import (existing records updated with imported data)
- Duplicate check buttons on land registration, transfer, contact, user, and profile forms
- Bulk duplicate report modal on ParcelsPage

---

## [2.2.0] — 2026-08-04

### Added
- Sorting (A-Z / Z-A) on ParcelsPage and UserManagement headers
- Column selection modal with localStorage persistence
- List view with all Medium view features + hidden column expand
- Overflow prevention across all tables

---

## [2.1.0] — 2026-08-04

### Added
- Parallel bulk delete (5 at a time via `Promise.allSettled`)
- Operation guard (`operationGuard.js`) prevents logout during bulk operations
- Import data replaces existing records (no skip)

---

## [2.0.0] — 2026-08-04

### Added
- Double "/" and triple "/" contact parsing: primary / alternate / alternate2
- SMS sent to all contact numbers (except WhatsApp) on every key event
- Import upsert: existing records updated with missing fields

---

## [1.x.x] — Earlier Releases

Core platform: land registration, transfers, payments, certificates, chat, tickets, reports, user management, administrative hierarchy, verification codes, OTP, SMS, dark mode, offline support.
