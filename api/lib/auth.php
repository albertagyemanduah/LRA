<?php
/**
 * =============================================================
 * AUTHENTICATION
 * =============================================================
 * Replaces PocketBase's built-in auth. Sessions are opaque random
 * tokens; only a SHA-256 hash of each token is stored, so a dump of
 * `user_sessions` cannot be replayed as a valid login.
 *
 * This file also carries over the two PocketBase hooks that used to
 * gate sign-in, since there is no hook layer any more:
 *   - pb_hooks/enforce-suspension.pb.js        (suspended staff)
 *   - pb_hooks/enforce-tenant-suspension.pb.js (unpaid workspace)
 * =============================================================
 */

declare(strict_types=1);

const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;   // 12 hours, extended on use
const LOGIN_MAX_ATTEMPTS       = 10;             // per IP
const LOGIN_ATTEMPT_WINDOW     = 15 * 60;        // 15 minutes

/** Hash a session token for storage/lookup. */
function auth_hash_token(string $token): string
{
    return hash('sha256', $token);
}

/**
 * Verify an email/password pair and start a session.
 *
 * @return array{token: string, expiresAt: string, user: array<string, mixed>}
 */
function auth_login(string $email, string $password): array
{
    $ip = client_ip();

    // ---- Brute-force throttle (PocketBase enforced this itself) ----
    if ($ip !== '') {
        $recentFailures = (int) db_value(
            "SELECT COUNT(*) FROM `audit_logs`
              WHERE `action` = 'login_failed' AND `ip` = ?
                AND `created` > DATE_SUB(NOW(), INTERVAL ? SECOND)",
            [$ip, LOGIN_ATTEMPT_WINDOW]
        );
        if ($recentFailures >= LOGIN_MAX_ATTEMPTS) {
            json_error('Too many failed sign-in attempts. Please try again later.', 429);
        }
    }

    $user = db_one('SELECT * FROM `users` WHERE `email` = ?', [$email]);

    // Compare against a dummy hash when the account does not exist, so a
    // missing account and a wrong password take the same amount of time
    // and cannot be told apart by an attacker enumerating emails.
    $hash = $user['password'] ?? '$2y$10$usesomesillystringfoetsomethingxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

    if (!password_verify($password, $hash) || !$user) {
        auth_record_failure($email, $ip);
        json_error('Incorrect email or password.', 401);
    }

    // ---- Suspended staff member ----
    if (!empty($user['suspended'])) {
        $reason = $user['suspendedReason'] ?: 'Account suspended by administrator.';
        json_error("Account suspended: $reason", 403);
    }

    // ---- Workspace subscription status ----
    if ($user['role'] !== 'super_admin' && !empty($user['tenant'])) {
        $tenant = db_one('SELECT `name`, `status`, `billingStatus` FROM `tenants` WHERE `id` = ?', [$user['tenant']]);
        if ($tenant) {
            $blocked = in_array($tenant['billingStatus'], ['suspended', 'cancelled'], true)
                || (empty($tenant['billingStatus']) && $tenant['status'] === 'inactive');
            if ($blocked) {
                json_error(
                    ($tenant['name'] ?: 'Your workspace')
                    . "'s subscription is not active. Contact the platform administrator to restore access.",
                    403
                );
            }
        }
    }

    // ---- Issue the session ----
    $token     = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_LIFETIME_SECONDS);

    db_insert('user_sessions', [
        'user'      => $user['id'],
        'tokenHash' => auth_hash_token($token),
        'ip'        => $ip,
        'userAgent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500),
        'expiresAt' => $expiresAt,
    ]);

    auth_log($user['id'], 'login', 'users', $user['email'], $user['tenant'] ?? null);

    return [
        'token'     => $token,
        'expiresAt' => $expiresAt,
        'user'      => auth_public_user($user),
    ];
}

/** Record a failed attempt so the throttle above can see it. */
function auth_record_failure(string $email, string $ip): void
{
    try {
        db_insert('audit_logs', [
            'action'  => 'login_failed',
            'entity'  => 'users',
            'details' => 'Failed sign-in for ' . substr($email, 0, 100),
            'ip'      => $ip,
        ]);
    } catch (Throwable $e) {
        error_log('[auth] could not record failed login: ' . $e->getMessage());
    }
}

/**
 * Resolve the caller from their bearer token.
 * Returns null when there is no valid session.
 *
 * @return array<string, mixed>|null
 */
function auth_user(): ?array
{
    static $cached = false;
    static $user = null;
    if ($cached) {
        return $user;
    }
    $cached = true;

    $token = bearer_token();
    if ($token === null) {
        return null;
    }

    $row = db_one(
        'SELECT s.`id` AS sessionId, s.`expiresAt`, u.*
           FROM `user_sessions` s
           JOIN `users` u ON u.`id` = s.`user`
          WHERE s.`tokenHash` = ? AND s.`expiresAt` > NOW()',
        [auth_hash_token($token)]
    );
    if (!$row) {
        return null;
    }

    // A staff member suspended mid-session loses access immediately.
    if (!empty($row['suspended'])) {
        return null;
    }

    // Slide the expiry forward so an active session does not expire
    // under someone mid-task.
    db_update('user_sessions', (string) $row['sessionId'], [
        'expiresAt' => date('Y-m-d H:i:s', time() + SESSION_LIFETIME_SECONDS),
    ]);

    unset($row['sessionId'], $row['expiresAt']);
    $user = $row;
    return $user;
}

/** The caller, or a 401. */
function auth_require(): array
{
    $user = auth_user();
    if ($user === null) {
        json_error('Please sign in to continue.', 401);
    }
    return $user;
}

/** End the current session. */
function auth_logout(): void
{
    $token = bearer_token();
    if ($token !== null) {
        db_query('DELETE FROM `user_sessions` WHERE `tokenHash` = ?', [auth_hash_token($token)]);
    }
}

/** Strip secrets before a user record is sent to the client. */
function auth_public_user(array $user): array
{
    unset($user['password'], $user['tokenKey']);

    // `roles` is stored as a JSON array; hand the client an array, not a string.
    if (isset($user['roles']) && is_string($user['roles'])) {
        $decoded = json_decode($user['roles'], true);
        $user['roles'] = is_array($decoded) ? $decoded : [];
    }
    if (empty($user['roles']) && !empty($user['role'])) {
        $user['roles'] = [$user['role']];
    }

    foreach (['emailVisibility', 'verified', 'mfaEnabled', 'suspended'] as $flag) {
        if (isset($user[$flag])) {
            $user[$flag] = (bool) $user[$flag];
        }
    }
    return $user;
}

/** Write an audit-trail entry. Never throws. */
function auth_log(?string $actorId, string $action, string $entity = '', string $details = '', ?string $tenant = null): void
{
    try {
        db_insert('audit_logs', [
            'actor'   => $actorId,
            'action'  => $action,
            'entity'  => $entity,
            'details' => substr($details, 0, 2000),
            'ip'      => client_ip(),
            'tenant'  => $tenant,
        ]);
    } catch (Throwable $e) {
        error_log('[auth] audit write failed: ' . $e->getMessage());
    }
}

/** Delete expired sessions. Called opportunistically on login. */
function auth_prune_sessions(): void
{
    try {
        db_query('DELETE FROM `user_sessions` WHERE `expiresAt` < NOW()');
    } catch (Throwable $e) {
        error_log('[auth] session prune failed: ' . $e->getMessage());
    }
}
