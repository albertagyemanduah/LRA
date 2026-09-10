<?php
/**
 * =============================================================
 * DEMO CONTENT  (non-interactive, idempotent-ish)
 * =============================================================
 * Populates the default workspace with a realistic structure
 * hierarchy plus sample parcels, documents, payments, transfers
 * and verification codes so the admin console has something to
 * show. Run after seed.sql + seed-accounts.php.
 *
 *     php database/seed-demo.php
 * =============================================================
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("CLI only.\n");
}
require_once __DIR__ . '/connection.php';

$tenant = db_value("SELECT `id` FROM `tenants` ORDER BY `created` LIMIT 1");
if (!$tenant) {
    exit("Import seed.sql first.\n");
}
$admin = db_value("SELECT `id` FROM `users` WHERE `role` = 'admin' AND `tenant` = ? LIMIT 1", [$tenant]);
$registrar = db_value("SELECT `id` FROM `users` WHERE `role` = 'registrar' LIMIT 1") ?: $admin;
$surveyor = db_value("SELECT `id` FROM `users` WHERE `role` = 'survey_officer' LIMIT 1") ?: $admin;

if (db_value("SELECT COUNT(*) FROM `parcels` WHERE `tenant` = ?", [$tenant]) > 0) {
    echo "Demo parcels already present — nothing to do.\n";
    return;
}

function upsertStruct(string $table, array $data, string $tenant): string
{
    $existing = db_value("SELECT `id` FROM `$table` WHERE `name` = ? AND `tenant` = ?", [$data['name'], $tenant]);
    if ($existing) {
        return $existing;
    }
    return db_insert($table, $data + ['tenant' => $tenant, 'status' => 'active']);
}

// ---- Structure -------------------------------------------------
$office = upsertStruct('offices_struct', ['name' => 'Tuobodom Office', 'code' => 'TUO'], $tenant);
$councils = [];
foreach (['Tuobodom Area Council' => 'TUO-AC', 'Offuman Area Council' => 'OFF-AC', 'Akrofrom Area Council' => 'AKR-AC'] as $name => $code) {
    $councils[$name] = upsertStruct('area_councils', ['name' => $name, 'code' => $code, 'office' => $office], $tenant);
}
$communities = [];
foreach ([
    'Tuobodom' => 'Tuobodom Area Council',
    'Adumasa' => 'Tuobodom Area Council',
    'Offuman' => 'Offuman Area Council',
    'Akrofrom' => 'Akrofrom Area Council',
    'Krobo' => 'Offuman Area Council',
] as $cname => $council) {
    $communities[$cname] = upsertStruct('communities', [
        'name' => $cname, 'code' => strtoupper(substr($cname, 0, 4)),
        'areaCouncil' => $councils[$council] ?? null, 'office' => $office,
    ], $tenant);
}

// ---- Owners + parcels ----------------------------------------
$people = [
    ['Kwame Mensah', '0244123001', 'GHA-0111111111-1', 'Christianity', 'Akan'],
    ['Abena Owusu', '0201234002', 'GHA-0222222222-2', 'Christianity', 'Akan'],
    ['Yaw Boateng', '0559876003', 'GHA-0333333333-3', 'Islam', 'Mole-Dagbani'],
    ['Adjoa Sarpong', '0246550004', 'GHA-0444444444-4', 'Christianity', 'Akan'],
    ['Kojo Antwi', '0208880005', 'GHA-0555555555-5', 'Traditional', 'Ewe'],
    ['Ama Serwaa', '0273330006', 'GHA-0666666666-6', 'Christianity', 'Akan'],
    ['Kofi Asante', '0244777007', 'GHA-0777777777-7', 'Christianity', 'Akan'],
    ['Efua Bonsu', '0501110008', 'GHA-0888888888-8', 'Islam', 'Akan'],
];
$communityNames = array_keys($communities);
$statuses = ['registered', 'registered', 'registered', 'under_review', 'under_survey', 'submitted', 'draft', 'registered'];
$abbr = static fn (string $c): string => strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $c) ?: 'UNK');
$seq = [];
$parcelIds = [];

foreach ($people as $i => [$name, $phone, $card, $religion, $tribe]) {
    $ownerId = db_insert('users', [
        'email' => 'owner' . $i . '@no-login.local',
        'password' => password_hash(bin2hex(random_bytes(12)), PASSWORD_BCRYPT),
        'role' => 'citizen', 'roles' => json_encode(['citizen']),
        'name' => $name, 'fullName' => $name, 'phone' => '233' . substr($phone, 1),
        'ghanaCard' => $card, 'tenant' => $tenant, 'verified' => 0, 'emailVisibility' => 0,
    ]);

    $community = $communityNames[$i % count($communityNames)];
    $ab = substr($abbr($community), 0, 4);
    $seq[$ab] = ($seq[$ab] ?? 0) + 1;
    $number = 'TeNDA-PPD-' . $ab . '-' . str_pad((string) $seq[$ab], 4, '0', STR_PAD_LEFT);
    $status = $statuses[$i];
    $council = array_search($communities[$community], array_map(null, array_values($councils), array_keys($councils)), true);

    $pid = db_insert('parcels', [
        'owner' => $ownerId,
        'parcelNumber' => $number,
        'status' => $status,
        'applicantName' => $name,
        'contactPhone' => '233' . substr($phone, 1),
        'religion' => $religion,
        'tribe' => $tribe,
        'areaCouncil' => array_keys($councils)[$i % 3],
        'community' => $community,
        'sector' => 'Sector ' . chr(65 + ($i % 4)),
        'plotNumber' => (string) (10 + $i),
        'block' => 'B' . (1 + ($i % 3)),
        'allocationDate' => date('Y-m-d', strtotime('-' . (300 - $i * 20) . ' days')),
        'registrationDate' => $status === 'registered' ? date('Y-m-d', strtotime('-' . (200 - $i * 15) . ' days')) : null,
        'tenant' => $tenant,
        'created' => date('Y-m-d H:i:s', strtotime('-' . (240 - $i * 25) . ' days')),
    ]);
    $parcelIds[] = [$pid, $ownerId, $number, $status, $name];

    db_insert('audit_logs', ['actor' => $registrar, 'action' => 'parcel_registered', 'entity' => 'parcels',
        'details' => "$number created", 'tenant' => $tenant,
        'created' => date('Y-m-d H:i:s', strtotime('-' . (240 - $i * 25) . ' days'))]);

    // Documents
    foreach (['deed' => 'Deed of assignment', 'site_plan' => 'Site plan'] as $type => $title) {
        db_insert('documents', [
            'owner' => $ownerId, 'parcel' => $pid, 'title' => $title, 'docType' => $type,
            'status' => $status === 'registered' ? 'verified' : 'pending_scan',
            'version' => 1, 'tenant' => $tenant,
        ]);
    }

    // Payments for registered parcels
    if ($status === 'registered') {
        db_insert('payments', [
            'payer' => $ownerId, 'parcel' => $pid, 'parcelNumber' => $number,
            'invoiceNumber' => 'INV-' . date('Y') . '-' . str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT),
            'purpose' => 'registration_fee', 'amount' => 250 + $i * 25, 'method' => 'mobile_money',
            'status' => 'paid', 'ownerName' => $name, 'ownerPhone' => '233' . substr($phone, 1),
            'community' => $community, 'tenant' => $tenant,
            'created' => date('Y-m-d H:i:s', strtotime('-' . (190 - $i * 15) . ' days')),
        ]);
    }

    // A survey for those in/after survey stage
    if (in_array($status, ['under_survey', 'under_review', 'registered'], true)) {
        db_insert('surveys', [
            'parcel' => $pid, 'surveyor' => $surveyor,
            'surveyDate' => date('Y-m-d', strtotime('-' . (150 - $i * 10) . ' days')),
            'computedArea' => 400 + $i * 37.5,
            'status' => $status === 'registered' ? 'verified' : 'completed',
            'notes' => 'Boundaries pillared; no encroachment observed.', 'tenant' => $tenant,
        ]);
    }
}

// ---- A pending transfer + a pending edit request -------------
[$p0, $o0, $n0] = $parcelIds[0];
db_insert('land_transfers', [
    'parcel' => $p0, 'fromOwner' => $o0, 'toOwnerName' => 'Nana Kwaku Duah', 'toOwnerPhone' => '233246000999',
    'reason' => 'Sale of land, agreement signed 12 Jan.', 'status' => 'pending', 'tenant' => $tenant,
]);
[$p3, $o3] = $parcelIds[3];
db_insert('land_edit_requests', [
    'parcel' => $p3, 'requestedBy' => $registrar, 'type' => 'edit',
    'proposedChanges' => json_encode(['contactPhone' => '233201234999']),
    'reason' => 'Owner changed phone number.', 'status' => 'pending', 'tenant' => $tenant,
]);

// ---- Verification codes -------------------------------------
foreach (['Tuobodom', 'Offuman'] as $i => $c) {
    db_insert('verification_codes', [
        'code' => strtoupper($c) . '-' . date('Y'),
        'communityRef' => $communities[$c] ?? null,
        'description' => "Public verification for $c community",
        'createdBy' => $admin, 'isActive' => 1, 'usageCount' => 0, 'maxUsage' => 500,
        'codeType' => 'community',
        'expiresAt' => date('Y-m-d H:i:s', strtotime('+1 year')), 'tenant' => $tenant,
    ]);
}

// ---- A published news post + ticket -------------------------
db_insert('news_categories', ['name' => 'Announcements', 'slug' => 'announcements', 'color' => '#1c3d5a', 'tenant' => $tenant]);
db_insert('news_posts', [
    'title' => 'Digital land registration now live', 'slug' => 'digital-land-registration-live',
    'excerpt' => 'Residents can now verify land records online using a community code.',
    'content' => 'The Assembly has launched its digital land registry...', 'type' => 'news',
    'status' => 'published', 'author' => $admin, 'publishedAt' => date('Y-m-d H:i:s', strtotime('-10 days')),
    'tenant' => $tenant,
]);
db_insert('tickets', [
    'subject' => 'Cannot find my parcel in verification portal', 'category' => 'General Inquiry',
    'priority' => 'Medium', 'description' => 'I searched with the Tuobodom code but my plot is missing.',
    'status' => 'Open', 'submittedBy' => $registrar, 'tenant' => $tenant,
]);

echo "Demo content created: " . count($parcelIds) . " parcels, documents, payments, surveys, 1 transfer, 1 edit request, 2 verification codes.\n";
