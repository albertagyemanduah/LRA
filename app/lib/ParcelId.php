<?php

declare(strict_types=1);

namespace App;

/**
 * Sequential parcel identifiers:  <PREFIX><COMMUNITY 2-4>-XXXX
 * e.g. TeNDA-PPD-ADUM-0001   (matches apps/web/src/lib/parcelId.js)
 */
final class ParcelId
{
    public const PREFIX = 'TeNDA-PPD-';

    public static function abbreviate(?string $community): string
    {
        $clean = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $community) ?? '');
        return $clean === '' ? 'UNK' : substr($clean, 0, 4);
    }

    public static function isValid(string $id): bool
    {
        return (bool) preg_match('/^' . preg_quote(self::PREFIX, '/') . '[A-Z0-9]{2,4}-\d{4}$/', $id);
    }

    /** Next free id for a community, scoped to a workspace. */
    public static function next(?string $community, ?string $tenantId): string
    {
        $abbr = self::abbreviate($community);
        $prefix = self::PREFIX . $abbr . '-';
        $params = [$prefix . '%'];
        $sql = 'SELECT `parcelNumber` FROM `parcels` WHERE `parcelNumber` LIKE ?';
        if ($tenantId) {
            $sql .= ' AND (`tenant` = ? OR `tenant` IS NULL)';
            $params[] = $tenantId;
        }
        $max = 0;
        foreach (db_all($sql, $params) as $row) {
            if (preg_match('/(\d{4})$/', (string) $row['parcelNumber'], $m)) {
                $max = max($max, (int) $m[1]);
            }
        }
        return $prefix . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }
}
