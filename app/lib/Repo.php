<?php

declare(strict_types=1);

namespace App;

/**
 * Thin, workspace-aware data access for the admin UI.
 *
 * Every read is scoped to the caller's workspace unless they are a
 * super_admin. Writes are stamped with the caller's workspace and
 * an audit-log entry. Column names are validated against the live
 * table before they ever touch SQL.
 */
final class Repo
{
    /** Tables that carry a `tenant` column and must be workspace-scoped. */
    private const TENANT_TABLES = [
        'parcels', 'applications', 'documents', 'surveys', 'land_transfers',
        'payments', 'land_edit_requests', 'notifications', 'notification_preferences',
        'audit_logs', 'chat_messages', 'tickets', 'sms_logs', 'verification_codes',
        'verification_logs', 'menu_customizations', 'news_posts', 'news_categories',
        'offices_struct', 'area_councils', 'communities', 'sectors', 'users',
    ];

    public function __construct(private Auth $auth)
    {
    }

    public function isTenantScoped(string $table): bool
    {
        return in_array($table, self::TENANT_TABLES, true) && !$this->auth->isSuperAdmin();
    }

    /** [sqlFragment, params] workspace clause for a table (or ['', []]). */
    public function tenantClause(string $table, string $alias = ''): array
    {
        if (!$this->isTenantScoped($table)) {
            return ['', []];
        }
        $col = ($alias ? "`$alias`." : '') . '`tenant`';
        $tid = $this->auth->tenantId();
        if (!$tid) {
            return ["$col IS NULL", []];
        }
        return ["($col = ? OR $col IS NULL)", [$tid]];
    }

    /** @return array<string,string> column => type */
    public static function columns(string $table): array
    {
        static $cache = [];
        if (isset($cache[$table])) {
            return $cache[$table];
        }
        $rows = db_all(
            'SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
            [$table]
        );
        $out = [];
        foreach ($rows as $r) {
            $out[$r['COLUMN_NAME']] = strtolower($r['DATA_TYPE']);
        }
        return $cache[$table] = $out;
    }

    public static function hasColumn(string $table, string $column): bool
    {
        return array_key_exists($column, self::columns($table));
    }

    /** Find one row by id, workspace-checked. */
    public function find(string $table, string $id): ?array
    {
        $row = db_one("SELECT * FROM `$table` WHERE `id` = ?", [$id]);
        if (!$row) {
            return null;
        }
        if ($this->isTenantScoped($table)) {
            $rt = $row['tenant'] ?? null;
            if ($rt !== null && $rt !== '' && $rt !== $this->auth->tenantId()) {
                return null;
            }
        }
        return self::hydrate($table, $row);
    }

    public function findBy(string $table, string $column, $value): ?array
    {
        self::assertColumn($table, $column);
        [$tc, $tp] = $this->tenantClause($table);
        $sql = "SELECT * FROM `$table` WHERE `$column` = ?" . ($tc ? " AND $tc" : '') . ' LIMIT 1';
        $row = db_one($sql, array_merge([$value], $tp));
        return $row ? self::hydrate($table, $row) : null;
    }

    /**
     * List rows with optional exact filters, search, sort, pagination.
     * @param array{filters?:array<string,mixed>, search?:string, searchable?:string[],
     *              sort?:string, page?:int, perPage?:int, where?:array{0:string,1:array}} $opts
     * @return array{0: array<int,array>, 1: array}
     */
    public function paginate(string $table, array $opts = []): array
    {
        $where = [];
        $params = [];

        [$tc, $tp] = $this->tenantClause($table);
        if ($tc) {
            $where[] = $tc;
            $params = array_merge($params, $tp);
        }

        foreach ($opts['filters'] ?? [] as $col => $val) {
            if ($val === '' || $val === null) {
                continue;
            }
            self::assertColumn($table, $col);
            if ($val === '__null__') {
                $where[] = "`$col` IS NULL";
            } else {
                $where[] = "`$col` = ?";
                $params[] = $val;
            }
        }

        if (!empty($opts['search']) && !empty($opts['searchable'])) {
            $parts = [];
            foreach ($opts['searchable'] as $col) {
                if (self::hasColumn($table, $col)) {
                    $parts[] = "`$col` LIKE ?";
                    $params[] = '%' . $opts['search'] . '%';
                }
            }
            if ($parts) {
                $where[] = '(' . implode(' OR ', $parts) . ')';
            }
        }

        if (!empty($opts['where'])) {
            $where[] = $opts['where'][0];
            $params = array_merge($params, $opts['where'][1]);
        }

        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

        $orderSql = ' ORDER BY `created` DESC';
        if (!empty($opts['sort'])) {
            $field = ltrim($opts['sort'], '-+');
            if (self::hasColumn($table, $field)) {
                $dir = str_starts_with($opts['sort'], '-') ? 'DESC' : 'ASC';
                $orderSql = " ORDER BY `$field` $dir";
            }
        } elseif (!self::hasColumn($table, 'created')) {
            $orderSql = '';
        }

        [$rows, $meta] = paginate(
            "SELECT * FROM `$table`$whereSql$orderSql",
            $params,
            (int) ($opts['page'] ?? 1),
            (int) ($opts['perPage'] ?? 25)
        );
        return [array_map(static fn ($r) => self::hydrate($table, $r), $rows), $meta];
    }

