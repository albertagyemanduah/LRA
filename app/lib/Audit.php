<?php

declare(strict_types=1);

namespace App;

/** Append-only activity trail. Never throws into the request path. */
final class Audit
{
    public static function log(
        string $action,
        string $entity = '',
        string $details = '',
        ?string $tenant = null,
        ?string $actorId = null
    ): void {
        try {
            $actorId ??= $_SESSION['uid'] ?? null;
            if ($tenant === null && $actorId) {
                $tenant = db_value('SELECT `tenant` FROM `users` WHERE `id` = ?', [$actorId]);
            }
            db_insert('audit_logs', [
                'actor'   => $actorId,
                'action'  => $action,
                'entity'  => $entity,
                'details' => mb_substr($details, 0, 2000),
                'ip'      => Auth::clientIp(),
                'tenant'  => $tenant ?: null,
            ]);
        } catch (\Throwable $e) {
            error_log('[audit] ' . $e->getMessage());
        }
    }
}
