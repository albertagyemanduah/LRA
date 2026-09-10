<?php
/**
 * =============================================================
 * AUTH API  —  /api/auth/*
 * =============================================================
 *   POST /api/auth/login     { email, password }  -> { token, user }
 *   POST /api/auth/logout
 *   GET  /api/auth/me                             -> the current user
 *   POST /api/auth/password  { currentPassword, newPassword }
 *
 * Replaces pb.collection('users').authWithPassword() and friends.
 * =============================================================
 */

declare(strict_types=1);

function auth_route(?string $action): void
{
    $method = request_method();

    switch ("$method $action") {
        case 'POST login':
            auth_route_login();
            break;

        case 'POST logout':
            auth_logout();
            json_response(['ok' => true]);

        case 'GET me':
            $user = auth_require();
            json_response(['user' => auth_public_user($user)]);

        case 'POST password':
            auth_route_change_password();
            break;

        default:
            json_error('Unknown auth endpoint.', 404);
    }
}

function auth_route_login(): void
{
    $body     = request_body();
    $email    = trim((string) ($body['email'] ?? ''));
    $password = (string) ($body['password'] ?? '');

    if ($email === '' || $password === '') {
        json_error('Email and password are required.', 422);
    }

    $result = auth_login($email, $password);
    auth_prune_sessions();

    json_response($result);
}

function auth_route_change_password(): void
{
    $user = auth_require();
    $body = request_body();

    $current = (string) ($body['currentPassword'] ?? '');
    $new     = (string) ($body['newPassword'] ?? '');

    if (strlen($new) < 10) {
        json_error('The new password must be at least 10 characters.', 422);
    }

    $row = db_one('SELECT `password` FROM `users` WHERE `id` = ?', [$user['id']]);
    if (!$row || !password_verify($current, $row['password'])) {
        json_error('Your current password is incorrect.', 403);
    }

    db_update('users', $user['id'], [
        'password' => password_hash($new, PASSWORD_BCRYPT, ['cost' => 10]),
    ]);

    // Every other session for this account is invalidated, so a
    // stolen token stops working the moment the password changes.
    $token = bearer_token();
    db_query(
        'DELETE FROM `user_sessions` WHERE `user` = ? AND `tokenHash` != ?',
        [$user['id'], $token !== null ? auth_hash_token($token) : '']
    );

    auth_log($user['id'], 'password_changed', 'users', $user['email'], $user['tenant'] ?? null);
    json_response(['ok' => true]);
}
