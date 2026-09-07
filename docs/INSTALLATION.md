# Installation Guide

## System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 20.04 / Debian 11 | Ubuntu 22.04 LTS |
| Node.js | 22.x | 22.x LTS |
| npm | 10.x | 10.x |
| RAM | 512 MB | 1 GB |
| Disk | 2 GB | 5 GB |
| CPU | 1 core | 2 cores |

## Prerequisites

1. **Node.js 22** — verify: `node -v`
2. **npm 10** — verify: `npm -v`
3. **PM2** — `npm install -g pm2`
4. **Git** (optional, for updates)

## Installation Steps

### 1. Clone / Upload Project

```bash
# via Git
git clone https://github.com/yourorg/techiman-land-registry.git public_html
cd public_html

# or extract archive
tar -xzf landregistry.tar.gz
cd public_html
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- Database encryption key
- JWT secret
- Arkesel SMS credentials
- SMTP email credentials

### 3. Install Dependencies

```bash
npm ci
```

### 4. Build Frontend

```bash
npm run build --workspace apps/web
```

### 5. Make PocketBase Executable

```bash
chmod +x apps/pocketbase/pocketbase
```

### 6. Start Services

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### 7. Verify

```bash
bash scripts/health-check.sh
```

Open your browser at `http://localhost:3000` (or your configured domain).

## First Login

Create the first admin user via PocketBase Admin UI:

```
http://localhost:8090/_/
```

Or ask your developer to seed an admin account via migration.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
