import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Hash, AlertTriangle, CheckCircle2, Wand2, ShieldCheck, RefreshCw,
  Search, Download, X, Loader2, XCircle, MinusCircle,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner, EmptyState, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  buildCorrections, isValidParcelId, abbreviateCommunity, PARCEL_ID_PREFIX,
} from "@/lib/parcelId";

/** Extract a useful message from a PocketBase / network error. */
function errMessage(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.isAbort || err.status === 0) return "Request cancelled or network interrupted";
  if (err.status === 401) {
    return "Your session has expired — please log out and sign in again, then retry";
  }
  if (err.status === 429) {
    return "Rate limited by the server — wait a moment and retry remaining rows";
  }
  if (err.status === 403) {
    return err?.response?.message || err?.message || "Forbidden — admin permission required to change Land IDs";
  }
  if (err.status === 404) return "Parcel no longer exists";
  const data = err?.response?.data;
  if (data && typeof data === "object") {
    const parts = Object.entries(data)
      .map(([field, info]) => {
        const msg = info?.message || info?.code || (typeof info === "string" ? info : "");
        return msg ? `${field}: ${msg}` : "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  return err?.response?.message || err?.message || `Error ${err.status || ""}`.trim();
}

export default function ParcelIdCorrectionPage() {
  const { user, role, roles, log } = useAuth();
  const { toast } = useToast();
  const effectiveRoles = roles && roles.length > 0 ? roles : [role];
  const isAdmin = effectiveRoles.includes("admin");

  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [corrections, setCorrections] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [filterReason, setFilterReason] = useState("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  // parcelId -> { status, reason? }
  const [correctionStatus, setCorrectionStatus] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmMode, setConfirmMode] = useState("all"); // "all" | "selected"
  const [cancelled, setCancelled] = useState(false);
  const cancelRef = useRef(false);
  const applyingRef = useRef(false);
  const [loadError, setLoadError] = useState(null);
  const [loadProgress, setLoadProgress] = useState(null);
  const loadRunIdRef = useRef(0);

  const loadParcels = useCallback(async () => {
    const runId = ++loadRunIdRef.current;
    const PER_PAGE = 300;
    setLoading(true);
    setLoadError(null);
    setLoadProgress({ loaded: 0, total: null });
    try {
      const all = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        if (runId !== loadRunIdRef.current) return;
        let res = null;
        let lastErr = null;
        for (let attempt = 0; attempt < 2 && !res; attempt++) {
          try {
            res = await pb.collection("parcels").getList(page, PER_PAGE, {
              sort: "created",
              requestKey: `pid-correction-load-${runId}-${page}-${attempt}`,
            });
          } catch (err) {
            if (runId !== loadRunIdRef.current) return;
            if (err?.isAbort || err?.status === 0) return;
            lastErr = err;
          }
        }
        if (!res) throw lastErr || new Error("Failed to load parcel records");
        all.push(...res.items);
        totalPages = res.totalPages;
        setLoadProgress({ loaded: all.length, total: res.totalItems });
        page += 1;
      }
      if (runId !== loadRunIdRef.current) return;
      setParcels(all);
    } catch (err) {
      if (runId !== loadRunIdRef.current) return;
      if (err?.isAbort || err?.status === 0) return;
      const msg = errMessage(err) || "Failed to load parcel records. Please retry.";
      setLoadError(msg);
      toast({ variant: "destructive", title: "Load failed", description: msg });
    } finally {
      if (runId === loadRunIdRef.current) {
        setLoading(false);
        setLoadProgress(null);
      }
    }
  }, [toast]);

  useEffect(() => {
    if (isAdmin) loadParcels();
    else setLoading(false);
  }, [isAdmin, loadParcels]);

  const scan = useCallback(() => {
    setScanning(true);
    setCorrectionStatus({});
    setSelectedIds(new Set());
    setResult(null);
    try {
      const corr = buildCorrections(parcels);
      setCorrections(corr);
      if (corr.length === 0) {
        toast({ title: "No ID errors found", description: "All parcel IDs match the TeNDA-PPD-XXXX format." });
      } else {
        toast({ title: `${corr.length} parcel ID${corr.length !== 1 ? "s" : ""} need correction` });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Scan failed", description: err?.message });
    } finally {
      setScanning(false);
    }
  }, [parcels, toast]);

  const validCount = useMemo(
    () => parcels.filter((p) => isValidParcelId(p.parcelNumber, p.community)).length,
    [parcels],
  );
  const invalidCount = corrections.length;

  const reasonOptions = useMemo(() => {
    const set = new Set();
    corrections.forEach((c) => c.reason.split(", ").forEach((r) => set.add(r)));
    return ["all", ...Array.from(set).sort()];
  }, [corrections]);

  const filteredCorrections = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    return corrections.filter((c) => {
      const matchReason = filterReason === "all" || c.reason.includes(filterReason);
      const matchQ = !q ||
        c.currentId.toLowerCase().includes(q) ||
        c.proposedId.toLowerCase().includes(q) ||
        c.community.toLowerCase().includes(q) ||
        c.applicantName.toLowerCase().includes(q);
      return matchReason && matchQ;
    });
  }, [corrections, searchQ, filterReason]);

  // ── Selection helpers ───────────────────────────────────────────
  const selectedCount = useMemo(
    () => corrections.reduce((n, c) => (selectedIds.has(c.parcelId) ? n + 1 : n), 0),
    [corrections, selectedIds],
  );
  const allVisibleSelected = filteredCorrections.length > 0 &&
    filteredCorrections.every((c) => selectedIds.has(c.parcelId));
  const someVisibleSelected = filteredCorrections.some((c) => selectedIds.has(c.parcelId));

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (filteredCorrections.length > 0 && filteredCorrections.every((c) => next.has(c.parcelId))) {
        filteredCorrections.forEach((c) => next.delete(c.parcelId));
      } else {
        filteredCorrections.forEach((c) => next.add(c.parcelId));
      }
      return next;
    });
  }, [filteredCorrections]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Prune stale selections whenever the correction set changes (rescan, retry, rebuild)
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(corrections.map((c) => c.parcelId));
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [corrections]);

  // Auto-unselect rows once they have been processed (corrected/skipped/failed)
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (correctionStatus[id]) changed = true;
        else next.add(id);
      });
      return changed ? next : prev;
    });
  }, [correctionStatus]);

  const exportCorrections = () => {
    const rows = [["Current ID", "Proposed ID", "Community", "Area Council", "Applicant", "Reason", "Status", "Detail"]];
    corrections.forEach((c) => {
      const st = correctionStatus[c.parcelId];
      rows.push([
        c.currentId, c.proposedId, c.community, c.areaCouncil, c.applicantName, c.reason,
        st?.status || "", st?.reason || "",
      ]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parcel-id-corrections-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Apply one correction with minimal round-trips:
   * 1) PATCH parcelNumber (unique requestKey)
   * 2) best-effort payment denorm sync
   * 3) best-effort audit log
   * Pre-flight conflict checks use the in-memory claimed set (no extra GETs),
   * with a single re-fetch only when the update fails with a conflict-like error.
   */
  const applyOne = async (c, claimedIds, runToken) => {
    if (cancelRef.current) {
      return { id: c.parcelId, status: "skipped", reason: "Cancelled" };
    }

    // Local conflict: proposed ID already taken by another parcel (or earlier success)
    if (claimedIds.has(c.proposedId)) {
      return {
        id: c.parcelId,
        status: "skipped",
        reason: "Proposed ID already in use",
        oldId: c.currentId,
        newId: c.proposedId,
      };
    }

    // Already at proposed (e.g. retry after partial run)
    if (c.currentId === c.proposedId) {
      return {
        id: c.parcelId,
        status: "skipped",
        reason: "Already corrected",
        oldId: c.currentId,
        newId: c.proposedId,
      };
    }

    try {
      const updated = await pb.collection("parcels").update(
        c.parcelId,
        { parcelNumber: c.proposedId },
        { requestKey: `pid-fix-${runToken}-${c.parcelId}` },
      );

      // Release old id from claimed set if it was the previous value
      if (c.currentId && c.currentId !== "(empty)") {
        claimedIds.delete(c.currentId);
      }
      claimedIds.add(updated.parcelNumber || c.proposedId);

      // Sync denormalised parcelNumber on related payments (best-effort)
      try {
        const pays = await pb.collection("payments").getFullList({
          filter: pb.filter("parcel = {:pid}", { pid: c.parcelId }),
          fields: "id,parcelNumber",
          requestKey: `pid-pay-${runToken}-${c.parcelId}`,
        });
        await Promise.all(
          pays
            .filter((pay) => pay.parcelNumber !== c.proposedId)
            .map((pay) =>
              pb.collection("payments").update(
                pay.id,
                { parcelNumber: c.proposedId },
                { requestKey: `pid-pay-upd-${runToken}-${pay.id}` },
              ).catch(() => null),
            ),
        );
      } catch (_) { /* non-fatal */ }

      // Audit log (best-effort)
      try {
        await pb.collection("audit_logs").create({
          actor: user.id,
          action: "parcel_id_corrected",
          entity: c.parcelId,
          details: JSON.stringify({
            oldId: c.currentId,
            newId: c.proposedId,
            community: c.community,
            reason: c.reason,
            correctedBy: user.email,
            batch: "parcel-id-correction",
            timestamp: new Date().toISOString(),
          }).slice(0, 1900),
        }, { requestKey: `pid-audit-${runToken}-${c.parcelId}` });
      } catch (_) {}

      return {
        id: c.parcelId,
        status: "corrected",
        oldId: c.currentId,
        newId: c.proposedId,
      };
    } catch (err) {
      // Distinguish skip-worthy conflicts from hard failures
      const msg = errMessage(err);
      const status = err?.status;

      if (status === 404) {
        return { id: c.parcelId, status: "skipped", reason: "Parcel no longer exists", oldId: c.currentId, newId: c.proposedId };
      }

      // Re-fetch once to classify race / already-corrected
      if (status === 400 || status === 403 || msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("already")) {
        try {
          const current = await pb.collection("parcels").getOne(c.parcelId, {
            fields: "id,parcelNumber",
            requestKey: `pid-rechk-${runToken}-${c.parcelId}`,
          });
          if (current.parcelNumber === c.proposedId) {
            claimedIds.add(c.proposedId);
            return { id: c.parcelId, status: "skipped", reason: "Already corrected", oldId: c.currentId, newId: c.proposedId };
          }
          if (current.parcelNumber && current.parcelNumber !== c.currentId) {
            return {
              id: c.parcelId,
              status: "skipped",
              reason: `ID changed since scan (now ${current.parcelNumber})`,
              oldId: c.currentId,
              newId: current.parcelNumber,
            };
          }
        } catch (_) { /* fall through to failed */ }
      }

      throw Object.assign(err instanceof Error ? err : new Error(msg), { friendlyMessage: msg });
    }
  };

  const applyCorrections = async (items) => {
    const itemsToApply = Array.isArray(items) ? items : corrections;
    if (applyingRef.current) return;
    applyingRef.current = true;
    cancelRef.current = false;
    setCancelled(false);
    setApplying(true);
    setCorrectionStatus({});
    setResult(null);
    setConfirmOpen(false);

    const runToken = `${Date.now().toString(36)}`;
    const total = itemsToApply.length;
    let done = 0;
    let succeeded = 0;
    let skipped = 0;
    let failed = 0;
    const failures = [];
    setProgress({ done, total, succeeded, skipped, failed });

    // Track IDs claimed across the live dataset so we never double-assign
    const claimedIds = new Set(
      parcels.map((p) => p.parcelNumber).filter(Boolean),
    );

    // Modest concurrency — enough throughput without stampeding the API
    const BATCH = 5;

    try {
      for (let i = 0; i < total; i += BATCH) {
        if (cancelRef.current) break;
        const batch = itemsToApply.slice(i, i + BATCH);

        // Sequential within a tiny micro-queue would be safer for claimedIds
        // mutations; use allSettled but apply claimedIds updates only after
        // each result is known (results processed in order below).
        const results = [];
        for (const c of batch) {
          if (cancelRef.current) {
            results.push({
              status: "fulfilled",
              value: { id: c.parcelId, status: "skipped", reason: "Cancelled" },
            });
            continue;
          }
          try {
            const value = await applyOne(c, claimedIds, runToken);
            results.push({ status: "fulfilled", value });
          } catch (reason) {
            results.push({ status: "rejected", reason });
          }
        }

        const statusUpdates = {};
        results.forEach((r, idx) => {
          done++;
          const c = batch[idx];
          if (r.status === "fulfilled") {
            const res = r.value;
            if (res.status === "corrected") {
              succeeded++;
              statusUpdates[c.parcelId] = { status: "corrected" };
            } else {
              skipped++;
              statusUpdates[c.parcelId] = { status: "skipped", reason: res.reason || "Skipped" };
              failures.push({ ...c, skipReason: res.reason });
            }
          } else {
            failed++;
            const reason = r.reason?.friendlyMessage || errMessage(r.reason);
            statusUpdates[c.parcelId] = { status: "failed", reason };
            failures.push({ ...c, error: reason });
          }
        });
        setCorrectionStatus((prev) => ({ ...prev, ...statusUpdates }));
        setProgress({ done, total, succeeded, skipped, failed });
      }

      const wasCancelled = cancelRef.current;
      await log(
        "parcel_id_correction_run",
        "parcels",
        `Corrected ${succeeded}/${total} parcel IDs (${skipped} skipped, ${failed} failed${wasCancelled ? ", cancelled" : ""})`,
      );
      setResult({ succeeded, skipped, failed, total, failures, cancelled: wasCancelled });
      toast({
        title: wasCancelled ? "ID correction cancelled" : "ID correction complete",
        description: `${succeeded} corrected${skipped ? `, ${skipped} skipped` : ""}${failed ? `, ${failed} failed` : ""}.${wasCancelled ? " Completed corrections are preserved." : ""}`,
        variant: failed && !succeeded ? "destructive" : "default",
      });
      await loadParcels();
      if (!wasCancelled && failed === 0) {
        setCorrections([]);
        setCorrectionStatus({});
        setSelectedIds(new Set());
      }
      // Partial runs: remaining corrections rebuild from fresh parcels in the effect below
    } catch (err) {
      toast({ variant: "destructive", title: "Correction aborted", description: errMessage(err) });
    } finally {
      setApplying(false);
      setProgress(null);
      applyingRef.current = false;
      cancelRef.current = false;
    }
  };

  // After a partial success, rebuild corrections from the latest parcels list
  useEffect(() => {
    if (applying || loading) return;
    if (!result || result.cancelled) return;
    if (result.failed === 0 && result.skipped === 0) return;
    if (result.succeeded === 0) return;
    // Refresh the queue list so corrected rows drop out
    try {
      const corr = buildCorrections(parcels);
      setCorrections(corr);
    } catch (_) {}
    // only when parcels refresh after a run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels]);

  const cancelApply = () => {
    if (!applyingRef.current) return;
    cancelRef.current = true;
    setCancelled(true);
    toast({
      title: "Cancelling…",
      description: "Will stop after the current batch. Completed corrections are preserved.",
    });
  };

  const retryFailed = () => {
    const failedIds = new Set(
      Object.entries(correctionStatus)
        .filter(([, v]) => v?.status === "failed")
        .map(([id]) => id),
    );
    if (failedIds.size === 0) {
      toast({ title: "Nothing to retry", description: "No failed rows in the current list." });
      return;
    }
    const remaining = corrections.filter(
      (c) => failedIds.has(c.parcelId) || !correctionStatus[c.parcelId] || correctionStatus[c.parcelId]?.status === "failed",
    );
    // Keep only failed (and any not-yet-processed) for a focused retry
    const onlyFailed = corrections.filter((c) => failedIds.has(c.parcelId));
    setCorrections(onlyFailed.length ? onlyFailed : remaining);
    setCorrectionStatus({});
    setSelectedIds(new Set());
    setResult(null);
    setConfirmOpen(true);
    toast({ title: `Ready to retry ${onlyFailed.length || remaining.length} failed correction(s)` });
  };

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="District Administrators only"
        message="The Parcel ID correction tool is restricted to District Assembly Administrators."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Parcel ID Correction"
        subtitle="Identify and repair malformed or inconsistent parcel IDs (TeNDA-PPD-XXXX format)"
        icon={Hash}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadParcels} disabled={loading || applying}>
              <RefreshCw className="mr-1 h-4 w-4" /> Reload
            </Button>
            <Button variant="outline" size="sm" onClick={exportCorrections} disabled={corrections.length === 0}>
              <Download className="mr-1 h-4 w-4" /> Export report
            </Button>
            <Button size="sm" onClick={scan} disabled={scanning || loading || applying}>
              {scanning ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
              Scan for ID errors
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" /> Canonical format
        </p>
        <p className="mt-1 text-xs">
          Every parcel ID must follow <code className="font-mono bg-white/60 dark:bg-black/30 px-1 rounded">{PARCEL_ID_PREFIX}[COMMUNITY ABBR]-XXXX</code>,
          e.g. <code className="font-mono bg-white/60 dark:bg-black/30 px-1 rounded">TeNDA-PPD-ADUM-0001</code>. The abbreviation is the first 4 letters of the community name (uppercased). This tool previews and repairs invalid IDs in bulk.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total parcels" value={parcels.length} icon={Hash} accent="primary" />
        <StatCard label="Valid IDs" value={validCount} icon={CheckCircle2} accent="blue" />
        <StatCard label="Need correction" value={invalidCount} icon={AlertTriangle} accent="amber" />
      </div>

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="font-semibold text-destructive">Failed to load parcel records</p>
          <p className="text-sm text-muted-foreground break-words">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadParcels}>
            <RefreshCw className="mr-1 h-4 w-4" /> Retry load
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          <Spinner />
          {loadProgress && (
            <p className="text-center text-xs text-muted-foreground">
              Loading parcel records… {loadProgress.loaded}
              {loadProgress.total != null ? ` of ${loadProgress.total}` : ""}
            </p>
          )}
        </div>
      ) : parcels.length === 0 ? (
        <EmptyState icon={Hash} title="No parcels loaded" message="Reload to scan parcel records for ID errors." />
      ) : corrections.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={scanning ? "Scanning…" : "No corrections queued"}
          message={scanning ? "Analysing parcel IDs…" : "Click ‘Scan for ID errors’ to detect malformed, duplicate or community-mismatched parcel IDs."}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search by current/proposed ID, community, applicant…" className="pl-9" />
            </div>
            <select value={filterReason} onChange={(e) => setFilterReason(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm">
              {reasonOptions.map((r) => <option key={r} value={r}>{r === "all" ? "All reasons" : r}</option>)}
            </select>
            {Object.values(correctionStatus).some((s) => s?.status === "failed") && !applying && (
              <Button variant="outline" onClick={retryFailed}>
                <RefreshCw className="mr-1 h-4 w-4" /> Retry failed
              </Button>
            )}
            <Button variant="default" onClick={() => { setConfirmMode("selected"); setConfirmOpen(true); }}
              disabled={applying || selectedCount === 0}>
              <Wand2 className="mr-1 h-4 w-4" /> Correct selected ({selectedCount})
            </Button>
            <Button variant="destructive" onClick={() => { setConfirmMode("all"); setConfirmOpen(true); }} disabled={applying}>
              <Wand2 className="mr-1 h-4 w-4" /> Correct all ({corrections.length})
            </Button>
          </div>

          {selectedCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span className="font-medium text-primary">
                {selectedCount} parcel{selectedCount !== 1 ? "s" : ""} selected for correction
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={clearSelection} disabled={applying}>Clear selection</Button>
                <Button size="sm" variant="default" onClick={() => { setConfirmMode("selected"); setConfirmOpen(true); }} disabled={applying}>
                  <Wand2 className="mr-1 h-4 w-4" /> Correct selected ({selectedCount})
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                      onCheckedChange={toggleSelectVisible}
                      aria-label="Select all visible corrections"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Current ID</th>
                  <th className="px-4 py-3 font-medium">Proposed ID</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Community</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Applicant</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCorrections.map((c) => {
                  const st = correctionStatus[c.parcelId];
                  const isDone = st?.status === "corrected" || st?.status === "skipped" || st?.status === "failed";
                  return (
                    <tr key={c.parcelId} className="hover:bg-muted/20">
                      <td className="px-4 py-3 w-10">
                        <Checkbox
                          checked={selectedIds.has(c.parcelId)}
                          onCheckedChange={() => toggleSelect(c.parcelId)}
                          disabled={isDone || applying}
                          aria-label={`Select parcel ${c.currentId}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-destructive whitespace-nowrap">{c.currentId}</td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{c.proposedId}</td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <p className="text-xs">{c.community}</p>
                        <p className="text-[10px] text-muted-foreground">abbr: {abbreviateCommunity(c.community)}</p>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell text-muted-foreground">{c.applicantName}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex flex-wrap gap-1">
                          {c.reason.split(", ").map((r) => (
                            <span key={r} className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium">
                              {r}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {st?.status === "corrected" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4 shrink-0" /> Corrected
                          </span>
                        ) : st?.status === "skipped" ? (
                          <span className="inline-flex flex-col items-start gap-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <span className="inline-flex items-center gap-1"><MinusCircle className="h-4 w-4 shrink-0" /> Skipped</span>
                            {st.reason && <span className="text-[10px] font-normal text-muted-foreground max-w-[14rem] break-words">{st.reason}</span>}
                          </span>
                        ) : st?.status === "failed" ? (
                          <span className="inline-flex flex-col items-start gap-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                            <span className="inline-flex items-center gap-1"><XCircle className="h-4 w-4 shrink-0" /> Failed</span>
                            {st.reason && <span className="text-[10px] font-normal max-w-[14rem] break-words" title={st.reason}>{st.reason}</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border bg-muted/20">
                <tr>
                  <td colSpan={7} className="px-4 py-2.5 text-xs text-muted-foreground">
                    Showing {filteredCorrections.length} of {corrections.length} corrections{selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {applying && progress && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-primary flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {cancelled ? "Cancelling…" : "Applying corrections…"}
            </span>
            <span className="font-mono font-bold">{progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-border overflow-hidden">
            <div className="h-full bg-primary transition-all duration-200 rounded-full"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5">
              <p className="text-muted-foreground">Corrected</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-400">{progress.succeeded}</p>
            </div>
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5">
              <p className="text-muted-foreground">Skipped</p>
              <p className="font-bold text-amber-700 dark:text-amber-400">{progress.skipped}</p>
            </div>
            <div className="rounded-md bg-red-50 dark:bg-red-950/30 px-2 py-1.5">
              <p className="text-muted-foreground">Failed</p>
              <p className="font-bold text-red-700 dark:text-red-400">{progress.failed}</p>
            </div>
            <div className="rounded-md bg-muted px-2 py-1.5">
              <p className="text-muted-foreground">Processed</p>
              <p className="font-bold text-foreground">{progress.done}/{progress.total}</p>
            </div>
            <div className="rounded-md bg-muted px-2 py-1.5">
              <p className="text-muted-foreground">Remaining</p>
              <p className="font-bold text-foreground">{Math.max(0, progress.total - progress.done)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Corrections apply in realtime — other users see updates as each batch completes.</p>
            <Button size="sm" variant="outline" onClick={cancelApply} disabled={cancelled}>
              <X className="mr-1 h-3.5 w-3.5" /> {cancelled ? "Stopping…" : "Cancel"}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className={cn("rounded-xl border p-4 space-y-2 shadow-sm",
          result.cancelled ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700"
          : result.failed ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"
                        : "border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-700")}>
          <p className="font-semibold flex items-center gap-2">
            {result.cancelled ? <X className="h-4 w-4" /> : result.failed ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {result.cancelled ? "Correction run cancelled" : "Correction run complete"}
          </p>
          <p className="text-sm">
            {result.succeeded} of {result.total} parcel IDs were corrected successfully
            {result.skipped ? `, ${result.skipped} skipped (conflict/already corrected)` : ""}
            {result.failed ? `, ${result.failed} failed and remain unchanged` : ""}.
            {result.cancelled && " Completed corrections are preserved; remaining records were not processed."}
          </p>
          {result.failures && result.failures.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">View {result.failures.length} skipped/failed record(s)</summary>
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {result.failures.map((f, i) => (
                  <li key={i} className="font-mono text-destructive break-words">
                    {f.currentId} → {f.proposedId} ({f.community}) — {f.skipReason || f.error || "error"}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setResult(null)}>Dismiss</Button>
            {result.failed > 0 && (
              <Button size="sm" variant="destructive" onClick={retryFailed}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry failed ({result.failed})
              </Button>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!applying) setConfirmOpen(o); }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Confirm Parcel ID Correction
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  <p className="font-bold mb-1">This changes parcel identifiers and cannot be undone.</p>
                  <p>{confirmMode === "selected"
                    ? `${selectedCount} selected parcel ID${selectedCount !== 1 ? "s" : ""} will be permanently changed to the TeNDA-PPD-XXXX format.`
                    : `${corrections.length} parcel ID${corrections.length !== 1 ? "s" : ""} will be permanently changed to the TeNDA-PPD-XXXX format.`} Related payment records and audit logs will be synced. This operation is logged with your administrator account.</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Do you want to proceed with {confirmMode === "selected"
                    ? `correcting ${selectedCount} selected parcel${selectedCount !== 1 ? "s" : ""}`
                    : `correcting all ${corrections.length} parcel${corrections.length !== 1 ? "s" : ""}`}?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setConfirmOpen(false)}
              disabled={applying}
              className="mt-2 sm:mt-0"
            >
              No, cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={applying || (confirmMode === "selected" && selectedCount === 0)}
              onClick={(ev) => {
                ev.preventDefault();
                const items = confirmMode === "selected"
                  ? corrections.filter((c) => selectedIds.has(c.parcelId))
                  : corrections;
                applyCorrections(items);
              }}
            >
              {applying ? "Applying…" : `Yes, correct ${confirmMode === "selected" ? selectedCount : corrections.length} parcel${(confirmMode === "selected" ? selectedCount : corrections.length) !== 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
