<div class="page-head">
    <div>
        <h1>Bulk import parcels</h1>
        <p class="lead">Upload a CSV to create many parcels at once. Existing parcel numbers are skipped.</p>
    </div>
    <a href="<?= url('/parcels') ?>" class="btn btn-outline-secondary">Back</a>
</div>

<?= view('partials/errors') ?>

<div class="row g-4">
    <div class="col-lg-6">
        <div class="card">
            <div class="card-body">
                <form method="post" action="<?= url('/parcels/import') ?>" enctype="multipart/form-data">
                    <?= csrf_field() ?>
                    <div class="mb-3">
                        <label class="form-label">CSV file</label>
                        <input type="file" name="file" accept=".csv,text/csv" class="form-control" required>
                    </div>
                    <button class="btn btn-primary"><i class="bi bi-upload me-1"></i>Import</button>
                </form>
            </div>
        </div>
    </div>
    <div class="col-lg-6">
        <div class="card">
            <div class="card-header bg-transparent fw-semibold">Expected columns</div>
            <div class="card-body small">
                <p>The header row is matched case-insensitively. Recognised columns:</p>
                <code>parcelNumber, applicantName, contactPhone, ghanaCard, applicantEmail,
                    areaCouncil, community, sector, plotNumber, block, religion, tribe,
                    allocationDate, registrationDate, status</code>
                <p class="mt-2 mb-0"><strong>applicantName</strong> and <strong>community</strong> are required.
                    Leave <strong>parcelNumber</strong> blank to auto-generate.</p>
            </div>
        </div>
    </div>
</div>
