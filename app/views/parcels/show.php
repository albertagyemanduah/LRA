<?php
/** @var array $parcel @var ?array $owner @var array $documents @var array $surveys
 *  @var array $transfers @var array $payments @var array $editRequests @var array $timeline
 *  @var array $statuses @var array $transitions @var bool $canEdit */
$auth = $GLOBALS['auth'];
$statusFlow = ['draft', 'submitted', 'under_survey', 'under_review', 'registered'];
$curIdx = array_search($parcel['status'], $statusFlow, true);
?>
<div class="page-head">
    <div>
        <h1><?= e($parcel['parcelNumber']) ?> <?= status_badge($parcel['status']) ?></h1>
        <p class="lead"><?= e($parcel['applicantName']) ?> · <?= e($parcel['community']) ?><?= $parcel['areaCouncil'] ? ', ' . e($parcel['areaCouncil']) : '' ?></p>
    </div>
    <div class="d-flex gap-2 flex-wrap">
        <?php if ($parcel['status'] === 'registered'): ?>
            <a href="<?= url('/parcels/' . $parcel['id'] . '/certificate') ?>" target="_blank" class="btn btn-outline-secondary"><i class="bi bi-award me-1"></i>Certificate</a>
        <?php endif; ?>
        <?php if ($canEdit): ?>
            <a href="<?= url('/parcels/' . $parcel['id'] . '/edit') ?>" class="btn btn-outline-secondary"><i class="bi bi-pencil me-1"></i>Edit</a>
        <?php endif; ?>
        <a href="<?= url('/transfers/new?parcel=' . $parcel['id']) ?>" class="btn btn-outline-secondary"><i class="bi bi-arrow-left-right me-1"></i>Transfer</a>
        <?php if ($auth->isAdmin()): ?>
            <form method="post" action="<?= url('/parcels/' . $parcel['id'] . '/delete') ?>" data-confirm="Delete this parcel permanently?">
                <?= csrf_field() ?>
                <button class="btn btn-outline-danger"><i class="bi bi-trash me-1"></i>Delete</button>
            </form>
        <?php endif; ?>
    </div>
</div>

<!-- Workflow bar -->
<div class="card mb-3">
    <div class="card-body">
        <div class="workflow-steps mb-3">
            <?php foreach ($statusFlow as $i => $st): ?>
                <span class="step <?= $parcel['status'] === $st ? 'current' : ($curIdx !== false && $i < $curIdx ? 'done' : '') ?>"><?= e(humanize($st)) ?></span>
                <?php if ($i < count($statusFlow) - 1): ?><span class="text-secondary">→</span><?php endif; ?>
            <?php endforeach; ?>
            <?php if (in_array($parcel['status'], ['rejected', 'disputed'], true)): ?>
                <span class="step current"><?= e(humanize($parcel['status'])) ?></span>
            <?php endif; ?>
        </div>
        <?php if ($transitions): ?>
            <form method="post" action="<?= url('/parcels/' . $parcel['id'] . '/status') ?>" class="row g-2 align-items-end">
                <?= csrf_field() ?>
                <div class="col-sm-4">
                    <label class="form-label small">Move to</label>
                    <select name="action" class="form-select form-select-sm">
                        <?php foreach ($transitions as $act => $meta): ?>
                            <option value="<?= e($act) ?>"><?= e($meta['label']) ?> → <?= e(humanize($meta['to'])) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-sm-6">
                    <label class="form-label small">Note (optional)</label>
                    <input name="note" class="form-control form-control-sm" placeholder="Reason / comment">
                </div>
                <div class="col-sm-2">
                    <button class="btn btn-sm btn-primary w-100">Apply</button>
                </div>
            </form>
        <?php else: ?>
            <p class="text-secondary small mb-0">No status changes available to your role from “<?= e(humanize($parcel['status'])) ?>”.</p>
        <?php endif; ?>
    </div>
</div>

