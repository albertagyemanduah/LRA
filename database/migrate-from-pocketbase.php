<?php
/**
 * =============================================================
 * MIGRATE DATA: PocketBase (SQLite) -> MySQL
 * =============================================================
 * Copies every record out of the old PocketBase database into the
 * MySQL tables created by schema.sql. Record ids are preserved, so
 * all relations survive the move.
 *
 * Run AFTER importing schema.sql:
 *
 *     php database/migrate-from-pocketbase.php
 *     php database/migrate-from-pocketbase.php --dry-run
 *     php database/migrate-from-pocketbase.php --db=/path/to/data.db
 *
 * Idempotent: re-running updates existing rows rather than
 * duplicating them, so it is safe to run again after a failure or
 * to pick up records added since the last run.
 *
 * Requires the pdo_sqlite extension (enabled by default in XAMPP).
 * =============================================================
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("This script may only be run from the command line.\n");
}

require_once __DIR__ . '/connection.php';

// ---- Options ------------------------------------------------------
$options = getopt('', ['db::', 'dry-run', 'batch::']);
$dryRun  = isset($options['dry-run']);
$sqlitePath = $options['db'] ?? __DIR__ . '/../apps/pocketbase/pb_data/data.db';

if (!is_file($sqlitePath)) {
    fwrite(STDERR, "PocketBase database not found: $sqlitePath\n");
    fwrite(STDERR, "Pass its location with --db=/path/to/data.db\n");
    exit(1);
}

// PocketBase runs SQLite in WAL mode. If the app is still running,
// recent writes may sit in data.db-wal and not yet be in data.db.
if (is_file($sqlitePath . '-wal') && filesize($sqlitePath . '-wal') > 0) {
    fwrite(STDOUT, "! data.db-wal is not empty — stop PocketBase first so all\n");
    fwrite(STDOUT, "  writes are checkpointed into data.db, or records may be missed.\n\n");
}

// Parent tables first so foreign keys always resolve.
const TABLE_ORDER = [
    'tenants', 'users', 'tenant_branding',
    'offices_struct', 'area_councils', 'communities', 'sectors',
    'parcels', 'applications', 'documents', 'surveys',
    'land_transfers', 'payments', 'land_edit_requests',
    'notifications', 'notification_preferences', 'audit_logs', 'chat_messages',
    'tickets', 'ticket_comments',
    'news_categories', 'news_posts',
    'menu_customizations', 'sms_logs',
    'verification_codes', 'verification_logs', 'otp_sessions',
    'integrated_ai_messages', 'integrated_ai_images',
];

// PocketBase named these two with a leading underscore.
const SOURCE_TABLE = [
    'integrated_ai_messages' => '_integratedAiMessages',
    'integrated_ai_images'   => '_integratedAiImages',
];

$sqlite = new PDO('sqlite:' . $sqlitePath, null, null, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$mysql  = db();
$dbName = db_value('SELECT DATABASE()');

fwrite(STDOUT, "Source : $sqlitePath\n");
fwrite(STDOUT, "Target : $dbName\n");
fwrite(STDOUT, $dryRun ? "Mode   : DRY RUN (nothing will be written)\n\n" : "Mode   : LIVE\n\n");

/** Column metadata for a MySQL table: name => [type, nullable, isFk]. */
function columnMeta(string $table, string $dbName): array
{
    $cols = db_all(
        'SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
        [$dbName, $table]
    );
    if ($cols === []) {
        return [];
    }

    // Foreign-key columns must never receive '' — PocketBase stores an
    // empty relation as '', which MySQL would reject (no such parent row).
    $fks = db_all(
        'SELECT COLUMN_NAME
           FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            AND REFERENCED_TABLE_NAME IS NOT NULL',
        [$dbName, $table]
    );
    $fkCols = array_column($fks, 'COLUMN_NAME');

    // Unique columns: '' would collide across rows, so blanks become NULL.
    $uniques = db_all(
        'SELECT DISTINCT COLUMN_NAME
           FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND NON_UNIQUE = 0',
        [$dbName, $table]
    );
    $uniqueCols = array_column($uniques, 'COLUMN_NAME');

    $meta = [];
    foreach ($cols as $c) {
        $meta[$c['COLUMN_NAME']] = [
            'type'     => strtolower($c['DATA_TYPE']),
            'nullable' => $c['IS_NULLABLE'] === 'YES',
            'blankNull' => in_array($c['COLUMN_NAME'], $fkCols, true)
                        || in_array($c['COLUMN_NAME'], $uniqueCols, true),
        ];
    }
    return $meta;
}

