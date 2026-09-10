<?php
/** @var array $parcels @var array $meta @var array $counts @var array $statuses
 *  @var array $areaCouncils @var array $filters */
$q = $_GET;
?>
<div class="page-head">
    <div>
        <h1>Land Parcels</h1>
        <p class="lead"><?= number_format($meta['total']) ?> record<?= $meta['total'] === 1 ? '' : 's' ?> in <?= e($GLOBALS['tenant']['name'] ?? 'the platform') ?></p>
    </div>
    <div class="d-flex gap-2 flex-wrap">
        <a href="<?= url('/parcels/export?' . http_build_query($q)) ?>" class="btn btn-outline-secondary"><i class="bi bi-download me-1"></i>Export CSV</a>
        <?php if ($GLOBALS['auth']->is('admin', 'super_admin', 'registrar')): ?>
            <a href="<?= url('/parcels/import') ?>" class="btn btn-outline-secondary"><i class="bi bi-upload me-1"></i>Import</a>
        <?php endif; ?>
        <a href="<?= url('/parcels/new') ?>" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Register land</a>
    </div>
</div>

<div class="d-flex flex-wrap gap-2 mb-3">
    <a href="<?= url('/parcels') ?>" class="btn btn-sm <?= empty($filters['status']) ? 'btn-primary' : 'btn-outline-secondary' ?>">
        All <span class="badge text-bg-light ms-1"><?= array_sum($counts) ?></span>
    </a>
    <?php foreach ($statuses as $st): ?>
        <a href="<?= url('/parcels?status=' . $st) ?>" class="btn btn-sm <?= ($filters['status'] ?? '') === $st ? 'btn-primary' : 'btn-outline-secondary' ?>">
            <?= e(humanize($st)) ?> <span class="badge text-bg-light ms-1"><?= $counts[$st] ?></span>
        </a>
    <?php endforeach; ?>
</div>

<div class="card">
    <div class="card-body pb-0">
        <form class="row g-2 align-items-end mb-3" data-autosubmit>
            <?php if (!empty($filters['status'])): ?><input type="hidden" name="status" value="<?= e($filters['status']) ?>"><?php endif; ?>
            <div class="col-sm-5">
                <label class="form-label small">Search</label>
                <input name="q" value="<?= e($_GET['q'] ?? '') ?>" class="form-control form-control-sm" placeholder="Parcel #, name, phone, plot…">
            </div>
            <div class="col-sm-4">
                <label class="form-label small">Area council</label>
                <select name="areaCouncil" class="form-select form-select-sm">
                    <option value="">All</option>
                    <?php foreach ($areaCouncils as $ac): ?>
                        <option value="<?= e($ac['name']) ?>" <?= ($_GET['areaCouncil'] ?? '') === $ac['name'] ? 'selected' : '' ?>><?= e($ac['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="col-sm-3">
                <button class="btn btn-sm btn-primary w-100">Filter</button>
            </div>
        </form>
    </div>

    <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
            <thead>
            <tr>
                <th>Parcel #</th><th>Applicant</th><th>Location</th><th>Sector / Plot / Block</th><th>Status</th><th class="text-end">Registered</th>
            </tr>
            </thead>
            <tbody>
            <?php foreach ($parcels as $p): ?>
                <tr data-href="<?= url('/parcels/' . $p['id']) ?>">
                    <td class="fw-semibold"><?= e($p['parcelNumber']) ?></td>
                    <td><?= e($p['applicantName']) ?><div class="small text-secondary"><?= e($p['contactPhone']) ?></div></td>
                    <td><?= e($p['community']) ?><div class="small text-secondary"><?= e($p['areaCouncil']) ?></div></td>
                    <td class="small"><?= e(trim(($p['sector'] ?? '—') . ' / ' . ($p['plotNumber'] ?? '—') . ' / ' . ($p['block'] ?? '—'), ' /')) ?></td>
                    <td><?= status_badge($p['status']) ?></td>
                    <td class="text-end small text-secondary"><?= $p['registrationDate'] ? fmt_date($p['registrationDate']) : '—' ?></td>
                </tr>
            <?php endforeach; ?>
            <?php if (!$parcels): ?>
                <tr><td colspan="6">
                    <div class="empty-state">
                        <i class="bi bi-map"></i>
                        <p class="mt-2 mb-0">No parcels match your filters.</p>
                        <a href="<?= url('/parcels/new') ?>" class="btn btn-sm btn-primary mt-2">Register the first parcel</a>
                    </div>
                </td></tr>
            <?php endif; ?>
            </tbody>
        </table>
    </div>
    <div class="card-body pt-2">
        <?= view('partials/pagination', ['meta' => $meta]) ?>
    </div>
</div>
