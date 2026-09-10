<?php
/**
 * =============================================================
 * ACCESS-CONTROL TESTS
 * =============================================================
 * Run with:   php api/tests/guard-test.php
 *
 * These cover the rules that used to be enforced inside PocketBase
 * and are now enforced in PHP — above all, that one District
 * Assembly can never see another's records. Run this after any
 * change to api/lib/rules.php or api/lib/guard.php.
 *
 * No database is required; the guard works on plain arrays.
 * =============================================================
 */

declare(strict_types=1);

// Stand-ins for http.php, so a rejected check raises instead of exiting.
class GuardRejection extends RuntimeException {}

function json_error(string $message, int $status = 400, array $extra = []): never
{
    throw new GuardRejection($message, $status);
}
function json_response($data, int $status = 200): never
{
    throw new GuardRejection('response', $status);
}

require_once __DIR__ . '/../lib/guard.php';

// ---- Fixtures ---------------------------------------------------
$T1 = 'tenantoneid00000';
$T2 = 'tenanttwoid00000';

$superAdmin  = ['id' => 'usrsuper0000001', 'role' => 'super_admin',      'tenant' => null];
$adminT1     = ['id' => 'usradmin1000001', 'role' => 'admin',            'tenant' => $T1];
$adminT2     = ['id' => 'usradmin2000001', 'role' => 'admin',            'tenant' => $T2];
$registrarT1 = ['id' => 'usrregis1000001', 'role' => 'registrar',        'tenant' => $T1];
$financeT1   = ['id' => 'usrfinan1000001', 'role' => 'finance_officer',  'tenant' => $T1];
$planningT1  = ['id' => 'usrplann1000001', 'role' => 'planning_officer', 'tenant' => $T1];
$unassigned  = ['id' => 'usrlegacy000001', 'role' => 'registrar',        'tenant' => null];
$anonymous   = null;

$passed = 0;
$failed = 0;

function check(string $label, $actual, $expected): void
{
    global $passed, $failed;
    $ok = $actual === $expected;
    $ok ? $passed++ : $failed++;
    printf(
        "  %s  %-62s %s\n",
        $ok ? 'PASS' : 'FAIL',
        $label,
        $ok ? '' : '(got ' . var_export($actual, true) . ', expected ' . var_export($expected, true) . ')'
    );
}

function section(string $title): void
{
    echo "\n$title\n" . str_repeat('-', 78) . "\n";
}

// =================================================================
section('Workspace isolation — the clause that must never be skipped');

[$sql, $params] = guard_tenant_clause('parcels', $adminT1);
check('workspace admin: parcels are filtered by their own workspace',
    $sql, '(`tenant` = ? OR `tenant` IS NULL)');
check('workspace admin: the bound parameter is their own workspace id',
    $params, [$T1]);

[$sql, $params] = guard_tenant_clause('parcels', $superAdmin);
check('super admin: no workspace filter (sees the whole platform)', $sql, '');

[$sql, $params] = guard_tenant_clause('parcels', $unassigned);
check('unassigned account: only legacy rows with no workspace', $sql, '`tenant` IS NULL');

[$sql] = guard_tenant_clause('news_posts', $adminT1);
check('news is platform-wide, so it carries no workspace filter', $sql, '');

[$sql] = guard_tenant_clause('parcels', $adminT1, 'p');
check('table alias is honoured in the clause', $sql, '(`p`.`tenant` = ? OR `p`.`tenant` IS NULL)');

// =================================================================
section('Cross-workspace record access is refused');

$parcelT1 = ['id' => 'parcel000000001', 'owner' => $registrarT1['id'], 'tenant' => $T1];
$parcelT2 = ['id' => 'parcel000000002', 'owner' => $adminT2['id'],     'tenant' => $T2];

try {
    records_stub_same_workspace('parcels', $parcelT2, $adminT1);
    check('admin of workspace 1 reading a workspace 2 parcel is blocked', 'allowed', 'blocked');
} catch (GuardRejection $e) {
    check('admin of workspace 1 reading a workspace 2 parcel is blocked', 'blocked', 'blocked');
}

