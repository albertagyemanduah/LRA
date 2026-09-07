# Database Documentation

The application uses **PocketBase** (embedded SQLite) running at port 8090.

## Collections

| Collection | Purpose |
|---|---|
| `users` | Auth collection — staff accounts with roles |
| `parcels` | Land parcel records (core data) |
| `land_transfers` | Transfer workflow records |
| `land_edit_requests` | Edit/delete approval requests |
| `documents` | Uploaded documents linked to parcels |
| `payments` | Invoice and payment records |
| `surveys` | Survey records linked to parcels |
| `applications` | Land application workflow |
| `notifications` | In-app notifications per user |
| `chat_messages` | Direct messages between users |
| `tickets` | Support ticket records |
| `ticket_comments` | Comments on tickets |
| `audit_logs` | Immutable audit trail |
| `area_councils` | Administrative hierarchy |
| `communities` | Administrative hierarchy |
| `sectors` | Administrative hierarchy |
| `offices_struct` | District offices |
| `verification_codes` | Public land verification codes |
| `verification_logs` | Verification attempt logs |
| `otp_sessions` | OTP/password reset sessions |

## Schema Migrations

All schema changes are versioned migration files under `apps/pocketbase/pb_migrations/`.  
PocketBase applies unapplied migrations automatically on startup.

```bash
# Apply pending migrations manually
npm run migrations:up --workspace pocketbase-app
```

**Never edit an already-applied migration.** Add a new timestamped file instead.

## Backup & Restore

```bash
# Create backup
bash scripts/backup.sh

# Restore
tar -xzf backups/landregistry_backup_YYYYMMDD_HHMMSS.tar.gz -C ~/
```

Backups include: `pb_data/` (SQLite database + uploaded files), `pb_migrations/`, `pb_hooks/`.

## Data Directory

| Path | Contents |
|---|---|
| `apps/pocketbase/pb_data/data.db` | Main SQLite database |
| `apps/pocketbase/pb_data/auxiliary.db` | Request / error logs |
| `apps/pocketbase/pb_data/storage/` | Uploaded files |

## Access Rules

PocketBase access rules enforce RBAC at the database layer:

- `admin` role has broad access to all collections
- `planning_officer` can approve/reject edit and transfer requests
- `registrar` sees all parcels in their assigned area council
- `finance_officer` sees all payments
- All other roles see only their own records by default

See `apps/pocketbase/pb_migrations/` for exact rule expressions.

## PocketBase Admin UI

Available at: `http://yourdomain.com:8090/_/`  
Use superuser credentials set in `.env` (`PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD`).
