<?php
/** @var array $stats @var array $statusMap @var array $monthly @var float $revenue @var float $revenueMonth
 *  @var array $recentParcels @var array $recentActivity @var array $myApprovals */
$user = $GLOBALS['user'];
$chartLabels = array_map(fn ($m) => date('M', strtotime($m['m'] . '-01')), $monthly);
$chartData = array_map(fn ($m) => (int) $m['c'], $monthly);
$statusOrder = ['draft', 'submitted', 'under_survey', 'under_review', 'registered', 'disputed', 'rejected'];
?>

<div class="page-head">
    <div>
        <h1>Welcome, <?= e($user['firstName'] ?: $user['name'] ?: 'there') ?></h1>
        <p class="lead"><?= e($GLOBALS['tenant']['name'] ?? 'Platform administration') ?> · <?= e(fmt_date(date('c'), 'l, d F Y')) ?></p>
    </div>
    <div class="d-flex gap-2">
        <a href="<?= url('/parcels/new') ?>" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Register land</a>
    </div>
</div>

<div class="row g-3 mb-4">
    <?php
    $tiles = [
        ['Registered parcels', number_format($stats['registered']), $stats['parcels'] . ' total', 'map', '/parcels?status=registered'],
        ['Pending review', number_format($stats['pendingReview']), $stats['pendingSurvey'] . ' awaiting survey', 'hourglass-split', '/parcels?status=under_review'],
        ['Transfers pending', number_format($stats['transfersPending']), $stats['editRequestsPending'] . ' edit requests', 'arrow-left-right', '/transfers?status=pending'],
        ['Revenue (paid)', fmt_money($revenue), fmt_money($revenueMonth) . ' this month', 'cash-coin', '/payments'],
    ];
    foreach ($tiles as [$label, $value, $sub, $icon, $href]): ?>
        <div class="col-6 col-xl-3">
            <a href="<?= url($href) ?>" class="text-decoration-none text-reset">
                <div class="stat-card">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="stat-label"><?= e($label) ?></div>
                        <i class="bi bi-<?= $icon ?> text-primary"></i>
                    </div>
                    <div class="stat-value"><?= e($value) ?></div>
                    <div class="stat-sub"><?= e($sub) ?></div>
                </div>
            </a>
        </div>
    <?php endforeach; ?>
</div>

<div class="row g-3">
    <div class="col-lg-8">
        <div class="card mb-3">
            <div class="card-body">
                <h2 class="h6 mb-3">Registrations — last 6 months</h2>
                <canvas id="regChart" height="90"></canvas>
            </div>
        </div>

        <div class="card">
            <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
                <h2 class="h6 mb-0">Recent parcels</h2>
                <a href="<?= url('/parcels') ?>" class="small">View all</a>
            </div>
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead><tr><th>Parcel #</th><th>Applicant</th><th>Community</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                    <?php foreach ($recentParcels as $p): ?>
                        <tr data-href="<?= url('/parcels/' . $p['id']) ?>">
                            <td class="fw-semibold"><?= e($p['parcelNumber']) ?></td>
                            <td><?= e($p['applicantName']) ?></td>
                            <td><?= e($p['community']) ?></td>
                            <td><?= status_badge($p['status']) ?></td>
                            <td class="text-end text-secondary small"><?= time_ago($p['created']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    <?php if (!$recentParcels): ?>
                        <tr><td colspan="5" class="text-center text-secondary py-4">No parcels registered yet.</td></tr>
                    <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="col-lg-4">
        <div class="card mb-3">
            <div class="card-body">
                <h2 class="h6 mb-3">Parcels by status</h2>
                <?php $maxCount = max(1, ...array_values($statusMap ?: [1])); ?>
                <?php foreach ($statusOrder as $s): $c = $statusMap[$s] ?? 0; ?>
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <span class="small text-secondary" style="width:110px"><?= e(humanize($s)) ?></span>
                        <div class="progress flex-grow-1" style="height:8px">
                            <div class="progress-bar bg-<?= status_class($s) ?>" style="width:<?= (int) round($c / $maxCount * 100) ?>%"></div>
                        </div>
                        <span class="small fw-semibold" style="width:32px;text-align:right"><?= $c ?></span>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <?php if ($myApprovals): ?>
            <div class="card mb-3">
                <div class="card-header bg-transparent d-flex justify-content-between">
                    <h2 class="h6 mb-0">Awaiting your approval</h2>
                    <a href="<?= url('/approvals') ?>" class="small">Inbox</a>
                </div>
                <ul class="list-group list-group-flush">
                    <?php foreach ($myApprovals as $a): ?>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <span class="badge text-bg-<?= $a['kind'] === 'transfer' ? 'info' : 'warning' ?>"><?= e(humanize($a['kind'])) ?></span>
                                <span class="small ms-1"><?= e(str_excerpt($a['reason'], 40) ?: humanize($a['type'])) ?></span>
                            </div>
                            <a class="small" href="<?= url(($a['kind'] === 'transfer' ? '/transfers/' : '/approvals/') . $a['id']) ?>">Open</a>
                        </li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>

        <div class="card">
            <div class="card-header bg-transparent"><h2 class="h6 mb-0">Recent activity</h2></div>
            <ul class="list-group list-group-flush small">
                <?php foreach ($recentActivity as $log): ?>
                    <li class="list-group-item">
                        <span class="text-secondary"><?= time_ago($log['created']) ?></span> —
                        <?= e(humanize($log['action'])) ?>
                        <?php if ($log['entity']): ?><span class="text-secondary"><?= e($log['entity']) ?></span><?php endif; ?>
                    </li>
                <?php endforeach; ?>
                <?php if (!$recentActivity): ?><li class="list-group-item text-secondary">Nothing yet.</li><?php endif; ?>
            </ul>
        </div>
    </div>
</div>

<?php push_script('
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
(function(){
  var el = document.getElementById("regChart"); if(!el || !window.Chart) return;
  var css = getComputedStyle(document.documentElement);
  new Chart(el, {
    type: "bar",
    data: { labels: ' . json_encode($chartLabels ?: ['—']) . ',
      datasets: [{ label: "Parcels", data: ' . json_encode($chartData ?: [0]) . ',
        backgroundColor: (css.getPropertyValue("--brand-accent") || "#2b5f8f").trim(), borderRadius: 4 }] },
    options: { plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, ticks:{precision:0} } } }
  });
})();
</script>'); ?>
