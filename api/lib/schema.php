<?php
/**
 * =============================================================
 * SCHEMA INTROSPECTION
 * =============================================================
 * Column names supplied by a client can never be parameterised —
 * they go straight into the SQL text. So every column name used for
 * filtering, sorting or writing is checked against the real table
 * definition first. Anything not in the table is rejected.
 * =============================================================
 */

declare(strict_types=1);

/**
 * Column name => MySQL data type for a table, cached per request.
 * @return array<string, string>
 */
function table_columns(string $table): array
{
    static $cache = [];
    if (isset($cache[$table])) {
        return $cache[$table];
    }

    $rows = db_all(
        'SELECT COLUMN_NAME, DATA_TYPE
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [$table]
    );

    $columns = [];
    foreach ($rows as $r) {
        $columns[$r['COLUMN_NAME']] = strtolower($r['DATA_TYPE']);
    }
    $cache[$table] = $columns;
    return $columns;
}

/** Reject any column name that is not really in the table. */
function assert_column(string $table, string $column): string
{
    if (!array_key_exists($column, table_columns($table))) {
        json_error("Unknown field: $column", 422);
    }
    return $column;
}

/** Keep only the keys that are real columns. */
function filter_to_columns(string $table, array $data): array
{
    $columns = table_columns($table);
    return array_intersect_key($data, $columns);
}

/**
 * Convert a row on its way out: JSON columns become objects/arrays,
 * TINYINT(1) columns become real booleans.
 */
function hydrate_row(string $table, array $row): array
{
    foreach (table_columns($table) as $column => $type) {
        if (!array_key_exists($column, $row)) {
            continue;
        }
        if ($type === 'json' && is_string($row[$column])) {
            $decoded = json_decode($row[$column], true);
            $row[$column] = json_last_error() === JSON_ERROR_NONE ? $decoded : $row[$column];
        } elseif ($type === 'tinyint' && $row[$column] !== null) {
            $row[$column] = (bool) $row[$column];
        }
    }
    unset($row['password'], $row['tokenHash'], $row['tokenKey']);
    return $row;
}

/** @param array<int, array<string, mixed>> $rows */
function hydrate_rows(string $table, array $rows): array
{
    return array_map(static fn (array $r): array => hydrate_row($table, $r), $rows);
}

/**
 * Convert an incoming value to something the column will accept
 * (arrays to JSON, booleans to 0/1, '' to NULL where required).
 */
function dehydrate_value(string $type, $value, bool $nullable = true)
{
    if ($value === null) {
        return null;
    }
    if (is_array($value) || is_object($value)) {
        return $type === 'json' ? json_encode($value) : json_encode($value);
    }
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }
    if ($value === '') {
        return in_array($type, ['int', 'bigint', 'double', 'decimal', 'datetime', 'date', 'json', 'enum'], true)
            ? null
            : '';
    }
    if (in_array($type, ['datetime', 'date'], true)) {
        $clean = preg_replace('/\.\d+/', '', str_replace('T', ' ', trim((string) $value)));
        return rtrim((string) $clean, 'Z ');
    }
    return $value;
}

/** Prepare a whole payload for writing to $table. */
function dehydrate_row(string $table, array $data): array
{
    $columns = table_columns($table);
    $out = [];
    foreach ($data as $key => $value) {
        if (!isset($columns[$key])) {
            continue;   // silently drop unknown fields, like PocketBase did
        }
        $out[$key] = dehydrate_value($columns[$key], $value);
    }
    return $out;
}
