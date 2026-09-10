<?php
/**
 * =============================================================
 * ADMIN UI BOOTSTRAP
 * =============================================================
 * Loaded first by the front controller (index.php). Sets up
 * config, the database, sessions, the class autoloader and the
 * view helpers, then resolves the signed-in user.
 * =============================================================
 */

declare(strict_types=1);

define('APP_START', microtime(true));

$GLOBALS['config'] = require __DIR__ . '/config.php';

error_reporting(E_ALL);
ini_set('display_errors', $GLOBALS['config']['debug'] ? '1' : '0');
ini_set('log_errors', '1');

// ---- Data layer (shared with /api) --------------------------------
require_once dirname(__DIR__) . '/database/connection.php';

// ---- Class autoloader --------------------------------------------
//   App\Controllers\FooController  ->  app/controllers/FooController.php
//   App\Foo                        ->  app/lib/Foo.php
spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'App\\')) {
        return;
    }
    $relative = str_replace('\\', '/', substr($class, 4));
    $candidates = [__DIR__ . '/lib/' . $relative . '.php'];
    if (str_starts_with($relative, 'Controllers/')) {
        $candidates[] = __DIR__ . '/controllers/' . substr($relative, strlen('Controllers/')) . '.php';
    }
    foreach ($candidates as $file) {
        if (is_file($file)) {
            require $file;
            return;
        }
    }
});

// ---- View helpers -------------------------------------------------
require __DIR__ . '/helpers.php';

// ---- Sessions ----------------------------------------------------
session_name($GLOBALS['config']['session_name']);
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => ($GLOBALS['config']['base_path'] ?: '/'),
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

// Idle-timeout.
$ttl = $GLOBALS['config']['session_ttl'] ?: 1800;
if (!empty($_SESSION['uid']) && !empty($_SESSION['last_seen']) && (time() - $_SESSION['last_seen']) > $ttl) {
    $_SESSION = [];
    session_destroy();
    session_start();
    App\Flash::add('info', 'Your session timed out. Please sign in again.');
}
$_SESSION['last_seen'] = time();

// ---- Resolve the current user + workspace -----------------------
$GLOBALS['auth']     = new App\Auth();
$GLOBALS['user']     = $GLOBALS['auth']->user();
$GLOBALS['tenant']   = $GLOBALS['auth']->tenant();
$GLOBALS['branding'] = App\Branding::resolve($GLOBALS['tenant']['id'] ?? $GLOBALS['config']['default_tenant']);
