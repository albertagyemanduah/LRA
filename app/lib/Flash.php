<?php

declare(strict_types=1);

namespace App;

/** One-shot session messages shown at the top of the next page. */
final class Flash
{
    public static function add(string $type, string $message): void
    {
        $_SESSION['_flash'][] = ['type' => $type, 'message' => $message];
    }

    public static function success(string $m): void { self::add('success', $m); }
    public static function error(string $m): void   { self::add('danger', $m); }
    public static function info(string $m): void    { self::add('info', $m); }
    public static function warning(string $m): void { self::add('warning', $m); }

    /** @return array<int, array{type:string, message:string}> */
    public static function pull(): array
    {
        $items = $_SESSION['_flash'] ?? [];
        unset($_SESSION['_flash']);
        return $items;
    }
}
