<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Audit;
use App\Controller;
use App\Flash;
use App\Notify;
use App\ParcelId;
use App\People;
use App\Repo;
use App\Validator;

final class ParcelController extends Controller
{
    private const STATUSES = ['draft', 'submitted', 'under_survey', 'under_review', 'registered', 'disputed', 'rejected'];

    private const LAND_USE = ['residential', 'commercial', 'agricultural', 'industrial', 'mixed_use', 'civic', 'other'];

    /** action => [from-statuses, roles-allowed, to-status] */
    private const TRANSITIONS = [
        'submit'      => [['draft', 'rejected'], ['registrar', 'planning_officer', 'admin', 'super_admin', 'customary_secretariat'], 'submitted'],
        'send_survey' => [['submitted', 'under_review'], ['planning_officer', 'survey_officer', 'admin', 'super_admin'], 'under_survey'],
        'send_review' => [['submitted', 'under_survey'], ['planning_officer', 'survey_officer', 'admin', 'super_admin'], 'under_review'],
        'register'    => [['under_review'], ['registrar', 'admin', 'super_admin'], 'registered'],
        'reject'      => [['submitted', 'under_survey', 'under_review'], ['registrar', 'planning_officer', 'admin', 'super_admin'], 'rejected'],
        'dispute'     => [['registered', 'under_review'], ['planning_officer', 'admin', 'super_admin', 'registrar'], 'disputed'],
        'resolve'     => [['disputed'], ['planning_officer', 'admin', 'super_admin'], 'registered'],
        'reopen'      => [['rejected', 'registered', 'disputed'], ['admin', 'super_admin'], 'under_review'],
    ];

    private function canEditDirectly(): bool
    {
        return $this->auth->is('admin', 'super_admin', 'registrar', 'planning_officer');
    }

    // ---------------------------------------------------------------
    public function index(): void
    {
        $this->requireLogin();

        $filters = [];
        if (($s = $_GET['status'] ?? '') !== '' && in_array($s, self::STATUSES, true)) {
            $filters['status'] = $s;
        }
        if (($ac = $_GET['areaCouncil'] ?? '') !== '') {
            $filters['areaCouncil'] = $ac;
        }
        if (($lu = $_GET['landUse'] ?? '') !== '' && Repo::hasColumn('parcels', 'landUse')) {
            $filters['landUse'] = $lu;
        }

        [$rows, $meta] = $this->listing('parcels', [
            'filters' => $filters,
            'searchable' => ['parcelNumber', 'applicantName', 'plotNumber', 'block', 'community', 'areaCouncil', 'sector', 'contactPhone'],
            'sort' => $_GET['sort'] ?? '-created',
        ]);

        $counts = [];
        foreach (self::STATUSES as $st) {
            $counts[$st] = $this->repo->count('parcels', ['status' => $st]);
        }

        $this->render('parcels/index', [
            'title' => 'Land Parcels',
            'parcels' => $rows,
            'meta' => $meta,
            'counts' => $counts,
            'statuses' => self::STATUSES,
            'areaCouncils' => $this->repo->all('area_councils'),
            'filters' => $filters,
        ]);
    }

    public function create(): void
    {
        $this->requireLogin();
        $community = $_GET['community'] ?? '';
        $this->render('parcels/form', [
            'title' => 'Register land',
            'parcel' => ['status' => 'draft'],
            'suggestedId' => $community ? ParcelId::next($community, $this->auth->tenantId()) : '',
            'lookups' => $this->lookups(),
            'landUse' => self::LAND_USE,
            'mode' => 'create',
        ]);
    }

    public function store(): void
    {
        $this->requireLogin();
        $this->guardCsrf();

        $v = new Validator($_POST);
        $v->requireAll(['applicantName', 'community'])
            ->require('contactPhone');
        if ($v->fails()) {
            $this->redirectBackWithErrors($v->errors(), '/parcels/new');
        }

        $tenantId = $this->auth->tenantId();
        $community = trim((string) input('community'));
        $parcelNumber = trim((string) input('parcelNumber')) ?: ParcelId::next($community, $tenantId);

        if (!ParcelId::isValid($parcelNumber)) {
            $this->redirectBackWithErrors(['parcelNumber' => 'Parcel number must look like ' . ParcelId::PREFIX . 'XXXX-0001.'], '/parcels/new');
        }
        if ($this->repo->findBy('parcels', 'parcelNumber', $parcelNumber)) {
            $this->redirectBackWithErrors(['parcelNumber' => "Parcel $parcelNumber already exists."], '/parcels/new');
        }

        $ownerId = People::ensureCitizen([
            'name'      => input('applicantName'),
            'phone'     => input('contactPhone'),
            'email'     => input('applicantEmail'),
            'ghanaCard' => input('ghanaCard'),
        ], $tenantId);

        $data = $this->collectFields();
        $data['owner'] = $ownerId;
        $data['parcelNumber'] = $parcelNumber;
        $data['status'] = 'draft';

        $id = $this->repo->create('parcels', $data, 'parcel_registered');
        Audit::log('parcel_status', 'parcels', "$parcelNumber → draft", $tenantId);

        Flash::success("Parcel $parcelNumber created as a draft. Submit it to begin the workflow.");
        redirect('/parcels/' . $id);
    }