try {
    records_stub_same_workspace('parcels', $parcelT1, $adminT1);
    check('admin of workspace 1 reading their own parcel is allowed', 'allowed', 'allowed');
} catch (GuardRejection $e) {
    check('admin of workspace 1 reading their own parcel is allowed', 'blocked', 'allowed');
}

try {
    records_stub_same_workspace('parcels', $parcelT2, $superAdmin);
    check('super admin may read any workspace', 'allowed', 'allowed');
} catch (GuardRejection $e) {
    check('super admin may read any workspace', 'blocked', 'allowed');
}

// =================================================================
section('Role permissions');

check('registrar may not delete a parcel',      guard_can('parcels', 'delete', $registrarT1), false);
check('workspace admin may delete a parcel',    guard_can('parcels', 'delete', $adminT1), true);
check('super admin may delete a parcel',        guard_can('parcels', 'delete', $superAdmin), true);
check('registrar may create a parcel',          guard_can('parcels', 'create', $registrarT1), true);
check('registrar may not create a payment',     guard_can('payments', 'create', $registrarT1), false);
check('finance officer may create a payment',   guard_can('payments', 'create', $financeT1), true);
check('planning officer may approve transfers', guard_can('land_transfers', 'update', $planningT1), true);
check('registrar may not approve transfers',    guard_can('land_transfers', 'update', $registrarT1), false);

// =================================================================
section('Public endpoints');

check('anonymous visitor may view one parcel (verification portal)',
    guard_can('parcels', 'view', $anonymous), true);
check('anonymous visitor may NOT list all parcels',
    guard_can('parcels', 'list', $anonymous), false);
check('anonymous visitor may read workspace branding (login screen)',
    guard_can('tenant_branding', 'view', $anonymous), true);
check('anonymous visitor may read published news',
    guard_can('news_posts', 'list', $anonymous), true);
check('anonymous visitor may not write news',
    guard_can('news_posts', 'create', $anonymous), false);

// =================================================================
section('Owner-only collections have no admin bypass (as in PocketBase)');

$prefsOfRegistrar = ['id' => 'pref00000000001', 'user' => $registrarT1['id'], 'tenant' => $T1];
check('admin may NOT read another user\'s notification preferences',
    guard_can('notification_preferences', 'view', $adminT1, $prefsOfRegistrar), false);
check('the owner may read their own notification preferences',
    guard_can('notification_preferences', 'view', $registrarT1, $prefsOfRegistrar), true);

$chat = ['id' => 'chat00000000001', 'sender' => $registrarT1['id'], 'recipient' => $financeT1['id'], 'tenant' => $T1];
check('admin may NOT read a chat between two other staff',
    guard_can('chat_messages', 'view', $adminT1, $chat), false);
check('the recipient may read their own chat',
    guard_can('chat_messages', 'view', $financeT1, $chat), true);

// =================================================================
section('Ownership filters for callers without a blanket role');

[$sql, $params] = guard_ownership_clause('payments', $financeT1);
check('finance officer sees every payment (no ownership filter)', $sql, '');

[$sql, $params] = guard_ownership_clause('payments', $registrarT1);
check('registrar only sees payments they are the payer of', $sql, '(`payer` = ?)');
check('  ...bound to their own user id', $params, [$registrarT1['id']]);

[$sql] = guard_ownership_clause('parcels', $registrarT1);
check('parcels are visible to all staff, so no ownership filter', $sql, '');

[$sql, $params] = guard_ownership_clause('chat_messages', $registrarT1);
check('chat is limited to messages the caller sent or received',
    $sql, '(`sender` = ? OR `recipient` = ?)');

// =================================================================
section('SaaS platform boundaries');

check('workspace admin may not create a workspace', guard_can('tenants', 'create', $adminT1), false);
check('workspace admin may not edit a workspace',   guard_can('tenants', 'update', $adminT1), false);
check('super admin may create a workspace',         guard_can('tenants', 'create', $superAdmin), true);

$tenantRow1 = ['id' => $T1, 'name' => 'Techiman North'];
$tenantRow2 = ['id' => $T2, 'name' => 'Another Assembly'];
check('workspace admin may view their own workspace record',
    guard_can('tenants', 'view', $adminT1, $tenantRow1), true);
