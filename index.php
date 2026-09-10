<?php
/**
 * =============================================================
 * FRONT CONTROLLER — Land Registry admin console
 * =============================================================
 * Apache sends every request that is not a real file and not
 * under /api or /uploads here (see .htaccess). This boots the
 * app and hands off to the router in app/routes.php.
 * =============================================================
 */

declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';

use App\Csrf;
use App\Flash;

// CSRF on every unsafe request, before any handler runs.
Csrf::check();

/** @var App\Router $router */
$router = require __DIR__ . '/app/routes.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path   = current_path();

try {
    $router->dispatch($method, $path);
} catch (Throwable $e) {
    error_log('[app] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    if ($GLOBALS['config']['debug']) {
        echo '<pre style="padding:1rem;font:13px/1.5 monospace">'
            . e($e->getMessage()) . "\n\n" . e($e->getTraceAsString()) . '</pre>';
    } else {
        render('errors/generic', [
            'title' => 'Something went wrong',
            'code' => 500,
            'message' => 'An unexpected error occurred. It has been logged and we will look into it.',
        ]);
    }
}
