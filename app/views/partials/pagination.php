<?php
/** @var array $meta  from paginate() */
if (($meta['pages'] ?? 1) <= 1 && ($meta['total'] ?? 0) <= ($meta['perPage'] ?? 25)) {
    if (($meta['total'] ?? 0) > 0) {
        echo '<div class="text-secondary small mt-2">' . (int) $meta['total'] . ' record' . ($meta['total'] === 1 ? '' : 's') . '</div>';
    }
    return;
}
$qs = $_GET;
$link = static function (int $p) use ($qs) {
    $qs['page'] = $p;
    return '?' . http_build_query($qs);
};
$page = $meta['page'];
$pages = $meta['pages'];
$start = max(1, $page - 2);
$end = min($pages, $start + 4);
$start = max(1, $end - 4);
?>
<nav class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
    <span class="text-secondary small">
        Showing <?= (int) $meta['from'] ?>–<?= (int) $meta['to'] ?> of <?= (int) $meta['total'] ?>
    </span>
    <ul class="pagination pagination-sm mb-0">
        <li class="page-item <?= $page <= 1 ? 'disabled' : '' ?>">
            <a class="page-link" href="<?= e($link(max(1, $page - 1))) ?>">Prev</a>
        </li>
        <?php if ($start > 1): ?>
            <li class="page-item"><a class="page-link" href="<?= e($link(1)) ?>">1</a></li>
            <?php if ($start > 2): ?><li class="page-item disabled"><span class="page-link">…</span></li><?php endif; ?>
        <?php endif; ?>
        <?php for ($i = $start; $i <= $end; $i++): ?>
            <li class="page-item <?= $i === $page ? 'active' : '' ?>">
                <a class="page-link" href="<?= e($link($i)) ?>"><?= $i ?></a>
            </li>
        <?php endfor; ?>
        <?php if ($end < $pages): ?>
            <?php if ($end < $pages - 1): ?><li class="page-item disabled"><span class="page-link">…</span></li><?php endif; ?>
            <li class="page-item"><a class="page-link" href="<?= e($link($pages)) ?>"><?= $pages ?></a></li>
        <?php endif; ?>
        <li class="page-item <?= $page >= $pages ? 'disabled' : '' ?>">
            <a class="page-link" href="<?= e($link(min($pages, $page + 1))) ?>">Next</a>
        </li>
    </ul>
</nav>
