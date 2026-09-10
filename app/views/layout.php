<?php
/** @var string $content */
/** @var string|null $title */
/** @var array $breadcrumb */
$cfg      = $GLOBALS['config'];
$user     = $GLOBALS['user'] ?? null;
$branding = $GLOBALS['branding'] ?? [];
$tenant   = $GLOBALS['tenant'] ?? null;
$auth     = $GLOBALS['auth'];
$primary  = \App\Branding::css($branding['primaryColor'] ?? '210 55% 22%');
$accent   = \App\Branding::css($branding['accentColor'] ?? '210 60% 38%');
$portal   = $branding['portalName'] ?? $cfg['app_name'];
$pageTitle = $title ?? null;

$unread = 0;
if ($user) {
    try {
        $unread = (int) db_value('SELECT COUNT(*) FROM `notifications` WHERE `user` = ? AND `read` = 0', [$user['id']]);
    } catch (\Throwable) {
    }
}

/** Nav definition: [label, icon, path, roles|null] */
$nav = [
    ['Dashboard', 'speedometer2', '/dashboard', null],
    ['Land Parcels', 'map', '/parcels', null],
    ['Transfers', 'arrow-left-right', '/transfers', null],
    ['Approvals', 'inboxes', '/approvals', ['planning_officer', 'admin', 'super_admin']],
    ['Surveys', 'rulers', '/surveys', ['survey_officer', 'admin', 'super_admin', 'planning_officer']],
    ['Documents', 'folder2-open', '/documents', null],
    ['Payments', 'cash-coin', '/payments', ['finance_officer', 'admin', 'super_admin']],
    ['Verification Codes', 'shield-check', '/verification-codes', ['admin', 'super_admin', 'registrar']],
    ['Reports', 'graph-up', '/reports', ['admin', 'super_admin', 'finance_officer', 'planning_officer']],
    ['News', 'newspaper', '/news', ['admin', 'super_admin']],
    ['Tickets', 'life-preserver', '/tickets', null],
    ['Staff Chat', 'chat-dots', '/chat', null],
    ['SMS', 'phone', '/sms', ['admin', 'super_admin']],
    ['Staff', 'people', '/users', ['admin', 'super_admin']],
    ['Structure', 'diagram-3', '/structure', ['admin', 'super_admin']],
    ['Audit Log', 'clipboard-data', '/audit', ['admin', 'super_admin']],
    ['Workspace Settings', 'sliders', '/settings', ['admin', 'super_admin']],
    ['Platform Console', 'buildings', '/platform', ['super_admin']],
];
?>
<!doctype html>
<html lang="en" data-bs-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($pageTitle ? "$pageTitle · $portal" : $portal) ?></title>
    <link rel="icon" href="<?= asset('img/favicon.svg') ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="<?= asset('css/app.css') ?>">
    <style>
        :root{
            --brand-primary: <?= $primary ?>;
            --brand-accent: <?= $accent ?>;
            --bs-primary: <?= $primary ?>;
            --bs-primary-rgb: 28,61,90;
            --bs-link-color: <?= $accent ?>;
            --bs-link-hover-color: <?= $primary ?>;
        }
        .btn-primary{--bs-btn-bg:var(--brand-primary);--bs-btn-border-color:var(--brand-primary);--bs-btn-hover-bg:var(--brand-accent);--bs-btn-hover-border-color:var(--brand-accent);--bs-btn-active-bg:var(--brand-accent);}
        .text-primary{color:var(--brand-primary)!important;}
        .app-sidebar{background:linear-gradient(180deg,var(--brand-primary),color-mix(in srgb,var(--brand-primary) 78%, #000));}
    </style>
</head>
<body>
<?php if (!$user): ?>
    <?= $content ?>
<?php else: ?>
<div class="app-shell">
    <aside class="app-sidebar" id="appSidebar">
        <div class="app-brand">
            <?php if (!empty($branding['logo']) && $tenant): ?>
                <img src="<?= e(upload_url('tenant_branding', $branding['id'] ?? '', $branding['logo'])) ?>" alt="">
            <?php else: ?>
                <span class="app-brand-mark"><i class="bi bi-geo-alt-fill"></i></span>
            <?php endif; ?>
            <span class="app-brand-name"><?= e($portal) ?></span>
        </div>
        <nav class="app-nav">
            <?php foreach ($nav as [$label, $icon, $path, $roles]): ?>
                <?php if ($roles !== null && !$auth->is(...$roles)) {
                    continue;
                } ?>
                <a href="<?= url($path) ?>" class="app-nav-link <?= nav_active($path) ?>">
                    <i class="bi bi-<?= $icon ?>"></i><span><?= e($label) ?></span>
                </a>
            <?php endforeach; ?>
        </nav>
        <div class="app-sidebar-foot">
            <small><?= e($tenant['name'] ?? 'Platform') ?></small>
        </div>
    </aside>

    <div class="app-main">
        <header class="app-topbar">
            <button class="btn btn-sm btn-light d-lg-none" id="sidebarToggle" aria-label="Menu">
                <i class="bi bi-list"></i>
            </button>
            <div class="app-topbar-title"><?= e($pageTitle ?? 'Dashboard') ?></div>
            <div class="app-topbar-actions">
                <button class="btn btn-sm btn-light" id="themeToggle" title="Toggle theme">
                    <i class="bi bi-moon-stars"></i>
                </button>
                <a href="<?= url('/notifications') ?>" class="btn btn-sm btn-light position-relative" title="Notifications">
                    <i class="bi bi-bell"></i>
                    <?php if ($unread): ?>
                        <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger" id="notifCount"><?= $unread > 99 ? '99+' : $unread ?></span>
                    <?php endif; ?>
                </a>
                <div class="dropdown">
                    <button class="btn btn-sm btn-light dropdown-toggle" data-bs-toggle="dropdown">
                        <i class="bi bi-person-circle"></i>
                        <span class="d-none d-md-inline"><?= e($user['firstName'] ?: $user['name'] ?: $user['email']) ?></span>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><span class="dropdown-header"><?= e($user['email']) ?><br><span class="badge text-bg-secondary"><?= e(humanize($user['role'])) ?></span></span></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="<?= url('/profile') ?>"><i class="bi bi-person me-2"></i>My profile</a></li>
                        <li><a class="dropdown-item" href="<?= url('/notifications/preferences') ?>"><i class="bi bi-gear me-2"></i>Notification settings</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <form method="post" action="<?= url('/logout') ?>">
                                <?= csrf_field() ?>
                                <button class="dropdown-item text-danger"><i class="bi bi-box-arrow-right me-2"></i>Sign out</button>
                            </form>
                        </li>
                    </ul>
                </div>
            </div>
        </header>

        <main class="app-content">
            <?php if (!empty($breadcrumb)): ?>
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb small">
                        <?php foreach ($breadcrumb as $label => $href): ?>
                            <?php if (is_int($label)): ?>
                                <li class="breadcrumb-item active"><?= e($href) ?></li>
                            <?php else: ?>
                                <li class="breadcrumb-item"><a href="<?= e(url($href)) ?>"><?= e($label) ?></a></li>
                            <?php endif; ?>
                        <?php endforeach; ?>
                    </ol>
                </nav>
            <?php endif; ?>

            <?php foreach (\App\Flash::pull() as $f): ?>
                <div class="alert alert-<?= e($f['type']) ?> alert-dismissible fade show" role="alert">
                    <?= e($f['message']) ?>
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            <?php endforeach; ?>

            <?= $content ?>
        </main>
    </div>
</div>
<?php endif; ?>

<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js"></script>
<script src="<?= asset('js/app.js') ?>"></script>
<?= page_scripts() ?>
</body>
</html>
<?php unset($_SESSION['_errors']); clear_old(); ?>