<div class="row g-3">
    <div class="col-lg-5">
        <div class="card mb-3">
            <div class="card-header bg-transparent fw-semibold">Parcel details</div>
            <div class="card-body">
                <dl class="detail-list row mb-0">
                    <?php
                    $fields = [
                        'Applicant' => $parcel['applicantName'],
                        'Phone' => $parcel['contactPhone'],
                        'Alt. mobile' => $parcel['alternateMobile'],
                        'WhatsApp' => $parcel['whatsapp'],
                        'Email' => $parcel['applicantEmail'],
                        'Ghana Card' => $owner['ghanaCard'] ?? null,
                        'Religion' => $parcel['religion'],
                        'Tribe' => $parcel['tribe'],
                        'Area council' => $parcel['areaCouncil'],
                        'Community' => $parcel['community'],
                        'Sector' => $parcel['sector'],
                        'Plot number' => $parcel['plotNumber'],
                        'Block' => $parcel['block'],
                        'Allocation date' => $parcel['allocationDate'] ? fmt_date($parcel['allocationDate']) : null,
                        'Registration date' => $parcel['registrationDate'] ? fmt_date($parcel['registrationDate']) : null,
                        'Created' => fmt_datetime($parcel['created']),
                    ];
                    foreach ($fields as $label => $value): ?>
                        <dt class="col-5"><?= e($label) ?></dt>
                        <dd class="col-7"><?= $value ? e($value) : '<span class="text-secondary">—</span>' ?></dd>
                    <?php endforeach; ?>
                </dl>
            </div>
            <?php if (!$canEdit): ?>
                <div class="card-footer bg-transparent">
                    <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="collapse" data-bs-target="#changeReq">
                        <i class="bi bi-pencil-square me-1"></i>Request a change
                    </button>
                    <div class="collapse mt-2" id="changeReq">
                        <form method="post" action="<?= url('/parcels/' . $parcel['id'] . '/request-change') ?>">
                            <?= csrf_field() ?>
                            <div class="mb-2">
                                <select name="type" class="form-select form-select-sm">
                                    <option value="edit">Edit request</option>
                                    <option value="delete">Deletion request</option>
                                </select>
                            </div>
                            <input name="proposed_applicantName" class="form-control form-control-sm mb-2" placeholder="Proposed applicant name (optional)">
                            <input name="proposed_contactPhone" class="form-control form-control-sm mb-2" placeholder="Proposed phone (optional)">
                            <textarea name="reason" class="form-control form-control-sm mb-2" rows="2" placeholder="Reason for the change *" required></textarea>
                            <button class="btn btn-sm btn-primary">Submit request</button>
                        </form>
                    </div>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <div class="col-lg-7">
        <ul class="nav nav-tabs" role="tablist">
            <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-docs">Documents <span class="badge text-bg-secondary"><?= count($documents) ?></span></button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-surveys">Surveys <span class="badge text-bg-secondary"><?= count($surveys) ?></span></button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-transfers">Transfers <span class="badge text-bg-secondary"><?= count($transfers) ?></span></button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-payments">Payments <span class="badge text-bg-secondary"><?= count($payments) ?></span></button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-history">History</button></li>
        </ul>
        <div class="tab-content border border-top-0 rounded-bottom p-3 bg-body">
            <div class="tab-pane fade show active" id="tab-docs">
                <a href="<?= url('/documents/new?parcel=' . $parcel['id']) ?>" class="btn btn-sm btn-primary mb-2"><i class="bi bi-plus-lg me-1"></i>Attach document</a>
                <?php if ($documents): ?>
                    <div class="list-group">
                        <?php foreach ($documents as $d): ?>
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <i class="bi bi-file-earmark-text me-1"></i><?= e($d['title']) ?>
                                    <span class="badge text-bg-light ms-1"><?= e(humanize($d['docType'])) ?></span>
                                    <?= status_badge($d['status']) ?>
                                </div>
                                <?php if ($d['file']): ?>
                                    <a class="btn btn-sm btn-outline-secondary" href="<?= url('/documents/' . $d['id'] . '/download') ?>"><i class="bi bi-download"></i></a>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php else: ?><p class="text-secondary small mb-0">No documents attached.</p><?php endif; ?>
            </div>

            <div class="tab-pane fade" id="tab-surveys">
                <a href="<?= url('/surveys/new?parcel=' . $parcel['id']) ?>" class="btn btn-sm btn-primary mb-2"><i class="bi bi-plus-lg me-1"></i>Schedule survey</a>
                <?php foreach ($surveys as $s): ?>
                    <div class="border rounded p-2 mb-2">
                        <div class="d-flex justify-content-between">
                            <span><?= status_badge($s['status']) ?> <?= $s['surveyDate'] ? fmt_date($s['surveyDate']) : 'unscheduled' ?></span>
                            <span class="small text-secondary"><?= e($s['surveyorName'] ?? '—') ?></span>
                        </div>
                        <?php if ($s['computedArea']): ?><div class="small">Area: <?= e(number_format((float) $s['computedArea'], 2)) ?> m²</div><?php endif; ?>
                        <?php if ($s['notes']): ?><div class="small text-secondary"><?= e($s['notes']) ?></div><?php endif; ?>
                    </div>
                <?php endforeach; ?>
                <?php if (!$surveys): ?><p class="text-secondary small mb-0">No surveys yet.</p><?php endif; ?>
            </div>

            <div class="tab-pane fade" id="tab-transfers">
                <?php foreach ($transfers as $t): ?>
                    <a href="<?= url('/transfers/' . $t['id']) ?>" class="list-group-item list-group-item-action border rounded d-block p-2 mb-2 text-reset text-decoration-none">
                        <?= status_badge($t['status']) ?> to <strong><?= e($t['toOwnerName'] ?: 'account holder') ?></strong>
                        <span class="small text-secondary float-end"><?= fmt_date($t['created']) ?></span>
                    </a>
                <?php endforeach; ?>
                <?php if (!$transfers): ?><p class="text-secondary small mb-0">No transfers recorded.</p><?php endif; ?>
            </div>

            <div class="tab-pane fade" id="tab-payments">
                <a href="<?= url('/payments/new?parcel=' . $parcel['id']) ?>" class="btn btn-sm btn-primary mb-2"><i class="bi bi-plus-lg me-1"></i>Record payment</a>
                <?php foreach ($payments as $p): ?>
                    <div class="d-flex justify-content-between border-bottom py-2">
                        <span><?= e(humanize($p['purpose'])) ?> <span class="small text-secondary"><?= e($p['invoiceNumber']) ?></span></span>
                        <span><?= fmt_money($p['amount']) ?> <?= status_badge($p['status']) ?></span>
                    </div>
                <?php endforeach; ?>
                <?php if (!$payments): ?><p class="text-secondary small mb-0">No payments recorded.</p><?php endif; ?>
            </div>

            <div class="tab-pane fade" id="tab-history">
                <ul class="timeline mb-0">
                    <?php foreach (array_reverse($timeline) as $log): ?>
                        <li>
                            <div class="small text-secondary"><?= fmt_datetime($log['created']) ?></div>
                            <?= e(humanize($log['action'])) ?><?= $log['details'] ? ' — ' . e($log['details']) : '' ?>
                        </li>
                    <?php endforeach; ?>
                    <?php if (!$timeline): ?><li>Created <?= fmt_datetime($parcel['created']) ?></li><?php endif; ?>
                </ul>
            </div>
        </div>

        <?php if ($editRequests): ?>
            <div class="card mt-3">
                <div class="card-header bg-transparent fw-semibold">Change requests</div>
                <ul class="list-group list-group-flush">
                    <?php foreach ($editRequests as $er): ?>
                        <li class="list-group-item d-flex justify-content-between">
                            <span><?= status_badge($er['status']) ?> <?= e(humanize($er['type'])) ?> — <?= e(str_excerpt($er['reason'], 60)) ?></span>
                            <a href="<?= url('/approvals/' . $er['id']) ?>" class="small">View</a>
                        </li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>
    </div>
</div>
