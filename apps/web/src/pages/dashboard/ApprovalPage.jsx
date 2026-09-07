import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import {
  ClipboardCheck, Search, Filter, Check, X, Eye, ArrowLeft, ArrowRight,
  ChevronDown, ChevronUp, FileEdit, Trash2, ArrowRightLeft, Clock,
  User, MapPin, Calendar, AlertTriangle, MessageSquare, RefreshCw, Lock,
  Edit2, Save, ShieldAlert,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge, Spinner, EmptyState } from "@/components/shared";
import { formatDate, titleCase } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const TYPE_META = {
  edit: { label: "Land Edit", icon: FileEdit, color: "text-blue-600 bg-blue-100" },
  delete: { label: "Land Delete", icon: Trash2, color: "text-red-600 bg-red-100" },
  transfer: { label: "Land Transfer", icon: ArrowRightLeft, color: "text-amber-600 bg-amber-100" },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "edit", label: "Land Edit" },
  { value: "delete", label: "Land Delete" },
  { value: "transfer", label: "Land Transfer" },
];

const SORT_OPTIONS = [
  { value: "-created", label: "Newest First" },
  { value: "+created", label: "Oldest First" },
  { value: "type", label: "By Type (A-Z)" },
  { value: "status", label: "By Status" },
];

// Build a unified approval item from a land_edit_requests record
function fromEditRequest(r) {
  return {
    id: r.id,
    kind: "edit_request",
    type: r.type || "edit", // "edit" | "delete"
    status: r.status,
    parcelId: r.parcel,
    parcelNumber: r.expand?.parcel?.parcelNumber || r.expand?.parcel?.id?.slice(0, 8) || "—",
    parcelData: r.expand?.parcel || null,
    applicantName: r.expand?.requestedBy?.fullName || r.expand?.requestedBy?.name || r.expand?.requestedBy?.email || "—",
    applicantId: r.requestedBy,
    applicantData: r.expand?.requestedBy || null,
    reason: r.reason || "",
    proposedChanges: r.proposedChanges || {},
    reviewComment: r.reviewComment || "",
    reviewedBy: r.expand?.reviewedBy?.fullName || r.expand?.reviewedBy?.email || "",
    created: r.created,
    updated: r.updated,
    raw: r,
  };
}

// Build a unified approval item from a land_transfers record
function fromTransfer(r) {
  return {
    id: r.id,
    kind: "transfer",
    type: "transfer",
    status: r.status,
    parcelId: r.parcel,
    parcelNumber: r.expand?.parcel?.parcelNumber || r.expand?.parcel?.id?.slice(0, 8) || "—",
    parcelData: r.expand?.parcel || null,
    applicantName: r.expand?.fromOwner?.fullName || r.expand?.fromOwner?.name || r.expand?.fromOwner?.email || "—",
    applicantId: r.fromOwner,
    applicantData: r.expand?.fromOwner || null,
    reason: r.reason || "",
    toOwnerName: r.toOwnerName || "",
    toOwnerPhone: r.toOwnerPhone || "",
    toOwnerUser: r.expand?.toOwnerUser || null,
    certificateNumber: r.certificateNumber || "",
    transferLetter: r.transferLetter || "",
    ownershipHistory: r.ownershipHistory || [],
    reviewComment: r.reviewComment || "",
    reviewedBy: r.expand?.reviewedBy?.fullName || r.expand?.reviewedBy?.email || "",
    created: r.created,
    updated: r.updated,
    raw: r,
  };
}

