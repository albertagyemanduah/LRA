<?php
/**
 * =============================================================
 * ACCESS RULES
 * =============================================================
 * A direct translation of PocketBase's collection rules (the
 * listRule / viewRule / createRule / updateRule / deleteRule
 * expressions in apps/pocketbase/pb_migrations) into something the
 * PHP API can enforce.
 *
 * This file is the single place where "who may see what" is
 * decided. PocketBase enforced it inside the database; MySQL
 * cannot, so guard.php reads this table and builds the WHERE
 * clause for every query. Nothing else should hand-write a tenant
 * or role check.
 *
 * Each action accepts a list of alternatives — the caller passes if
 * ANY of them matches:
 *
 *   'public'                     no sign-in required
 *   'auth'                       any signed-in staff member
 *   ['role' => ['admin', ...]]   the caller holds one of these roles
 *   ['own' => 'columnName']      the record belongs to the caller
 *   'never'                      nobody (API-only, e.g. audit rows)
 *
 * 'tenant' => true adds the workspace clause: a caller only ever
 * sees rows belonging to their own workspace (plus legacy rows with
 * no workspace). super_admin bypasses it — and only super_admin.
 * =============================================================
 */

declare(strict_types=1);

/** Roles allowed to administer their own workspace. */
const ADMIN_ROLES = ['admin', 'super_admin'];

