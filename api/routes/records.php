<?php
/**
 * =============================================================
 * RECORD API  —  /api/records/{collection}[/{id}]
 * =============================================================
 * The generic CRUD layer that replaces PocketBase's record API.
 * The response shape matches PocketBase's (page / perPage /
 * totalItems / totalPages / items) so the frontend's existing
 * getList() and getFullList() call sites need the smallest possible
 * change.
 *
 *   GET    /api/records/parcels?page=1&perPage=50&sort=-created
 *   GET    /api/records/parcels?filter[status]=registered
 *   GET    /api/records/parcels?search=TUO-2026            (see SEARCHABLE)
 *   GET    /api/records/parcels/abc123def456ghi
 *   POST   /api/records/parcels          { ...fields }
 *   PATCH  /api/records/parcels/abc123   { ...fields }
 *   DELETE /api/records/parcels/abc123
 *
 * Every query is filtered by workspace in guard.php — see the note
 * there before changing anything in this file.
 * =============================================================
 */

declare(strict_types=1);

/** Columns a free-text `search` looks at, per collection. */
const SEARCHABLE = [
    'parcels'       => ['parcelNumber', 'applicantName', 'plotNumber', 'block', 'community', 'areaCouncil', 'sector', 'contactPhone'],
    'users'         => ['fullName', 'email', 'phone', 'ghanaCard'],
    'payments'      => ['invoiceNumber', 'ownerName', 'parcelNumber', 'ownerPhone'],
    'tickets'       => ['subject', 'description', 'relatedLandId'],
    'documents'     => ['title'],
    'news_posts'    => ['title', 'excerpt'],
    'tenants'       => ['name', 'code', 'region', 'subdomain'],
    'communities'   => ['name', 'code'],
    'area_councils' => ['name', 'code'],
    'sectors'       => ['name', 'code'],
];

const MAX_PER_PAGE = 500;

function records_route(string $collection, ?string $id): void
{
    $method = request_method();
    $user   = auth_user();

    switch ($method) {
        case 'GET':
            $id === null
                ? records_list($collection, $user)
                : records_view($collection, $id, $user);
            break;

        case 'POST':
            records_create($collection, $user);
            break;

        case 'PATCH':
        case 'PUT':
            if ($id === null) {
                json_error('A record id is required.', 400);
            }
            records_update($collection, $id, $user);
            break;

        case 'DELETE':
            if ($id === null) {
                json_error('A record id is required.', 400);
            }
            records_delete($collection, $id, $user);
            break;

        default:
            json_error("Method $method is not supported here.", 405);
    }
}

// ---------------------------------------------------------------
// LIST
// ---------------------------------------------------------------
function records_list(string $collection, ?array $user): void
{
    guard_require($collection, 'list', $user);

    $where  = [];
    $params = [];

    // Workspace isolation — the clause that must never be skipped.
    [$tenantSql, $tenantParams] = guard_tenant_clause($collection, $user);
    if ($tenantSql !== '') {
        $where[] = $tenantSql;
        $params  = array_merge($params, $tenantParams);
    }

    // "You may only see your own rows" for callers without a
    // blanket role (e.g. a registrar listing payments).
    [$ownSql, $ownParams] = guard_ownership_clause($collection, $user);
    if ($ownSql !== '') {
        $where[] = $ownSql;
        $params  = array_merge($params, $ownParams);
    }

    // Exact-match filters: ?filter[status]=registered
    foreach ((array) ($_GET['filter'] ?? []) as $column => $value) {
        if (!is_string($column) || is_array($value)) {
            continue;
        }
        $column  = assert_column($collection, $column);
        if ($value === 'null') {
            $where[] = "`$column` IS NULL";
        } else {
            $where[]  = "`$column` = ?";
            $params[] = $value;
        }
    }

    // Partial matches: ?like[applicantName]=kwame
    foreach ((array) ($_GET['like'] ?? []) as $column => $value) {
        if (!is_string($column) || is_array($value)) {
            continue;
        }
        $column   = assert_column($collection, $column);
        $where[]  = "`$column` LIKE ?";
        $params[] = '%' . $value . '%';
    }

    // Free-text search across the collection's searchable columns.
    $search = query_param('search');
    if ($search !== null && isset(SEARCHABLE[$collection])) {
        $parts = [];
        foreach (SEARCHABLE[$collection] as $column) {
            if (array_key_exists($column, table_columns($collection))) {
                $parts[]  = "`$column` LIKE ?";
                $params[] = '%' . $search . '%';
            }
        }
        if ($parts !== []) {
            $where[] = '(' . implode(' OR ', $parts) . ')';
        }
    }

    $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);

    // Sorting: ?sort=-created,name
    $orderSql = '';
    if ($sort = query_param('sort')) {
        $orders = [];
        foreach (explode(',', $sort) as $field) {
            $field = trim($field);
            if ($field === '') {
                continue;
            }
            $direction = 'ASC';
            if ($field[0] === '-') {
                $direction = 'DESC';
                $field = substr($field, 1);
            } elseif ($field[0] === '+') {
                $field = substr($field, 1);
            }
            $orders[] = '`' . assert_column($collection, $field) . "` $direction";
        }
        if ($orders !== []) {
            $orderSql = ' ORDER BY ' . implode(', ', $orders);
        }
    }

    $total = (int) db_value("SELECT COUNT(*) FROM `$collection`$whereSql", $params);

    // perPage=0 (or all=1) returns everything, matching getFullList().
    $perPageParam = query_param('perPage', '50');
    $wantsAll = query_param('all') === '1' || $perPageParam === '0';
    $perPage  = $wantsAll ? max($total, 1) : min(max((int) $perPageParam, 1), MAX_PER_PAGE);
    $page     = max((int) query_param('page', '1'), 1);
    $offset   = ($page - 1) * $perPage;

    // LIMIT/OFFSET are cast to int, never interpolated from raw input.
    $rows = db_all(
        "SELECT * FROM `$collection`$whereSql$orderSql LIMIT $perPage OFFSET $offset",
        $params
    );

    json_response([
        'page'       => $wantsAll ? 1 : $page,
        'perPage'    => $perPage,
        'totalItems' => $total,
        'totalPages' => $perPage > 0 ? (int) ceil($total / $perPage) : 1,
        'items'      => hydrate_rows($collection, $rows),
    ]);
}