/** Convert one PocketBase value to something MySQL will accept. */
function convert($value, array $meta)
{
    if ($value === null) {
        return null;
    }

    $type = $meta['type'];

    // PocketBase writes '' for "no value" in almost every field type.
    // MySQL in STRICT mode rejects '' for numeric/date/enum/json columns,
    // so each of those needs its own empty-value fallback.
    if ($value === '') {
        switch ($type) {
            case 'tinyint':
                // Booleans are NOT NULL DEFAULT 0 in the schema.
                return 0;
            case 'int':
            case 'bigint':
            case 'double':
            case 'decimal':
                return $meta['nullable'] ? null : 0;
            case 'datetime':
            case 'date':
                // created/updated are NOT NULL; an explicit NULL would be
                // rejected even though the column has a default.
                return $meta['nullable'] ? null : date('Y-m-d H:i:s');
            case 'json':
            case 'enum':
                return null;
            default:
                return $meta['blankNull'] ? null : '';
        }
    }

    switch ($type) {
        case 'datetime':
        case 'date':
            // PocketBase: "2026-09-10 12:34:56.789Z" -> MySQL: "2026-09-10 12:34:56"
            $clean = str_replace('T', ' ', trim((string) $value));
            $clean = preg_replace('/\.\d+/', '', $clean);
            $clean = rtrim($clean, 'Z ');
            return $clean === '' ? null : $clean;

        case 'tinyint':
            if (is_bool($value)) return $value ? 1 : 0;
            return in_array(strtolower((string) $value), ['1', 'true', 'yes'], true) ? 1 : 0;

        case 'int':
        case 'bigint':
            return (int) $value;

        case 'double':
        case 'decimal':
            return is_numeric($value) ? $value + 0 : null;

        case 'json':
            // Already serialised JSON in PocketBase; pass through if valid.
            if (is_array($value)) return json_encode($value);
            json_decode((string) $value);
            return json_last_error() === JSON_ERROR_NONE ? (string) $value : json_encode($value);

        default:
            return is_scalar($value) ? (string) $value : json_encode($value);
    }
}

// ---- Migrate ------------------------------------------------------
$batchSize = (int) ($options['batch'] ?? 200);
$report    = [];
$grandTotal = 0;

if (!$dryRun) {
    $mysql->exec('SET FOREIGN_KEY_CHECKS = 0');
}

foreach (TABLE_ORDER as $table) {
    $source = SOURCE_TABLE[$table] ?? $table;

    // Does the source table exist in PocketBase?
    $exists = $sqlite->query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=" . $sqlite->quote($source)
    )->fetch();
    if (!$exists) {
        $report[] = [$table, '-', 'skipped (not in PocketBase)'];
        continue;
    }

    $meta = columnMeta($table, $dbName);
    if ($meta === []) {
        $report[] = [$table, '-', 'skipped (not in MySQL — run schema.sql first)'];
        continue;
    }

    // Only copy columns that exist on BOTH sides.
    $sourceCols = array_column(
        $sqlite->query("PRAGMA table_info(`$source`)")->fetchAll(),
        'name'
    );
    $shared = array_values(array_intersect(array_keys($meta), $sourceCols));
    if (!in_array('id', $shared, true)) {
        $report[] = [$table, '-', 'skipped (no id column)'];
        continue;
    }

    $rows = $sqlite->query("SELECT * FROM `$source`")->fetchAll();
    if ($rows === []) {
        $report[] = [$table, 0, 'empty'];
        continue;
    }

    $quoted   = '`' . implode('`, `', $shared) . '`';
    $holders  = implode(', ', array_fill(0, count($shared), '?'));
    $updates  = implode(', ', array_map(
        static fn (string $c): string => "`$c` = VALUES(`$c`)",
        array_filter($shared, static fn (string $c): bool => $c !== 'id')
    ));
    $sql = "INSERT INTO `$table` ($quoted) VALUES ($holders)"
         . ($updates !== '' ? " ON DUPLICATE KEY UPDATE $updates" : '');

    $done = 0;
    $failed = 0;
    $firstError = null;

    if ($dryRun) {
        $report[] = [$table, count($rows), 'would migrate'];
        $grandTotal += count($rows);
        continue;
    }

    $stmt = $mysql->prepare($sql);
    foreach (array_chunk($rows, $batchSize) as $chunk) {
        $mysql->beginTransaction();
        foreach ($chunk as $row) {
            $values = [];
            foreach ($shared as $c) {
                $values[] = convert($row[$c] ?? null, $meta[$c]);
            }
            try {
                $stmt->execute($values);
                $done++;
            } catch (PDOException $e) {
                $failed++;
                $firstError ??= $e->getMessage();
            }
        }
        $mysql->commit();
    }

    $grandTotal += $done;
    $note = $failed > 0 ? "$failed failed — " . substr((string) $firstError, 0, 90) : 'ok';
    $report[] = [$table, $done, $note];
    fwrite(STDOUT, sprintf("  %-26s %6d rows  %s\n", $table, $done, $note));
}

if (!$dryRun) {
    $mysql->exec('SET FOREIGN_KEY_CHECKS = 1');
}

// ---- Summary ------------------------------------------------------
fwrite(STDOUT, "\n" . str_repeat('-', 62) . "\n");
foreach ($report as [$table, $count, $note]) {
    if ($note !== 'ok' && $note !== 'empty') {
        fwrite(STDOUT, sprintf("  %-26s %6s  %s\n", $table, $count, $note));
    }
}
fwrite(STDOUT, str_repeat('-', 62) . "\n");
fwrite(STDOUT, ($dryRun ? "Would migrate " : "Migrated ") . number_format($grandTotal) . " records.\n");

if (!$dryRun) {
    fwrite(STDOUT, "\nNext: copy the uploaded files across too —\n");
    fwrite(STDOUT, "  apps/pocketbase/pb_data/storage/  ->  public/uploads/\n");
    fwrite(STDOUT, "(see docs/SQL_DATABASE.md, 'Uploaded files')\n");
}
