<div class="auth-wrap">
    <div class="auth-card">
        <div class="card">
            <div class="card-body p-4">
                <h1 class="h5 mb-1">Reset your password</h1>
                <p class="text-secondary small">Enter your email and we'll send you a link to choose a new password.</p>
                <?php foreach (\App\Flash::pull() as $f): ?>
                    <div class="alert alert-<?= e($f['type']) ?> py-2 small"><?= e($f['message']) ?></div>
                <?php endforeach; ?>
                <form method="post" action="<?= url('/forgot-password') ?>">
                    <?= csrf_field() ?>
                    <div class="mb-3">
                        <label class="form-label">Email address</label>
                        <input type="email" name="email" class="form-control" required autofocus>
                    </div>
                    <button class="btn btn-primary w-100">Send reset link</button>
                </form>
                <p class="text-center small mt-3 mb-0"><a href="<?= url('/login') ?>">Back to sign in</a></p>
            </div>
        </div>
    </div>
</div>
