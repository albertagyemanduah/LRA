-- =============================================================
-- SEED DATA
--
-- Run AFTER schema.sql:
--   mysql -u USER -p DBNAME < database/seed.sql
--
-- Creates the platform's first workspace (Techiman North District
-- Assembly) and its branding row, mirroring what the PocketBase
-- migration 1788863244_seed_default_tenant.js used to seed. The
-- fixed id `techimannorthda` is the one the frontend falls back to
-- (see apps/web/src/lib/auth.jsx), so keep it as-is.
--
-- Staff accounts are NOT seeded here on purpose: a password hash
-- committed to a .sql file is a known password on a live land
-- registry. Create the first administrator instead with:
--
--   php database/create-admin.php
-- =============================================================

SET NAMES utf8mb4;

-- ---------- Default workspace ----------
INSERT INTO `tenants`
    (`id`, `name`, `slug`, `code`, `status`, `region`,
     `plan`, `billingStatus`, `billingCycle`, `subdomain`)
VALUES
    ('techimannorthda',
     'Techiman North District Assembly',
     'techiman-north-district-assembly',
     'TNDA',
     'active',
     'Bono East',
     'professional',
     'active',
     'none',
     'techiman-north')
ON DUPLICATE KEY UPDATE
    `name` = VALUES(`name`),
    `slug` = VALUES(`slug`);

-- ---------- Its branding ----------
INSERT INTO `tenant_branding`
    (`id`, `tenant`, `subdomain`, `portalName`, `tagline`,
     `primaryColor`, `accentColor`)
VALUES
    ('brandtechimanno',
     'techimannorthda',
     'techiman-north',
     'Techiman North',
     'Land Registry System',
     '210 55% 22%',
     '210 60% 38%')
ON DUPLICATE KEY UPDATE
    `portalName` = VALUES(`portalName`);