check('workspace admin may NOT view another workspace record',
    guard_can('tenants', 'view', $adminT1, $tenantRow2), false);

$brandingT1 = ['id' => 'brand0000000001', 'tenant' => $T1];
$brandingT2 = ['id' => 'brand0000000002', 'tenant' => $T2];
check('workspace admin may edit their own branding',
    guard_can('tenant_branding', 'update', $adminT1, $brandingT1), true);
check('workspace admin may NOT edit another workspace\'s branding',
    guard_can('tenant_branding', 'update', $adminT1, $brandingT2), false);
check('a registrar may not edit branding at all',
    guard_can('tenant_branding', 'update', $registrarT1, $brandingT1), false);

// =================================================================
section('Append-only collections');

check('nobody may edit an audit log entry — not even a super admin',
    guard_can('audit_logs', 'update', $superAdmin), false);
check('nobody may reach otp_sessions over the record API',
    guard_can('otp_sessions', 'list', $superAdmin), false);

// =================================================================
section('Privilege escalation is blocked');

$escalation = guard_strip_protected('users', ['fullName' => 'Kofi', 'role' => 'admin'], $registrarT1);
check('a registrar cannot set roles when updating a user',
    array_key_exists('role', $escalation), false);

try {
    guard_strip_protected('users', ['role' => 'super_admin'], $adminT1);
    check('a workspace admin cannot grant super_admin', 'allowed', 'blocked');
} catch (GuardRejection $e) {
    check('a workspace admin cannot grant super_admin', 'blocked', 'blocked');
}

try {
    guard_strip_protected('users', ['roles' => ['admin', 'super_admin']], $adminT1);
    check('a workspace admin cannot grant super_admin via the roles array', 'allowed', 'blocked');
} catch (GuardRejection $e) {
    check('a workspace admin cannot grant super_admin via the roles array', 'blocked', 'blocked');
}

$billing = guard_strip_protected('tenants', ['name' => 'New name', 'billingStatus' => 'active', 'maxUsers' => 999], $adminT1);
check('a workspace admin cannot change their own billing status',
    array_key_exists('billingStatus', $billing), false);
check('a workspace admin cannot raise their own seat limit',
    array_key_exists('maxUsers', $billing), false);

$byPlatform = guard_strip_protected('tenants', ['billingStatus' => 'active'], $superAdmin);
check('a super admin can change billing status',
    array_key_exists('billingStatus', $byPlatform), true);

$stamped = guard_stamp_tenant('parcels', ['parcelNumber' => 'TUO-2026-0001'], $registrarT1);
check('a new record is stamped with the creator\'s workspace', $stamped['tenant'] ?? null, $T1);

$forged = guard_stamp_tenant('parcels', ['parcelNumber' => 'X', 'tenant' => $T2], $registrarT1);
check('a caller cannot plant a record in another workspace', $forged['tenant'], $T1);

$deliberate = guard_stamp_tenant('parcels', ['parcelNumber' => 'X', 'tenant' => $T2], $superAdmin);
check('a super admin may write into a chosen workspace', $deliberate['tenant'], $T2);

// =================================================================
section('Multi-role staff');

$multi = ['id' => 'usrmulti0000001', 'role' => 'registrar',
          'roles' => '["registrar","finance_officer"]', 'tenant' => $T1];
check('a second role from the roles array is honoured',
    guard_can('payments', 'create', $multi), true);
check('roles the account does not hold are still refused',
    guard_can('tenants', 'create', $multi), false);

// =================================================================
printf("\n%s\n%d passed, %d failed\n", str_repeat('=', 78), $passed, $failed);
exit($failed > 0 ? 1 : 0);

/**
 * Mirrors records_assert_same_workspace() from routes/records.php,
 * which cannot be loaded here because it pulls in the database.
 */
function records_stub_same_workspace(string $collection, array $record, ?array $user): void
{
    $rules = rules_for($collection);
    if (empty($rules['tenant']) || is_super_admin($user) || $user === null) {
        return;
    }
    $recordTenant = $record['tenant'] ?? null;
    if ($recordTenant === null || $recordTenant === '') {
        return;
    }
    if ($recordTenant !== ($user['tenant'] ?? null)) {
        json_error('Record not found.', 404);
    }
}
