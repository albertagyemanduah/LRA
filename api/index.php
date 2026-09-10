<?php
/**
 * =============================================================
 * API FRONT CONTROLLER
 * =============================================================
 * Every /api/* request enters here (see api/.htaccess) and is
 * dispatched to a route file. This replaces both PocketBase's REST
 * API and the Express server.
 *
 * Routes:
 *   /api/health                          service + database status
 *   /api/auth/login|logout|me|password   authentication
 *   /api/records/{collection}[/{id}]     generic record CRUD
 *
 * Layout on the server:
 *   public_html/
 *     index.html          <- the built SPA
 *     api/                <- this folder
 *     database/           <- connection.php + config.php (deny-listed)
 *     uploads/            <- files that used to live in pb_data/storage
 * =============================================================
 */

declare(strict_types=1);

// Errors are logged, never printed — a stack trace in a JSON body
// would leak paths and credentials to the browser.
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../database/connection.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/guard.php';
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/records.php';

send_cors_headers();

// Anything uncaught becomes a clean 500 rather than a blank page.
set_exception_handler(static function (Throwable $e): void {
    error_log('[api] uncaught: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    json_error('An unexpected error occurred.', 500);
});

// ---- Work out the path, with or without mod_rewrite ------------
$path = (string) (
    $_GET['_route']
    ?? parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH)
    ?? '/'
);

// Strip the script's own directory, so the API works whether it is
// mounted at /api, at the document root, or in a subfolder.
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($base !== '' && str_starts_with($path, $base)) {
    $path = substr($path, strlen($base));
}
$path = trim($path, '/');

// "api/records/parcels" and "records/parcels" both resolve.
$segments = array_values(array_filter(explode('/', $path), static fn ($s) => $s !== ''));
if (($segments[0] ?? '') === 'api') {
    array_shift($segments);
}
// A direct hit on /api/index.php (no rewrite) leaves "index.php" as the
// first segment — treat it as the root so the health check still answers.
if (($segments[0] ?? '') === 'index.php') {
    array_shift($segments);
}

$resource = $segments[0] ?? '';

// ---- Dispatch ---------------------------------------------------
switch ($resource) {
    case '':
    case 'health':
        json_response([
            'status'   => 'ok',
            'service'  => 'land-registry-api',
            'database' => db_health(),
            'time'     => date('c'),
        ]);

    case 'auth':
        auth_route($segments[1] ?? null);
        break;

    case 'records':
        $collection = $segments[1] ?? '';
        if ($collection === '') {
            json_error('A collection name is required.', 400);
        }
        // Only names that appear in rules.php are routable, so a
        // caller cannot reach an arbitrary table.
        records_route($collection, $segments[2] ?? null);
        break;

    default:
        json_error('Endpoint not found.', 404);
}
