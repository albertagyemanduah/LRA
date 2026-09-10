<?php
$errs = $_SESSION['_errors'] ?? [];
if (!$errs) {
    return;
}
?>
<div class="alert alert-danger">
    <strong>Please fix the following:</strong>
    <ul class="mb-0 mt-1">
        <?php foreach ($errs as $msg): ?><li><?= e($msg) ?></li><?php endforeach; ?>
    </ul>
</div>
