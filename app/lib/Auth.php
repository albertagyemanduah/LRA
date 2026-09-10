<?php

declare(strict_types=1);

namespace App;

/**
 * Session-based authentication for the admin console.
 *
 * The JSON API in /api uses bearer tokens; this UI uses a normal
 * PHP session. Both verify the same bcrypt hash in `users.password`
 * and enforce the same suspension / workspace-billing rules.
 */
final class Auth
{
    private const MAX_ATTEMPTS = 10;
    private const WINDOW = 900; // 15 min

    private ?array $cachedUser = null;
    private bool $resolved = false;

    /** The signed-in user row, or null. */
    public function user(): ?array
    {
        if ($this->resolved) {
            return $this->cachedUser;
        }
        $this->resolved = true;

        $uid = $_SESSION['uid'] ?? null;
        if (!$uid) {
            return null;
        }
        $user = db_one('SELECT * FROM `users` WHERE `id` = ?', [$uid]);
        if (!$user || !empty($user['suspended'])) {
            $this->logout();
            return null;
        }
        $user['roles'] = self::rolesOf($user);
        $this->cachedUser = $user;
        return $user;
    }

    /** The signed-in user's workspace row, or null. */
    public function tenant(): ?array
    {
        $user = $this->user();
        if (!$user || empty($user['tenant'])) {
            return null;
        }
        return db_one('SELECT * FROM `tenants` WHERE `id` = ?', [$user['tenant']]);
    }

    public function check(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Verify credentials and open a session.
     * @return array{ok:bool, error?:string}
     */
    public function attempt(string $email, string $password): array
    {
        $ip = self::clientIp();

        $recentFailures = (int) db_value(
            "SELECT COUNT(*) FROM `audit_logs`
              WHERE `action` = 'login_failed' AND `ip` = ?
                AND `created` > DATE_SUB(NOW(), INTERVAL ? SECOND)",
            [$ip, self::WINDOW]
        );
        if ($recentFailures >= self::MAX_ATTEMPTS) {
            return ['ok' => false, 'error' => 'Too many failed attempts. Try again in a few minutes.'];
        }

        $user = db_one('SELECT * FROM `users` WHERE `email` = ?', [$email]);
        $hash = $user['password'] ?? '$2y$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';

        if (!$user || !password_verify($password, $hash)) {
            self::recordFailure($email, $ip);
            return ['ok' => false, 'error' => 'Incorrect email or password.'];
        }
        if (!empty($user['suspended'])) {
            return ['ok' => false, 'error' => 'This account is suspended: '
                . ($user['suspendedReason'] ?: 'contact your administrator.')];
        }

        // Workspace subscription gate (super_admin is exempt).
        if ($user['role'] !== 'super_admin' && !empty($user['tenant'])) {
            $t = db_one('SELECT `name`,`status`,`billingStatus` FROM `tenants` WHERE `id` = ?', [$user['tenant']]);
            if ($t) {
                $blocked = in_array($t['billingStatus'], ['suspended', 'cancelled'], true)
                    || (empty($t['billingStatus']) && $t['status'] === 'inactive');
                if ($blocked) {
                    return ['ok' => false, 'error' => ($t['name'] ?: 'Your workspace')
                        . "'s subscription is not active. Contact the platform administrator."];
                }
            }
        }

        session_regenerate_id(true);
        $_SESSION['uid'] = $user['id'];
        $_SESSION['last_seen'] = time();

        db_update('users', $user['id'], ['updated' => date('Y-m-d H:i:s')]);
        Audit::log('login', 'users', $user['email'], $user['tenant'] ?? null, $user['id']);

        return ['ok' => true];
    }

    public function logout(): void
    {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid) {
            Audit::log('logout', 'users', '', null, $uid);
        }
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        $this->cachedUser = null;
        $this->resolved = true;
    }

    // ---- Role helpers ------------------------------------------------

    /** @return string[] */
    public static function rolesOf(?array $user): array
    {
        if (!$user) {
            return [];
        }
        $roles = $user['roles'] ?? null;
        if (is_string($roles)) {
            $decoded = json_decode($roles, true);
            $roles = is_array($decoded) ? $decoded : null;
        }
        if (!is_array($roles) || $roles === []) {
            $roles = !empty($user['role']) ? [$user['role']] : [];
        }
        return array_values(array_filter($roles, 'is_string'));
    }

    public function is(string ...$roles): bool
    {
        return array_intersect($roles, self::rolesOf($this->user())) !== [];
    }

    public function isSuperAdmin(): bool
    {
        return $this->is('super_admin');
    }

    public function isAdmin(): bool
    {
        return $this->is('admin', 'super_admin');
    }

    public function id(): ?string
    {
        return $this->user()['id'] ?? null;
    }

    public function tenantId(): ?string
    {
        return $this->user()['tenant'] ?? null;
    }

    // ---- internals -------------------------------------------------

    private static function recordFailure(string $email, string $ip): void
    {
        try {
            db_insert('audit_logs', [
                'action'  => 'login_failed',
                'entity'  => 'users',
                'details' => 'Failed sign-in for ' . substr($email, 0, 120),
                'ip'      => $ip,
            ]);
        } catch (\Throwable $e) {
            error_log('[auth] ' . $e->getMessage());
        }
    }

    public static function clientIp(): string
    {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $k) {
            if (!empty($_SERVER[$k])) {
                $ip = trim(explode(',', (string) $_SERVER[$k])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        return '';
    }
}
