<?php
/**
 * =============================================================
 * HTTP helpers — request parsing and JSON responses
 * =============================================================
 */

declare(strict_types=1);

/** Send a JSON response and stop. */
function json_response($data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Send an error response and stop. */
function json_error(string $message, int $status = 400, array $extra = []): never
{
    json_response(['error' => $message] + $extra, $status);
}

/**
 * Decoded JSON request body (or form fields for multipart uploads).
 * @return array<string, mixed>
 */
function request_body(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (str_contains($contentType, 'multipart/form-data')) {
        $body = $_POST;
        return $body;
    }

    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        $body = [];
        return $body;
    }

    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        json_error('Request body is not valid JSON.', 400);
    }
    $body = is_array($decoded) ? $decoded : [];
    return $body;
}

/** A single query-string parameter. */
function query_param(string $name, ?string $default = null): ?string
{
    $value = $_GET[$name] ?? null;
    return is_string($value) && $value !== '' ? $value : $default;
}

/** The HTTP verb, honouring the X-HTTP-Method-Override header. */
function request_method(): string
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if ($method === 'POST' && isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
        $method = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
    }
    return $method;
}

/** The bearer token from the Authorization header, if any. */
function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']   // Apache CGI/FastCGI
        ?? '';

    if ($header === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }

    if (preg_match('/^Bearer\s+(.+)$/i', trim((string) $header), $m)) {
        return trim($m[1]);
    }
    return null;
}

/** The caller's IP, accounting for a reverse proxy. */
function client_ip(): string
{
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            // X-Forwarded-For may be a list; the client is the first entry.
            $ip = trim(explode(',', (string) $_SERVER[$key])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return '';
}

/**
 * Emit CORS headers. The SPA is served from the same origin in the
 * cPanel layout, so this only matters for local development where
 * Vite runs on :3000 and Apache on :80.
 */
function send_cors_headers(): void
{
    $allowed = array_filter(array_map('trim', explode(',', (string) getenv('CORS_ORIGINS'))));
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($origin !== '' && ($allowed === [] || in_array($origin, $allowed, true))) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Headers: Authorization, Content-Type, X-HTTP-Method-Override');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');

    if (request_method() === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
