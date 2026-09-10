<?php

declare(strict_types=1);

namespace App;

/**
 * `parcels.owner` and several other columns are required foreign keys
 * to `users`. Land owners are not staff and never sign in, but they
 * still need a `users` row (role = citizen) so the key resolves.
 * This finds an existing citizen record or creates one.
 */
final class People
{
    /**
     * @param array{name?:string, fullName?:string, phone?:string, email?:string,
     *              ghanaCard?:string, firstName?:string, surname?:string} $data
     */
    public static function ensureCitizen(array $data, ?string $tenantId): string
    {
        $name  = trim((string) ($data['fullName'] ?? $data['name'] ?? ''));
        $phone = self::normalisePhone($data['phone'] ?? '');
        $card  = trim((string) ($data['ghanaCard'] ?? ''));
        $email = trim((string) ($data['email'] ?? ''));

        // Match an existing citizen by Ghana Card, then by phone + name.
        if ($card !== '') {
            $hit = db_one("SELECT `id` FROM `users` WHERE `ghanaCard` = ? AND `role` = 'citizen' LIMIT 1", [$card]);
            if ($hit) {
                return $hit['id'];
            }
        }
        if ($phone !== '' && $name !== '') {
            $hit = db_one(
                "SELECT `id` FROM `users` WHERE `phone` = ? AND `fullName` = ? AND `role` = 'citizen' LIMIT 1",
                [$phone, $name]
            );
            if ($hit) {
                return $hit['id'];
            }
        }

        // Synthesize a unique, non-login email if none was given.
        if ($email === '' || db_one('SELECT `id` FROM `users` WHERE `email` = ?', [$email])) {
            $email = 'citizen+' . bin2hex(random_bytes(5)) . '@no-login.local';
        }

        $parts = preg_split('/\s+/', $name) ?: [];
        return db_insert('users', [
            'email'           => $email,
            'password'        => password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT),
            'emailVisibility' => 0,
            'verified'        => 0,
            'role'            => 'citizen',
            'roles'           => json_encode(['citizen']),
            'name'            => $name ?: 'Land owner',
            'fullName'        => $name ?: null,
            'firstName'       => $data['firstName'] ?? ($parts[0] ?? null),
            'surname'         => $data['surname'] ?? (count($parts) > 1 ? end($parts) : null),
            'phone'           => $phone ?: null,
            'ghanaCard'       => $card ?: null,
            'tenant'          => $tenantId,
        ]);
    }

    public static function normalisePhone(?string $raw): string
    {
        $s = preg_replace('/[\s\-().]/', '', (string) $raw) ?? '';
        $s = ltrim($s, '+');
        if (str_starts_with($s, '233')) {
            return strlen($s) === 12 ? $s : $s;
        }
        if (str_starts_with($s, '0') && strlen($s) === 10) {
            return '233' . substr($s, 1);
        }
        if (preg_match('/^\d{9}$/', $s)) {
            return '233' . $s;
        }
        return $s;
    }

    /** Display name for a user id. */
    public static function name(?string $userId): string
    {
        if (!$userId) {
            return '—';
        }
        $u = db_one('SELECT `fullName`,`name`,`email` FROM `users` WHERE `id` = ?', [$userId]);
        return $u ? ($u['fullName'] ?: $u['name'] ?: $u['email']) : '—';
    }
}
