# Techiman North Land Registry

A comprehensive digital land registration platform built for the Techiman North District Assembly (TeNDA PPD), Ghana. Manages land parcels, transfers, payments, certificates, and official communications across seven role-based portals.

## Features

- **Land Registration** — Multi-field parcel records with sequential IDs (Community-YYYY-XXXX), CSV/XLS/XLSX bulk import, duplicate detection, and full audit trail
- **Land Transfer** — Approval workflow with ownership history, transfer letter upload, and SMS notifications to all parties
- **Document Management** — Upload, version, and verify deeds, site plans, indentures, and certificates
- **Payments & Invoices** — Registration fees, survey fees, and receipts; Finance Officer role
- **Certificate Generation** — PDF/Word certificates and receipts from template designer
- **Chat System** — Real-time direct messaging between staff members
- **Ticket System** — Support ticket workflow with priority and status tracking
- **Reports & Analytics** — Recharts dashboards, CSV/XLSX/XLS/PDF export, hidden lands tracking
- **User Management** — Role-based accounts with suspension, MFA, and audit logs
- **Public Land Verification** — Verification code system for public parcel lookup without login
- **Administrative Structure** — Drag-and-drop hierarchy: Office → Area Council → Community → Sector
- **SMS Notifications** — Arkesel API; sends to all contact numbers (except WhatsApp) on every key event
- **Offline Support** — Service worker + offline sync queue
- **Dark Mode** — Full light/dark/auto theme support

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS v3 + shadcn/ui |
| Backend API | Express.js 5 (Node ESM) |
| Database | PocketBase 0.26.x (SQLite) |
| Auth | PocketBase built-in auth + JWT |
| SMS | Arkesel API |
| PDF | jsPDF + jspdf-autotable |
| Excel | SheetJS (xlsx) |
| Word | docx |
| Hosting | Hostinger HPanel (Node.js app) |

## Roles

| Role | Key Capabilities |
|---|---|
| `admin` | Full access; permanent delete; user management; data wipe |
| `planning_officer` | Approve/reject edit and transfer requests |
| `survey_officer` | Manage surveys |
| `registrar` | Register and view all parcels in assigned area council |
| `finance_officer` | Manage payments and invoices |
| `customary_secretariat` | Customary land records |

## Quick Start (Local Development)

```bash
cp .env.example .env          # fill in your values
npm install
npm run dev                    # starts all three services concurrently
```

Open http://localhost:3000 — backend API at :3001, PocketBase at :8090.

## Production Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full instructions.

```bash
bash scripts/build.sh          # builds frontend
bash scripts/deploy.sh         # installs, migrates, starts PM2
bash scripts/health-check.sh   # verify everything is running
```

## Directory Structure

```
.
├── apps/
│   ├── web/          # React + Vite frontend
│   ├── api/          # Express.js API
│   └── pocketbase/   # PocketBase binary + migrations + hooks
├── docs/             # Documentation
├── scripts/          # Deployment and maintenance scripts
├── ecosystem.config.cjs   # PM2 config
├── nginx.conf             # Nginx reverse proxy config
├── Dockerfile
└── docker-compose.yml
```

## License

Proprietary — Techiman North District Assembly. All rights reserved.