    /** All rows (small reference tables only), workspace-scoped. */
    public function all(string $table, string $orderBy = 'name', string $dir = 'ASC'): array
    {
        [$tc, $tp] = $this->tenantClause($table);
        $order = self::hasColumn($table, $orderBy) ? " ORDER BY `$orderBy` $dir" : '';
        $rows = db_all("SELECT * FROM `$table`" . ($tc ? " WHERE $tc" : '') . $order, $tp);
        return array_map(static fn ($r) => self::hydrate($table, $r), $rows);
    }

    public function count(string $table, array $filters = []): int
    {
        $where = [];
        $params = [];
        [$tc, $tp] = $this->tenantClause($table);
        if ($tc) {
            $where[] = $tc;
            $params = array_merge($params, $tp);
        }
        foreach ($filters as $col => $val) {
            self::assertColumn($table, $col);
            if ($val === '__notnull__') {
                $where[] = "`$col` IS NOT NULL";
            } else {
                $where[] = "`$col` = ?";
                $params[] = $val;
            }
        }
        $sql = "SELECT COUNT(*) FROM `$table`" . ($where ? ' WHERE ' . implode(' AND ', $where) : '');
        return (int) db_value($sql, $params);
    }

    /** Insert, stamping workspace + returning the new id. */
    public function create(string $table, array $data, string $auditAction = ''): string
    {
        $data = self::sanitize($table, $data);
        if (self::hasColumn($table, 'tenant') && empty($data['tenant']) && $this->auth->tenantId()) {
            $data['tenant'] = $this->auth->tenantId();
        }
        $id = db_insert($table, $data);
        Audit::log($auditAction ?: "{$table}_created", $table, $id);
        return $id;
    }

    public function update(string $table, string $id, array $data, string $auditAction = ''): void
    {
        // Ensure the row is in-scope before writing.
        if (!$this->find($table, $id)) {
            throw new \RuntimeException('Record not found or outside your workspace.');
        }
        unset($data['id'], $data['created'], $data['tenant']);
        $data = self::sanitize($table, $data);
        if ($data) {
            db_update($table, $id, $data);
        }
        Audit::log($auditAction ?: "{$table}_updated", $table, $id);
    }

    public function delete(string $table, string $id, string $auditAction = ''): void
    {
        if (!$this->find($table, $id)) {
            throw new \RuntimeException('Record not found or outside your workspace.');
        }
        db_delete($table, $id);
        Audit::log($auditAction ?: "{$table}_deleted", $table, $id);
    }

    // ---- helpers ---------------------------------------------------

    public static function assertColumn(string $table, string $column): void
    {
        if (!self::hasColumn($table, $column)) {
            throw new \InvalidArgumentException("Unknown column $table.$column");
        }
    }

    /** Keep only real columns; encode arrays to JSON, '' to NULL for typed cols. */
    public static function sanitize(string $table, array $data): array
    {
        $cols = self::columns($table);
        $out = [];
        foreach ($data as $k => $v) {
            if (!isset($cols[$k])) {
                continue;
            }
            $type = $cols[$k];
            if (is_array($v) || is_object($v)) {
                $out[$k] = json_encode($v);
            } elseif (is_bool($v)) {
                $out[$k] = $v ? 1 : 0;
            } elseif ($v === '' && in_array($type, ['int', 'bigint', 'double', 'decimal', 'datetime', 'date', 'json', 'enum'], true)) {
                $out[$k] = null;
            } elseif (in_array($type, ['datetime', 'date'], true) && $v) {
                $out[$k] = rtrim(preg_replace('/\.\d+/', '', str_replace('T', ' ', trim((string) $v))) ?? '', 'Z ');
            } else {
                $out[$k] = $v;
            }
        }
        return $out;
    }

    /** JSON columns -> arrays, TINYINT(1) -> bool. */
    public static function hydrate(string $table, array $row): array
    {
        foreach (self::columns($table) as $col => $type) {
            if (!array_key_exists($col, $row) || $row[$col] === null) {
                continue;
            }
            if ($type === 'json' && is_string($row[$col])) {
                $decoded = json_decode($row[$col], true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $row[$col] = $decoded;
                }
            } elseif ($type === 'tinyint') {
                $row[$col] = (bool) $row[$col];
            }
        }
        unset($row['password'], $row['tokenKey'], $row['tokenHash']);
        return $row;
    }
}
