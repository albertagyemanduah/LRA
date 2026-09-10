<?php
/**
 * =============================================================
 * GUARD — enforces the rules in rules.php
 * =============================================================
 * Everything that reads or writes a record goes through here, so
 * the tenant and role checks live in exactly one place. This is
 * the layer PocketBase used to provide inside the database.
 *
 * The important one is guard_tenant_clause(): every list query gets
 * a workspace condition appended. Skip it anywhere and one District
 * Assembly starts seeing another's land records.
 * =============================================================
 */

declare(strict_types=1);

/** All rules, loaded once. */
function all_rules(): array
{
    static $rules = null;
    $rules ??= require __DIR__ . '/rules.php';
    return $rules;
}

/**
 * Rules for one collection. Unknown names are rejected — this is
 * also what stops a caller reaching an arbitrary table by name.
 */
function rules_for(string $collection): array
{
    $rules = all_rules();
    if (!isset($rules[$collection])) {
        json_error("Unknown collection: $collection", 404);
    }
    return $rules[$collection];
}

/** Every role the caller holds (the app supports multi-role staff). */
function user_roles(?array $user): array
{
    if (!$user) {
        return [];
    }
    $roles = $user['roles'] ?? null;
    if (is_string($roles)) {
        $decoded = json_decode($roles, true);
        $roles = is_array($decoded) ? $decoded : null;
    }
    if (!is_array($roles) || $roles === []) {
        $roles = isset($user['role']) ? [$user['role']] : [];
    }
    return array_values(array_filter($roles, 'is_string'));
}

function is_super_admin(?array $user): bool
{
    return in_array('super_admin', user_roles($user), true);
}

/**
 * Evaluate one alternative from a rule.
 *
 * $record is null when checking a whole-collection action (list,
 * create); in that case record-specific conditions are treated as
 * "possible" and are enforced later by the WHERE clause instead.
 */
function guard_alternative_passes($alternative, ?array $user, ?array $record, array $rules): bool
{
    // Shorthand alternatives
    if ($alternative === 'public') {
        return true;
    }
    if ($alternative === 'never') {
        return false;
    }
    if ($alternative === 'auth') {
        return $user !== null;
    }
    if (!is_array($alternative)) {
        return false;
    }

    // Every condition in an alternative must hold.
    foreach ($alternative as $type => $value) {
        switch ($type) {
            case 'role':
                if (!$user || array_intersect(user_roles($user), (array) $value) === []) {
                    return false;
                }
                break;

            case 'own':
                if (!$user) {
                    return false;
                }
                if ($record === null) {
                    break;  // enforced by the query's WHERE clause
                }
                $mine = !empty($rules['ownIsTenant']) ? ($user['tenant'] ?? null) : $user['id'];
                if (($record[$value] ?? null) !== $mine || $mine === null) {
                    return false;
                }
                break;

            case 'ownTenant':
                if (!$user) {
                    return false;
                }
                if ($record === null) {
                    break;
                }
                if (($record[$value] ?? null) !== ($user['tenant'] ?? null) || empty($user['tenant'])) {
                    return false;
                }
                break;

            default:
                return false;   // unknown condition — fail closed
        }
    }
    return true;
}

/** May the caller perform $action on $collection (optionally on $record)? */
function guard_can(string $collection, string $action, ?array $user, ?array $record = null): bool
{
    $rules = rules_for($collection);

    // super_admin bypasses everything except explicit 'never'.
    $alternatives = $rules[$action] ?? ['never'];
    if ($alternatives === ['never'] || $alternatives === 'never') {
        return false;
    }
    if (is_super_admin($user)) {
        return true;
    }

    foreach ((array) $alternatives as $alternative) {
        if (guard_alternative_passes($alternative, $user, $record, $rules)) {
            return true;
        }
    }
    return false;
}

/** Same as guard_can(), but stops the request with 401/403. */
function guard_require(string $collection, string $action, ?array $user, ?array $record = null): void
{
    if (guard_can($collection, $action, $user, $record)) {
        return;
    }
    if ($user === null) {
        json_error('Please sign in to continue.', 401);
    }
    json_error("You do not have permission to $action $collection.", 403);
}

/**
 * The workspace condition for a list/count query.
 *
 * super_admin sees every workspace. Everyone else sees only their
 * own, plus legacy rows that predate multi-tenancy (tenant IS NULL),
 * mirroring PocketBase's "@request.auth.tenant = tenant || tenant = ''".
 *
 * @return array{0: string, 1: array<int, mixed>}  [sqlFragment, params]
 */
function guard_tenant_clause(string $collection, ?array $user, string $alias = ''): array
{
    $rules = rules_for($collection);
    if (empty($rules['tenant']) || is_super_admin($user)) {
        return ['', []];
    }

    $col = ($alias !== '' ? "`$alias`." : '') . '`tenant`';
    $tenant = $user['tenant'] ?? null;

    if ($tenant === null || $tenant === '') {
        // An unassigned account only ever sees unassigned records.
        return ["$col IS NULL", []];
    }
    return ["($col = ? OR $col IS NULL)", [$tenant]];
}