    public function show(string $id): void
    {
        $this->requireLogin();
        $parcel = $this->repo->find('parcels', $id);
        if (!$parcel) {
            $this->notFound();
        }

        $owner = db_one('SELECT * FROM `users` WHERE `id` = ?', [$parcel['owner']]);
        $documents = db_all('SELECT * FROM `documents` WHERE `parcel` = ? ORDER BY `created` DESC', [$id]);
        $surveys = db_all('SELECT s.*, u.`name` surveyorName FROM `surveys` s LEFT JOIN `users` u ON u.`id` = s.`surveyor` WHERE s.`parcel` = ? ORDER BY s.`created` DESC', [$id]);
        $transfers = db_all('SELECT * FROM `land_transfers` WHERE `parcel` = ? ORDER BY `created` DESC', [$id]);
        $payments = db_all('SELECT * FROM `payments` WHERE `parcel` = ? ORDER BY `created` DESC', [$id]);
        $editRequests = db_all('SELECT * FROM `land_edit_requests` WHERE `parcel` = ? ORDER BY `created` DESC', [$id]);
        $timeline = db_all(
            "SELECT * FROM `audit_logs` WHERE `entity` = 'parcels' AND (`details` LIKE ? OR `details` LIKE ?) ORDER BY `created` ASC",
            ['%' . $parcel['parcelNumber'] . '%', '%' . $id . '%']
        );

        $this->render('parcels/show', [
            'title' => $parcel['parcelNumber'],
            'parcel' => $parcel,
            'owner' => $owner,
            'documents' => $documents,
            'surveys' => $surveys,
            'transfers' => $transfers,
            'payments' => $payments,
            'editRequests' => $editRequests,
            'timeline' => $timeline,
            'statuses' => self::STATUSES,
            'transitions' => $this->availableTransitions($parcel['status']),
            'canEdit' => $this->canEditDirectly(),
        ], ['breadcrumb' => ['Parcels' => '/parcels', 0 => $parcel['parcelNumber']]]);
    }

    public function edit(string $id): void
    {
        $this->requireLogin();
        $parcel = $this->repo->find('parcels', $id);
        if (!$parcel) {
            $this->notFound();
        }
        if (!$this->canEditDirectly()) {
            redirect('/parcels/' . $id); // others use request-change
        }
        $this->render('parcels/form', [
            'title' => 'Edit ' . $parcel['parcelNumber'],
            'parcel' => $parcel,
            'lookups' => $this->lookups(),
            'landUse' => self::LAND_USE,
            'mode' => 'edit',
        ], ['breadcrumb' => ['Parcels' => '/parcels', $parcel['parcelNumber'] => '/parcels/' . $id, 0 => 'Edit']]);
    }

    public function update(string $id): void
    {
        $this->requireLogin();
        $this->guardCsrf();
        $parcel = $this->repo->find('parcels', $id);
        if (!$parcel) {
            $this->notFound();
        }
        if (!$this->canEditDirectly()) {
            Flash::error('Your role cannot edit parcels directly — submit a change request instead.');
            redirect('/parcels/' . $id);
        }

        $data = $this->collectFields();
        // Only admins may change the parcel number (parcel-id-guard hook).
        if (!$this->auth->isAdmin()) {
            unset($data['parcelNumber']);
        } elseif (($data['parcelNumber'] ?? $parcel['parcelNumber']) !== $parcel['parcelNumber']) {
            if (!ParcelId::isValid($data['parcelNumber'])) {
                $this->redirectBackWithErrors(['parcelNumber' => 'Invalid parcel number format.'], '/parcels/' . $id . '/edit');
            }
        }

        $this->repo->update('parcels', $id, $data, 'parcel_updated');
        Flash::success('Parcel updated.');
        redirect('/parcels/' . $id);
    }

