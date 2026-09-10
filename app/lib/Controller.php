<?php

declare(strict_types=1);

namespace App;

/** Shared behaviour for all admin-console controllers. */
abstract class Controller
{
    protected Auth $auth;
    protected Repo $repo;
    protected ?array $user;

    public function __construct()
    {
        $this->auth = $GLOBALS['auth'];
        $this->repo = new Repo($this->auth);
        $this->user = $GLOBALS['user'];
    }

    /** Require a signed-in user; bounce to login otherwise. */
    protected function requireLogin(): void
    {
        if (!$this->auth->check()) {
            $_SESSION['_intended'] = current_path();
            Flash::info('Please sign in to continue.');
            redirect('login');
        }
    }

    /** Require one of the given roles; 403 otherwise. */
    protected function requireRole(string ...$roles): void
    {
        $this->requireLogin();
        if (!$this->auth->is(...$roles)) {
            http_response_code(403);
            render('errors/generic', [
                'title' => 'Access denied',
                'code' => 403,
                'message' => 'You do not have permission to view this page. '
                    . 'It is limited to: ' . implode(', ', array_map('humanize', $roles)) . '.',
            ]);
        }
    }

    /** Verify the CSRF token on an unsafe request. */
    protected function guardCsrf(): void
    {
        Csrf::check();
    }

    /** Render a page inside the layout. */
    protected function render(string $view, array $data = [], array $layout = []): never
    {
        render($view, $data, $layout);
    }

    /** Read a paginated list with the common query-string params. */
    protected function listing(string $table, array $opts = []): array
    {
        return $this->repo->paginate($table, array_merge([
            'page'    => max(1, (int) ($_GET['page'] ?? 1)),
            'perPage' => 25,
            'search'  => trim((string) ($_GET['q'] ?? '')) ?: null,
            'sort'    => $_GET['sort'] ?? null,
        ], $opts));
    }

    protected function redirectBackWithErrors(array $errors, string $back): never
    {
        remember_old();
        $_SESSION['_errors'] = $errors;
        Flash::error(reset($errors) ?: 'Please correct the errors and try again.');
        redirect($back);
    }

    protected function wantsJson(): bool
    {
        return str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json')
            || ($_GET['format'] ?? '') === 'json';
    }

    protected function json(array $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data, JSON_UNESCAPED_SLASHES);
        exit;
    }
}
