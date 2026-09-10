-- =============================================================
-- TECHIMAN NORTH / SaaS LAND REGISTRY — MySQL SCHEMA
--
-- Full conversion of the PocketBase database to plain SQL.
-- Generated from the live PocketBase collection metadata
-- (apps/pocketbase/pb_data/data.db) plus the SaaS migrations
-- 1788900001-1788900003 (super_admin role, tenant billing
-- fields, tenant_branding).
--
-- Target: MySQL 5.7+ / MariaDB 10.3+ (XAMPP locally, cPanel in
-- production). Import with:
--   mysql -u USER -p DBNAME < database/schema.sql
-- or via cPanel > phpMyAdmin > Import.
--
-- Record IDs keep PocketBase's 15-character format so existing
-- data and relations migrate across unchanged.
-- =============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- ---------- tenants ----------
DROP TABLE IF EXISTS `tenants`;
CREATE TABLE `tenants` (
  `id` VARCHAR(15) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `slug` VARCHAR(120) NULL,
  `code` VARCHAR(60) NULL,
  `status` ENUM('active', 'inactive', 'trial') NULL,
  `contactEmail` VARCHAR(255) NULL,
  `contactPhone` VARCHAR(40) NULL,
  `address` VARCHAR(500) NULL,
  `region` VARCHAR(120) NULL,
  `settings` JSON NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `plan` ENUM('trial', 'starter', 'professional', 'enterprise') NULL,
  `billingStatus` ENUM('trial', 'active', 'past_due', 'suspended', 'cancelled') NULL,
  `billingCycle` ENUM('monthly', 'annual', 'none') NULL,
  `trialEndsAt` DATETIME NULL,
  `maxUsers` INT NULL,
  `subdomain` VARCHAR(63) NULL,
  `planPriceGHS` DECIMAL(14,2) NULL,
  `billingNotes` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tenants_slug` (`slug`),  -- partial index in PocketBase (WHERE slug != ''); in MySQL store NULL instead of '' so the UNIQUE key ignores blanks
  KEY `idx_tenants_status` (`status`),
  UNIQUE KEY `idx_tenants_subdomain` (`subdomain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- users ----------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(15) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `tokenKey` VARCHAR(64) NULL,
  `email` VARCHAR(255) NOT NULL,
  `emailVisibility` TINYINT(1) NOT NULL DEFAULT 0,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `name` VARCHAR(255) NULL,
  `avatar` VARCHAR(255) NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `role` ENUM('citizen', 'planning_officer', 'survey_officer', 'registrar', 'finance_officer', 'admin', 'customary_secretariat', 'super_admin') NOT NULL,
  `fullName` VARCHAR(120) NULL,
  `ghanaCard` VARCHAR(40) NULL,
  `phone` VARCHAR(30) NULL,
  `mfaEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `office` ENUM('tuobodom_office', 'offuman_office', 'akrofrom_office') NULL,
  `firstName` VARCHAR(80) NULL,
  `middleName` VARCHAR(80) NULL,
  `surname` VARCHAR(80) NULL,
  `whatsappNumber` VARCHAR(30) NULL,
  `roles` JSON NULL,
  `suspended` TINYINT(1) NOT NULL DEFAULT 0,
  `suspendedReason` VARCHAR(500) NULL,
  `suspendedUntil` DATETIME NULL,
  `officeRef` VARCHAR(200) NULL,
  `areaCouncilRef` VARCHAR(200) NULL,
  `communityRef` VARCHAR(200) NULL,
  `sectorRef` VARCHAR(200) NULL,
  `alternateNumber2` VARCHAR(30) NULL,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tokenKey__pb_users_auth_` (`tokenKey`),
  UNIQUE KEY `idx_email__pb_users_auth_` (`email`),  -- partial index in PocketBase (WHERE email != ''); in MySQL store NULL instead of '' so the UNIQUE key ignores blanks
  KEY `idx_users_tenant` (`tenant`),
  CONSTRAINT `fk_users_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- tenant_branding ----------
DROP TABLE IF EXISTS `tenant_branding`;
CREATE TABLE `tenant_branding` (
  `id` VARCHAR(15) NOT NULL,
  `tenant` VARCHAR(15) NOT NULL,
  `subdomain` VARCHAR(63) NULL,
  `portalName` VARCHAR(120) NULL,
  `tagline` VARCHAR(200) NULL,
  `primaryColor` VARCHAR(40) NULL,
  `accentColor` VARCHAR(40) NULL,
  `logo` VARCHAR(255) NULL,
  `favicon` VARCHAR(255) NULL,
  `supportEmail` VARCHAR(255) NULL,
  `supportPhone` VARCHAR(40) NULL,
  `footerText` TEXT NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tenant_branding_tenant` (`tenant`),
  KEY `idx_tenant_branding_subdomain` (`subdomain`),
  CONSTRAINT `fk_tenant_branding_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- offices_struct ----------
DROP TABLE IF EXISTS `offices_struct`;
CREATE TABLE `offices_struct` (
  `id` VARCHAR(15) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `code` VARCHAR(60) NULL,
  `status` ENUM('active', 'inactive') NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `isDeleted` TINYINT(1) NOT NULL DEFAULT 0,
  `deletedReason` VARCHAR(500) NULL,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_offices_struct_tenant` (`tenant`),
  CONSTRAINT `fk_offices_struct_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- area_councils ----------
DROP TABLE IF EXISTS `area_councils`;
CREATE TABLE `area_councils` (
  `id` VARCHAR(15) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `code` VARCHAR(60) NULL,
  `status` ENUM('active', 'inactive') NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `office` VARCHAR(15) NULL,
  `isDeleted` TINYINT(1) NOT NULL DEFAULT 0,
  `deletedReason` VARCHAR(500) NULL,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_area_councils_office` (`office`),
  KEY `idx_area_councils_tenant` (`tenant`),
  CONSTRAINT `fk_area_councils_office` FOREIGN KEY (`office`) REFERENCES `offices_struct` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_area_councils_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- communities ----------
DROP TABLE IF EXISTS `communities`;
CREATE TABLE `communities` (
  `id` VARCHAR(15) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `code` VARCHAR(60) NULL,
  `status` ENUM('active', 'inactive') NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `areaCouncil` VARCHAR(15) NULL,
  `office` VARCHAR(15) NULL,
  `isDeleted` TINYINT(1) NOT NULL DEFAULT 0,
  `deletedReason` VARCHAR(500) NULL,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_communities_areaCouncil` (`areaCouncil`),
  KEY `idx_communities_office` (`office`),
  KEY `idx_communities_tenant` (`tenant`),
  CONSTRAINT `fk_communities_areaCouncil` FOREIGN KEY (`areaCouncil`) REFERENCES `area_councils` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_communities_office` FOREIGN KEY (`office`) REFERENCES `offices_struct` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_communities_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- sectors ----------
DROP TABLE IF EXISTS `sectors`;
CREATE TABLE `sectors` (
  `id` VARCHAR(15) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `code` VARCHAR(60) NULL,
  `status` ENUM('active', 'inactive') NULL,
  `areaCouncil` VARCHAR(15) NULL,
  `community` VARCHAR(15) NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `office` VARCHAR(15) NULL,
  `isDeleted` TINYINT(1) NOT NULL DEFAULT 0,
  `deletedReason` VARCHAR(500) NULL,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sectors_areaCouncil` (`areaCouncil`),
  KEY `idx_sectors_community` (`community`),
  KEY `idx_sectors_office` (`office`),
  KEY `idx_sectors_tenant` (`tenant`),
  CONSTRAINT `fk_sectors_areaCouncil` FOREIGN KEY (`areaCouncil`) REFERENCES `area_councils` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sectors_community` FOREIGN KEY (`community`) REFERENCES `communities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sectors_office` FOREIGN KEY (`office`) REFERENCES `offices_struct` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sectors_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- parcels ----------
DROP TABLE IF EXISTS `parcels`;
CREATE TABLE `parcels` (
  `id` VARCHAR(15) NOT NULL,
  `owner` VARCHAR(15) NOT NULL,
  `parcelNumber` VARCHAR(60) NOT NULL,
  `status` ENUM('draft', 'submitted', 'under_survey', 'under_review', 'registered', 'disputed', 'rejected') NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `areaCouncil` VARCHAR(120) NULL,
  `community` VARCHAR(120) NULL,
  `applicantName` VARCHAR(200) NULL,
  `religion` VARCHAR(80) NULL,
  `tribe` VARCHAR(80) NULL,
  `sector` VARCHAR(80) NULL,
  `plotNumber` VARCHAR(60) NULL,
  `allocationDate` DATETIME NULL,
  `registrationDate` DATETIME NULL,
  `contactPhone` VARCHAR(30) NULL,
  `alternateMobile` VARCHAR(30) NULL,
  `whatsapp` VARCHAR(30) NULL,
  `applicantEmail` VARCHAR(255) NULL,
  `block` VARCHAR(60) NULL,
  `alternateNumber2` VARCHAR(30) NULL,
  `additionalLands` JSON NULL,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_parcels_status` (`status`),
  KEY `idx_parcels_areaCouncil` (`areaCouncil`),
  KEY `idx_parcels_community` (`community`),
  KEY `idx_parcels_owner` (`owner`),
  KEY `idx_parcels_parcelNumber` (`parcelNumber`),
  KEY `idx_parcels_sector_plot_block` (`sector`, `plotNumber`, `block`),
  KEY `idx_parcels_tenant` (`tenant`),
  CONSTRAINT `fk_parcels_owner` FOREIGN KEY (`owner`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_parcels_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- applications ----------
DROP TABLE IF EXISTS `applications`;
CREATE TABLE `applications` (
  `id` VARCHAR(15) NOT NULL,
  `applicant` VARCHAR(15) NOT NULL,
  `parcel` VARCHAR(15) NULL,
  `reference` VARCHAR(60) NULL,
  `type` ENUM('registration', 'transfer', 'subdivision', 'title_search', 'customary_record', 'renewal') NULL,
  `status` ENUM('submitted', 'planning_review', 'survey', 'registrar_review', 'approved', 'rejected', 'completed') NULL,
  `notes` TEXT NULL,
  `reviewLog` JSON NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_applications_applicant` (`applicant`),
  KEY `idx_applications_parcel` (`parcel`),
  KEY `idx_applications_tenant` (`tenant`),
  CONSTRAINT `fk_applications_applicant` FOREIGN KEY (`applicant`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_applications_parcel` FOREIGN KEY (`parcel`) REFERENCES `parcels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_applications_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- documents ----------
DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents` (
  `id` VARCHAR(15) NOT NULL,
  `owner` VARCHAR(15) NOT NULL,
  `parcel` VARCHAR(15) NULL,
  `title` VARCHAR(200) NOT NULL,
  `docType` ENUM('deed', 'site_plan', 'indenture', 'ghana_card', 'survey_report', 'certificate', 'receipt', 'other') NULL,
  `file` VARCHAR(255) NULL,
  `version` INT NULL,
  `status` ENUM('pending_scan', 'verified', 'rejected') NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_documents_owner` (`owner`),
  KEY `idx_documents_parcel` (`parcel`),
  KEY `idx_documents_tenant` (`tenant`),
  CONSTRAINT `fk_documents_owner` FOREIGN KEY (`owner`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_documents_parcel` FOREIGN KEY (`parcel`) REFERENCES `parcels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_documents_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- surveys ----------
DROP TABLE IF EXISTS `surveys`;
CREATE TABLE `surveys` (
  `id` VARCHAR(15) NOT NULL,
  `parcel` VARCHAR(15) NULL,
  `surveyor` VARCHAR(15) NULL,
  `surveyDate` DATETIME NULL,
  `boundaries` JSON NULL,
  `computedArea` DOUBLE NULL,
  `beacons` TEXT NULL,
  `status` ENUM('scheduled', 'in_progress', 'completed', 'verified') NULL,
  `notes` TEXT NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_surveys_parcel` (`parcel`),
  KEY `idx_surveys_surveyor` (`surveyor`),
  KEY `idx_surveys_tenant` (`tenant`),
  CONSTRAINT `fk_surveys_parcel` FOREIGN KEY (`parcel`) REFERENCES `parcels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_surveys_surveyor` FOREIGN KEY (`surveyor`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_surveys_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- land_transfers ----------
DROP TABLE IF EXISTS `land_transfers`;
CREATE TABLE `land_transfers` (
  `id` VARCHAR(15) NOT NULL,
  `parcel` VARCHAR(15) NOT NULL,
  `fromOwner` VARCHAR(15) NOT NULL,
  `toOwnerUser` VARCHAR(15) NULL,
  `toOwnerName` VARCHAR(200) NULL,
  `toOwnerPhone` VARCHAR(30) NULL,
  `reason` TEXT NULL,
  `ownershipHistory` JSON NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL,
  `reviewedBy` VARCHAR(15) NULL,
  `reviewComment` TEXT NULL,
  `certificateNumber` VARCHAR(80) NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `transferLetter` VARCHAR(255) NULL,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lt_status` (`status`),
  KEY `idx_lt_parcel` (`parcel`),
  KEY `idx_lt_fromOwner` (`fromOwner`),
  KEY `idx_lt_reviewedBy` (`reviewedBy`),
  KEY `idx_lt_created` (`created`),
  KEY `idx_land_transfers_toOwnerUser` (`toOwnerUser`),
  KEY `idx_land_transfers_tenant` (`tenant`),
  CONSTRAINT `fk_land_transfers_parcel` FOREIGN KEY (`parcel`) REFERENCES `parcels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_land_transfers_fromOwner` FOREIGN KEY (`fromOwner`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_land_transfers_toOwnerUser` FOREIGN KEY (`toOwnerUser`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_land_transfers_reviewedBy` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_land_transfers_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- payments ----------
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` VARCHAR(15) NOT NULL,
  `payer` VARCHAR(15) NOT NULL,
  `application` VARCHAR(15) NULL,
  `invoiceNumber` VARCHAR(60) NULL,
  `purpose` ENUM('registration_fee', 'search_fee', 'survey_fee', 'processing_fee', 'ground_rent', 'penalty', 'transfer_fee') NULL,
  `amount` DECIMAL(14,2) NULL,
  `method` ENUM('mobile_money', 'card', 'bank_transfer', 'cash') NULL,
  `status` ENUM('pending', 'paid', 'failed', 'refunded') NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `parcel` VARCHAR(15) NULL,
  `parcelNumber` VARCHAR(60) NULL,
  `plotNumber` VARCHAR(60) NULL,
  `block` VARCHAR(60) NULL,
  `areaCouncil` VARCHAR(120) NULL,
  `community` VARCHAR(120) NULL,
  `sector` VARCHAR(80) NULL,
  `ownerName` VARCHAR(200) NULL,
  `ownerPhone` VARCHAR(30) NULL,
  `ownerEmail` VARCHAR(200) NULL,
  `transfer` VARCHAR(15) NULL,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_payments_status` (`status`),
  KEY `idx_payments_payer` (`payer`),
  KEY `idx_payments_created` (`created`),
  KEY `idx_payments_application` (`application`),
  KEY `idx_payments_parcel` (`parcel`),
  KEY `idx_payments_transfer` (`transfer`),
  KEY `idx_payments_tenant` (`tenant`),
  CONSTRAINT `fk_payments_payer` FOREIGN KEY (`payer`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_application` FOREIGN KEY (`application`) REFERENCES `applications` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_parcel` FOREIGN KEY (`parcel`) REFERENCES `parcels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_transfer` FOREIGN KEY (`transfer`) REFERENCES `land_transfers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- land_edit_requests ----------
DROP TABLE IF EXISTS `land_edit_requests`;
CREATE TABLE `land_edit_requests` (
  `id` VARCHAR(15) NOT NULL,
  `parcel` VARCHAR(15) NOT NULL,
  `requestedBy` VARCHAR(15) NOT NULL,
  `type` ENUM('edit', 'delete') NOT NULL,
  `proposedChanges` JSON NULL,
  `reason` TEXT NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL,
  `reviewedBy` VARCHAR(15) NULL,
  `reviewComment` TEXT NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_land_edit_requests_parcel` (`parcel`),
  KEY `idx_land_edit_requests_requestedBy` (`requestedBy`),
  KEY `idx_land_edit_requests_reviewedBy` (`reviewedBy`),
  KEY `idx_land_edit_requests_tenant` (`tenant`),
  CONSTRAINT `fk_land_edit_requests_parcel` FOREIGN KEY (`parcel`) REFERENCES `parcels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_land_edit_requests_requestedBy` FOREIGN KEY (`requestedBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_land_edit_requests_reviewedBy` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_land_edit_requests_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- notifications ----------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` VARCHAR(15) NOT NULL,
  `user` VARCHAR(15) NOT NULL,
  `message` VARCHAR(500) NOT NULL,
  `link` VARCHAR(200) NULL,
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user_read` (`user`, `read`),
  KEY `idx_notif_created` (`created`),
  KEY `idx_notifications_user` (`user`),
  KEY `idx_notifications_tenant` (`tenant`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notifications_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- notification_preferences ----------
DROP TABLE IF EXISTS `notification_preferences`;
CREATE TABLE `notification_preferences` (
  `id` VARCHAR(15) NOT NULL,
  `user` VARCHAR(15) NOT NULL,
  `channels` JSON NULL,
  `transferAlerts` TINYINT(1) NOT NULL DEFAULT 0,
  `editAlerts` TINYINT(1) NOT NULL DEFAULT 0,
  `deleteAlerts` TINYINT(1) NOT NULL DEFAULT 0,
  `approvalAlerts` TINYINT(1) NOT NULL DEFAULT 0,
  `rejectionAlerts` TINYINT(1) NOT NULL DEFAULT 0,
  `reminderAlerts` TINYINT(1) NOT NULL DEFAULT 0,
  `frequency` ENUM('instant', 'daily', 'weekly') NULL,
  `quietHoursStart` VARCHAR(5) NULL,
  `quietHoursEnd` VARCHAR(5) NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_notifprefs_user` (`user`),
  KEY `idx_notification_preferences_tenant` (`tenant`),
  CONSTRAINT `fk_notification_preferences_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_preferences_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- audit_logs ----------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` VARCHAR(15) NOT NULL,
  `actor` VARCHAR(15) NULL,
  `action` VARCHAR(200) NOT NULL,
  `entity` VARCHAR(120) NULL,
  `details` TEXT NULL,
  `ip` VARCHAR(60) NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_entity` (`entity`),
  KEY `idx_audit_actor` (`actor`),
  KEY `idx_audit_created` (`created`),
  KEY `idx_audit_logs_tenant` (`tenant`),
  CONSTRAINT `fk_audit_logs_actor` FOREIGN KEY (`actor`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_logs_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- chat_messages ----------
DROP TABLE IF EXISTS `chat_messages`;
CREATE TABLE `chat_messages` (
  `id` VARCHAR(15) NOT NULL,
  `sender` VARCHAR(15) NOT NULL,
  `recipient` VARCHAR(15) NOT NULL,
  `message` TEXT NOT NULL,
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_chat_messages_sender` (`sender`),
  KEY `idx_chat_messages_recipient` (`recipient`),
  KEY `idx_chat_messages_tenant` (`tenant`),
  CONSTRAINT `fk_chat_messages_sender` FOREIGN KEY (`sender`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_messages_recipient` FOREIGN KEY (`recipient`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_messages_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- tickets ----------
DROP TABLE IF EXISTS `tickets`;
CREATE TABLE `tickets` (
  `id` VARCHAR(15) NOT NULL,
  `subject` VARCHAR(200) NOT NULL,
  `category` ENUM('Bug Report', 'Feature Request', 'General Inquiry', 'Complaint', 'Technical Issue', 'Data Issue', 'Other') NULL,
  `priority` ENUM('Low', 'Medium', 'High', 'Urgent') NULL,
  `description` TEXT NOT NULL,
  `status` ENUM('Open', 'In Progress', 'Resolved', 'Closed') NULL,
  `submittedBy` VARCHAR(15) NOT NULL,
  `assignedTo` VARCHAR(15) NULL,
  `relatedLandId` VARCHAR(80) NULL,
  `attachments` JSON NULL,
  `internalNotes` TEXT NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tickets_submittedBy` (`submittedBy`),
  KEY `idx_tickets_assignedTo` (`assignedTo`),
  KEY `idx_tickets_tenant` (`tenant`),
  CONSTRAINT `fk_tickets_submittedBy` FOREIGN KEY (`submittedBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_tickets_assignedTo` FOREIGN KEY (`assignedTo`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tickets_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ticket_comments ----------
DROP TABLE IF EXISTS `ticket_comments`;
CREATE TABLE `ticket_comments` (
  `id` VARCHAR(15) NOT NULL,
  `ticket` VARCHAR(15) NOT NULL,
  `author` VARCHAR(15) NOT NULL,
  `message` TEXT NOT NULL,
  `isInternal` TINYINT(1) NOT NULL DEFAULT 0,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ticket_comments_ticket` (`ticket`),
  KEY `idx_ticket_comments_author` (`author`),
  CONSTRAINT `fk_ticket_comments_ticket` FOREIGN KEY (`ticket`) REFERENCES `tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ticket_comments_author` FOREIGN KEY (`author`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- news_categories ----------
DROP TABLE IF EXISTS `news_categories`;
CREATE TABLE `news_categories` (
  `id` VARCHAR(15) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) NULL,
  `color` VARCHAR(20) NULL,
  `slug` VARCHAR(120) NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_news_cat_name` (`name`),
  KEY `idx_news_categories_tenant` (`tenant`),
  CONSTRAINT `fk_news_categories_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- news_posts ----------
DROP TABLE IF EXISTS `news_posts`;
CREATE TABLE `news_posts` (
  `id` VARCHAR(15) NOT NULL,
  `title` VARCHAR(300) NOT NULL,
  `slug` VARCHAR(350) NULL,
  `excerpt` TEXT NULL,
  `content` LONGTEXT NULL,
  `type` ENUM('news', 'article') NOT NULL,
  `status` ENUM('draft', 'published') NOT NULL,
  `featuredImage` VARCHAR(255) NULL,
  `category` VARCHAR(15) NULL,
  `author` VARCHAR(15) NULL,
  `publishedAt` DATETIME NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_news_posts_type` (`type`),
  KEY `idx_news_posts_status` (`status`),
  KEY `idx_news_posts_created` (`created`),
  KEY `idx_news_posts_category` (`category`),
  KEY `idx_news_posts_author` (`author`),
  KEY `idx_news_posts_tenant` (`tenant`),
  CONSTRAINT `fk_news_posts_category` FOREIGN KEY (`category`) REFERENCES `news_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_news_posts_author` FOREIGN KEY (`author`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_news_posts_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- menu_customizations ----------
DROP TABLE IF EXISTS `menu_customizations`;
CREATE TABLE `menu_customizations` (
  `id` VARCHAR(15) NOT NULL,
  `config` JSON NULL,
  `label` VARCHAR(120) NULL,
  `owner` VARCHAR(15) NOT NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_menu_customizations_owner` (`owner`),
  KEY `idx_menu_customizations_tenant` (`tenant`),
  CONSTRAINT `fk_menu_customizations_owner` FOREIGN KEY (`owner`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_customizations_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- sms_logs ----------
DROP TABLE IF EXISTS `sms_logs`;
CREATE TABLE `sms_logs` (
  `id` VARCHAR(15) NOT NULL,
  `sentBy` VARCHAR(15) NOT NULL,
  `recipientId` VARCHAR(20) NULL,
  `recipientName` VARCHAR(200) NULL,
  `recipientPhone` VARCHAR(30) NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('sent', 'failed', 'pending') NULL,
  `errorMsg` VARCHAR(500) NULL,
  `isBulk` TINYINT(1) NOT NULL DEFAULT 0,
  `bulkGroup` VARCHAR(60) NULL,
  `templateName` VARCHAR(100) NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sms_logs_sentBy` (`sentBy`),
  KEY `idx_sms_logs_created` (`created`),
  KEY `idx_sms_logs_tenant` (`tenant`),
  CONSTRAINT `fk_sms_logs_sentBy` FOREIGN KEY (`sentBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sms_logs_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- verification_codes ----------
DROP TABLE IF EXISTS `verification_codes`;
CREATE TABLE `verification_codes` (
  `id` VARCHAR(15) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `officeRef` VARCHAR(200) NULL,
  `areaCouncilRef` VARCHAR(200) NULL,
  `communityRef` VARCHAR(200) NULL,
  `description` VARCHAR(500) NULL,
  `createdBy` VARCHAR(15) NOT NULL,
  `expiresAt` DATETIME NULL,
  `maxUsage` INT NULL,
  `usageCount` INT NULL,
  `lastUsedAt` DATETIME NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 0,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `codeType` ENUM('community', 'admin') NULL,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_vcodes_code` (`code`),
  KEY `idx_vcodes_community` (`communityRef`),
  KEY `idx_vcodes_active` (`isActive`),
  KEY `idx_verification_codes_createdBy` (`createdBy`),
  KEY `idx_verification_codes_tenant` (`tenant`),
  CONSTRAINT `fk_verification_codes_createdBy` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_verification_codes_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- verification_logs ----------
DROP TABLE IF EXISTS `verification_logs`;
CREATE TABLE `verification_logs` (
  `id` VARCHAR(15) NOT NULL,
  `code` VARCHAR(80) NULL,
  `status` ENUM('success', 'failure') NULL,
  `reason` VARCHAR(300) NULL,
  `communityRef` VARCHAR(200) NULL,
  `searchFilters` JSON NULL,
  `resultsCount` INT NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_verification_logs_tenant` (`tenant`),
  CONSTRAINT `fk_verification_logs_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- otp_sessions ----------
DROP TABLE IF EXISTS `otp_sessions`;
CREATE TABLE `otp_sessions` (
  `id` VARCHAR(15) NOT NULL,
  `userId` VARCHAR(30) NULL,
  `email` VARCHAR(200) NULL,
  `phone` VARCHAR(30) NULL,
  `code` VARCHAR(10) NULL,
  `expiresAt` DATETIME NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant` VARCHAR(15) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_otp_sessions_tenant` (`tenant`),
  CONSTRAINT `fk_otp_sessions_tenant` FOREIGN KEY (`tenant`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- integrated_ai_messages ----------
DROP TABLE IF EXISTS `integrated_ai_messages`;
CREATE TABLE `integrated_ai_messages` (
  `id` VARCHAR(15) NOT NULL,
  `userId` VARCHAR(30) NULL,
  `role` ENUM('user', 'assistant') NOT NULL,
  `content` JSON NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_messages_userId` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- integrated_ai_images ----------
DROP TABLE IF EXISTS `integrated_ai_images`;
CREATE TABLE `integrated_ai_images` (
  `id` VARCHAR(15) NOT NULL,
  `file` VARCHAR(255) NOT NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- AUTH SUPPORT TABLES
--
-- PocketBase handled sessions, password resets and email
-- verification internally (its _otps / _authOrigins / _mfas
-- tables). Those are gone with PocketBase, so the equivalents
-- live here as ordinary application tables.
--
-- Always store a HASH of the token, never the token itself, so
-- a database leak can't be replayed as a valid session.
-- (The app's own OTP flow keeps using `otp_sessions` above.)
-- =============================================================

-- ---------- user_sessions ----------
DROP TABLE IF EXISTS `user_sessions`;
CREATE TABLE `user_sessions` (
  `id` VARCHAR(15) NOT NULL,
  `user` VARCHAR(15) NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `ip` VARCHAR(60) NULL,
  `userAgent` VARCHAR(500) NULL,
  `expiresAt` DATETIME NOT NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_sessions_token` (`tokenHash`),
  KEY `idx_user_sessions_user` (`user`),
  KEY `idx_user_sessions_expires` (`expiresAt`),
  CONSTRAINT `fk_user_sessions_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- password_resets ----------
DROP TABLE IF EXISTS `password_resets`;
CREATE TABLE `password_resets` (
  `id` VARCHAR(15) NOT NULL,
  `user` VARCHAR(15) NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `usedAt` DATETIME NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_password_resets_token` (`tokenHash`),
  KEY `idx_password_resets_user` (`user`),
  CONSTRAINT `fk_password_resets_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- email_verifications ----------
DROP TABLE IF EXISTS `email_verifications`;
CREATE TABLE `email_verifications` (
  `id` VARCHAR(15) NOT NULL,
  `user` VARCHAR(15) NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `usedAt` DATETIME NULL,
  `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_email_verifications_token` (`tokenHash`),
  KEY `idx_email_verifications_user` (`user`),
  CONSTRAINT `fk_email_verifications_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- NOTES
--
-- 1. `read` (notifications, chat_messages) is a MySQL reserved
--    word - always backtick it in queries: SELECT `read` FROM ...
--
-- 2. Empty strings vs NULL: PocketBase used partial unique
--    indexes (WHERE slug != ''). MySQL has none, so store NULL -
--    not '' - in `tenants`.`slug`, `tenants`.`subdomain` and
--    `verification_codes`.`code` when there is no value, or the
--    UNIQUE key will reject the second blank row.
--
-- 3. File fields (`documents`.`file`, `tenant_branding`.`logo`,
--    `tickets`.`attachments`, ...) store the FILE NAME only,
--    exactly as PocketBase did. The bytes themselves live on
--    disk - see docs/SQL_DATABASE.md for where to put the
--    uploads directory once PocketBase's pb_data/storage is gone.
--
-- 4. ON DELETE policy: ownership and financial records
--    (parcels, documents, payments, transfers, applications)
--    are RESTRICT - the database refuses to delete a user who
--    still owns them. Dependent rows (notifications, chat,
--    ticket comments, branding) CASCADE. Everything optional
--    is SET NULL. PocketBase enforced none of this; deleting a
--    record there left dangling ids behind.
-- =============================================================

