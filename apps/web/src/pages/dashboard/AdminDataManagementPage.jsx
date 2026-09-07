import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Database, Trash2, RefreshCw, AlertTriangle, ScrollText, Bell, Clock, ShieldAlert, CheckCircle2, XCircle, Download, Upload, FileCode2, HardDrive } from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, SectionCard, StatCard, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { downloadSQL, previewSQLImport, executeSQLImport } from "@/lib/sqlExport";

// ── Parcel wipe collections (in cascade-safe deletion order) ───────────────
const WIPE_COLLECTIONS = [
  { key: "documents",         label: "Documents" },
  { key: "payments",          label: "Payments" },
  { key: "surveys",           label: "Surveys" },
  { key: "land_transfers",    label: "Land Transfers" },
  { key: "land_edit_requests",label: "Edit Requests / Amendments" },
  { key: "applications",      label: "Applications" },
  { key: "parcels",           label: "Parcels" },
];

async function deleteAll(collection, requestKeySuffix) {
  let page = 1;
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await pb.collection(collection).getList(1, 200, { requestKey: `wipe-list-${collection}-${page}-${requestKeySuffix}` });
    if (!result.items.length) break;
    const batch = result.items;
    await Promise.allSettled(
      batch.map((r) => pb.collection(collection).delete(r.id, { requestKey: `wipe-del-${collection}-${r.id}` }))
    );
    deleted += batch.length;
    if (result.items.length < 200) break;
    page++;
  }
  return deleted;
}

async function deleteParcelAuditLogs() {
  let page = 1;
  let deleted = 0;
  const parcelActions = [
    "parcel_registered","parcel_status_update","parcel_amended","parcel_disputed",
    "parcel_soft_deleted","parcel_restored","parcel_permanent_deleted","parcel_permanent_delete_failed",
    "parcel_registration_attempt","parcel_registration_failed","duplicate_scan","duplicate_resolved",
    "bulk_register","bulk_dispute","bulk_status","bulk_permanent_delete",
    "payment_created","transfer_approved","transfer_rejected","transfer_initiated",
    "bulk_data_purge",
  ];
  const filter = parcelActions.map((a) => `action = '${a}'`).join(" || ");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let items = [];
    try {
      const result = await pb.collection("audit_logs").getList(1, 200, {
        filter,
        requestKey: `wipe-auditlogs-${page}`,
      });
      items = result.items;
    } catch (_) { break; }
    if (!items.length) break;
    await Promise.allSettled(items.map((r) => pb.collection("audit_logs").delete(r.id, { requestKey: `wipe-del-audit-${r.id}` })));
    deleted += items.length;
    if (items.length < 200) break;
    page++;
  }
  return deleted;
}

async function deleteParcelNotifications() {
  const keywords = ["parcel","land registration","plot","land transfer","transfer","certificate","registration"];
  let deleted = 0;
  for (const kw of keywords) {
    try {
      const result = await pb.collection("notifications").getFullList({
        filter: `message ~ '${kw}'`,
        requestKey: `wipe-notif-${kw}`,
      });
      await Promise.allSettled(result.map((r) => pb.collection("notifications").delete(r.id, { requestKey: `wipe-del-notif-${r.id}` })));
      deleted += result.length;
    } catch (_) {}
  }
  return deleted;
}

