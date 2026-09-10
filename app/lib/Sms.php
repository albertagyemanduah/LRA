<?php

declare(strict_types=1);

namespace App;

/**
 * SMS via the Arkesel gateway (v1 API), ported from
 * apps/api/src/routes/sms.js. Every attempt is written to sms_logs.
 * When no API key is configured the message is logged only, so
 * notification flows still work in local development.
 */
final class Sms
{
    /** @return array{ok:bool, error?:string} */
    public static function send(string $to, string $message, string $senderKey = 'default', ?string $tenant = null, ?string $sentBy = null): array
    {
        $phone = People::normalisePhone($to);
        $sentBy ??= $_SESSION['uid'] ?? null;
        $cfg = $GLOBALS['config'];
        $sender = $senderKey === 'transfer' ? 'Transfer' : ($cfg['arkesel_sender'] ?: 'LandReg');

        if (!preg_match('/^233\d{9}$/', $phone)) {
            self::log($sentBy, $to, $message, 'failed', 'invalid phone number', $tenant);
            return ['ok' => false, 'error' => 'Invalid Ghana phone number.'];
        }

        if (empty($cfg['arkesel_api_key'])) {
            self::log($sentBy, $phone, $message, 'pending', 'no ARKESEL_API_KEY — not sent', $tenant);
            error_log("[sms] (no API key) would send to $phone: $message");
            return ['ok' => true];
        }

        $url = rtrim($cfg['arkesel_base'], '/') . '?' . http_build_query([
            'action' => 'send-sms',
            'api_key' => $cfg['arkesel_api_key'],
            'to' => $phone,
            'from' => $sender,
            'sms' => $message,
        ]);

        try {
            $ctx = stream_context_create(['http' => ['timeout' => 15, 'ignore_errors' => true]]);
            $body = @file_get_contents($url, false, $ctx);
            $data = json_decode((string) $body, true) ?: [];
            $code = strtolower((string) ($data['code'] ?? ''));
            $ok = in_array($code, ['ok', '100'], true);
            self::log($sentBy, $phone, $message, $ok ? 'sent' : 'failed',
                $ok ? null : ($data['message'] ?? 'gateway error'), $tenant);
            return $ok ? ['ok' => true] : ['ok' => false, 'error' => $data['message'] ?? 'SMS gateway error'];
        } catch (\Throwable $e) {
            self::log($sentBy, $phone, $message, 'failed', $e->getMessage(), $tenant);
            return ['ok' => false, 'error' => 'SMS gateway unreachable.'];
        }
    }

    private static function log(?string $by, string $phone, string $msg, string $status, ?string $err, ?string $tenant): void
    {
        try {
            db_insert('sms_logs', [
                'sentBy' => $by ?: db_value("SELECT `id` FROM `users` WHERE `role` IN ('admin','super_admin') ORDER BY `created` LIMIT 1"),
                'recipientPhone' => $phone,
                'message' => $msg,
                'status' => $status,
                'errorMsg' => $err,
                'tenant' => $tenant,
            ]);
        } catch (\Throwable $e) {
            error_log('[sms] log failed: ' . $e->getMessage());
        }
    }
}
