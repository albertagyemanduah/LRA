<?php

declare(strict_types=1);

use App\Router;
use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\ParcelController;
use App\Controllers\TransferController;
use App\Controllers\ApprovalController;
use App\Controllers\DocumentController;
use App\Controllers\PaymentController;
use App\Controllers\SurveyController;
use App\Controllers\UserController;
use App\Controllers\StructureController;
use App\Controllers\VerificationController;
use App\Controllers\NewsController;
use App\Controllers\TicketController;
use App\Controllers\ChatController;
use App\Controllers\ReportController;
use App\Controllers\SmsController;
use App\Controllers\AuditController;
use App\Controllers\NotificationController;
use App\Controllers\SettingsController;
use App\Controllers\PlatformController;
use App\Controllers\ProfileController;
use App\Controllers\PublicController;

/** @var Router $r */
$r = new Router();

// ---- Public / auth ------------------------------------------------
$r->get('/', [PublicController::class, 'home']);
$r->get('/verify', [PublicController::class, 'verify']);
$r->post('/verify', [PublicController::class, 'verifySubmit']);
$r->get('/public-stats', [PublicController::class, 'stats']);

$r->get('/login', [AuthController::class, 'showLogin']);
$r->post('/login', [AuthController::class, 'login']);
$r->post('/logout', [AuthController::class, 'logout']);
$r->get('/forgot-password', [AuthController::class, 'showForgot']);
$r->post('/forgot-password', [AuthController::class, 'forgot']);
$r->get('/reset-password/{token}', [AuthController::class, 'showReset']);
$r->post('/reset-password', [AuthController::class, 'reset']);

// ---- Dashboard --------------------------------------------------
$r->get('/dashboard', [DashboardController::class, 'index']);

// ---- Parcels --------------------------------------------------
$r->get('/parcels', [ParcelController::class, 'index']);
$r->get('/parcels/new', [ParcelController::class, 'create']);
$r->post('/parcels', [ParcelController::class, 'store']);
$r->get('/parcels/import', [ParcelController::class, 'importForm']);
$r->post('/parcels/import', [ParcelController::class, 'import']);
$r->get('/parcels/export', [ParcelController::class, 'export']);
$r->get('/parcels/{id}', [ParcelController::class, 'show']);
$r->get('/parcels/{id}/edit', [ParcelController::class, 'edit']);
$r->post('/parcels/{id}', [ParcelController::class, 'update']);
$r->post('/parcels/{id}/status', [ParcelController::class, 'changeStatus']);
$r->post('/parcels/{id}/request-change', [ParcelController::class, 'requestChange']);
$r->post('/parcels/{id}/delete', [ParcelController::class, 'destroy']);
$r->get('/parcels/{id}/certificate', [ParcelController::class, 'certificate']);

// ---- Land transfers ------------------------------------------
$r->get('/transfers', [TransferController::class, 'index']);
$r->get('/transfers/new', [TransferController::class, 'create']);
$r->post('/transfers', [TransferController::class, 'store']);
$r->get('/transfers/{id}', [TransferController::class, 'show']);
$r->post('/transfers/{id}/review', [TransferController::class, 'review']);

// ---- Approvals (edit / delete requests) ---------------------
$r->get('/approvals', [ApprovalController::class, 'index']);
$r->get('/approvals/{id}', [ApprovalController::class, 'show']);
$r->post('/approvals/{id}/review', [ApprovalController::class, 'review']);

// ---- Documents ---------------------------------------------
$r->get('/documents', [DocumentController::class, 'index']);
$r->get('/documents/new', [DocumentController::class, 'create']);
$r->post('/documents', [DocumentController::class, 'store']);
$r->post('/documents/{id}/verify', [DocumentController::class, 'verify']);
$r->post('/documents/{id}/delete', [DocumentController::class, 'destroy']);
$r->get('/documents/{id}/download', [DocumentController::class, 'download']);

// ---- Payments & invoices ---------------------------------
$r->get('/payments', [PaymentController::class, 'index']);
$r->get('/payments/new', [PaymentController::class, 'create']);
$r->post('/payments', [PaymentController::class, 'store']);
$r->get('/payments/{id}', [PaymentController::class, 'show']);
$r->post('/payments/{id}', [PaymentController::class, 'update']);
$r->get('/payments/{id}/receipt', [PaymentController::class, 'receipt']);
$r->get('/payments/export', [PaymentController::class, 'export']);

// ---- Surveys ---------------------------------------------
$r->get('/surveys', [SurveyController::class, 'index']);
$r->get('/surveys/new', [SurveyController::class, 'create']);
$r->post('/surveys', [SurveyController::class, 'store']);
$r->get('/surveys/{id}/edit', [SurveyController::class, 'edit']);
$r->post('/surveys/{id}', [SurveyController::class, 'update']);