    public function changeStatus(string $id): void
    {
        $this->requireLogin();
        $this->guardCsrf();
        $parcel = $this->repo->find('parcels', $id);
        if (!$parcel) {
            $this->notFound();
        }

        $action = (string) input('action');
        $note = trim((string) input('note', ''));
        $t = self::TRANSITIONS[$action] ?? null;

        if (!$t || !in_array($parcel['status'], $t[0], true)) {
            Flash::error('That status change is not allowed from "' . humanize($parcel['status']) . '".');
            redirect('/parcels/' . $id);
        }
        if (!$this->auth->is(...$t[1])) {
            Flash::error('Your role cannot ' . humanize($action) . ' a parcel.');
            redirect('/parcels/' . $id);
        }

        $newStatus = $t[2];
        $patch = ['status' => $newStatus];
        if ($newStatus === 'registered' && empty($parcel['registrationDate'])) {
            $patch['registrationDate'] = date('Y-m-d H:i:s');
        }
        $this->repo->update('parcels', $id, $patch, 'parcel_status');
        Audit::log('parcel_status', 'parcels',
            "{$parcel['parcelNumber']}: {$parcel['status']} → $newStatus" . ($note ? " — $note" : ''),
            $this->auth->tenantId());

        // Notify the owner on meaningful milestones.
        if (in_array($newStatus, ['registered', 'rejected', 'disputed'], true)) {
            Notify::toUser($parcel['owner'], [
                'message' => "Your parcel {$parcel['parcelNumber']} is now " . humanize($newStatus) . '.',
                'link' => '/parcels/' . $id,
                'tenant' => $parcel['tenant'] ?? null,
                'event' => $newStatus === 'registered' ? 'approvalAlerts' : 'rejectionAlerts',
            ]);
        }

        Flash::success("Parcel moved to " . humanize($newStatus) . '.');
        redirect('/parcels/' . $id);
    }

    public function requestChange(string $id): void
    {
        $this->requireLogin();
        $this->guardCsrf();
        $parcel = $this->repo->find('parcels', $id);
        if (!$parcel) {
            $this->notFound();
        }

        $type = input('type') === 'delete' ? 'delete' : 'edit';
        $reason = trim((string) input('reason', ''));
        if ($reason === '') {
            Flash::error('Please give a reason for the change request.');
            redirect('/parcels/' . $id);
        }

        $proposed = [];
        foreach (['applicantName', 'contactPhone', 'community', 'areaCouncil', 'sector', 'plotNumber', 'block'] as $f) {
            $val = input('proposed_' . $f);
            if ($val !== null && $val !== '' && $val !== ($parcel[$f] ?? '')) {
                $proposed[$f] = $val;
            }
        }

        $reqId = $this->repo->create('land_edit_requests', [
            'parcel' => $id,
            'requestedBy' => $this->auth->id(),
            'type' => $type,
            'proposedChanges' => $proposed ?: null,
            'reason' => $reason,
            'status' => 'pending',
        ], 'edit_request_created');

        Notify::toApprovers($this->auth->tenantId(), [
            'message' => humanize($type) . " request for parcel {$parcel['parcelNumber']} needs review.",
            'link' => '/approvals/' . $reqId,
            'event' => 'approvalAlerts',
        ]);

        Flash::success('Your change request has been submitted for approval.');
        redirect('/parcels/' . $id);
    }

    public function destroy(string $id): void
    {
        $this->requireRole('admin', 'super_admin');
        $this->guardCsrf();
        $parcel = $this->repo->find('parcels', $id);
        if (!$parcel) {
            $this->notFound();
        }
        try {
            $this->repo->delete('parcels', $id, 'parcel_deleted');
        } catch (\Throwable $e) {
            Flash::error('This parcel cannot be deleted — documents, payments or transfers still reference it.');
            redirect('/parcels/' . $id);
        }
        Flash::success("Parcel {$parcel['parcelNumber']} deleted.");
        redirect('/parcels');
    }

    public function certificate(string $id): void
    {
        $this->requireLogin();
        $parcel = $this->repo->find('parcels', $id);
        if (!$parcel || $parcel['status'] !== 'registered') {
            Flash::error('Certificates are only available for registered parcels.');
            redirect('/parcels/' . $id);
        }
        $owner = db_one('SELECT * FROM `users` WHERE `id` = ?', [$parcel['owner']]);
        echo view('parcels/certificate', [
            'parcel' => $parcel,
            'owner' => $owner,
            'branding' => $GLOBALS['branding'],
            'tenant' => $GLOBALS['tenant'],
        ]);
        exit;
    }

