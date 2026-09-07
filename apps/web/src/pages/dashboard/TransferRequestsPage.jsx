import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet";
import {
  ArrowRightLeft, Search, Filter, Printer, Download, Eye, CheckCircle2,
  XCircle, Wallet, Bell, ChevronDown,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/useCollection";
import { sendSms } from "@/lib/messaging";
import { PageHeader, Spinner, EmptyState } from "@/components/shared";
import { titleCase, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import PaginationControl, { usePagination } from "@/components/Pagination";
import TransferDetail, { buildTransferRow, exportTransfersCSV, exportTransfersXLSX, exportTransferPDF } from "@/components/TransferDetail";

const STATUS_FILTERS = ["all", "pending", "approved", "rejected"];
const PAY_FILTERS = ["all", "unpaid", "pending", "paid", "failed"];
const SORT_OPTIONS = [
  { value: "-created", label: "Date (newest first)" },
  { value: "+created", label: "Date (oldest first)" },
  { value: "status", label: "Status" },
  { value: "payment", label: "Payment status" },
  { value: "applicant", label: "Applicant name" },
];

function StatCard({ label, value, tone }) {
  return (
    <div className={cn("rounded-xl border p-3", tone || "border-border bg-card")}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export function StatusPill({ status }) {
  const map = {
    approved: "border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-900/30",
    rejected: "border-red-300 bg-red-50 text-red-800 dark:bg-red-900/30",
    pending: "border-yellow-300 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30",
    paid: "border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-900/30",
    failed: "border-red-300 bg-red-50 text-red-800 dark:bg-red-900/30",
    unpaid: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", map[status] || map.unpaid)}>
      {titleCase(status || "unpaid")}
    </span>
  );
}

export default function TransferRequestsPage() {
  const { user, role, roles, log } = useAuth();
  const { toast } = useToast();

  const effectiveRoles = roles?.length > 0 ? roles : [role];
  const isAdmin = effectiveRoles.includes("admin");
  const canApprove = isAdmin || effectiveRoles.includes("planning_officer") || effectiveRoles.includes("registrar");

  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payFilter, setPayFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("-created");
  const [selected, setSelected] = useState(null);
  const [actionMode, setActionMode] = useState(null);
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [trf, pays] = await Promise.all([
        pb.collection("land_transfers").getFullList({
          sort: "-created",
          expand: "parcel,fromOwner,toOwnerUser,reviewedBy",
          requestKey: "trfreq-load",
        }).catch(() => []),
        pb.collection("payments").getFullList({
          sort: "-created", requestKey: "trfreq-pays",
        }).catch(() => []),
      ]);
      setTransfers(trf);
      setPayments(pays);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime updates
  useEffect(() => {
    void pb.collection("land_transfers").subscribe("*", () => { load(); })
      .catch((err) => console.error("transfer subscription failed", err));
    return () => { void pb.collection("land_transfers").unsubscribe("*").catch(() => {}); };
  }, [load]);

  const rows = useMemo(
    () => transfers.map((t) => buildTransferRow(t, payments)),
    [transfers, payments],
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (payFilter !== "all") list = list.filter((r) => r.paymentStatus === payFilter);
    if (fromDate) list = list.filter((r) => new Date(r.created) >= new Date(fromDate));
    if (toDate) list = list.filter((r) => new Date(r.created) <= new Date(`${toDate}T23:59:59`));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.id, r.certificateNumber, r.applicantName, r.toOwnerName, r.parcelNumber,
          r.community, r.sector, r.plotNumber, r.block]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    const sorted = [...list];
    if (sortBy === "-created") sorted.sort((a, b) => new Date(b.created) - new Date(a.created));
    else if (sortBy === "+created") sorted.sort((a, b) => new Date(a.created) - new Date(b.created));
    else if (sortBy === "status") sorted.sort((a, b) => String(a.status).localeCompare(String(b.status)));
    else if (sortBy === "payment") sorted.sort((a, b) => String(a.paymentStatus).localeCompare(String(b.paymentStatus)));
    else if (sortBy === "applicant") sorted.sort((a, b) => String(a.applicantName).localeCompare(String(b.applicantName)));
    return sorted;
  }, [rows, statusFilter, payFilter, fromDate, toDate, search, sortBy]);

  const {
    page, setPage, pageSize, setPageSize, totalPages, totalRecords, pageItems,
  } = usePagination(filtered, "tnda-trfreq-page-size", 10);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    paid: rows.filter((r) => r.paymentStatus === "paid").length,
    unpaid: rows.filter((r) => r.paymentStatus !== "paid").length,
  }), [rows]);

  const openDetail = (row) => { setSelected(row); setActionMode(null); setComment(""); };

  const runAction = async () => {
    if (!selected || !actionMode) return;
    setActing(true);
    try {
      const status = actionMode === "approve" ? "approved" : "rejected";
      await pb.collection("land_transfers").update(selected.id, {
        status,
        reviewedBy: user.id,
        reviewComment: comment.trim(),
      }, { requestKey: `trfreq-act-${selected.id}` });

      if (actionMode === "approve" && selected.parcelId) {
        const updates = {};
        if (selected.toOwnerUserId) updates.owner = selected.toOwnerUserId;
        if (selected.toOwnerName) updates.applicantName = selected.toOwnerName;
        if (selected.toOwnerPhone) updates.contactPhone = selected.toOwnerPhone;
        if (selected.newOwnerEmail) updates.applicantEmail = selected.newOwnerEmail;
        if (selected.newOwnerReligion) updates.religion = selected.newOwnerReligion;
        if (selected.newOwnerTribe) updates.tribe = selected.newOwnerTribe;
        if (Object.keys(updates).length) {
          await pb.collection("parcels").update(selected.parcelId, updates, { requestKey: `trfreq-parcel-${selected.id}` });
        }
      }

      await log?.(`transfer_${status}`, "land_transfers", `${selected.certificateNumber || selected.id} — ${selected.parcelNumber}`);

      // Notify applicant and new owner
      const msg = actionMode === "approve"
        ? `Transfer ${selected.certificateNumber || ""} for ${selected.parcelNumber} was approved.${comment ? " " + comment : ""}`
        : `Transfer ${selected.certificateNumber || ""} for ${selected.parcelNumber} was rejected.${comment ? " Reason: " + comment : ""}`;
      if (selected.applicantId) await notify(selected.applicantId, msg, "/app/my-transfers").catch(() => {});
      if (selected.toOwnerUserId) await notify(selected.toOwnerUserId, msg, "/app/my-transfers").catch(() => {});
      if (selected.applicantPhone) await sendSms(selected.applicantPhone, `${msg} - TeNDA PPD`).catch(() => {});
      if (selected.toOwnerPhone) await sendSms(selected.toOwnerPhone, `${msg} - TeNDA PPD`).catch(() => {});

      toast({ title: `Transfer ${status}`, description: selected.parcelNumber });
      setSelected(null);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: "Action failed", description: err?.message || "Please try again." });
    } finally {
      setActing(false);
    }
  };

  const sendReminder = async (row) => {
    try {
      const msg = `Reminder: transfer request ${row.certificateNumber || row.id} for land ${row.parcelNumber} is still ${row.status}. Payment: ${titleCase(row.paymentStatus)}. - TeNDA PPD`;
      if (row.applicantId) await notify(row.applicantId, msg, "/app/my-transfers").catch(() => {});
      if (row.applicantPhone) await sendSms(row.applicantPhone, msg).catch(() => {});
      toast({ title: "Reminder sent", description: row.applicantName });
    } catch (err) {
      toast({ variant: "destructive", title: "Could not send reminder", description: err?.message });
    }
  };

  const clearFilters = () => {
    setStatusFilter("all"); setPayFilter("all"); setFromDate(""); setToDate(""); setSearch("");
  };

  return (
    <>
      <Helmet>
        <title>Transfer Requests — Techiman North Land Registry</title>
        <meta name="description" content="Review, approve and track all land transfer requests, their payment status and full transfer details." />
      </Helmet>

      <PageHeader
        title="Transfer Requests"
        subtitle="All land transfer requests with status and payment tracking"
        icon={ArrowRightLeft}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-1 h-4 w-4" /> Export
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportTransfersCSV(filtered, "transfer-requests")}>CSV — filtered list</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportTransfersXLSX(filtered, "transfer-requests")}>Excel — filtered list</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportTransfersCSV(filtered, "transfer-statistics", stats)}>CSV — statistics report</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total requests" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} tone="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20" />
        <StatCard label="Approved" value={stats.approved} tone="border-blue-200 bg-blue-50 dark:bg-blue-900/20" />
        <StatCard label="Rejected" value={stats.rejected} tone="border-red-200 bg-red-50 dark:bg-red-900/20" />
        <StatCard label="Paid" value={stats.paid} />
        <StatCard label="Unpaid" value={stats.unpaid} />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transfer ID, applicant, new owner, land details…" className="pl-9 h-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : titleCase(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={payFilter} onValueChange={setPayFilter}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAY_FILTERS.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All payments" : titleCase(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From date</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-40 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To date</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-40 text-xs" />
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
            <Filter className="mr-1 h-3.5 w-3.5" /> Clear filters
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {rows.length} requests</span>
        </div>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={ArrowRightLeft} title="No transfer requests found"
          message={rows.length === 0 ? "No land transfer requests have been submitted yet." : "No requests match your current filters."} />
      ) : (
        <div className="overflow-table-wrapper rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Transfer ID</th>
                <th className="px-3 py-2.5">Applicant</th>
                <th className="px-3 py-2.5">Land details</th>
                <th className="px-3 py-2.5">New owner</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Payment</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono text-xs">{r.certificateNumber || r.id.slice(0, 8)}</td>
                  <td className="px-3 py-2.5">{r.applicantName}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.community || "—"} · Sec {r.sector || "—"} · Plot {r.plotNumber || "—"}/{r.block || "—"}
                  </td>
                  <td className="px-3 py-2.5">{r.toOwnerName || "—"}</td>
                  <td className="px-3 py-2.5 text-xs">{formatDate(r.created)}</td>
                  <td className="px-3 py-2.5"><StatusPill status={r.status} /></td>
                  <td className="px-3 py-2.5"><StatusPill status={r.paymentStatus} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openDetail(r)} title="View details">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {canApprove && r.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-blue-700 border-blue-200"
                            onClick={() => { setSelected(r); setActionMode("approve"); setComment(""); }} title="Approve">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 border-red-200"
                            onClick={() => { setSelected(r); setActionMode("reject"); setComment(""); }} title="Reject">
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openDetail(r)} title="View payment">
                        <Wallet className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => sendReminder(r)} title="Send reminder">
                        <Bell className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <PaginationControl currentPage={page} totalPages={totalPages} totalRecords={totalRecords}
          pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}

      {/* Detail / action dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setActionMode(null); } }}>
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Transfer {selected?.certificateNumber || selected?.id?.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          <div className="dialog-scroll flex-1 px-6 py-5">
            {selected && (
              <div className="space-y-4">
                <TransferDetail row={selected} />
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="mr-1 h-4 w-4" /> Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportTransferPDF(selected)}>
                    <Download className="mr-1 h-4 w-4" /> Export PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportTransfersXLSX([selected], `transfer-${selected.id}`)}>
                    <Download className="mr-1 h-4 w-4" /> Export Excel
                  </Button>
                </div>

                {canApprove && selected.status === "pending" && (
                  <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
                    <Label className="text-xs font-medium">
                      {actionMode === "reject" ? "Rejection reason" : "Review comment"} {actionMode === "reject" && <span className="text-destructive">*</span>}
                    </Label>
                    <Input value={comment} onChange={(e) => setComment(e.target.value)}
                      placeholder={actionMode === "reject" ? "Why is this transfer rejected?" : "Optional comment…"} />
                    <div className="flex gap-2 pt-1">
                      <Button className="flex-1" disabled={acting}
                        onClick={() => { setActionMode("approve"); runAction(); }}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> {acting ? "Working…" : "Approve transfer"}
                      </Button>
                      <Button variant="destructive" className="flex-1" disabled={acting || (actionMode === "reject" && !comment.trim())}
                        onClick={() => {
                          if (!comment.trim()) {
                            setActionMode("reject");
                            toast({ variant: "destructive", title: "Rejection reason required" });
                            return;
                          }
                          setActionMode("reject");
                          runAction();
                        }}>
                        <XCircle className="mr-1 h-4 w-4" /> Reject transfer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