export default function ApprovalPage() {
  const { user, role, roles } = useAuth();
  const { toast } = useToast();

  const isAdmin = role === "admin" || roles?.includes("admin");
  const isPlanningOfficer = role === "planning_officer" || roles?.includes("planning_officer");
  const canApprove = isAdmin || isPlanningOfficer;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [sortBy, setSortBy] = useState("-created");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionMode, setActionMode] = useState(null); // "approve" | "reject" | "info"
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ toOwnerName: "", toOwnerPhone: "", reason: "", certificateNumber: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Admin permanent deletion of REJECTED approvals ───────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null); // single item to delete
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkConfirmPhrase, setBulkConfirmPhrase] = useState("");
  const [deleting, setDeleting] = useState(false);
  const BULK_PHRASE = "DELETE ALL REJECTED";

  const rejectedItems = useMemo(
    () => items.filter((x) => x.status === "rejected"),
    [items],
  );

  // Load all approvals (edit requests + transfers) with expansions
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const expand = "parcel,requestedBy,reviewedBy,fromOwner,toOwnerUser";
      const [edits, transfers] = await Promise.all([
        pb.collection("land_edit_requests").getFullList({
          sort: "-created", expand, requestKey: "appr-load-edits",
        }).catch(() => []),
        pb.collection("land_transfers").getFullList({
          sort: "-created", expand, requestKey: "appr-load-transfers",
        }).catch(() => []),
      ]);
      const combined = [
        ...edits.map(fromEditRequest),
        ...transfers.map(fromTransfer),
      ];
      setItems(combined);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime subscriptions
  useEffect(() => {
    let unsubE, unsubT;
    const subE = pb.collection("land_edit_requests").subscribe("*", (e) => {
      setItems((prev) => {
        if (e.action === "delete") return prev.filter((x) => !(x.kind === "edit_request" && x.id === e.record.id));
        const built = fromEditRequest({ ...e.record, expand: e.record.expand });
        const idx = prev.findIndex((x) => x.kind === "edit_request" && x.id === e.record.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = built; return next; }
        return [built, ...prev];
      });
    }).catch(() => {});
    const subT = pb.collection("land_transfers").subscribe("*", (e) => {
      setItems((prev) => {
        if (e.action === "delete") return prev.filter((x) => !(x.kind === "transfer" && x.id === e.record.id));
        const built = fromTransfer({ ...e.record, expand: e.record.expand });
        const idx = prev.findIndex((x) => x.kind === "transfer" && x.id === e.record.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = built; return next; }
        return [built, ...prev];
      });
    }).catch(() => {});
    Promise.resolve(subE).then((fn) => { unsubE = fn; });
    Promise.resolve(subT).then((fn) => { unsubT = fn; });
    return () => {
      try { if (unsubE) unsubE(); } catch (_) {}
      try { if (unsubT) unsubT(); } catch (_) {}
      void pb.collection("land_edit_requests").unsubscribe("*").catch(() => {});
      void pb.collection("land_transfers").unsubscribe("*").catch(() => {});
    };
  }, []);

  // Filtering + sorting
  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter !== "all") list = list.filter((x) => x.type === typeFilter);
    if (statusFilter !== "all") list = list.filter((x) => x.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((x) =>
        x.parcelNumber?.toLowerCase().includes(q) ||
        x.applicantName?.toLowerCase().includes(q) ||
        x.type?.toLowerCase().includes(q) ||
        (x.kind === "transfer" && x.toOwnerName?.toLowerCase().includes(q))
      );
    }
    const sorted = [...list];
    if (sortBy === "-created") sorted.sort((a, b) => new Date(b.created) - new Date(a.created));
    else if (sortBy === "+created") sorted.sort((a, b) => new Date(a.created) - new Date(b.created));
    else if (sortBy === "type") sorted.sort((a, b) => a.type.localeCompare(b.type));
    else if (sortBy === "status") sorted.sort((a, b) => a.status.localeCompare(b.status));
    return sorted;
  }, [items, typeFilter, statusFilter, search, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [typeFilter, statusFilter, search, sortBy]);

  // Stats
  const stats = useMemo(() => ({
    total: items.length,
    pending: items.filter((x) => x.status === "pending").length,
    approved: items.filter((x) => x.status === "approved").length,
    rejected: items.filter((x) => x.status === "rejected").length,
  }), [items]);

  const openDetail = (item) => { setSelected(item); setDetailOpen(true); setActionMode(null); setComment(""); setEditMode(false); setEditForm({ toOwnerName: item?.toOwnerName || "", toOwnerPhone: item?.toOwnerPhone || "", reason: item?.reason || "", certificateNumber: item?.certificateNumber || "" }); };

  const startAction = (mode) => { setActionMode(mode); setComment(""); };

  // Save edits to a pending transfer (admin / planning_officer only)
  const saveTransferEdit = async () => {
    if (!selected || selected.kind !== "transfer") return;
    if (!editForm.toOwnerName.trim()) {
      toast({ variant: "destructive", title: "New owner name is required" });
      return;
    }
    setSavingEdit(true);
    try {
      const update = {
        toOwnerName: editForm.toOwnerName.trim(),
        toOwnerPhone: editForm.toOwnerPhone.trim(),
        reason: editForm.reason.trim(),
        certificateNumber: editForm.certificateNumber.trim(),
      };
      await pb.collection("land_transfers").update(selected.id, update, { requestKey: `appr-edit-${selected.id}` });
      // Audit log
      try {
        await pb.collection("audit_logs").create({
          actor: user.id,
          action: "transfer_edit",
          entity: selected.id,
          details: JSON.stringify({ parcel: selected.parcelNumber, changes: update, editor: user.email }),
        }, { requestKey: `appr-edit-audit-${selected.id}` });
      } catch (_) {}
      setItems((prev) => prev.map((x) => (x.id === selected.id && x.kind === "transfer" ? { ...x, ...update } : x)));
      setSelected((prev) => (prev && prev.id === selected.id ? { ...prev, ...update } : prev));
      setEditMode(false);
      toast({ title: "Transfer updated", description: `${selected.parcelNumber} — details saved` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err?.message || "Unknown error" });
    } finally {
      setSavingEdit(false);
    }
  };

  // Approve / Reject handler
  const handleAction = async () => {
    if (!selected) return;
    if (actionMode === "reject" && !comment.trim()) {
      toast({ variant: "destructive", title: "Please provide a reason for rejection" });
      return;
    }
    setActing(true);
    try {
      const newStatus = actionMode === "approve" ? "approved" : "rejected";
      const collection = selected.kind === "transfer" ? "land_transfers" : "land_edit_requests";
      const update = {
        status: newStatus,
        reviewedBy: user.id,
        reviewComment: comment.trim(),
      };

      await pb.collection(collection).update(selected.id, update, { requestKey: `appr-act-${selected.id}` });

      // If approving an edit request, apply the proposed changes to the parcel
      if (actionMode === "approve" && selected.kind === "edit_request" && selected.type === "edit" && selected.proposedChanges) {
        try {
          // Strip system/read-only fields that PocketBase rejects
          const SYSTEM_FIELDS = new Set(["id", "collectionId", "collectionName", "created", "updated", "expand"]);
          const safeChanges = Object.fromEntries(
            Object.entries(selected.proposedChanges).filter(([k]) => !SYSTEM_FIELDS.has(k))
          );
          if (Object.keys(safeChanges).length > 0) {
            await pb.collection("parcels").update(selected.parcelId, safeChanges, { requestKey: `appr-apply-${selected.parcelId}` });
          }
        } catch (applyErr) {
          console.warn("Could not apply proposed changes to parcel:", applyErr?.message);
        }
      }

      // If approving a delete request, soft-delete the parcel
      if (actionMode === "approve" && selected.kind === "edit_request" && selected.type === "delete" && selected.parcelId) {
        try {
          await pb.collection("parcels").update(selected.parcelId, { status: "rejected" }, { requestKey: `appr-del-${selected.parcelId}` });
        } catch (_) {}
      }

      // If approving a transfer, update parcel ownership with ALL new owner details
      if (actionMode === "approve" && selected.kind === "transfer" && selected.parcelId) {
        try {
          // Fetch current parcel to snapshot old owner before replacing
          const currentParcel = await pb.collection("parcels").getOne(selected.parcelId, { requestKey: `appr-trf-fetch-${selected.parcelId}` }).catch(() => null);

          // Extract new owner details from ownershipHistory JSON (stored at transfer creation)
          const histArr = Array.isArray(selected.ownershipHistory) ? selected.ownershipHistory : [];
          const latestHist = histArr.length > 0 ? histArr[histArr.length - 1] : {};

          const parcelUpdate = {};
          if (selected.toOwnerName) parcelUpdate.applicantName = selected.toOwnerName;
          if (selected.toOwnerPhone) parcelUpdate.contactPhone = selected.toOwnerPhone;
          if (selected.toOwnerUser?.id) parcelUpdate.owner = selected.toOwnerUser.id;
          // Apply additional new owner fields from ownershipHistory
          if (latestHist.newOwnerEmail) parcelUpdate.applicantEmail = latestHist.newOwnerEmail;
          if (latestHist.newOwnerReligion) parcelUpdate.religion = latestHist.newOwnerReligion;
          if (latestHist.newOwnerTribe) parcelUpdate.tribe = latestHist.newOwnerTribe;
          if (latestHist.newOwnerAlternateMobile) parcelUpdate.alternateMobile = latestHist.newOwnerAlternateMobile;
          if (latestHist.newOwnerWhatsapp) parcelUpdate.whatsapp = latestHist.newOwnerWhatsapp;
          if (latestHist.allocationDate) parcelUpdate.allocationDate = latestHist.allocationDate;
          if (latestHist.registrationDate) parcelUpdate.registrationDate = latestHist.registrationDate;

          if (Object.keys(parcelUpdate).length > 0) {
            await pb.collection("parcels").update(selected.parcelId, parcelUpdate, { requestKey: `appr-trf-parcel-${selected.parcelId}` });
          }

          // Update ownershipHistory on the transfer record to include old owner snapshot
          if (currentParcel) {
            const oldOwnerSnapshot = {
              snapshotType: "oldOwner",
              snapshotDate: new Date().toISOString(),
              applicantName: currentParcel.applicantName || "",
              contactPhone: currentParcel.contactPhone || "",
              applicantEmail: currentParcel.applicantEmail || "",
              alternateMobile: currentParcel.alternateMobile || "",
              whatsapp: currentParcel.whatsapp || "",
              religion: currentParcel.religion || "",
              tribe: currentParcel.tribe || "",
              allocationDate: currentParcel.allocationDate || "",
              registrationDate: currentParcel.registrationDate || "",
              approvedBy: user.email,
              approvedAt: new Date().toISOString(),
            };
            const updatedHistory = [...histArr, oldOwnerSnapshot];
            await pb.collection("land_transfers").update(selected.id, {
              ownershipHistory: JSON.stringify(updatedHistory),
            }, { requestKey: `appr-trf-hist-${selected.id}` }).catch(() => {});
          }
        } catch (trfErr) {
          console.warn("Transfer ownership update error:", trfErr?.message);
        }
      }

      // Audit log
      try {
        await pb.collection("audit_logs").create({
          actor: user.id,
          action: `approval_${newStatus}`,
          entity: selected.id,
          details: JSON.stringify({
            type: selected.type,
            parcel: selected.parcelNumber,
            comment: comment.trim(),
            reviewer: user.email,
          }),
        }, { requestKey: `appr-audit-${selected.id}` });
      } catch (_) {}

      // Notify the applicant
      if (selected.applicantId) {
        try {
          await pb.collection("notifications").create({
            user: selected.applicantId,
            message: `Your ${selected.type === "transfer" ? "land transfer" : `land ${selected.type}`} request for ${selected.parcelNumber} has been ${newStatus}.${comment.trim() ? ` Reason: ${comment.trim()}` : ""}`,
            link: "/app/approvals",
          }, { requestKey: `appr-notif-${selected.applicantId}` });
        } catch (_) {}
      }

      toast({
        title: actionMode === "approve" ? "Request approved" : "Request rejected",
        description: `${selected.parcelNumber} — ${selected.type === "transfer" ? "Transfer" : titleCase(selected.type)} ${newStatus}`,
      });

      // Update local state
      setItems((prev) => prev.map((x) =>
        x.id === selected.id && x.kind === selected.kind ? { ...x, status: newStatus, reviewComment: comment.trim(), reviewedBy: user.fullName || user.email } : x
      ));
      setDetailOpen(false);
      setActionMode(null);
      setComment("");
    } catch (err) {
      toast({ variant: "destructive", title: "Action failed", description: err?.message || "Unknown error" });
    } finally {
      setActing(false);
    }
  };

  const requestInfo = async () => {
    if (!selected || !comment.trim()) {
      toast({ variant: "destructive", title: "Enter a message for the applicant" });
      return;
    }
    setActing(true);
    try {
      if (selected.applicantId) {
        await pb.collection("notifications").create({
          user: selected.applicantId,
          message: `More information requested for your ${selected.type === "transfer" ? "transfer" : selected.type} request (${selected.parcelNumber}): ${comment.trim()}`,
          link: "/app/approvals",
        }, { requestKey: `appr-info-${selected.applicantId}` });
      }
      toast({ title: "Information requested", description: "The applicant has been notified." });
      setDetailOpen(false);
      setActionMode(null);
      setComment("");
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to send request" });
    } finally {
      setActing(false);
    }
  };

  // ── Permanent deletion helpers (admin only, rejected only) ───────────────
  const collectionOf = (item) => (item.kind === "transfer" ? "land_transfers" : "land_edit_requests");

  const writeDeleteAudit = async (item, context) => {
    try {
      await pb.collection("audit_logs").create({
        actor: user.id,
        action: "approval_permanent_delete",
        entity: item.id,
        details: JSON.stringify({
          approvalType: item.type,
          approvalKind: item.kind,
          approvalId: item.id,
          parcel: item.parcelNumber,
          parcelId: item.parcelId || null,
          transferId: item.kind === "transfer" ? item.id : null,
          reviewer: user.email,
          context,
          deletedAt: new Date().toISOString(),
        }),
      }, { requestKey: `appr-del-audit-${item.id}-${Date.now()}` });
    } catch (_) {}
  };

  // Permanently delete a single rejected approval record
  const confirmDeleteSingle = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.status !== "rejected") {
      toast({ variant: "destructive", title: "Only rejected approvals can be permanently deleted" });
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await pb.collection(collectionOf(deleteTarget)).delete(deleteTarget.id, {
        requestKey: `appr-del-${deleteTarget.id}`,
      });
      await writeDeleteAudit(deleteTarget, "Admin permanent deletion of a single rejected approval");
      setItems((prev) => prev.filter((x) => !(x.kind === deleteTarget.kind && x.id === deleteTarget.id)));
      if (selected && selected.kind === deleteTarget.kind && selected.id === deleteTarget.id) {
        setDetailOpen(false);
        setSelected(null);
      }
      toast({
        title: "Rejected approval deleted",
        description: `${deleteTarget.parcelNumber} — ${deleteTarget.type === "transfer" ? "Transfer" : titleCase(deleteTarget.type)} permanently removed`,
      });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Deletion failed",
        description: err?.message || "You may not have permission to delete this record",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Permanently delete ALL rejected approvals (edit requests + transfers)
  const confirmDeleteAllRejected = async () => {
    if (bulkConfirmPhrase.trim() !== BULK_PHRASE) {
      toast({ variant: "destructive", title: "Confirmation phrase does not match", description: `Type exactly: ${BULK_PHRASE}` });
      return;
    }
    setDeleting(true);
    let ok = 0;
    let failed = 0;
    // Delete sequentially so a single failure doesn't cancel the batch
    for (const item of rejectedItems) {
      try {
        await pb.collection(collectionOf(item)).delete(item.id, {
          requestKey: `appr-bulk-del-${item.id}`,
        });
        await writeDeleteAudit(item, "Admin bulk permanent deletion of all rejected approvals");
        ok += 1;
      } catch (err) {
        failed += 1;
      }
    }
    // Reload to sync local state with the server after the batch
    if (ok > 0) {
      await loadAll();
    }
    setDeleting(false);
    setBulkDeleteOpen(false);
    setBulkConfirmPhrase("");
    if (failed === 0) {
      toast({ title: "All rejected approvals deleted", description: `${ok} record${ok !== 1 ? "s" : ""} permanently removed` });
    } else if (ok === 0) {
      toast({ variant: "destructive", title: "No records deleted", description: `${failed} deletion${failed !== 1 ? "s" : ""} failed` });
    } else {
      toast({
        title: "Partial deletion complete",
        description: `${ok} deleted, ${failed} failed. Rejected approvals list has been refreshed.`,
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Approvals — Techiman North Land Registry</title>
        <meta name="description" content="Review and approve land edit, delete, and transfer requests with role-based access." />
      </Helmet>

      <div className="flex flex-col gap-5">
        <PageHeader
          title="Approvals"
          subtitle="Review and act on land edit, delete, and transfer requests"
          icon={ClipboardCheck}
          action={
            <div className="flex items-center gap-2">
              {isAdmin && rejectedItems.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => { setBulkConfirmPhrase(""); setBulkDeleteOpen(true); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete all rejected ({rejectedItems.length})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} /> Refresh
              </Button>
            </div>
          }
        />

        {/* Breadcrumb + back */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button onClick={() => window.history.back()} className="flex items-center gap-1 hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <span>/</span>
          <span className="text-foreground font-medium">Approvals</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: ClipboardCheck, color: "text-primary bg-primary/10" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-blue-600 bg-blue-100" },
            { label: "Approved", value: stats.approved, icon: Check, color: "text-emerald-600 bg-emerald-100" },
            { label: "Rejected", value: stats.rejected, icon: X, color: "text-red-600 bg-red-100" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", s.color)}>
                  <s.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4 text-primary" /> Filters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Parcel, applicant, type…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sort</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {loading ? (
            <Spinner />
          ) : paged.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No approvals found"
              message="There are no requests matching your current filters."
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Parcel</th>
                      <th className="px-4 py-3 font-medium">Applicant</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paged.map((item) => {
                      const TM = TYPE_META[item.type] || TYPE_META.edit;
                      return (
                        <tr key={`${item.kind}-${item.id}`} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium", TM.color)}>
                              <TM.icon className="h-3.5 w-3.5" /> {TM.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">{item.parcelNumber}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.applicantName}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(item.created)}</td>
                          <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="ghost" size="sm" onClick={() => openDetail(item)} className="h-8">
                                <Eye className="h-3.5 w-3.5 mr-1" /> View
                              </Button>
                              {canApprove && item.status === "pending" && (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => { openDetail(item); startAction("approve"); }} className="h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => { openDetail(item); startAction("reject"); }} className="h-8 text-red-600 border-red-200 hover:bg-red-50">
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {isAdmin && item.status === "rejected" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                                  title="Permanently delete this rejected approval (admin only)"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {paged.map((item) => {
                  const TM = TYPE_META[item.type] || TYPE_META.edit;
                  return (
                    <div key={`${item.kind}-${item.id}`} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium", TM.color)}>
                          <TM.icon className="h-3.5 w-3.5" /> {TM.label}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="font-medium text-foreground">{item.parcelNumber}</div>
                      <div className="text-xs text-muted-foreground">{item.applicantName} · {formatDate(item.created)}</div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openDetail(item)} className="h-8 flex-1">
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                        {canApprove && item.status === "pending" && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => { openDetail(item); startAction("approve"); }} className="h-8 text-emerald-600 border-emerald-200">
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { openDetail(item); startAction("reject"); }} className="h-8 text-red-600 border-red-200">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {isAdmin && item.status === "rejected" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-red-600 border-red-200"
                            title="Permanently delete (admin only)"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <span className="text-xs text-muted-foreground">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="h-8">
                    <ChevronDown className="h-3.5 w-3.5 rotate-90" />
                  </Button>
                  <span className="px-2 text-xs font-medium">{safePage} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="h-8">
                    <ChevronUp className="h-3.5 w-3.5 rotate-90" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) { setActionMode(null); setComment(""); setEditMode(false); } }}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && (() => {
                const TM = TYPE_META[selected.type] || TYPE_META.edit;
                return <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium", TM.color)}><TM.icon className="h-3.5 w-3.5" /> {TM.label}</span>;
              })()}
              {selected?.parcelNumber}
            </DialogTitle>
            <DialogDescription>
              Submitted {selected ? formatDate(selected.created) : ""} · <StatusBadge status={selected?.status} />
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="dialog-scroll flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Applicant info */}
              <Section icon={User} title="Applicant Information">
                <Field label="Name" value={selected.applicantName} />
                {selected.applicantData?.email && <Field label="Email" value={selected.applicantData.email} />}
                {selected.applicantData?.phone && <Field label="Phone" value={selected.applicantData.phone} />}
              </Section>

              {/* Land info */}
              <Section icon={MapPin} title="Land Information">
                <Field label="Parcel Number" value={selected.parcelNumber} />
                {selected.parcelData?.community && <Field label="Community" value={selected.parcelData.community} />}
                {selected.parcelData?.areaCouncil && <Field label="Area Council" value={selected.parcelData.areaCouncil} />}
                {selected.parcelData?.sector && <Field label="Sector" value={selected.parcelData.sector} />}
                {selected.parcelData?.applicantName && <Field label="Registered Owner" value={selected.parcelData.applicantName} />}
              </Section>

              {/* Transfer-specific */}
              {selected.kind === "transfer" && (
                <Section icon={ArrowRightLeft} title="Transfer Details">
                  {editMode && canApprove && selected.status === "pending" ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">New Owner Name *</Label>
                        <Input value={editForm.toOwnerName} onChange={(e) => setEditForm((f) => ({ ...f, toOwnerName: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">New Owner Phone</Label>
                        <Input value={editForm.toOwnerPhone} onChange={(e) => setEditForm((f) => ({ ...f, toOwnerPhone: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Reason</Label>
                        <Textarea value={editForm.reason} onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))} rows={2} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Certificate Number</Label>
                        <Input value={editForm.certificateNumber} onChange={(e) => setEditForm((f) => ({ ...f, certificateNumber: e.target.value }))} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Field label="New Owner Name" value={selected.toOwnerName} />
                      <Field label="New Owner Phone" value={selected.toOwnerPhone} />
                      {selected.toOwnerUser && <Field label="New Owner (User)" value={selected.toOwnerUser.fullName || selected.toOwnerUser.email} />}
                      {selected.certificateNumber && <Field label="Certificate Number" value={selected.certificateNumber} />}
                    </>
                  )}
                  {selected.transferLetter && (
                    <div className="pt-1">
                      <Label className="text-xs text-muted-foreground">Transfer Letter</Label>
                      <a
                        href={pb.files.getURL(selected.raw, selected.transferLetter)}
                        target="_blank" rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                      >
                        <FileEdit className="h-3.5 w-3.5" /> View document
                      </a>
                    </div>
                  )}
                </Section>
              )}

              {/* Proposed changes (edit requests) */}
              {selected.kind === "edit_request" && selected.type === "edit" && selected.proposedChanges && Object.keys(selected.proposedChanges).length > 0 && (
                <Section icon={FileEdit} title="Proposed Changes">
                  <div className="space-y-2">
                    {Object.entries(selected.proposedChanges).map(([k, v]) => {
                      const current = selected.parcelData?.[k];
                      return (
                        <div key={k} className="flex items-center gap-2 text-sm rounded-md bg-muted/40 px-3 py-2">
                          <span className="font-medium text-foreground capitalize flex-1">{k.replace(/([A-Z])/g, " $1")}</span>
                          <span className="text-muted-foreground line-through">{current || "—"}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-primary font-medium">{v || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Reason */}
              {selected.reason && (
                <Section icon={MessageSquare} title="Reason for Request">
                  <p className="text-sm text-foreground bg-muted/40 rounded-md p-3">{selected.reason}</p>
                </Section>
              )}

              {/* Review info */}
              {selected.status !== "pending" && (
                <Section icon={Check} title="Review Decision">
                  <Field label="Reviewed By" value={selected.reviewedBy} />
                  <Field label="Decision" value={titleCase(selected.status)} />
                  {selected.reviewComment && <Field label="Comment" value={selected.reviewComment} />}
                </Section>
              )}

              {/* Action comment box */}
              {canApprove && selected.status === "pending" && actionMode && (
                <Section icon={AlertTriangle} title={actionMode === "approve" ? "Approval Comment" : actionMode === "reject" ? "Rejection Reason" : "Message to Applicant"}>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={actionMode === "reject" ? "State the reason for rejection (required)…" : "Optional comment…"}
                    rows={3}
                  />
                </Section>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {!canApprove && <><Lock className="h-3 w-3" /> View only — no approval permission</>}
              {canApprove && selected?.status !== "pending" && "This request has already been processed"}
            </div>
            <div className="flex gap-2">
              {canApprove && selected?.status === "pending" && !actionMode && !editMode && (
                <>
                  {selected?.kind === "transfer" && (
                    <Button variant="outline" size="sm" onClick={() => setEditMode(true)}><Edit2 className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => startAction("info")}><MessageSquare className="h-3.5 w-3.5 mr-1" /> Request Info</Button>
                  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => startAction("reject")}><X className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => startAction("approve")}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                </>
              )}
              {canApprove && selected?.status === "pending" && editMode && selected?.kind === "transfer" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setEditForm({ toOwnerName: selected.toOwnerName || "", toOwnerPhone: selected.toOwnerPhone || "", reason: selected.reason || "", certificateNumber: selected.certificateNumber || "" }); }} disabled={savingEdit}>Cancel</Button>
                  <Button size="sm" onClick={saveTransferEdit} disabled={savingEdit}><Save className="h-3.5 w-3.5 mr-1" /> {savingEdit ? "Saving…" : "Save Changes"}</Button>
                </>
              )}
              {canApprove && selected?.status === "pending" && actionMode && (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setActionMode(null); setComment(""); }} disabled={acting}>Cancel</Button>
                  <Button
                    size="sm"
                    className={actionMode === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : actionMode === "reject" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                    onClick={actionMode === "info" ? requestInfo : handleAction}
                    disabled={acting}
                  >
                    {acting ? "Processing…" : actionMode === "approve" ? "Confirm Approval" : actionMode === "reject" ? "Confirm Rejection" : "Send Request"}
                  </Button>
                </>
              )}
              {(!canApprove || selected?.status !== "pending") && (
                <>
                  {isAdmin && selected?.status === "rejected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => { setDeleteTarget(selected); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete permanently
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); setActionMode(null); }}>Close</Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single rejected approval — permanent delete confirmation (admin only) */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" /> Permanently delete rejected approval?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the rejected{" "}
              <strong>{deleteTarget?.type === "transfer" ? "Land Transfer" : `Land ${titleCase(deleteTarget?.type || "edit")}`}</strong>{" "}
              for parcel <strong>{deleteTarget?.parcelNumber}</strong> from the registry.
              This action <strong>cannot be undone</strong>. An audit entry will be recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); confirmDeleteSingle(); }}
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk — permanently delete ALL rejected approvals (admin only) */}
      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => { setBulkDeleteOpen(o); if (!o) setBulkConfirmPhrase(""); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" /> Delete ALL rejected approvals
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{rejectedItems.length}</strong> rejected
              approval record{rejectedItems.length !== 1 ? "s" : ""} (land edits, deletions, and transfers).
              Pending and approved records are <strong>not</strong> affected. This action{" "}
              <strong>cannot be undone</strong>. An audit entry is recorded for each deletion.
              <br /><br />
              To confirm, type <strong>{BULK_PHRASE}</strong> below:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={bulkConfirmPhrase}
            onChange={(e) => setBulkConfirmPhrase(e.target.value)}
            placeholder={BULK_PHRASE}
            className="mt-1"
            disabled={deleting}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              disabled={deleting || bulkConfirmPhrase.trim() !== BULK_PHRASE}
              onClick={(e) => { e.preventDefault(); confirmDeleteAllRejected(); }}
            >
              {deleting ? "Deleting…" : `Delete all ${rejectedItems.length} rejected`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right">{value || "—"}</span>
    </div>
  );
}