return [

    // ---- Core land records -------------------------------------
    'parcels' => [
        'list'   => ['auth'],
        // Public: the "Verify Land" portal looks up a single parcel
        // without a login, exactly as PocketBase's empty viewRule did.
        'view'   => ['public'],
        'create' => ['auth'],
        'update' => ['auth'],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
        'owner'  => 'owner',
    ],

    'applications' => [
        'list'   => ['auth'],
        'view'   => ['auth'],
        'create' => ['auth'],
        'update' => ['auth'],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
        'owner'  => 'applicant',
    ],

    'documents' => [
        'list'   => ['auth'],
        'view'   => ['auth'],
        'create' => ['auth'],
        'update' => ['auth'],
        'delete' => ['auth'],
        'tenant' => true,
        'owner'  => 'owner',
    ],

    'surveys' => [
        'list'   => ['auth'],
        'view'   => ['auth'],
        'create' => ['auth'],
        'update' => ['auth'],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
    ],

    // ---- Workflow ----------------------------------------------
    'land_transfers' => [
        'list'   => [['own' => 'fromOwner'], ['role' => ['planning_officer', 'admin', 'super_admin']]],
        'view'   => [['own' => 'fromOwner'], ['role' => ['planning_officer', 'admin', 'super_admin']]],
        'create' => ['auth'],
        // Approval is deliberately limited to planning officers and admins:
        // migration 1785278068 removed registrars from it on purpose.
        'update' => [['role' => ['planning_officer', 'admin', 'super_admin']]],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
    ],

    'land_edit_requests' => [
        'list'   => [['own' => 'requestedBy'], ['role' => ['planning_officer', 'admin', 'super_admin']]],
        'view'   => [['own' => 'requestedBy'], ['role' => ['planning_officer', 'admin', 'super_admin']]],
        'create' => ['auth'],
        'update' => [['role' => ['planning_officer', 'admin', 'super_admin']]],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
    ],

    'payments' => [
        'list'   => [['own' => 'payer'], ['role' => ['finance_officer', 'admin', 'super_admin']]],
        'view'   => [['own' => 'payer'], ['role' => ['finance_officer', 'admin', 'super_admin']]],
        'create' => [['role' => ['finance_officer', 'admin', 'super_admin']]],
        'update' => [['role' => ['finance_officer', 'admin', 'super_admin']]],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
        'owner'  => 'payer',
    ],

    // ---- Communication -----------------------------------------
    'notifications' => [
        'list'   => [['own' => 'user'], ['role' => ADMIN_ROLES]],
        'view'   => [['own' => 'user'], ['role' => ADMIN_ROLES]],
        'create' => ['auth'],
        'update' => [['own' => 'user'], ['role' => ADMIN_ROLES]],
        'delete' => [['own' => 'user'], ['role' => ADMIN_ROLES]],
        'tenant' => true,
    ],

    'notification_preferences' => [
        // Strictly the owner — no admin bypass, matching PocketBase.
        'list'   => [['own' => 'user']],
        'view'   => [['own' => 'user']],
        'create' => ['auth'],
        'update' => [['own' => 'user']],
        'delete' => [['own' => 'user']],
        'tenant' => true,
    ],

    'chat_messages' => [
        // Either side of the conversation, and no admin bypass.
        'list'   => [['own' => 'sender'], ['own' => 'recipient']],
        'view'   => [['own' => 'sender'], ['own' => 'recipient']],
        'create' => ['auth'],
        'update' => [['own' => 'sender']],
        'delete' => [['own' => 'sender']],
        'tenant' => true,
    ],

    'tickets' => [
        'list'   => [['own' => 'submittedBy'], ['role' => ADMIN_ROLES]],
        'view'   => [['own' => 'submittedBy'], ['role' => ADMIN_ROLES]],
        'create' => ['auth'],
        'update' => ['auth'],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
        'owner'  => 'submittedBy',
    ],

    'ticket_comments' => [
        'list'   => ['auth'],
        'view'   => ['auth'],
        'create' => ['auth'],
        'update' => [['own' => 'author']],
        'delete' => [['own' => 'author'], ['role' => ADMIN_ROLES]],
        'tenant' => false,        // scoped through its parent ticket
        'owner'  => 'author',
    ],

    // ---- Public site -------------------------------------------
    'news_posts' => [
        'list'   => ['public'],
        'view'   => ['public'],
        'create' => [['role' => ADMIN_ROLES]],
        'update' => [['role' => ADMIN_ROLES]],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => false,
        'owner'  => 'author',
    ],

    'news_categories' => [
        'list'   => ['public'],
        'view'   => ['public'],
        'create' => [['role' => ADMIN_ROLES]],
        'update' => [['role' => ADMIN_ROLES]],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => false,
    ],

    // ---- Administrative hierarchy (public read) -----------------
    'offices_struct' => [
        'list' => ['public'], 'view' => ['public'],
        'create' => [['role' => ADMIN_ROLES]], 'update' => [['role' => ADMIN_ROLES]], 'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => false,
    ],
    'area_councils' => [
        'list' => ['public'], 'view' => ['public'],
        'create' => [['role' => ADMIN_ROLES]], 'update' => [['role' => ADMIN_ROLES]], 'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => false,
    ],
    'communities' => [
        'list' => ['public'], 'view' => ['public'],
        'create' => [['role' => ADMIN_ROLES]], 'update' => [['role' => ADMIN_ROLES]], 'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => false,
    ],
    'sectors' => [
        'list' => ['public'], 'view' => ['public'],
        'create' => [['role' => ADMIN_ROLES]], 'update' => [['role' => ADMIN_ROLES]], 'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => false,
    ],

    // ---- Verification ------------------------------------------
    'verification_codes' => [
        'list'   => [['role' => ADMIN_ROLES]],
        'view'   => ['public'],          // redeemed by the public portal
        'create' => [['role' => ADMIN_ROLES]],
        'update' => [['role' => ADMIN_ROLES]],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
    ],

    'verification_logs' => [
        'list'   => [['role' => ADMIN_ROLES]],
        'view'   => [['role' => ADMIN_ROLES]],
        'create' => ['public'],          // written on every public lookup
        'update' => ['never'],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
    ],

    // ---- Administration ----------------------------------------
    'audit_logs' => [
        'list'   => [['own' => 'actor'], ['role' => ADMIN_ROLES]],
        'view'   => [['own' => 'actor'], ['role' => ADMIN_ROLES]],
        'create' => ['auth'],
        'update' => ['never'],           // the trail is append-only
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
    ],

    'sms_logs' => [
        'list'   => [['role' => ADMIN_ROLES]],
        'view'   => [['role' => ADMIN_ROLES]],
        'create' => ['auth'],
        'update' => ['never'],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
    ],

    'menu_customizations' => [
        'list'   => ['auth'],
        'view'   => ['auth'],
        'create' => [['role' => ADMIN_ROLES]],
        'update' => [['role' => ADMIN_ROLES]],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
        'owner'  => 'owner',
    ],

    'otp_sessions' => [
        // Handled entirely by the OTP endpoints, never over the
        // generic record API.
        'list' => ['never'], 'view' => ['never'],
        'create' => ['never'], 'update' => ['never'], 'delete' => ['never'],
        'tenant' => true,
    ],

    // ---- SaaS platform -----------------------------------------
    'tenants' => [
        // A workspace admin may read only their OWN workspace row;
        // only super_admin sees the directory or writes to it.
        'list'   => [['own' => 'id'], ['role' => ['super_admin']]],
        'view'   => [['own' => 'id'], ['role' => ['super_admin']]],
        'create' => [['role' => ['super_admin']]],
        'update' => [['role' => ['super_admin']]],
        'delete' => [['role' => ['super_admin']]],
        'tenant' => false,
        'ownIsTenant' => true,   // 'own' compares against the caller's tenant
    ],

    'tenant_branding' => [
        // Public read: the login screen resolves a workspace's logo
        // and colours by subdomain before anyone signs in.
        'list'   => ['public'],
        'view'   => ['public'],
        'create' => [['role' => ['super_admin']]],
        'update' => [['ownTenant' => 'tenant', 'role' => ADMIN_ROLES], ['role' => ['super_admin']]],
        'delete' => [['role' => ['super_admin']]],
        'tenant' => false,
    ],

    'users' => [
        // Staff see colleagues in their own workspace (and themselves).
        'list'   => ['auth'],
        'view'   => ['auth'],
        'create' => [['role' => ADMIN_ROLES]],
        'update' => [['own' => 'id'], ['role' => ADMIN_ROLES]],
        'delete' => [['role' => ADMIN_ROLES]],
        'tenant' => true,
        'ownIsSelf' => true,     // 'own' => 'id' compares against the caller's id
    ],
];
