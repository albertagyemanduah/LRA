<?php
/**
 * View + request helpers. Kept as plain functions so templates
 * stay terse.
 */

declare(strict_types=1);

/** HTML-escape. */
function e($value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Absolute URL within the app, honouring the mount path. */
function url(string $path = ''): string
{
    $base = $GLOBALS['config']['base_path'] ?? '';
    return ($base === '' ? '' : $base) . '/' . ltrim($path, '/');
}

/** URL for a bundled asset under app/assets. */
function asset(string $path): string
{
    return url('app/assets/' . ltrim($path, '/'));
}

/** URL for an uploaded file:  uploads/<collection>/<id>/<name>. */
function upload_url(string $collection, string $recordId, ?string $filename): string
{
    if (!$filename) {
        return '';
    }
    return ($GLOBALS['config']['upload_url'] ?? '/uploads')
        . '/' . rawurlencode($collection)
        . '/' . rawurlencode($recordId)
        . '/' . rawurlencode($filename);
}

/** Send a redirect and stop. */
function redirect(string $path): never
{
    header('Location: ' . (str_starts_with($path, 'http') ? $path : url($path)));
    exit;
}

/** Current request path, relative to the mount point, no query string. */
function current_path(): string
{
    $uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $base = $GLOBALS['config']['base_path'] ?? '';
    if ($base !== '' && str_starts_with($uri, $base)) {
        $uri = substr($uri, strlen($base));
    }
    return '/' . trim($uri, '/');
}

/** A query-string / body value with a fallback. */
function input(string $key, $default = null)
{
    return $_POST[$key] ?? $_GET[$key] ?? $default;
}

/** Remembered old input after a failed form submit. */
function old(string $key, $default = ''): string
{
    return e($_SESSION['_old'][$key] ?? $default);
}

/** Stash the current POST body so a redirect-back can repopulate the form. */
function remember_old(): void
{
    $_SESSION['_old'] = array_diff_key($_POST, ['password' => 1, 'password_confirm' => 1, '_csrf' => 1]);
}

function clear_old(): void
{
    unset($_SESSION['_old']);
}

/** Hidden CSRF input for forms. */
function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(App\Csrf::token()) . '">';
}

/** `active` when the current path starts with $prefix — for nav links. */
function nav_active(string $prefix): string
{
    return str_starts_with(current_path(), $prefix) ? 'active' : '';
}

/** Queue extra <script> markup to be emitted at the end of the layout. */
function push_script(string $html): void
{
    $GLOBALS['_scripts'] = ($GLOBALS['_scripts'] ?? '') . $html;
}

function page_scripts(): string
{
    return $GLOBALS['_scripts'] ?? '';
}

/** Render a view file from app/views with $data extracted into scope. */
function view(string $name, array $data = []): string
{
    $file = dirname(__FILE__) . '/views/' . $name . '.php';
    if (!is_file($file)) {
        throw new RuntimeException("View not found: $name");
    }
    extract($data, EXTR_SKIP);
    ob_start();
    require $file;
    return (string) ob_get_clean();
}

/** Render a page inside the main layout and send it. */
function render(string $name, array $data = [], array $layoutData = []): never
{
    $content = view($name, $data);
    echo view('layout', array_merge([
        'content'    => $content,
        'title'      => $data['title'] ?? ($layoutData['title'] ?? null),
        'pageTitle'  => $data['pageTitle'] ?? ($layoutData['pageTitle'] ?? null),
        'breadcrumb' => $layoutData['breadcrumb'] ?? [],
    ], $layoutData));
    exit;
}

/** Format a datetime for display. */
function fmt_date($value, string $format = 'd M Y'): string
{
    if (!$value) {
        return '—';
    }
    try {
        return (new DateTime((string) $value))->format($format);
    } catch (Throwable) {
        return (string) $value;
    }
}

function fmt_datetime($value): string
{
    return fmt_date($value, 'd M Y, H:i');
}

/** Money in Ghana cedis. */
function fmt_money($value): string
{
    return 'GHS ' . number_format((float) $value, 2);
}

/** "3 days ago" style relative time. */
function time_ago($value): string
{
    if (!$value) {
        return '—';
    }
    try {
        $then = new DateTime((string) $value);
    } catch (Throwable) {
        return (string) $value;
    }
    $diff = (new DateTime())->getTimestamp() - $then->getTimestamp();
    if ($diff < 60)     return 'just now';
    if ($diff < 3600)   return floor($diff / 60) . 'm ago';
    if ($diff < 86400)  return floor($diff / 3600) . 'h ago';
    if ($diff < 604800) return floor($diff / 86400) . 'd ago';
    return $then->format('d M Y');
}

/** Humanise a snake_case / camelCase token for labels. */
function humanize(?string $value): string
{
    $value = (string) $value;
    $value = preg_replace('/(?<!^)([A-Z])/', ' $1', $value) ?? $value;
    $value = str_replace(['_', '-'], ' ', $value);
    return ucwords(trim($value));
}

/** Bootstrap contextual class for a status token. */
function status_class(?string $status): string
{
    return match (strtolower((string) $status)) {
        'registered', 'approved', 'paid', 'verified', 'completed', 'active', 'published', 'resolved', 'success', 'sent'
            => 'success',
        'pending', 'submitted', 'under_review', 'under_survey', 'planning_review', 'survey', 'registrar_review',
        'in_progress', 'scheduled', 'pending_scan', 'open', 'trial', 'draft'
            => 'warning',
        'rejected', 'failed', 'disputed', 'cancelled', 'suspended', 'closed', 'inactive', 'past_due', 'failure'
            => 'danger',
        default => 'secondary',
    };
}

/** Small helper to build a status badge. */
function status_badge(?string $status): string
{
    return '<span class="badge text-bg-' . status_class($status) . '">' . e(humanize($status)) . '</span>';
}

/** Truncate for table cells. */
function str_excerpt(?string $value, int $length = 80): string
{
    $value = trim((string) $value);
    if (mb_strlen($value) <= $length) {
        return $value;
    }
    return mb_substr($value, 0, $length - 1) . '…';
}

/** Page through a result set — returns [rows, meta]. */
function paginate(string $sql, array $params, int $page, int $perPage): array
{
    $page    = max(1, $page);
    $perPage = max(1, min($perPage, 200));
    $countSql = 'SELECT COUNT(*) FROM (' . $sql . ') _c';
    $total = (int) db_value($countSql, $params);
    $pages = max(1, (int) ceil($total / $perPage));
    $offset = ($page - 1) * $perPage;
    $rows = db_all($sql . " LIMIT $perPage OFFSET $offset", $params);
    return [$rows, [
        'total' => $total, 'pages' => $pages, 'page' => $page,
        'perPage' => $perPage, 'from' => $total ? $offset + 1 : 0,
        'to' => min($offset + $perPage, $total),
    ]];
}
