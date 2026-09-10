<?php

declare(strict_types=1);

namespace App;

/** Per-workspace portal name, colours and logo. */
final class Branding
{
    public static function resolve(?string $tenantId): array
    {
        $defaults = [
            'portalName'   => $GLOBALS['config']['app_name'] ?? 'Land Registry',
            'tagline'      => 'Land Registry System',
            'primaryColor' => '210 55% 22%',
            'accentColor'  => '210 60% 38%',
            'logo'         => null,
            'tenant'       => $tenantId,
            'supportEmail' => null,
            'supportPhone' => null,
            'footerText'   => null,
        ];
        if (!$tenantId) {
            return $defaults;
        }
        $row = db_one('SELECT * FROM `tenant_branding` WHERE `tenant` = ?', [$tenantId]);
        return $row ? array_merge($defaults, array_filter($row, static fn ($v) => $v !== null && $v !== '')) : $defaults;
    }

    /** Turn "210 55% 22%" into a valid CSS colour. */
    public static function css(string $hslTriple, string $fallback = '#1c3d5a'): string
    {
        $t = trim($hslTriple);
        if (preg_match('/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/', $t)) {
            return "hsl($t)";
        }
        if (preg_match('/^#?[0-9a-fA-F]{3,8}$/', $t)) {
            return str_starts_with($t, '#') ? $t : "#$t";
        }
        return $fallback;
    }
}
