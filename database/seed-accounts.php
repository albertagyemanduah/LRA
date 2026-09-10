<?php
/**
 * =============================================================
 * SEED DEMO / FIRST-RUN ACCOUNTS  (non-interactive)
 * =============================================================
 * Creates a platform Super Admin plus one staff account per role
 * inside the default workspace, so the app can be signed into
 * immediately for local development and demos.
 *
 *     php database/seed-accounts.php
 *
 * All demo accounts use the password:  Password123!
 * Safe to re-run — existing emails are skipped.
 * =============================================================
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only.\n");
}

require_once __DIR__ . '/connection.php';

const DEMO_PASSWORD = 'Password123!';

$tenant = db_one("SELECT `id` FROM `tenants` ORDER BY `created` LIMIT 1");
if (!$tenant) {
    fwrite(STDERR, "No workspace found. Import database/seed.sql first.\n");
    exit(1);
}
$tenantId = $tenant['id'];
$hash = password_hash(DEMO_PASSWORD, PASSWORD_BCRYPT, ['cost' => 10]);

/** @var array<int, array{email:string, first:string, surname:string, role:string, tenant:?string}> */
$accounts = [
    ['email' => 'superadmin@lra.test',   'first' => 'Platform', 'surname' => 'Owner',       'role' => 'super_admin',           'tenant' => null],
    ['email' => 'admin@lra.test',         'first' => 'Ama',      'surname' => 'Administrator','role' => 'admin',                 'tenant' => $tenantId],
    ['email' => 'planning@lra.test',      'first' => 'Kofi',     'surname' => 'Planning',    'role' => 'planning_officer',      'tenant' => $tenantId],
    ['email' => 'survey@lra.test',        'first' => 'Yaa',      'surname' => 'Survey',      'role' => 'survey_officer',        'tenant' => $tenantId],
    ['email' => 'registrar@lra.test',     'first' => 'Kwabena',  'surname' => 'Registrar',   'role' => 'registrar',             'tenant' => $tenantId],
    ['email' => 'finance@lra.test',       'first' => 'Esi',      'surname' => 'Finance',     'role' => 'finance_officer',       'tenant' => $tenantId],
    ['email' => 'customary@lra.test',     'first' => 'Nana',     'surname' => 'Secretariat', 'role' => 'customary_secretariat', 'tenant' => $tenantId],
];

foreach ($accounts as $a) {
    if (db_one('SELECT `id` FROM `users` WHERE `email` = ?', [$a['email']])) {
        fwrite(STDOUT, "· skip  {$a['email']} (exists)\n");
        continue;
    }
    $full = trim("{$a['first']} {$a['surname']}");
    $id = db_insert('users', [
        'email'           => $a['email'],
        'password'        => $hash,
        'emailVisibility' => 1,
        'verified'        => 1,
        'name'            => $full,
        'fullName'        => $full,
        'firstName'       => $a['first'],
        'surname'         => $a['surname'],
        'role'            => $a['role'],
        'roles'           => json_encode([$a['role']]),
        'tenant'          => $a['tenant'],
    ]);
    fwrite(STDOUT, "✓ create {$a['email']}  ({$a['role']}, id {$id})\n");
}

fwrite(STDOUT, "\nAll demo passwords: " . DEMO_PASSWORD . "\n");
