<?php $b = $GLOBALS['branding']; ?>
<div class="auth-wrap">
    <div class="auth-card">
        <div class="text-center text-white mb-4">
            <div class="d-inline-grid" style="width:52px;height:52px;place-items:center;background:rgba(255,255,255,.15);border-radius:12px;font-size:1.5rem">
                <i class="bi bi-geo-alt-fill"></i>
            </div>
            <h1 class="h4 mt-3 mb-0"><?= e($b['portalName'] ?? 'Land Registry') ?></h1>
            <p class="opacity-75 small mb-0"><?= e($b['tagline'] ?? 'Land Registry System') ?></p>
        </div>
        <div class="card">
            <div class="card-body p-4">
                <h2 class="h5 mb-3">Staff sign in</h2>
                <?php foreach (\App\Flash::pull() as $f): ?>
                    <div class="alert alert-<?= e($f['type']) ?> py-2 small"><?= e($f['message']) ?></div>
                <?php endforeach; ?>
                <form method="post" action="<?= url('/login') ?>" novalidate>
                    <?= csrf_field() ?>
                    <div class="mb-3">
                        <label class="form-label">Email address</label>
                        <input type="email" name="email" class="form-control" required autofocus
                               value="<?= old('email') ?>" placeholder="you@assembly.gov.gh">
                    </div>
                    <div class="mb-3">
                        <label class="form-label d-flex justify-content-between">
                            <span>Password</span>
                            <a href="<?= url('/forgot-password') ?>" class="small text-decoration-none">Forgot?</a>
                        </label>
                        <input type="password" name="password" class="form-control" required placeholder="••••••••••">
                    </div>
                    <button class="btn btn-primary w-100">Sign in</button>
                </form>
            </div>
        </div>
        <p class="text-center text-white-50 small mt-3 mb-0">
            <a href="<?= url('/verify') ?>" class="link-light">Verify a land record</a>
            &nbsp;·&nbsp;
            <a href="<?= url('/') ?>" class="link-light">Public site</a>
        </p>
    </div>
</div>
