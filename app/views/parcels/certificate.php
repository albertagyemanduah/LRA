<?php
/** @var array $parcel @var ?array $owner @var array $branding @var ?array $tenant */
$portal = $branding['portalName'] ?? 'Land Registry';
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Certificate — <?= e($parcel['parcelNumber']) ?></title>
<style>
    @page { size: A4; margin: 18mm; }
    body { font-family: "Times New Roman", Georgia, serif; color:#1a1a1a; }
    .sheet { border:6px double #1c3d5a; padding:36px 44px; }
    h1 { text-align:center; letter-spacing:2px; font-size:22px; margin:0 0 4px; color:#1c3d5a; }
    .sub { text-align:center; color:#555; margin-bottom:28px; }
    .crest { text-align:center; font-size:34px; color:#1c3d5a; }
    table { width:100%; border-collapse:collapse; margin:18px 0; }
    td { padding:8px 6px; border-bottom:1px solid #ccc; font-size:14px; }
    td.k { width:38%; color:#555; text-transform:uppercase; font-size:11px; letter-spacing:1px; }
    .sig { display:flex; justify-content:space-between; margin-top:60px; }
    .sig div { width:40%; border-top:1px solid #333; text-align:center; padding-top:6px; font-size:12px; }
    .no { text-align:center; color:#777; font-size:12px; margin-top:8px; }
    @media screen { body { background:#eee; } .sheet { max-width:800px; margin:24px auto; background:#fff; } .print-btn{position:fixed;top:12px;right:12px} }
    @media print { .print-btn { display:none; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print / Save PDF</button>
<div class="sheet">
    <div class="crest">&#9733;</div>
    <h1><?= e($tenant['name'] ?? $portal) ?></h1>
    <div class="sub"><?= e($branding['tagline'] ?? 'Land Registry') ?><br>Republic of Ghana</div>

    <h2 style="text-align:center;font-size:16px;letter-spacing:1px">CERTIFICATE OF LAND REGISTRATION</h2>
    <p style="text-align:center">This is to certify that the parcel of land described below has been
        duly registered in the records of this Assembly.</p>

    <table>
        <tr><td class="k">Parcel Number</td><td><strong><?= e($parcel['parcelNumber']) ?></strong></td></tr>
        <tr><td class="k">Registered Owner</td><td><?= e($parcel['applicantName']) ?></td></tr>
        <?php if (!empty($owner['ghanaCard'])): ?><tr><td class="k">Ghana Card</td><td><?= e($owner['ghanaCard']) ?></td></tr><?php endif; ?>
        <tr><td class="k">Area Council</td><td><?= e($parcel['areaCouncil'] ?: '—') ?></td></tr>
        <tr><td class="k">Community</td><td><?= e($parcel['community'] ?: '—') ?></td></tr>
        <tr><td class="k">Sector / Plot / Block</td><td><?= e(trim(($parcel['sector'] ?? '—') . ' / ' . ($parcel['plotNumber'] ?? '—') . ' / ' . ($parcel['block'] ?? '—'), ' /')) ?></td></tr>
        <tr><td class="k">Allocation Date</td><td><?= $parcel['allocationDate'] ? fmt_date($parcel['allocationDate']) : '—' ?></td></tr>
        <tr><td class="k">Registration Date</td><td><?= fmt_date($parcel['registrationDate'] ?: $parcel['updated']) ?></td></tr>
    </table>

    <div class="sig">
        <div>Registrar</div>
        <div>Coordinating Director</div>
    </div>
    <div class="no">Certificate generated <?= fmt_datetime(date('c')) ?> · Verify at <?= e($_SERVER['HTTP_HOST'] ?? '') ?><?= e(url('/verify')) ?></div>
</div>
</body>
</html>