    public function export(): void
    {
        $this->requireLogin();
        [$rows] = $this->repo->paginate('parcels', ['perPage' => 100000, 'sort' => '-created']);
        $cols = ['parcelNumber', 'applicantName', 'contactPhone', 'community', 'areaCouncil', 'sector', 'plotNumber', 'block', 'status', 'registrationDate', 'created'];
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="parcels-' . date('Ymd') . '.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, $cols);
        foreach ($rows as $r) {
            fputcsv($out, array_map(static fn ($c) => $r[$c] ?? '', $cols));
        }
        fclose($out);
        exit;
    }

    public function importForm(): void
    {
        $this->requireRole('admin', 'super_admin', 'registrar');
        $this->render('parcels/import', ['title' => 'Bulk import parcels']);
    }

    public function import(): void
    {
        $this->requireRole('admin', 'super_admin', 'registrar');
        $this->guardCsrf();

        if (($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Flash::error('Choose a CSV file to import.');
            redirect('/parcels/import');
        }
        $handle = fopen($_FILES['file']['tmp_name'], 'r');
        $header = fgetcsv($handle) ?: [];
        $header = array_map(static fn ($h) => lcfirst(str_replace(' ', '', ucwords(trim((string) $h)))), $header);

        $tenantId = $this->auth->tenantId();
        $created = 0;
        $skipped = 0;
        $errors = [];
        $line = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $line++;
            $rec = array_combine($header, array_pad($row, count($header), null)) ?: [];
            $rec = array_filter($rec, static fn ($v) => $v !== null && trim((string) $v) !== '');
            if (empty($rec['applicantName']) || empty($rec['community'])) {
                $skipped++;
                continue;
            }
            $num = $rec['parcelNumber'] ?? ParcelId::next($rec['community'], $tenantId);
            if ($this->repo->findBy('parcels', 'parcelNumber', $num)) {
                $skipped++;
                continue;
            }
            try {
                $ownerId = People::ensureCitizen([
                    'name' => $rec['applicantName'],
                    'phone' => $rec['contactPhone'] ?? '',
                    'ghanaCard' => $rec['ghanaCard'] ?? '',
                ], $tenantId);
                $payload = Repo::sanitize('parcels', array_merge($rec, [
                    'owner' => $ownerId,
                    'parcelNumber' => $num,
                    'status' => $rec['status'] ?? 'draft',
                ]));
                $this->repo->create('parcels', $payload, 'parcel_imported');
                $created++;
            } catch (\Throwable $e) {
                $errors[] = "Line $line: " . $e->getMessage();
            }
        }
        fclose($handle);

        Flash::success("Imported $created parcel(s). Skipped $skipped." . ($errors ? ' ' . count($errors) . ' error(s).' : ''));
        if ($errors) {
            $_SESSION['_errors'] = array_slice($errors, 0, 10);
        }
        redirect('/parcels');
    }

    // ---------------------------------------------------------------
    private function collectFields(): array
    {
        $allowed = [
            'parcelNumber', 'applicantName', 'contactPhone', 'alternateMobile', 'whatsapp',
            'applicantEmail', 'alternateNumber2', 'religion', 'tribe',
            'areaCouncil', 'community', 'sector', 'plotNumber', 'block',
            'allocationDate', 'registrationDate',
        ];
        if (Repo::hasColumn('parcels', 'landUse')) {
            $allowed[] = 'landUse';
        }
        $data = [];
        foreach ($allowed as $f) {
            $val = input($f);
            if ($val !== null) {
                $data[$f] = is_string($val) ? trim($val) : $val;
            }
        }
        return $data;
    }

    private function availableTransitions(string $status): array
    {
        $out = [];
        foreach (self::TRANSITIONS as $action => [$from, $roles, $to]) {
            if (in_array($status, $from, true) && $this->auth->is(...$roles)) {
                $out[$action] = ['to' => $to, 'label' => humanize($action)];
            }
        }
        return $out;
    }

    private function lookups(): array
    {
        return [
            'areaCouncils' => $this->repo->all('area_councils'),
            'communities'  => $this->repo->all('communities'),
            'sectors'      => $this->repo->all('sectors'),
        ];
    }

    private function notFound(): never
    {
        http_response_code(404);
        render('errors/generic', ['title' => 'Parcel not found', 'code' => 404,
            'message' => 'That parcel does not exist or is outside your workspace.']);
    }
}
