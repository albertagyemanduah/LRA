# ============================================================
# Techiman North Land Registry — Dockerfile
# Multi-stage build: build frontend then create lean runtime image
# ============================================================

# ---- Stage 1: Build frontend ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy workspace package files
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/pocketbase/package.json apps/pocketbase/

# Install all dependencies
RUN npm ci --workspace apps/web --workspace apps/api

# Copy source
COPY apps/web/ apps/web/
COPY apps/api/ apps/api/

# Build frontend
RUN npm run build --workspace apps/web

# ---- Stage 2: Runtime ----
FROM node:22-alpine AS runtime

WORKDIR /app

# Install only production API dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace apps/api --omit=dev

# Copy built frontend
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Copy API source
COPY apps/api/src ./apps/api/src

# Copy PocketBase binary and config
COPY apps/pocketbase/pocketbase ./apps/pocketbase/pocketbase
COPY apps/pocketbase/pb_migrations ./apps/pocketbase/pb_migrations
COPY apps/pocketbase/pb_hooks ./apps/pocketbase/pb_hooks
RUN chmod +x ./apps/pocketbase/pocketbase

# Create data directories
RUN mkdir -p apps/pocketbase/pb_data logs

# Expose ports
# 3000  — Vite static (served via nginx in production)
# 3001  — Express API
# 8090  — PocketBase
EXPOSE 3001 8090

ENV NODE_ENV=production

# Start both PocketBase and Express via PM2
RUN npm install -g pm2
COPY ecosystem.config.cjs ./

CMD ["pm2-runtime", "ecosystem.config.cjs"]
