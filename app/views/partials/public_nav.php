<?php $b = $GLOBALS['branding']; ?>
<nav class="navbar navbar-expand-lg border-bottom" style="background:var(--brand-primary)" data-bs-theme="dark">
    <div class="container">
        <a class="navbar-brand d-flex align-items-center gap-2 fw-semibold" href="<?= url('/') ?>">
            <i class="bi bi-geo-alt-fill"></i><?= e($b['portalName'] ?? 'Land Registry') ?>
        </a>
        <button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#pubnav"><span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="pubnav">
            <ul class="navbar-nav ms-auto align-items-lg-center gap-lg-1">
                <li class="nav-item"><a class="nav-link" href="<?= url('/') ?>">Home</a></li>
                <li class="nav-item"><a class="nav-link" href="<?= url('/verify') ?>">Verify Land</a></li>
                <li class="nav-item"><a class="btn btn-light btn-sm ms-lg-2" href="<?= url('/login') ?>">Staff sign in</a></li>
            </ul>
        </div>
    </div>
</nav>
