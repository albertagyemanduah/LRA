<?php
/** @var int $code @var string $message @var string $title */
$loggedIn = !empty($GLOBALS['user']);
?>
<div class="<?= $loggedIn ? '' : 'auth-wrap' ?>">
    <div class="text-center <?= $loggedIn ? 'py-5' : '' ?>" style="max-width:480px;margin:0 auto;<?= $loggedIn ? '' : 'color:#fff' ?>">
        <div style="font-size:3.5rem;font-weight:800;opacity:.5"><?= e((string) ($code ?? 500)) ?></div>
        <h1 class="h4 mt-2"><?= e($title ?? 'Error') ?></h1>
        <p class="<?= $loggedIn ? 'text-secondary' : '' ?>"><?= e($message ?? '') ?></p>
        <a href="<?= url($loggedIn ? '/dashboard' : '/login') ?>" class="btn btn-<?= $loggedIn ? 'primary' : 'light' ?> mt-2">
            <i class="bi bi-arrow-left me-1"></i><?= $loggedIn ? 'Back to dashboard' : 'Go to sign in' ?>
        </a>
    </div>
</div>
