<?php
/** @var array $parcel @var array $lookups @var string $mode @var array $landUse @var string|null $suggestedId */
$isEdit = ($mode ?? 'create') === 'edit';
$action = $isEdit ? url('/parcels/' . $parcel['id']) : url('/parcels');
$canNumber = !$isEdit || $GLOBALS['auth']->isAdmin();
$v = static fn (string $k, $d = '') => e($parcel[$k] ?? $d);
?>
<div class="page-head">
    <div>
        <h1><?= $isEdit ? 'Edit ' . e($parcel['parcelNumber']) : 'Register land parcel' ?></h1>
        <p class="lead"><?= $isEdit ? 'Update the parcel record.' : 'Capture the applicant, location and identifiers. The parcel starts as a draft.' ?></p>
    </div>
    <a href="<?= url($isEdit ? '/parcels/' . $parcel['id'] : '/parcels') ?>" class="btn btn-outline-secondary">Cancel</a>
</div>

<?= view('partials/errors') ?>

<form method="post" action="<?= $action ?>" class="row g-4">
    <?= csrf_field() ?>

    <div class="col-lg-7">
        <div class="card">
            <div class="card-header bg-transparent fw-semibold">Applicant</div>
            <div class="card-body row g-3">
                <div class="col-md-8">
                    <label class="form-label">Name of applicant <span class="text-danger">*</span></label>
                    <input name="applicantName" class="form-control" required value="<?= $isEdit ? $v('applicantName') : old('applicantName') ?>">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Ghana Card</label>
                    <input name="ghanaCard" class="form-control" value="<?= $isEdit ? $v('ghanaCard') : old('ghanaCard') ?>" placeholder="GHA-...">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Phone <span class="text-danger">*</span></label>
                    <input name="contactPhone" class="form-control" required value="<?= $isEdit ? $v('contactPhone') : old('contactPhone') ?>" placeholder="024...">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Alternate mobile</label>
                    <input name="alternateMobile" class="form-control" value="<?= $isEdit ? $v('alternateMobile') : old('alternateMobile') ?>">
                </div>
                <div class="col-md-4">
                    <label class="form-label">WhatsApp</label>
                    <input name="whatsapp" class="form-control" value="<?= $isEdit ? $v('whatsapp') : old('whatsapp') ?>">
                </div>
                <div class="col-md-6">
                    <label class="form-label">Email</label>
                    <input type="email" name="applicantEmail" class="form-control" value="<?= $isEdit ? $v('applicantEmail') : old('applicantEmail') ?>">
                </div>
                <div class="col-md-3">
                    <label class="form-label">Religion</label>
                    <input name="religion" class="form-control" value="<?= $isEdit ? $v('religion') : old('religion') ?>">
                </div>
                <div class="col-md-3">
                    <label class="form-label">Tribe</label>
                    <input name="tribe" class="form-control" value="<?= $isEdit ? $v('tribe') : old('tribe') ?>">
                </div>
            </div>
        </div>

        <div class="card mt-4">
            <div class="card-header bg-transparent fw-semibold">Location</div>
            <div class="card-body row g-3">
                <div class="col-md-6">
                    <label class="form-label">Area council</label>
                    <input name="areaCouncil" class="form-control" list="acList" value="<?= $isEdit ? $v('areaCouncil') : old('areaCouncil') ?>">
                    <datalist id="acList"><?php foreach ($lookups['areaCouncils'] as $a): ?><option value="<?= e($a['name']) ?>"><?php endforeach; ?></datalist>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Community <span class="text-danger">*</span></label>
                    <input name="community" id="communityInput" class="form-control" list="commList" required value="<?= $isEdit ? $v('community') : old('community') ?>">
                    <datalist id="commList"><?php foreach ($lookups['communities'] as $c): ?><option value="<?= e($c['name']) ?>"><?php endforeach; ?></datalist>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Sector</label>
                    <input name="sector" class="form-control" value="<?= $isEdit ? $v('sector') : old('sector') ?>">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Plot number</label>
                    <input name="plotNumber" class="form-control" value="<?= $isEdit ? $v('plotNumber') : old('plotNumber') ?>">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Block</label>
                    <input name="block" class="form-control" value="<?= $isEdit ? $v('block') : old('block') ?>">
                </div>
            </div>
        </div>
    </div>

    <div class="col-lg-5">
        <div class="card">
            <div class="card-header bg-transparent fw-semibold">Identifiers &amp; dates</div>
            <div class="card-body row g-3">
                <div class="col-12">
                    <label class="form-label">Parcel number</label>
                    <input name="parcelNumber" id="parcelNumberInput" class="form-control"
                           <?= $canNumber ? '' : 'readonly' ?>
                           value="<?= $isEdit ? $v('parcelNumber') : e($suggestedId ?? old('parcelNumber')) ?>"
                           placeholder="<?= e(\App\ParcelId::PREFIX) ?>ADUM-0001">
                    <div class="form-text">
                        <?= $isEdit
                            ? ($canNumber ? 'Only administrators can change this.' : 'Locked — administrators only.')
                            : 'Leave blank to auto-generate from the community.' ?>
                    </div>
                </div>
                <div class="col-6">
                    <label class="form-label">Allocation date</label>
                    <input type="date" name="allocationDate" class="form-control" value="<?= e(substr((string) ($parcel['allocationDate'] ?? old('allocationDate')), 0, 10)) ?>">
                </div>
                <div class="col-6">
                    <label class="form-label">Registration date</label>
                    <input type="date" name="registrationDate" class="form-control" value="<?= e(substr((string) ($parcel['registrationDate'] ?? old('registrationDate')), 0, 10)) ?>">
                </div>
            </div>
            <div class="card-footer bg-transparent d-flex gap-2">
                <button class="btn btn-primary"><?= $isEdit ? 'Save changes' : 'Create draft' ?></button>
                <a href="<?= url($isEdit ? '/parcels/' . $parcel['id'] : '/parcels') ?>" class="btn btn-outline-secondary">Cancel</a>
            </div>
        </div>
        <?php if (!$isEdit): ?>
        <p class="small text-secondary mt-2">
            After creating the draft you can attach documents, schedule a survey, and move it through
            <strong>submitted → survey → review → registered</strong>.
        </p>
        <?php endif; ?>
    </div>
</form>

