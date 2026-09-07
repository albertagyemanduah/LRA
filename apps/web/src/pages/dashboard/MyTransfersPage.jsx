import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet";
import { Send, Eye, Wallet, Pencil, XCircle, Printer, Download } from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner, EmptyState } from "@/components/shared";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import PaginationControl, { usePagination } from "@/components/Pagination";
import TransferDetail, { buildTransferRow, exportTransfersXLSX, exportTransferPDF } from "@/components/TransferDetail";
import { StatusPill } from "@/pages/dashboard/TransferRequestsPage";

export default function MyTransfersPage() {
  const { user, log } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({ toOwnerName: "", toOwnerPhone: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [transfers, payments] = await Promise.all([
        pb.collection("land_transfers").getFullList({
          filter: pb.filter("fromOwner = {:u}", { u: user.id }),
          sort: "-created",
          expand: "parcel,fromOwner,toOwnerUser,reviewedBy",
          requestKey: "mytrf-load",
        }).catch(() => []),
        pb.collection("payments").getFullList({ sort: "-created", requestKey: "mytrf-pays" }).catch(() => []),
      ]);
      setRows(transfers.map((t) => buildTransferRow(t, payments)));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime status updates for the user's transfers
  useEffect(() => {
    void pb.collection("land_transfers").subscribe("*", () => { load(); })
      .catch((err) => console.error("my transfers subscription failed", err));
    return () => { void pb.collection("land_transfers").unsubscribe("*").catch(() => {}); };
  }, [load]);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  }), [rows]);

  const { page, setPage, pageSize, setPageSize, totalPages, totalRecords, pageItems } =
    usePagination(rows, "tnda-mytrf-page-size", 10);

  const openEdit = (r) => {
    setEditRow(r);
    setEditForm({ toOwnerName: r.toOwnerName || "", toOwnerPhone: r.toOwnerPhone || "", reason: r.reason || "" });
  };

  const saveEdit = async () => {
    if (!editRow) return;
    if (!editForm.toOwnerName.trim()) {
      toast({ variant: "destructive", title: "New owner name is required" });
      return;
    }
    setSaving(true);
    try {
      await pb.collection("land_transfers").update(editRow.id, {
        toOwnerName: editForm.toOwnerName.trim().slice(0, 200),
        toOwnerPhone: editForm.toOwnerPhone.trim().slice(0, 30),
        reason: editForm.reason.trim().slice(0, 1000),
      }, { requestKey: `mytrf-edit-${editRow.id}` });
      await log?.("transfer_updated", "land_transfers", `${editRow.certificateNumber || editRow.id} edited by owner`);
      toast({ title: "Transfer updated" });
      setEditRow(null);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const cancelTransfer = async (r) => {
    if (!window.confirm(`Cancel transfer request ${r.certificateNumber || r.id}? This cannot be undone.`)) return;
    try {
      await pb.collection("land_transfers").delete(r.id, { requestKey: `mytrf-del-${r.id}` });
      await log?.("transfer_cancelled", "land_transfers", `${r.certificateNumber || r.id} cancelled by owner`);
      toast({ title: "Transfer request cancelled" });
      load();
    } catch (err) {
      toast({ variant: "destructive", title: "Could not cancel", description: err?.message });
    }
  };

  return (
    <>
      <Helmet>
        <title>My Transfers — Techiman North Land Registry</title>
        <meta name="description" content="View the status, land details, new owner information and payment status of every land transfer you have initiated." />
      </Helmet>

      <PageHeader
        title="My Transfers"
        subtitle="Land transfer requests you have initiated"
        icon={Send}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total", stats.total, "border-border bg-card"],
          ["Pending", stats.pending, "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20"],
          ["Approved", stats.approved, "border-blue-200 bg-blue-50 dark:bg-blue-900/20"],
          ["Rejected", stats.rejected, "border-red-200 bg-red-50 dark:bg-red-900/20"],
        ].map(([label, value, tone]) => (
          <div key={label} className={`rounded-xl border p-3 ${tone}`}>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={Send} title="No transfers yet"
          message="You have not initiated any land transfer requests. Start one from the Land Registration page." />
      ) : (
        <div className="overflow-table-wrapper rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Transfer ID</th>
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
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.parcelNumber || "—"} · {r.community || "—"} · Sec {r.sector || "—"} · Plot {r.plotNumber || "—"}/{r.block || "—"}
                  </td>
                  <td className="px-3 py-2.5">{r.toOwnerName || "—"}</td>
                  <td className="px-3 py-2.5 text-xs">{formatDate(r.created)}</td>
                  <td className="px-3 py-2.5"><StatusPill status={r.status} /></td>
                  <td className="px-3 py-2.5"><StatusPill status={r.paymentStatus} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setSelected(r)} title="View details">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setSelected(r)} title="View payment">
                        <Wallet className="h-3.5 w-3.5" />
                      </Button>
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEdit(r)} title="Edit request">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 border-red-200"
                            onClick={() => cancelTransfer(r)} title="Cancel request">
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <PaginationControl currentPage={page} totalPages={totalPages} totalRecords={totalRecords}
          pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-4">
            <DialogTitle>Transfer {selected?.certificateNumber || selected?.id?.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          <div className="dialog-scroll flex-1 px-6 py-5 space-y-4">
            {selected && (
              <>
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit pending transfer dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Transfer Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">New Owner Name <span className="text-destructive">*</span></Label>
              <Input value={editForm.toOwnerName}
                onChange={(e) => setEditForm((f) => ({ ...f, toOwnerName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">New Owner Contact</Label>
              <Input value={editForm.toOwnerPhone}
                onChange={(e) => setEditForm((f) => ({ ...f, toOwnerPhone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Transfer Reason</Label>
              <Input value={editForm.reason}
                onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditRow(null)}>Cancel</Button>
              <Button className="flex-1" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
