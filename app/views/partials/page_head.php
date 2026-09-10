<?php
/** @var string $heading  @var string|null $sub  @var string|null $actions (HTML) */
?>
<div class="page-head">
    <div>
        <h1><?= e($heading ?? '') ?></h1>
        <?php if (!empty($sub)): ?><p class="lead"><?= e($sub) ?></p><?php endif; ?>
    </div>
    <?php if (!empty($actions)): ?>
        <div class="d-flex gap-2 flex-wrap"><?= $actions ?></div>
    <?php endif; ?>
</div>
