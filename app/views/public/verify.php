<?php /** @var array|null $result */ ?>
<?php require __DIR__ . '/../partials/public_nav.php'; ?>

<main class="container py-5" style="max-width:820px">
    <h1 class="h3">Verify a land record</h1>
    <p class="text-secondary">Enter the verification code issued for your community to view the registered parcels on file.</p>

    <?php foreach (\App\Flash::pull() as $f): ?>
        <div class="alert alert-<?= e($f['type']) ?>"><?= e($f['message']) ?></div>
    <?php endforeach; ?>

    <form method="post" action="<?= url('/verify') ?>" class="card card-body flex-row gap-2 align-items-end flex-wrap">
        <?= csrf_field() ?>
        <div class="flex-grow-1">
            <label class="form-label">Verification code</label>
            <input name="code" class="form-control form-control-lg text-uppercase" placeholder="e.g. TUOBODOM-2026" required autofocus>
        </div>
        <button class="btn btn-primary btn-lg"><i class="bi bi-shield-check me-2"></i>Verify</button>
    </form>

    <?php if ($result && !$result['ok'] && $result['message']): ?>
        <div class="alert alert-warning mt-4"><i class="bi bi-exclamation-triangle me-2"></i><?= e($result['message']) ?></div>
    <?php endif; ?>

    <?php if ($result && $result['ok']): ?>
        <div class="alert alert-success mt-4"><i class="bi bi-check-circle me-2"></i>Code verified. <?= count($result['parcels']) ?> registered parcel(s) found.</div>
        <?php if ($result['parcels']): ?>
            <div class="table-responsive">
                <table class="table table-sm align-middle">
                    <thead><tr><th>Parcel #</th><th>Owner</th><th>Community</th><th>Sector / Plot / Block</th><th>Registered</th></tr></thead>
                    <tbody>
                    <?php foreach ($result['parcels'] as $p): ?>
                        <tr>
                            <td class="fw-semibold"><?= e($p['parcelNumber']) ?></td>
                            <td><?= e($p['applicantName']) ?></td>
                            <td><?= e($p['community']) ?></td>
                            <td><?= e(trim(($p['sector'] ?? '') . ' / ' . ($p['plotNumber'] ?? '') . ' / ' . ($p['block'] ?? ''), ' /')) ?></td>
                            <td><?= fmt_date($p['registrationDate']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    <?php endif; ?>
</main>
