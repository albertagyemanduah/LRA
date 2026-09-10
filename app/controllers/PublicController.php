<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Controller;

/** Unauthenticated pages: landing, public land verification. */
final class PublicController extends Controller
{
    public function home(): void
    {
        if ($this->auth->check()) {
            redirect('/dashboard');
        }
        $this->render('public/home', [
            'title' => 'Home',
            'stats' => $this->publicStats(),
            'news'  => db_all(
                "SELECT `id`,`title`,`slug`,`excerpt`,`publishedAt`,`created`
                   FROM `news_posts` WHERE `status` = 'published'
                   ORDER BY COALESCE(`publishedAt`,`created`) DESC LIMIT 3"
            ),
        ]);
    }

    public function verify(): void
    {
        $this->render('public/verify', ['title' => 'Verify a land record', 'result' => null]);
    }

    public function verifySubmit(): void
    {
        $this->guardCsrf();
        $code = strtoupper(trim((string) input('code', '')));
        $result = ['ok' => false, 'message' => '', 'parcels' => []];

        if ($code === '') {
            $result['message'] = 'Enter a verification code.';
            $this->render('public/verify', ['title' => 'Verify a land record', 'result' => $result]);
        }

        $row = db_one('SELECT * FROM `verification_codes` WHERE UPPER(`code`) = ? LIMIT 1', [$code]);
        $valid = $row
            && !empty($row['isActive'])
            && (empty($row['expiresAt']) || strtotime($row['expiresAt']) > time())
            && (empty($row['maxUsage']) || (int) $row['usageCount'] < (int) $row['maxUsage']);

        if (!$valid) {
            db_insert('verification_logs', [
                'code' => $code, 'status' => 'failure',
                'reason' => $row ? 'inactive/expired/exhausted' : 'unknown code',
                'tenant' => $row['tenant'] ?? null,
            ]);
            $result['message'] = 'That verification code is invalid, expired, or has been used up.';
            $this->render('public/verify', ['title' => 'Verify a land record', 'result' => $result]);
        }

        db_update('verification_codes', $row['id'], [
            'usageCount' => (int) $row['usageCount'] + 1,
            'lastUsedAt' => date('Y-m-d H:i:s'),
        ]);

        // Look up registered parcels in the code's community / area council.
        // Codes reference structure rows by id, but parcels store the name —
        // resolve the id to a name (falling back to the raw value).
        $resolveName = static function (string $table, ?string $ref): ?string {
            if (!$ref) {
                return null;
            }
            $name = db_value("SELECT `name` FROM `$table` WHERE `id` = ?", [$ref]);
            return $name ?: $ref;
        };

        $where = ["`status` = 'registered'"];
        $params = [];
        if (!empty($row['tenant'])) {
            $where[] = '`tenant` = ?';
            $params[] = $row['tenant'];
        }
        if (!empty($row['communityRef'])) {
            $where[] = '`community` = ?';
            $params[] = $resolveName('communities', $row['communityRef']);
        } elseif (!empty($row['areaCouncilRef'])) {
            $where[] = '`areaCouncil` = ?';
            $params[] = $resolveName('area_councils', $row['areaCouncilRef']);
        }
        $parcels = db_all(
            'SELECT `parcelNumber`,`applicantName`,`community`,`areaCouncil`,`sector`,`plotNumber`,`block`,`status`,`registrationDate`
               FROM `parcels` WHERE ' . implode(' AND ', $where) . ' ORDER BY `parcelNumber` LIMIT 200',
            $params
        );

        db_insert('verification_logs', [
            'code' => $code, 'status' => 'success', 'communityRef' => $row['communityRef'] ?? null,
            'resultsCount' => count($parcels), 'tenant' => $row['tenant'] ?? null,
        ]);

        $result = ['ok' => true, 'message' => '', 'parcels' => $parcels, 'code' => $row];
        $this->render('public/verify', ['title' => 'Verify a land record', 'result' => $result]);
    }

    public function stats(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: public, max-age=30');
        echo json_encode($this->publicStats());
        exit;
    }

    private function publicStats(): array
    {
        try {
            return [
                'parcels'   => (int) db_value("SELECT COUNT(*) FROM `parcels` WHERE `status` = 'registered'"),
                'transfers' => (int) db_value('SELECT COUNT(*) FROM `land_transfers`'),
                'officers'  => (int) db_value("SELECT COUNT(*) FROM `users` WHERE `suspended` = 0 AND `role` <> 'citizen'"),
                'councils'  => (int) db_value('SELECT COUNT(*) FROM `area_councils` WHERE `isDeleted` = 0'),
            ];
        } catch (\Throwable) {
            return ['parcels' => null, 'transfers' => null, 'officers' => null, 'councils' => null];
        }
    }
}
