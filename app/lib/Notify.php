<?php

declare(strict_types=1);

namespace App;

/**
 * Notification engine — a PHP port of the essentials of
 * pb_hooks/land-notifications.pb.js and approval-notifications.pb.js.
 *
 * Every notification is written in-app; SMS and email go out too
 * when the recipient's notification_preferences allow it and it is
 * outside their quiet hours. A delivery failure is logged and
 * swallowed — it must never abort the workflow that triggered it.
 */
final class Notify
{
    /**
     * @param array{message:string, link?:string, tenant?:?string,
     *              event?:string, sms?:bool, email?:bool} $opts
     */
    public static function toUser(?string $userId, array $opts): void
    {
        if (!$userId) {
            return;
        }
        try {
            $user = db_one('SELECT `id`,`email`,`phone`,`whatsappNumber`,`fullName`,`name` FROM `users` WHERE `id` = ?', [$userId]);
            if (!$user) {
                return;
            }

            db_insert('notifications', [
                'user'    => $userId,
                'message' => mb_substr($opts['message'], 0, 500),
                'link'    => $opts['link'] ?? null,
                'read'    => 0,
                'tenant'  => $opts['tenant'] ?? null,
            ]);

            $prefs = self::prefs($userId);
            $event = $opts['event'] ?? null;
            if ($event && isset($prefs[$event]) && !$prefs[$event]) {
                return; // opted out of this class of alert
            }
            if (self::inQuietHours($prefs)) {
                return;
            }
            $channels = $prefs['channels'] ?? ['in_app', 'sms'];

            if (($opts['sms'] ?? true) && in_array('sms', $channels, true) && !empty($user['phone'])) {
                Sms::send($user['phone'], $opts['message'], 'default', $opts['tenant'] ?? null);
            }
            if (($opts['email'] ?? false) && in_array('email', $channels, true) && !empty($user['email'])
                && !str_ends_with($user['email'], '@no-login.local')) {
                Mailer::send($user['email'], 'Land Registry notification',
                    '<p>' . e($opts['message']) . '</p>');
            }
        } catch (\Throwable $e) {
            error_log('[notify] ' . $e->getMessage());
        }
    }

    /** Notify every approver (admin + planning_officer) in a workspace. */
    public static function toApprovers(?string $tenantId, array $opts): void
    {
        try {
            $sql = "SELECT `id` FROM `users` WHERE `suspended` = 0 AND `role` IN ('admin','planning_officer','super_admin')";
            $params = [];
            if ($tenantId) {
                $sql .= ' AND (`tenant` = ? OR `role` = \'super_admin\')';
                $params[] = $tenantId;
            }
            foreach (db_all($sql, $params) as $row) {
                self::toUser($row['id'], $opts + ['tenant' => $tenantId]);
            }
        } catch (\Throwable $e) {
            error_log('[notify] approvers: ' . $e->getMessage());
        }
    }

    /** @return array<string,mixed> */
    private static function prefs(string $userId): array
    {
        $row = db_one('SELECT * FROM `notification_preferences` WHERE `user` = ?', [$userId]);
        if (!$row) {
            return ['channels' => ['in_app', 'sms']];
        }
        if (is_string($row['channels'] ?? null)) {
            $decoded = json_decode($row['channels'], true);
            $row['channels'] = is_array($decoded) ? $decoded : ['in_app', 'sms'];
        }
        foreach (['transferAlerts', 'editAlerts', 'deleteAlerts', 'approvalAlerts', 'rejectionAlerts', 'reminderAlerts'] as $f) {
            $row[$f] = (bool) ($row[$f] ?? true);
        }
        return $row;
    }

    private static function inQuietHours(array $prefs): bool
    {
        $start = $prefs['quietHoursStart'] ?? '';
        $end = $prefs['quietHoursEnd'] ?? '';
        if (!$start || !$end) {
            return false;
        }
        $now = (int) date('Hi');
        $s = (int) str_replace(':', '', $start);
        $e = (int) str_replace(':', '', $end);
        return $s <= $e ? ($now >= $s && $now < $e) : ($now >= $s || $now < $e);
    }
}
