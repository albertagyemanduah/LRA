<?php /** @var string $token */ ?>
<div class="auth-wrap">
    <div class="auth-card">
        <div class="card">
            <div class="card-body p-4">
                <h1 class="h5 mb-3">Choose a new password</h1>
                <?php foreach (\App\Flash::pull() as $f): ?>
                    <div class="alert alert-<?= e($f['type']) ?> py-2 small"><?= e($f['message']) ?></div>
                <?php endforeach; ?>
                <form method="post" action="<?= url('/reset-password') ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="token" value="<?= e($token) ?>">
                    <div class="mb-3">
                        <label class="form-label">New password</label>
                        <input type="password" name="password" class="form-control" required minlength="10" autofocus>
                        <div class="form-text">At least 10 characters.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Confirm new password</label>
                        <input type="password" name="password_confirm" class="form-control" required minlength="10">
                    </div>
                    <button class="btn btn-primary w-100">Update password</button>
                </form>
            </div>
        </div>
    </div>
</div>