// ---- Staff / users --------------------------------------
$r->get('/users', [UserController::class, 'index']);
$r->get('/users/new', [UserController::class, 'create']);
$r->post('/users', [UserController::class, 'store']);
$r->get('/users/{id}/edit', [UserController::class, 'edit']);
$r->post('/users/{id}', [UserController::class, 'update']);
$r->post('/users/{id}/suspend', [UserController::class, 'suspend']);
$r->post('/users/{id}/reset-password', [UserController::class, 'resetPassword']);

// ---- Administrative structure -------------------------
$r->get('/structure', [StructureController::class, 'index']);
$r->post('/structure/{type}', [StructureController::class, 'store']);
$r->post('/structure/{type}/{id}', [StructureController::class, 'update']);
$r->post('/structure/{type}/{id}/delete', [StructureController::class, 'destroy']);

// ---- Public land verification codes ------------------
$r->get('/verification-codes', [VerificationController::class, 'index']);
$r->post('/verification-codes', [VerificationController::class, 'store']);
$r->post('/verification-codes/{id}/toggle', [VerificationController::class, 'toggle']);
$r->post('/verification-codes/{id}/delete', [VerificationController::class, 'destroy']);
$r->get('/verification-logs', [VerificationController::class, 'logs']);

// ---- News CMS -----------------------------------------
$r->get('/news', [NewsController::class, 'index']);
$r->get('/news/new', [NewsController::class, 'create']);
$r->post('/news', [NewsController::class, 'store']);
$r->get('/news/{id}/edit', [NewsController::class, 'edit']);
$r->post('/news/{id}', [NewsController::class, 'update']);
$r->post('/news/{id}/delete', [NewsController::class, 'destroy']);

// ---- Support tickets --------------------------------
$r->get('/tickets', [TicketController::class, 'index']);
$r->get('/tickets/new', [TicketController::class, 'create']);
$r->post('/tickets', [TicketController::class, 'store']);
$r->get('/tickets/{id}', [TicketController::class, 'show']);
$r->post('/tickets/{id}/comment', [TicketController::class, 'comment']);
$r->post('/tickets/{id}/status', [TicketController::class, 'status']);

// ---- Staff chat ------------------------------------
$r->get('/chat', [ChatController::class, 'index']);
$r->get('/chat/{id}', [ChatController::class, 'thread']);
$r->post('/chat/{id}', [ChatController::class, 'send']);
$r->get('/chat/{id}/poll', [ChatController::class, 'poll']);

// ---- Reports & analytics --------------------------
$r->get('/reports', [ReportController::class, 'index']);
$r->get('/reports/financial', [ReportController::class, 'financial']);
$r->get('/reports/ownership', [ReportController::class, 'ownership']);
$r->get('/reports/{type}/export', [ReportController::class, 'export']);

// ---- SMS console --------------------------------
$r->get('/sms', [SmsController::class, 'index']);
$r->post('/sms/send', [SmsController::class, 'send']);

// ---- Audit log ---------------------------------
$r->get('/audit', [AuditController::class, 'index']);

// ---- Notifications -----------------------------
$r->get('/notifications', [NotificationController::class, 'index']);
$r->post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
$r->post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
$r->get('/notifications/preferences', [NotificationController::class, 'preferences']);
$r->post('/notifications/preferences', [NotificationController::class, 'savePreferences']);
$r->get('/notifications/poll', [NotificationController::class, 'poll']);

// ---- Workspace settings -----------------------
$r->get('/settings', [SettingsController::class, 'index']);
$r->post('/settings/branding', [SettingsController::class, 'saveBranding']);
$r->post('/settings/workspace', [SettingsController::class, 'saveWorkspace']);

// ---- Platform console (super_admin) ----------
$r->get('/platform', [PlatformController::class, 'index']);
$r->get('/platform/workspaces/new', [PlatformController::class, 'createWorkspace']);
$r->post('/platform/workspaces', [PlatformController::class, 'storeWorkspace']);
$r->get('/platform/workspaces/{id}', [PlatformController::class, 'showWorkspace']);
$r->post('/platform/workspaces/{id}', [PlatformController::class, 'updateWorkspace']);
$r->post('/platform/workspaces/{id}/billing', [PlatformController::class, 'updateBilling']);

// ---- Profile ---------------------------------
$r->get('/profile', [ProfileController::class, 'show']);
$r->post('/profile', [ProfileController::class, 'update']);
$r->post('/profile/password', [ProfileController::class, 'changePassword']);

return $r;
