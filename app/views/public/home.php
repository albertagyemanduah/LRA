<?php /** @var array $stats @var array $news */ $b = $GLOBALS['branding']; ?>
<?php require __DIR__ . '/../partials/public_nav.php'; ?>

<header class="py-5" style="background:linear-gradient(135deg,var(--brand-primary),#0d2135);color:#fff">
    <div class="container py-4">
        <div class="row align-items-center g-4">
            <div class="col-lg-7">
                <h1 class="display-6 fw-bold"><?= e($b['portalName'] ?? 'Land Registry') ?></h1>
                <p class="lead opacity-90"><?= e($b['tagline'] ?? 'A transparent, digital record of land ownership.') ?></p>
                <div class="d-flex gap-2 flex-wrap mt-3">
                    <a href="<?= url('/verify') ?>" class="btn btn-light btn-lg"><i class="bi bi-shield-check me-2"></i>Verify a land record</a>
                    <a href="<?= url('/login') ?>" class="btn btn-outline-light btn-lg">Staff sign in</a>
                </div>
            </div>
            <div class="col-lg-5">
                <div class="row g-3">
                    <?php foreach ([
                        ['Registered parcels', $stats['parcels'], 'map'],
                        ['Land transfers', $stats['transfers'], 'arrow-left-right'],
                        ['Active officers', $stats['officers'], 'people'],
                        ['Area councils', $stats['councils'], 'diagram-3'],
                    ] as [$label, $value, $icon]): ?>
                        <div class="col-6">
                            <div class="bg-white bg-opacity-10 rounded-3 p-3">
                                <i class="bi bi-<?= $icon ?> fs-4 opacity-75"></i>
                                <div class="fs-3 fw-bold"><?= $value === null ? '—' : number_format((int) $value) ?></div>
                                <div class="small opacity-75"><?= e($label) ?></div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>
</header>

<main class="container py-5">
    <div class="row g-4">
        <div class="col-md-4">
            <i class="bi bi-search fs-3 text-primary"></i>
            <h3 class="h5 mt-2">Search &amp; verify</h3>
            <p class="text-secondary">Confirm the status and ownership of any registered parcel using a community verification code — no account needed.</p>
        </div>
        <div class="col-md-4">
            <i class="bi bi-file-earmark-check fs-3 text-primary"></i>
            <h3 class="h5 mt-2">Register land</h3>
            <p class="text-secondary">Assembly staff capture parcels, owners and supporting documents, then move each record through survey, review and registration.</p>
        </div>
        <div class="col-md-4">
            <i class="bi bi-arrow-left-right fs-3 text-primary"></i>
            <h3 class="h5 mt-2">Transfer ownership</h3>
            <p class="text-secondary">Ownership changes follow an approval workflow with a full history and notifications to all parties.</p>
        </div>
    </div>

    <?php if (!empty($news)): ?>
        <hr class="my-5">
        <h2 class="h4 mb-3">Latest news</h2>
        <div class="row g-3">
            <?php foreach ($news as $post): ?>
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="small text-secondary"><?= fmt_date($post['publishedAt'] ?: $post['created']) ?></div>
                            <h3 class="h6 mt-1"><?= e($post['title']) ?></h3>
                            <p class="small text-secondary mb-0"><?= e(str_excerpt($post['excerpt'], 120)) ?></p>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</main>

<footer class="border-top py-4 text-center text-secondary small">
    <div class="container">
        &copy; <?= date('Y') ?> <?= e($b['portalName'] ?? 'Land Registry') ?>.
        <?php if (!empty($b['supportEmail'])): ?> · <a href="mailto:<?= e($b['supportEmail']) ?>"><?= e($b['supportEmail']) ?></a><?php endif; ?>
    </div>
</footer>