// ---------------------------------------------------------------
// VIEW
// ---------------------------------------------------------------
function records_view(string $collection, string $id, ?array $user): void
{
    $record = db_one("SELECT * FROM `$collection` WHERE `id` = ?", [$id]);
    if (!$record) {
        json_error('Record not found.', 404);
    }

    guard_require($collection, 'view', $user, $record);
    records_assert_same_workspace($collection, $record, $user);

    json_response(hydrate_row($collection, $record));
}

// ---------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------
function records_create(string $collection, ?array $user): void
{
    guard_require($collection, 'create', $user);
    guard_workspace_active($user);

    $data = request_body();
    $data = guard_strip_protected($collection, $data, $user);
    $data = guard_stamp_tenant($collection, $data, $user);
    $data = dehydrate_row($collection, $data);

    if ($data === []) {
        json_error('No valid fields were supplied.', 422);
    }

    try {
        $id = db_insert($collection, $data);
    } catch (PDOException $e) {
        records_write_error($e);
    }

    $record = db_one("SELECT * FROM `$collection` WHERE `id` = ?", [$id]);
    auth_log($user['id'] ?? null, "{$collection}_created", $collection, $id, $user['tenant'] ?? null);

    json_response(hydrate_row($collection, $record ?? ['id' => $id]), 201);
}

// ---------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------
function records_update(string $collection, string $id, ?array $user): void
{
    $record = db_one("SELECT * FROM `$collection` WHERE `id` = ?", [$id]);
    if (!$record) {
        json_error('Record not found.', 404);
    }

    guard_require($collection, 'update', $user, $record);
    records_assert_same_workspace($collection, $record, $user);
    guard_workspace_active($user);

    $data = request_body();
    unset($data['id']);
    $data = guard_strip_protected($collection, $data, $user);
    $data = dehydrate_row($collection, $data);

    if ($data === []) {
        json_error('No valid fields were supplied.', 422);
    }

    try {
        db_update($collection, $id, $data);
    } catch (PDOException $e) {
        records_write_error($e);
    }

    $updated = db_one("SELECT * FROM `$collection` WHERE `id` = ?", [$id]);
    auth_log($user['id'] ?? null, "{$collection}_updated", $collection, $id, $user['tenant'] ?? null);

    json_response(hydrate_row($collection, $updated ?? []));
}

// ---------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------
function records_delete(string $collection, string $id, ?array $user): void
{
    $record = db_one("SELECT * FROM `$collection` WHERE `id` = ?", [$id]);
    if (!$record) {
        json_error('Record not found.', 404);
    }

    guard_require($collection, 'delete', $user, $record);
    records_assert_same_workspace($collection, $record, $user);
    guard_workspace_active($user);

    try {
        db_delete($collection, $id);
    } catch (PDOException $e) {
        // 1451: the row is still referenced by a protected record.
        if (($e->errorInfo[1] ?? 0) === 1451) {
            json_error(
                'This record cannot be deleted because other records still depend on it '
                . '(land, documents or payments reference it).',
                409
            );
        }
        records_write_error($e);
    }

    auth_log($user['id'] ?? null, "{$collection}_deleted", $collection, $id, $user['tenant'] ?? null);
    json_response(['deleted' => true, 'id' => $id]);
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/**
 * Second line of defence for single-record reads and writes: even
 * when the rule passes, the record must belong to the caller's
 * workspace. Without this, a guessed id from another District
 * Assembly would be readable.
 */
function records_assert_same_workspace(string $collection, array $record, ?array $user): void
{
    $rules = rules_for($collection);
    if (empty($rules['tenant']) || is_super_admin($user)) {
        return;
    }
    // A public read (e.g. the land verification portal) is allowed
    // across workspaces by design — that is what the portal is for.
    if ($user === null) {
        return;
    }
    $recordTenant = $record['tenant'] ?? null;
    if ($recordTenant === null || $recordTenant === '') {
        return;   // legacy record, visible to everyone as before
    }
    if ($recordTenant !== ($user['tenant'] ?? null)) {
        json_error('Record not found.', 404);   // do not confirm it exists
    }
}

/** Turn a database write error into a useful message. */
function records_write_error(PDOException $e): never
{
    $code = $e->errorInfo[1] ?? 0;

    if ($code === 1062) {
        json_error('A record with that value already exists.', 409);
    }
    if ($code === 1452) {
        json_error('A linked record does not exist.', 422);
    }
    if (in_array($code, [1364, 1048], true)) {
        json_error('A required field is missing.', 422);
    }
    if ($code === 1265 || $code === 1366) {
        json_error('One of the values is not valid for its field.', 422);
    }

    error_log('[records] write failed: ' . $e->getMessage());
    json_error('The record could not be saved.', 500);
}
