<?php
/**
 * =============================================================
 * DATABASE CREDENTIALS
 * =============================================================
 * This is the ONLY file you edit when moving between machines
 * (XAMPP locally -> cPanel in production). Everything else reads
 * its connection from here via database/connection.php.
 *
 * cPanel note: cPanel prefixes both the database name and the
 * user name with your account name, e.g. if your cPanel user is
 * "tendagov" and you create a database called "landreg" with user
 * "landuser", the real values are:
 *     'database' => 'tendagov_landreg'
 *     'username' => 'tendagov_landuser'
 * Host stays 'localhost' - cPanel MySQL runs on the same server.
 *
 * SECURITY: never commit real credentials. Add this line to
 * .gitignore:   database/config.php
 * and keep database/config.example.php in version control instead.
 * =============================================================
 */

return [
    // ---- Local development (XAMPP) ----
    // XAMPP's default MySQL user is "root" with an empty password.
    'host'     => getenv('DB_HOST') ?: 'localhost',
    'port'     => (int) (getenv('DB_PORT') ?: 3306),
    'database' => getenv('DB_DATABASE') ?: 'lra',
    'username' => getenv('DB_USERNAME') ?: 'root',
    'password' => getenv('DB_PASSWORD') ?: '',

    'charset'   => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',

    // Set to false in production so raw SQL errors are never shown
    // to a visitor (they are still written to the PHP error log).
    'debug' => (getenv('APP_DEBUG') === 'true'),
];
