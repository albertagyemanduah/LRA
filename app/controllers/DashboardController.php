<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Controller;

final class DashboardController extends Controller
{
    public function index(): void
    {
        $this->requireLogin();
        $r = $this->repo;

        // Workspace clause reused across the ad-hoc aggregate queries.
        [$tc, $tp] = $r->tenantClause('parcels');
        $pWhere = $tc ? " WHERE $tc" : '';

        $byStatus = db_all(
            "SELECT `status`, COUNT(*) c FROM `parcels`$pWhere GROUP BY `status`",
            $tp
        );
        $statusMap = [];
        foreach ($byStatus as $row) {
            $statusMap[$row['status'] ?: 'unknown'] = (int) $row['c'];
        }

        $monthly = db_all(
            "SELECT DATE_FORMAT(`created`, '%Y-%m') m, COUNT(*) c
               FROM `parcels`" . ($tc ? " WHERE $tc AND" : ' WHERE') . " `created` >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
              GROUP BY m ORDER BY m",
            $tp
        );

        $stats = [
            'parcels'        => $r->count('parcels'),
            'registered'     => $r->count('parcels', ['status' => 'registered']),
            'pendingSurvey'  => $statusMap['under_survey'] ?? 0,
            'pendingReview'  => ($statusMap['submitted'] ?? 0) + ($statusMap['under_review'] ?? 0),
            'transfersPending' => $r->count('land_transfers', ['status' => 'pending']),
            'editRequestsPending' => $r->count('land_edit_requests', ['status' => 'pending']),
            'openTickets'    => $r->count('tickets', ['status' => 'Open']),
            'staff'          => $r->count('users'),
        ];

        [$tcp, $tpp] = $r->tenantClause('payments');
        $revenue = (float) db_value(
            "SELECT COALESCE(SUM(`amount`),0) FROM `payments`
              WHERE `status` = 'paid'" . ($tcp ? " AND $tcp" : ''),
            $tpp
        );
        $revenueMonth = (float) db_value(
            "SELECT COALESCE(SUM(`amount`),0) FROM `payments`
              WHERE `status` = 'paid' AND `created` >= DATE_FORMAT(CURDATE(), '%Y-%m-01')"
              . ($tcp ? " AND $tcp" : ''),
            $tpp
        );

        $recentParcels = $r->paginate('parcels', ['perPage' => 6, 'sort' => '-created'])[0];
        [$recentActivity] = $r->paginate('audit_logs', ['perPage' => 8, 'sort' => '-created']);

        $myApprovals = [];
        if ($this->auth->is('planning_officer', 'admin', 'super_admin')) {
            [$te, $tep] = $r->tenantClause('land_edit_requests');
            $myApprovals = db_all(
                "SELECT 'edit' kind, `id`, `type`, `reason`, `created` FROM `land_edit_requests`
                  WHERE `status` = 'pending'" . ($te ? " AND $te" : '') . "
                 UNION ALL
                 SELECT 'transfer' kind, `id`, `status` type, `reason`, `created` FROM `land_transfers`
                  WHERE `status` = 'pending'" . ($te ? " AND $te" : '') . "
                 ORDER BY `created` DESC LIMIT 6",
                array_merge($tep, $tep)
            );
        }

        $this->render('dashboard/index', [
            'title' => 'Dashboard',
            'stats' => $stats,
            'statusMap' => $statusMap,
            'monthly' => $monthly,
            'revenue' => $revenue,
            'revenueMonth' => $revenueMonth,
            'recentParcels' => $recentParcels,
            'recentActivity' => $recentActivity,
            'myApprovals' => $myApprovals,
        ]);
    }
}
