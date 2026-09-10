<?php
/**
 * =============================================================
 * DATABASE CONNECTION
 * =============================================================
 * Single PDO connection to the MySQL database, shared across the
 * whole application. This replaces PocketBase as the data layer.
 *
 * Usage:
 *     require_once __DIR__ . '/../database/connection.php';
 *
 *     $rows  = db_all('SELECT * FROM parcels WHERE tenant = ?', [$tenantId]);
 *     $one   = db_one('SELECT * FROM users WHERE email = ?', [$email]);
 *     $id    = db_insert('parcels', ['parcelNumber' => 'TUO-2026-0001', ...]);
 *     db_update('parcels', $id, ['status' => 'registered']);
 *
 * Every helper uses prepared statements, so values are never
 * concatenated into SQL - that is what keeps this safe from SQL
 * injection. Never build a query by string concatenation.
 * =============================================================
 */

declare(strict_types=1);

/**
 * Returns the shared PDO instance, connecting on first use.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = require __DIR__ . '/config.php';

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $config['host'],
        $config['port'],
        $config['database'],
        $config['charset']
    );

    try {
        $pdo = new PDO($dsn, $config['username'], $config['password'], [
            // Throw on error instead of failing silently.
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            // Return associative arrays, not duplicated numeric keys.
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            // Use real prepared statements on the server, not emulated
            // ones - this is the part that actually stops SQL injection
            // and keeps integer/string types intact.
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_STRINGIFY_FETCHES  => false,
            PDO::MYSQL_ATTR_INIT_COMMAND =>
                "SET NAMES {$config['charset']} COLLATE {$config['collation']}, "
                . "sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'",
        ]);
    } catch (PDOException $e) {
        // Never leak credentials or SQL to the browser.
        error_log('[DB] Connection failed: ' . $e->getMessage());
        if (!empty($config['debug'])) {
            throw $e;
        }
        http_response_code(503);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'The database is unavailable. Please try again shortly.']);
        exit;
    }

    return $pdo;
}

/**
 * Run a query and return the PDOStatement.
 * @param array<int|string, mixed> $params
 */
function db_query(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

/**
 * All matching rows.
 * @return array<int, array<string, mixed>>
 */
function db_all(string $sql, array $params = []): array
{
    return db_query($sql, $params)->fetchAll();
}

/**
 * First matching row, or null.
 * @return array<string, mixed>|null
 */
function db_one(string $sql, array $params = []): ?array
{
    $row = db_query($sql, $params)->fetch();
    return $row === false ? null : $row;
}

/**
 * Single scalar value from the first column, or null.
 */
function db_value(string $sql, array $params = [])
{
    $row = db_query($sql, $params)->fetch(PDO::FETCH_NUM);
    return $row === false ? null : $row[0];
}

/**
 * Generate a 15-character record id in the same format PocketBase
 * used, so ids stay consistent across the migration and any data
 * exported from the old system still lines up.
 */
function db_id(): string
{
    $alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
    $id = '';
    for ($i = 0; $i < 15; $i++) {
        $id .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $id;
}

/**
 * Insert a row and return its id.
 * @param array<string, mixed> $data
 */
function db_insert(string $table, array $data): string
{
    if (!isset($data['id'])) {
        $data['id'] = db_id();
    }
    $columns      = array_keys($data);
    $placeholders = array_fill(0, count($columns), '?');

    $sql = sprintf(
        'INSERT INTO `%s` (%s) VALUES (%s)',
        $table,
        '`' . implode('`, `', $columns) . '`',
        implode(', ', $placeholders)
    );

    db_query($sql, array_values($data));
    return (string) $data['id'];
}

/**
 * Update a row by id. Returns the number of affected rows.
 * @param array<string, mixed> $data
 */
function db_update(string $table, string $id, array $data): int
{
    if ($data === []) {
        return 0;
    }
    $sets = implode(', ', array_map(
        static fn (string $c): string => "`$c` = ?",
        array_keys($data)
    ));

    $sql = sprintf('UPDATE `%s` SET %s WHERE `id` = ?', $table, $sets);
    return db_query($sql, [...array_values($data), $id])->rowCount();
}

/**
 * Delete a row by id. Returns the number of affected rows.
 */
function db_delete(string $table, string $id): int
{
    return db_query(sprintf('DELETE FROM `%s` WHERE `id` = ?', $table), [$id])->rowCount();
}

/**
 * Run a set of statements inside a transaction. Rolls back and
 * rethrows if the callback throws, so a half-finished write can
 * never be committed.
 *
 * @template T
 * @param callable(PDO): T $callback
 * @return T
 */
function db_transaction(callable $callback)
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $result = $callback($pdo);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/**
 * Quick connectivity probe for a health-check endpoint.
 *
 * Deliberately opens its own short-lived connection rather than
 * going through db(): db() fails the whole request with a 503 when
 * the database is down, which is right for a normal page but would
 * stop a health check from ever reporting *why* it is down.
 *
 * @return array{connected: bool, error?: string, database?: string, version?: string}
 */
function db_health(): array
{
    $config = require __DIR__ . '/config.php';
    try {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $config['host'],
            $config['port'],
            $config['database'],
            $config['charset']
        );
        $probe = new PDO($dsn, $config['username'], $config['password'], [
            PDO::ATTR_ERRMODE    => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT    => 3,
        ]);
        $row = $probe->query('SELECT DATABASE() AS db, VERSION() AS version')->fetch(PDO::FETCH_ASSOC);

        return [
            'connected' => true,
            'database'  => (string) ($row['db'] ?? ''),
            'version'   => (string) ($row['version'] ?? ''),
        ];
    } catch (Throwable $e) {
        // Safe to surface: it says the database is unreachable, not how to reach it.
        return ['connected' => false, 'error' => $e->getMessage()];
    }
}