function WipeSection({ onWipeComplete }) {
  const { user, log } = useAuth();
  const { toast } = useToast();
  const [counts, setCounts] = useState(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(null); // { step, stepLabel, done, total }
  const [wipeReport, setWipeReport] = useState(null);

  const fetchCounts = async () => {
    setLoadingCounts(true);
    const results = {};
    await Promise.allSettled(
      [...WIPE_COLLECTIONS, { key: "audit_logs", label: "Audit Logs (parcel-related)" }, { key: "notifications", label: "Notifications (parcel-related)" }].map(async ({ key, label }) => {
        try {
          const res = await pb.collection(key).getList(1, 1, { requestKey: `wipe-count-${key}` });
          results[key] = { label, count: res.totalItems };
        } catch (_) {
          results[key] = { label, count: "?" };
        }
      })
    );
    setCounts(results);
    setLoadingCounts(false);
  };

  const startWipe = async () => {
    if (confirmText.trim().toUpperCase() !== "WIPE ALL DATA") return;
    setConfirmOpen(false);
    setWiping(true);
    setWipeReport(null);
    const report = { startedAt: new Date().toISOString(), by: user?.email, collections: [], totalDeleted: 0 };

    const steps = [
      ...WIPE_COLLECTIONS,
      { key: "_audit_logs", label: "Audit Logs (parcel-related)" },
      { key: "_notifications", label: "Notifications (parcel-related)" },
    ];

    for (let i = 0; i < steps.length; i++) {
      const { key, label } = steps[i];
      setWipeProgress({ step: i + 1, total: steps.length, stepLabel: label, done: 0 });
      let deleted = 0;
      try {
        if (key === "_audit_logs") {
          deleted = await deleteParcelAuditLogs();
        } else if (key === "_notifications") {
          deleted = await deleteParcelNotifications();
        } else {
          deleted = await deleteAll(key, `${i}`);
        }
      } catch (err) {
        console.error(`Wipe failed for ${key}`, err);
      }
      report.collections.push({ key, label, deleted });
      report.totalDeleted += deleted;
    }

    report.finishedAt = new Date().toISOString();
    report.status = "completed";

    try {
      await log("system_parcel_wipe", "parcels", `Complete parcel wipe by ${user?.email} — ${report.totalDeleted} total records deleted at ${report.finishedAt}`);
    } catch (_) {}

    setWiping(false);
    setWipeProgress(null);
    setWipeReport(report);
    toast({ title: "System wipe complete", description: `${report.totalDeleted} records removed across all parcel collections.` });
    onWipeComplete?.();
  };

  return (
    <div className="rounded-2xl border-2 border-red-400 bg-red-50 dark:bg-red-950/20 dark:border-red-700 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-6 w-6 shrink-0 text-red-700 dark:text-red-400 mt-0.5" />
        <div>
          <h2 className="font-display text-lg font-bold text-red-900 dark:text-red-300">Complete Parcel System Wipe</h2>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">
            Permanently removes ALL parcel records and related data (transfers, documents, payments, surveys, amendments, applications, related audit logs, and notifications). This action <strong>cannot be undone</strong>. Use only before a clean data import.
          </p>
        </div>
      </div>

      {/* Count summary */}
      {counts && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {Object.values(counts).map(({ label, count }) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-700 bg-white dark:bg-red-950/30 px-3 py-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-bold text-red-800 dark:text-red-300">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      {wiping && wipeProgress && (
        <div className="space-y-2 rounded-xl border border-red-300 bg-white dark:bg-red-950/30 p-4">
          <div className="flex items-center justify-between text-sm font-medium text-red-800 dark:text-red-300">
            <span>Step {wipeProgress.step}/{wipeProgress.total}: {wipeProgress.stepLabel}</span>
            <span>{Math.round((wipeProgress.step / wipeProgress.total) * 100)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-red-100 dark:bg-red-900/40">
            <div className="h-full rounded-full bg-red-600 transition-all duration-300"
              style={{ width: `${(wipeProgress.step / wipeProgress.total) * 100}%` }} />
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 animate-pulse">Deleting records… do not close this page.</p>
        </div>
      )}

      {/* Report */}
      {wipeReport && (
        <div className="rounded-xl border border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-700 p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-300 font-semibold">
            <CheckCircle2 className="h-5 w-5" /> Wipe completed successfully
          </div>
          <div className="grid gap-1 text-xs">
            <p><span className="text-muted-foreground">Performed by:</span> <strong>{wipeReport.by}</strong></p>
            <p><span className="text-muted-foreground">Started:</span> {new Date(wipeReport.startedAt).toLocaleString()}</p>
            <p><span className="text-muted-foreground">Finished:</span> {new Date(wipeReport.finishedAt).toLocaleString()}</p>
            <p><span className="text-muted-foreground">Total deleted:</span> <strong>{wipeReport.totalDeleted}</strong> records</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-1 pr-4 font-medium">Collection</th>
                <th className="pb-1 font-medium">Deleted</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {wipeReport.collections.map(({ key, label, deleted }) => (
                  <tr key={key}>
                    <td className="py-1 pr-4">{label}</td>
                    <td className="py-1 font-bold">{deleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={fetchCounts} disabled={loadingCounts || wiping}
          className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-600 dark:text-red-300">
          {loadingCounts ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
          Count records
        </Button>
        <Button variant="destructive" size="sm" onClick={() => { setConfirmText(""); setConfirmOpen(true); }} disabled={wiping}
          className="bg-red-700 hover:bg-red-800">
          <Trash2 className="mr-1 h-4 w-4" /> Wipe All Parcels &amp; Related Data
        </Button>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o) setConfirmOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-800 dark:text-red-300">
              <ShieldAlert className="h-5 w-5" /> IRREVERSIBLE — Wipe All Parcel Data
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1 text-sm">
            <div className="rounded-lg border-2 border-red-400 bg-red-100 dark:bg-red-900/30 p-4 text-red-900 dark:text-red-200 space-y-2">
              <p className="font-bold flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> THIS CANNOT BE UNDONE</p>
              <p>This will permanently delete:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                {WIPE_COLLECTIONS.map(({ label }) => <li key={label}>{label}</li>)}
                <li>Parcel-related audit log entries</li>
                <li>Parcel-related notifications</li>
              </ul>
              <p className="font-semibold mt-2">All counter sequences will reset. New imports will start from 0001.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Type <span className="font-mono bg-muted px-1 rounded">WIPE ALL DATA</span> to confirm</Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="WIPE ALL DATA"
                className="border-red-300 focus:border-red-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              <XCircle className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button variant="destructive" onClick={startWipe}
              disabled={confirmText.trim().toUpperCase() !== "WIPE ALL DATA"}
              className="bg-red-700 hover:bg-red-800">
              <Trash2 className="mr-1 h-4 w-4" /> Confirm Wipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const EMPTY_FILTERS = { from: "", to: "", action: "all", entity: "all", user: "all", status: "all" };

// ── SQL Backup / Restore Panel ─────────────────────────────────────────────
function SQLBackupPanel() {
  const { toast } = useToast();
  const [exportOpts, setExportOpts] = useState({ scope: "schema+data", includeHidden: true });
  const [exportBusy, setExportBusy] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [, setImportResult] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = React.useRef();
  const [backupLog, setBackupLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sql_backup_log") || "[]"); } catch { return []; }
  });

  const saveLog = (entry) => {
    const updated = [entry, ...backupLog].slice(0, 20);
    setBackupLog(updated);
    localStorage.setItem("sql_backup_log", JSON.stringify(updated));
  };

  const handleExport = async () => {
    setExportBusy(true);
    try {
      const res = await downloadSQL(exportOpts);
      saveLog({ type: "export", file: res.filename, bytes: res.bytes, ts: new Date().toISOString(), status: "ok" });
      toast({ title: "SQL exported", description: `${res.filename} (${(res.bytes / 1024).toFixed(1)} KB)` });
    } catch (e) {
      toast({ variant: "destructive", title: "Export failed", description: e.message });
    } finally {
      setExportBusy(false);
    }
  };

  const handleFileChange = async (file) => {
    if (!file) return;
    setImportFile(file);
    setImportPreview(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const preview = await previewSQLImport(text);
      setImportPreview(preview);
    } catch (e) {
      toast({ variant: "destructive", title: "Preview failed", description: e.message });
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportBusy(true);
    try {
      const text = await importFile.text();
      const result = await executeSQLImport(text);
      setImportResult(result);
      saveLog({ type: "import", file: importFile.name, inserted: result.totalInserted, failed: result.totalFailed, ts: new Date().toISOString(), status: result.totalFailed === 0 ? "ok" : "partial" });
      toast({ title: "Import complete", description: `Inserted: ${result.totalInserted}  Failed: ${result.totalFailed}` });
      setImportOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Import failed", description: e.message });
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Export Card */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">SQL Database Export</h3>
        </div>
        <p className="text-sm text-muted-foreground">Export the entire database as a portable <code>.sql</code> file for backup, migration, or archival purposes.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Export scope</Label>
            <Select value={exportOpts.scope} onValueChange={(v) => setExportOpts((o) => ({ ...o, scope: v }))}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="schema+data">Schema + Data</SelectItem>
                <SelectItem value="schema">Schema only</SelectItem>
                <SelectItem value="data">Data only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Hidden (soft-deleted) records</Label>
            <Select value={String(exportOpts.includeHidden)} onValueChange={(v) => setExportOpts((o) => ({ ...o, includeHidden: v === "true" }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Include hidden records</SelectItem>
                <SelectItem value="false">Active records only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleExport} disabled={exportBusy} className="gap-2">
          {exportBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exportBusy ? "Exporting…" : "Export SQL File"}
        </Button>
      </div>

      {/* Import Card */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">SQL Database Import / Restore</h3>
        </div>
        <p className="text-sm text-muted-foreground">Import a previously exported <code>.sql</code> file to restore data. Existing records with matching IDs will be replaced.</p>
        <input ref={fileRef} type="file" accept=".sql,application/sql,text/plain" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0])} />
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); handleFileChange(e.dataTransfer.files?.[0]); }}
          onDragOver={(e) => e.preventDefault()}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/60 transition-colors"
        >
          <FileCode2 className="h-8 w-8 text-muted-foreground" />
          {importFile ? (
            <div>
              <p className="font-medium text-sm">{importFile.name}</p>
              <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">Drop .sql file or click to browse</p>
              <p className="text-xs text-muted-foreground">Accepts .sql files exported from this system</p>
            </div>
          )}
        </div>

        {importPreview && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Import Preview</p>
            <p><span className="font-semibold">{importPreview.insertCount}</span> INSERT statements across <span className="font-semibold">{importPreview.tables?.length}</span> tables</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {(importPreview.tables || []).map((t) => (
                <span key={t} className="rounded bg-secondary px-2 py-0.5 text-xs font-mono">{t} ({importPreview.preview?.[t]?.rowCount ?? 0})</span>
              ))}
            </div>
          </div>
        )}

        {importFile && (
          <Button onClick={() => setImportOpen(true)} disabled={importBusy || !importPreview} className="gap-2">
            <Upload className="h-4 w-4" />
            Restore from SQL
          </Button>
        )}
      </div>

      {/* Backup log */}
      {backupLog.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Backup / Restore History</h3>
          <ul className="divide-y text-sm">
            {backupLog.map((entry, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {entry.type === "export" ? <Download className="h-4 w-4 shrink-0 text-blue-500" /> : <Upload className="h-4 w-4 shrink-0 text-green-500" />}
                  <span className="truncate font-mono text-xs">{entry.file}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                  {entry.type === "export" && <span>{entry.bytes ? `${(entry.bytes / 1024).toFixed(1)} KB` : ""}</span>}
                  {entry.type === "import" && <span>{entry.inserted} inserted</span>}
                  <span className={cn("rounded px-1.5 py-0.5 font-semibold", entry.status === "ok" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700")}>{entry.status}</span>
                  <span>{new Date(entry.ts).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Confirm import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Confirm SQL Import</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm py-1">
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <strong>Warning:</strong> This will insert or replace {importPreview?.insertCount} records. Records with matching IDs will be overwritten. This cannot be undone.
            </div>
            {importPreview && (
              <p className="text-muted-foreground">File: <span className="font-mono font-medium">{importFile?.name}</span></p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importBusy}>Cancel</Button>
            <Button onClick={handleImport} disabled={importBusy} className="gap-1">
              {importBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importBusy ? "Importing…" : "Confirm Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Panel({
  title, description, icon: Icon, records, loading, filters, setFilters,
  actionOptions, entityOptions, userOptions, statusOptions, matched, onDelete, deleting, children,
}) {
  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  return (
    <SectionCard title={title} description={description}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">From date</Label>
            <Input type="date" value={filters.from} onChange={(e) => set("from")(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To date</Label>
            <Input type="date" value={filters.to} onChange={(e) => set("to")(e.target.value)} className="h-9" />
          </div>
          {actionOptions && (
            <div className="space-y-1.5">
              <Label className="text-xs">Action</Label>
              <Select value={filters.action} onValueChange={set("action")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all">All actions</SelectItem>
                  {actionOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {entityOptions && (
            <div className="space-y-1.5">
              <Label className="text-xs">Entity type</Label>
              <Select value={filters.entity} onValueChange={set("entity")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all">All entities</SelectItem>
                  {entityOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {statusOptions && (
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status} onValueChange={set("status")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {userOptions && (
            <div className="space-y-1.5">
              <Label className="text-xs">User</Label>
              <Select value={filters.user} onValueChange={set("user")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all">All users</SelectItem>
                  {userOptions.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <Icon className="h-4 w-4 text-primary" />
          <p className="text-sm">
            <strong>{matched.length}</strong> of {records.length} record(s) match the filters.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setFilters({ ...EMPTY_FILTERS })}>Reset filters</Button>
          <Button
            variant="destructive" size="sm" className="ml-auto"
            disabled={deleting || matched.length === 0}
            onClick={onDelete}
          >
            {deleting
              ? <><RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> Deleting…</>
              : <><Trash2 className="mr-1.5 h-4 w-4" /> Delete {matched.length} record(s)</>}
          </Button>
        </div>

        {loading ? <Spinner /> : children}
      </div>
    </SectionCard>
  );
}

export default function AdminDataManagementPage() {
  const { user, role, log } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null); // "audit" | "notifications" | "recent"
  const [progress, setProgress] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, records, label }

  const [auditFilters, setAuditFilters] = useState({ ...EMPTY_FILTERS });
  const [notifFilters, setNotifFilters] = useState({ ...EMPTY_FILTERS });
  const [recentFilters, setRecentFilters] = useState({ ...EMPTY_FILTERS });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, n, u] = await Promise.all([
        pb.collection("audit_logs").getFullList({ sort: "-created", requestKey: "adm-logs" }).catch(() => []),
        pb.collection("notifications").getFullList({ sort: "-created", requestKey: "adm-notifs" }).catch(() => []),
        pb.collection("users").getFullList({ sort: "email", requestKey: "adm-users" }).catch(() => []),
      ]);
      setLogs(l); setNotifications(n); setUsers(u);
    } catch (err) {
      console.error("Data management load failed", err);
      toast({ variant: "destructive", title: "Could not load data", description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (isAdmin) load(); else setLoading(false); }, [isAdmin, load]);

  const userOptions = useMemo(
    () => users.map((u) => ({ id: u.id, label: u.fullName || u.email || u.id })),
    [users],
  );

  const inRange = (rec, f) => {
    const d = new Date(rec.created);
    if (f.from && d < new Date(f.from)) return false;
    if (f.to && d > new Date(`${f.to}T23:59:59`)) return false;
    return true;
  };

  const matchedAudit = useMemo(() => logs.filter((r) =>
    inRange(r, auditFilters)
    && (auditFilters.action === "all" || r.action === auditFilters.action)
    && (auditFilters.entity === "all" || r.entity === auditFilters.entity)
    && (auditFilters.user === "all" || r.actor === auditFilters.user)
  ), [logs, auditFilters]);

  const notifMatch = (list, f) => list.filter((r) =>
    inRange(r, f)
    && (f.user === "all" || r.user === f.user)
    && (f.status === "all" || (f.status === "read" ? !!r.read : !r.read))
  );

  const matchedNotifs = useMemo(() => notifMatch(notifications, notifFilters), [notifications, notifFilters]);

  const recentPool = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return notifications.filter((n) => new Date(n.created).getTime() >= cutoff);
  }, [notifications]);
  const matchedRecent = useMemo(() => notifMatch(recentPool, recentFilters), [recentPool, recentFilters]);

  const actionOptions = useMemo(() => [...new Set(logs.map((l) => l.action).filter(Boolean))].sort(), [logs]);
  const entityOptions = useMemo(() => [...new Set(logs.map((l) => l.entity).filter(Boolean))].sort(), [logs]);

  const runDelete = async () => {
    if (!confirm) return;
    const { kind, records, collection, label } = confirm;
    setConfirm(null);
    setDeleting(kind);
    let done = 0, failed = 0;
    setProgress({ done: 0, total: records.length });
    for (let i = 0; i < records.length; i++) {
      try {
        await pb.collection(collection).delete(records[i].id, { requestKey: `del-${kind}-${i}` });
        done++;
      } catch (err) {
        failed++;
        console.error(`Delete failed for ${collection}/${records[i].id}`, err);
      }
      setProgress({ done: i + 1, total: records.length });
    }
    try {
      await log("bulk_data_purge", collection, `${label}: ${done} deleted, ${failed} failed (by ${user?.email})`);
    } catch (_) {}
    toast({
      variant: failed && !done ? "destructive" : "default",
      title: failed && !done ? "Deletion failed" : `${label} complete`,
      description: `${done} record(s) deleted${failed ? `, ${failed} failed` : ""}.`,
    });
    setDeleting(null);
    setProgress(null);
    await load();
  };

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Data Management" subtitle="Restricted area" icon={Database} />
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Only the District Assembly Administrator can access data management.
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Data Management — Techiman North Land Registry</title>
        <meta name="description" content="Administrator tools to purge audit trail entries and notifications in the Techiman North Land Registry." />
      </Helmet>

      <PageHeader
        title="Data Management"
        subtitle="Purge audit trail entries and notifications"
        icon={Database}
        action={<Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={cn("mr-1 h-4 w-4", loading && "animate-spin")} /> Refresh</Button>}
      />

      <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
        <AlertTriangle className="mr-1.5 inline h-4 w-4" />
        Deletions on this page are permanent and cannot be undone. Every purge is itself recorded in the audit trail.
      </div>

      <WipeSection onWipeComplete={load} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Audit entries" value={logs.length} icon={ScrollText} accent="primary" />
        <StatCard label="Notifications" value={notifications.length} icon={Bell} accent="gold" />
        <StatCard label="Recent (7 days)" value={recentPool.length} icon={Clock} accent="blue" />
      </div>

      {progress && (
        <div className="space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-primary">
            <span>Deleting records…</span>
            <span>{progress.done}/{progress.total}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        </div>
      )}

      <Panel
        title="Delete audit trail" description="Remove audit records matching the filters below"
        icon={ScrollText} records={logs} loading={loading}
        filters={auditFilters} setFilters={setAuditFilters}
        actionOptions={actionOptions} entityOptions={entityOptions} userOptions={userOptions}
        matched={matchedAudit} deleting={deleting === "audit"}
        onDelete={() => setConfirm({ kind: "audit", collection: "audit_logs", records: matchedAudit, label: "Audit trail purge" })}
      >
        <ul className="max-h-56 divide-y divide-border overflow-y-auto text-sm">
          {matchedAudit.slice(0, 25).map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.action}</p>
                <p className="truncate text-xs text-muted-foreground">{l.entity || "—"} · {l.details || "—"}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(l.created)}</span>
            </li>
          ))}
          {matchedAudit.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">No matching audit records.</li>}
        </ul>
      </Panel>

      <Panel
        title="Delete notifications" description="Remove notification records matching the filters below"
        icon={Bell} records={notifications} loading={loading}
        filters={notifFilters} setFilters={setNotifFilters}
        userOptions={userOptions}
        statusOptions={[{ value: "read", label: "Read" }, { value: "unread", label: "Unread" }]}
        matched={matchedNotifs} deleting={deleting === "notifications"}
        onDelete={() => setConfirm({ kind: "notifications", collection: "notifications", records: matchedNotifs, label: "Notifications purge" })}
      >
        <ul className="max-h-56 divide-y divide-border overflow-y-auto text-sm">
          {matchedNotifs.slice(0, 25).map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-2">
              <p className="min-w-0 truncate">{n.message}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(n.created)}</span>
            </li>
          ))}
          {matchedNotifs.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">No matching notifications.</li>}
        </ul>
      </Panel>

      <Panel
        title="Delete recent notifications" description="Only notifications created in the last 7 days"
        icon={Clock} records={recentPool} loading={loading}
        filters={recentFilters} setFilters={setRecentFilters}
        userOptions={userOptions}
        statusOptions={[{ value: "read", label: "Read" }, { value: "unread", label: "Unread" }]}
        matched={matchedRecent} deleting={deleting === "recent"}
        onDelete={() => setConfirm({ kind: "recent", collection: "notifications", records: matchedRecent, label: "Recent notifications purge" })}
      >
        <ul className="max-h-56 divide-y divide-border overflow-y-auto text-sm">
          {matchedRecent.slice(0, 25).map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-2">
              <p className="min-w-0 truncate">{n.message}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.created)}</span>
            </li>
          ))}
          {matchedRecent.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">No recent notifications.</li>}
        </ul>
      </Panel>

      <SQLBackupPanel />

      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Confirm permanent deletion</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1 text-sm">
            <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-red-800 dark:bg-red-900/20 dark:text-red-300">
              You are about to permanently delete <strong>{confirm?.records.length}</strong> record(s) from <strong>{confirm?.collection}</strong>. This cannot be undone.
            </div>
            <p className="text-muted-foreground">The purge itself will be written to the audit trail with your account details.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={runDelete}><Trash2 className="mr-1 h-4 w-4" /> Delete permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