/**
 * The ownership condition for a list query, when the caller does not
 * hold a role that grants blanket access.
 *
 * e.g. payments: a finance_officer sees everything; anyone else sees
 * only rows where payer = their id.
 *
 * @return array{0: string, 1: array<int, mixed>}
 */
function guard_ownership_clause(string $collection, ?array $user, string $alias = ''): array
{
    $rules = rules_for($collection);
    if (is_super_admin($user)) {
        return ['', []];
    }

    $alternatives = (array) ($rules['list'] ?? []);
    $ownColumns = [];

    foreach ($alternatives as $alternative) {
        // A non-record alternative the caller already satisfies means
        // no ownership filter is needed at all.
        if (in_array($alternative, ['public', 'auth'], true)) {
            if ($alternative === 'public' || $user !== null) {
                return ['', []];
            }
            continue;
        }
        if (!is_array($alternative)) {
            continue;
        }
        if (isset($alternative['role']) && !isset($alternative['own'])) {
            if ($user && array_intersect(user_roles($user), (array) $alternative['role']) !== []) {
                return ['', []];
            }
            continue;
        }
        if (isset($alternative['own'])) {
            $ownColumns[] = $alternative['own'];
        }
    }

    if ($ownColumns === []) {
        return ['', []];
    }
    if (!$user) {
        json_error('Please sign in to continue.', 401);
    }

    $mine = !empty($rules['ownIsTenant']) ? ($user['tenant'] ?? null) : $user['id'];
    if ($mine === null) {
        return ['1 = 0', []];   // nothing to match against — return nothing
    }

    $prefix = $alias !== '' ? "`$alias`." : '';
    $parts  = [];
    $params = [];
    foreach (array_unique($ownColumns) as $col) {
        $parts[]  = "$prefix`$col` = ?";
        $params[] = $mine;
    }
    return ['(' . implode(' OR ', $parts) . ')', $params];
}

/**
 * Refuse writes from a workspace whose subscription is not active.
 *
 * Carried over from pb_hooks/enforce-tenant-suspension.pb.js, which
 * blocked writes for a session that was still valid when the
 * workspace got suspended.
 */
function guard_workspace_active(?array $user): void
{
    if (!$user || is_super_admin($user) || empty($user['tenant'])) {
        return;
    }
    $tenant = db_one('SELECT `name`, `status`, `billingStatus` FROM `tenants` WHERE `id` = ?', [$user['tenant']]);
    if (!$tenant) {
        return;
    }
    $blocked = in_array($tenant['billingStatus'], ['suspended', 'cancelled'], true)
        || (empty($tenant['billingStatus']) && $tenant['status'] === 'inactive');

    if ($blocked) {
        json_error(
            ($tenant['name'] ?: 'Your workspace') . "'s subscription is not active. Contact the platform administrator.",
            403
        );
    }
}

/**
 * Stamp a new record with the creator's workspace, unless one was
 * given explicitly by a super_admin.
 *
 * Carried over from pb_hooks/tenant-autoassign.pb.js.
 */
function guard_stamp_tenant(string $collection, array $data, ?array $user): array
{
    $rules = rules_for($collection);
    if (empty($rules['tenant']) || !$user) {
        return $data;
    }
    if (!empty($data['tenant']) && is_super_admin($user)) {
        return $data;                      // deliberate cross-workspace write
    }
    if (!empty($user['tenant'])) {
        $data['tenant'] = $user['tenant'];
    }
    return $data;
}

/**
 * Columns a caller is never allowed to set directly, whatever the
 * request body says.
 */
function guard_strip_protected(string $collection, array $data, ?array $user): array
{
    // Ids and timestamps are owned by the database.
    unset($data['created'], $data['updated']);

    if ($collection === 'users') {
        // Only an admin may set these; password goes through its own endpoint.
        unset($data['password'], $data['tokenKey']);
        if (!$user || array_intersect(user_roles($user), ADMIN_ROLES) === []) {
            unset($data['role'], $data['roles'], $data['verified'], $data['suspended'], $data['tenant']);
        }
        // Only the platform owner may grant platform-level access.
        if (!is_super_admin($user)) {
            if (($data['role'] ?? null) === 'super_admin') {
                json_error('Only a platform Super Admin may grant that role.', 403);
            }
            if (isset($data['roles']) && in_array('super_admin', (array) $data['roles'], true)) {
                json_error('Only a platform Super Admin may grant that role.', 403);
            }
        }
    }

    if ($collection === 'tenants' && !is_super_admin($user)) {
        // Billing state is the platform's to set, never the workspace's.
        unset($data['plan'], $data['billingStatus'], $data['billingCycle'],
              $data['trialEndsAt'], $data['maxUsers'], $data['subdomain'],
              $data['planPriceGHS'], $data['billingNotes'], $data['status']);
    }

    return $data;
}
