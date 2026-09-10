<?php

declare(strict_types=1);

namespace App;

/**
 * Email sender.
 *
 * With SMTP settings configured it sends over SMTP (STARTTLS or
 * implicit TLS). With none configured — the default local setup —
 * it writes the message to storage/mail/ so flows can be tested
 * without a mail server. Returns true when the message was handed
 * off (or written to disk) successfully.
 */
final class Mailer
{
    public static function send(string $to, string $subject, string $htmlBody, ?string $textBody = null): bool
    {
        $cfg = $GLOBALS['config']['smtp'] ?? [];
        $from = $cfg['from'] ?: 'Land Registry <noreply@localhost>';
        $textBody ??= trim(strip_tags(preg_replace('/<(br|\/p|\/div|\/h[1-6])>/i', "\n", $htmlBody) ?? $htmlBody));

        if (empty($cfg['host'])) {
            return self::toDisk($to, $subject, $htmlBody, $from);
        }

        try {
            return self::smtp($cfg, $from, $to, $subject, $htmlBody, $textBody);
        } catch (\Throwable $e) {
            error_log('[mailer] SMTP failed: ' . $e->getMessage() . ' — falling back to disk');
            return self::toDisk($to, $subject, $htmlBody, $from);
        }
    }

    private static function toDisk(string $to, string $subject, string $body, string $from): bool
    {
        $dir = ($GLOBALS['config']['root_dir'] ?? dirname(__DIR__, 2)) . '/storage/mail';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $file = $dir . '/' . date('Ymd-His') . '-' . preg_replace('/[^a-z0-9]/i', '_', $to) . '.html';
        $meta = "<!-- To: $to\n     From: $from\n     Subject: $subject\n     Date: " . date('c') . " -->\n";
        @file_put_contents($file, $meta . $body);
        error_log("[mailer] (no SMTP) wrote message for $to to $file");
        return true;
    }

    /** Minimal SMTP client — enough for transactional mail. */
    private static function smtp(array $cfg, string $from, string $to, string $subject, string $html, string $text): bool
    {
        $host = $cfg['host'];
        $port = (int) ($cfg['port'] ?: 587);
        $secure = strtolower((string) ($cfg['secure'] ?: 'tls'));
        $transport = $secure === 'ssl' || $port === 465 ? "ssl://$host" : $host;

        $fp = @stream_socket_client("$transport:$port", $errno, $errstr, 15);
        if (!$fp) {
            throw new \RuntimeException("connect: $errstr ($errno)");
        }
        $read = static function () use ($fp): string {
            $data = '';
            while ($line = fgets($fp, 515)) {
                $data .= $line;
                if (isset($line[3]) && $line[3] === ' ') {
                    break;
                }
            }
            return $data;
        };
        $cmd = static function (string $c) use ($fp, $read): string {
            fwrite($fp, $c . "\r\n");
            return $read();
        };

        $read();
        $ehlo = $cmd('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'));
        if ($secure === 'tls' && $port !== 465) {
            $cmd('STARTTLS');
            stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $cmd('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'));
        }
        if (!empty($cfg['user'])) {
            $cmd('AUTH LOGIN');
            $cmd(base64_encode($cfg['user']));
            $auth = $cmd(base64_encode((string) $cfg['pass']));
            if (!str_starts_with(trim($auth), '235')) {
                throw new \RuntimeException('auth rejected: ' . trim($auth));
            }
        }

        $fromAddr = self::addr($from);
        $cmd("MAIL FROM:<$fromAddr>");
        $cmd("RCPT TO:<" . self::addr($to) . ">");
        $cmd('DATA');

        $boundary = 'b' . bin2hex(random_bytes(8));
        $headers = [
            "From: $from",
            "To: $to",
            'Subject: ' . self::encodeHeader($subject),
            'MIME-Version: 1.0',
            "Content-Type: multipart/alternative; boundary=\"$boundary\"",
            'Date: ' . date('r'),
        ];
        $message = implode("\r\n", $headers) . "\r\n\r\n"
            . "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" . $text . "\r\n"
            . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" . $html . "\r\n"
            . "--$boundary--\r\n.";
        $final = $cmd($message);
        $cmd('QUIT');
        fclose($fp);

        return str_starts_with(trim($final), '250');
    }

    private static function addr(string $value): string
    {
        return preg_match('/<([^>]+)>/', $value, $m) ? $m[1] : trim($value);
    }

    private static function encodeHeader(string $value): string
    {
        return preg_match('/[\x80-\xFF]/', $value)
            ? '=?UTF-8?B?' . base64_encode($value) . '?='
            : $value;
    }
}
