<?php
/**
 * =============================================================
 * ADMIN UI CONFIGURATION
 * =============================================================
 * The server-rendered Bootstrap 5 admin console. It shares the
 * same MySQL database and access rules as the JSON API in /api,
 * and reuses database/connection.php for all data access.
 * =============================================================
 */

declare(strict_types=1);

$root = dirname(__DIR__);

return [
    // Where the app is mounted. Locally under XAMPP that is /LRA;
    // in production at a document root it is ''.
    'base_path'   => rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/'),

    'app_name'    => getenv('APP_NAME') ?: 'Land Registry',
    'app_env'     => getenv('APP_ENV') ?: 'local',
    'debug'       => (getenv('APP_DEBUG') === 'true') || !getenv('APP_ENV'),

    'root_dir'    => $root,
    'upload_dir'  => $root . DIRECTORY_SEPARATOR . 'uploads',
    'upload_url'  => rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/uploads',

    'max_upload_bytes' => (int) (getenv('MAX_FILE_SIZE') ?: 15 * 1024 * 1024),
    'allowed_upload_ext' => ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'csv'],

    'session_name'    => 'lra_admin',
    'session_ttl'     => (int) (getenv('SESSION_TIMEOUT_MS') ?: 1800000) / 1000,

    // Default workspace the frontend falls back to (see seed.sql).
    'default_tenant'  => 'techimannorthda',

    // Express service that still owns SMS / OTP / AI, if running.
    'api_service_url' => getenv('API_SERVICE_URL') ?: 'http://localhost:3001',

    // Arkesel SMS (used directly from PHP when the Express service is not run).
    'arkesel_api_key' => getenv('ARKESEL_API_KEY') ?: '',
    'arkesel_sender'  => getenv('ARKESEL_SMS_SENDER') ?: 'TeNDA PPD',
    'arkesel_base'    => getenv('ARKESEL_BASE_URL') ?: 'https://sms.arkesel.com/sms/api',

    // SMTP — when unset, mail is written to storage/mail/ instead of sent.
    'smtp' => [
        'host'   => getenv('SMTP_HOST') ?: '',
        'port'   => (int) (getenv('SMTP_PORT') ?: 587),
        'secure' => getenv('SMTP_SECURE') ?: 'tls',
        'user'   => getenv('SMTP_USER') ?: '',
        'pass'   => getenv('SMTP_PASSWORD') ?: '',
        'from'   => getenv('SMTP_FROM') ?: 'Land Registry <noreply@localhost>',
    ],
];
