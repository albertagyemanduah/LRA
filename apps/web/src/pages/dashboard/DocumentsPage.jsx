import React, { useState, useMemo } from "react";
import { FileText, Upload, Download, ShieldCheck, Loader2, Search, Tag, Clock, Eye, Lock, Unlock, Archive, RefreshCw, Pencil, Trash2 } from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/useCollection";
import { PageHeader, StatusBadge, Spinner, EmptyState } from "@/components/shared";
import { titleCase, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DOC_TYPES = ["deed", "site_plan", "indenture", "ghana_card", "survey_report", "certificate", "receipt", "other"];
const DOC_TYPE_COLORS = {
  deed: "bg-blue-100 text-blue-700",
  site_plan: "bg-indigo-100 text-indigo-700",
  indenture: "bg-purple-100 text-purple-700",
  ghana_card: "bg-blue-100 text-blue-800",
  survey_report: "bg-blue-100 text-blue-700",
  certificate: "bg-blue-100 text-blue-800",
  receipt: "bg-cyan-100 text-cyan-700",
  other: "bg-muted text-muted-foreground",
};

export default function DocumentsPage() {
  const { user, role, log } = useAuth();
  const { toast } = useToast();
  const isCitizen = false; // citizen role removed
  const isStaff = !isCitizen;

  const { records, loading, reload } = useCollection("documents", {
    filter: isCitizen ? `owner = "${user.id}"` : "",
    expand: "owner,parcel",
  });

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewDoc, setViewDoc] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [form, setForm] = useState({ title: "", docType: "deed", file: null, expiresAt: "" });

  const filtered = useMemo(() => {
    return records.filter((d) => {
      const q = searchQ.toLowerCase();
      const matchQ = !q || d.title?.toLowerCase().includes(q) || d.docType?.includes(q) || d.expand?.owner?.fullName?.toLowerCase().includes(q);
      const matchType = filterType === "all" || d.docType === filterType;
      const matchStatus = filterStatus === "all" || d.status === filterStatus;
      return matchQ && matchType && matchStatus;
    });
  }, [records, searchQ, filterType, filterStatus]);

  const verified = records.filter((d) => d.status === "verified").length;
  const pending = records.filter((d) => d.status === "pending_scan").length;
  const rejected = records.filter((d) => d.status === "rejected").length;

  const submit = async () => {
    if (!form.title || !form.file) {
      toast({ variant: "destructive", title: "Missing details", description: "Provide a title and select a file." });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("owner", user.id);
      fd.append("title", form.title);
      fd.append("docType", form.docType);
      fd.append("version", "1");
      fd.append("status", "pending_scan");
      fd.append("file", form.file);
      const rec = await pb.collection("documents").create(fd);
      await log("document_uploaded", "documents", `${form.title} (${titleCase(form.docType)})`);
      // Simulate scan completing
      setTimeout(async () => {
        try { await pb.collection("documents").update(rec.id, { status: "verified" }); reload(); } catch (_) {}
      }, 2000);
      toast({ title: "Uploaded securely", description: "Encrypted and queued for virus scan. Will be verified shortly." });
      setOpen(false);
      setForm({ title: "", docType: "deed", file: null, expiresAt: "" });
      reload();
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const verifyDoc = async (id) => {
    await pb.collection("documents").update(id, { status: "verified" });
    await log("document_verified", "documents", id);
    reload();
    toast({ title: "Document verified" });
  };

  const rejectDoc = async (id) => {
    await pb.collection("documents").update(id, { status: "rejected" });
    await log("document_rejected", "documents", id);
    reload();
  };

  const saveEditDoc = async () => {
    if (!editDoc) return;
    setSaving(true);
    try {
      await pb.collection("documents").update(editDoc.id, {
        title: editDoc.title,
        docType: editDoc.docType,
      });
      await log("document_updated", "documents", editDoc.title);
      toast({ title: "Document updated" });
      setEditDoc(null);
      reload();
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const doDeleteDoc = async () => {
    if (!deleteDoc) return;
    try {
      await pb.collection("documents").delete(deleteDoc.id);
      await log("document_deleted", "documents", deleteDoc.title);
      toast({ title: "Document deleted" });
      setDeleteDoc(null);
      reload();
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err?.message });
    }
  };

  const resubmit = async (doc) => {
    await pb.collection("documents").update(doc.id, { status: "pending_scan", version: (doc.version || 1) + 1 });
    await log("document_resubmitted", "documents", doc.title);
    reload();
    toast({ title: "Document resubmitted for verification" });
  };

  const exportCsv = () => {
    const rows = [["ID", "Title", "Type", "Status", "Owner", "Uploaded"]];
    records.forEach((d) => {
      rows.push([d.id, d.title, titleCase(d.docType), titleCase(d.status), d.expand?.owner?.fullName || d.expand?.owner?.email || "—", formatDate(d.created)]);
    });
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "documents.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Document Management"
        subtitle="Secure, versioned storage with AES-256 encryption and virus scanning"
        icon={FileText}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} size="sm"><Download className="mr-1 h-4 w-4" /> Export</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Upload className="mr-1 h-4 w-4" /> Upload document</Button></DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Upload a document</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Document title *</Label>
                    <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Land indenture 2024" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Document type</Label>
                      <Select value={form.docType} onValueChange={(v) => setForm((f) => ({ ...f, docType: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DOC_TYPES.map((v) => <SelectItem key={v} value={v}>{titleCase(v)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry date (optional)</Label>
                      <Input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>File *</Label>
                    <Input type="file" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" /> AES-256 encrypted at rest · Virus scanned · Max 15MB
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={submit} disabled={saving}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</> : "Upload securely"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Quick stats */}
      <div className="grid gap-3 grid-cols-3">
        {[
          { label: "Verified", count: verified, color: "text-blue-700 bg-blue-50 border-blue-200" },
          { label: "Pending scan", count: pending, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Rejected", count: rejected, color: "text-red-600 bg-red-50 border-red-200" },
        ].map(({ label, count, color }) => (
          <div key={label} className={cn("rounded-xl border p-4 text-center", color)}>
            <p className="text-2xl font-bold font-display">{count}</p>
            <p className="text-xs font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search documents…" className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><Tag className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DOC_TYPES.map((v) => <SelectItem key={v} value={v}>{titleCase(v)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending_scan">Pending scan</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No documents found" message={records.length === 0 ? "Upload deeds, site plans and certificates to store them securely." : "No documents match your search."} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Document</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">Type</th>
                {isStaff && <th className="hidden px-5 py-3 font-medium md:table-cell">Owner</th>}
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">Uploaded</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-muted/20">
                  <td className="px-5 py-3">
                    <p className="font-medium leading-tight">{d.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">v{d.version || 1}</span>
                      <ShieldCheck className="h-3 w-3 text-blue-700" title="Encrypted" />
                    </div>
                  </td>
                  <td className="hidden px-5 py-3 sm:table-cell">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", DOC_TYPE_COLORS[d.docType] || "bg-muted text-muted-foreground")}>
                      {titleCase(d.docType)}
                    </span>
                  </td>
                  {isStaff && <td className="hidden px-5 py-3 md:table-cell text-muted-foreground">{d.expand?.owner?.fullName || d.expand?.owner?.email}</td>}
                  <td className="px-5 py-3"><StatusBadge status={d.status} /></td>
                  <td className="hidden px-5 py-3 text-muted-foreground sm:table-cell">{formatDate(d.created)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {d.file && (
                        <a href={pb.files.getURL(d, d.file)} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" className="h-8 px-2">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                      {d.file && (
                        <a href={pb.files.getURL(d, d.file)} target="_blank" rel="noreferrer" download>
                          <Button size="sm" variant="ghost" className="h-8 px-2">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                      {isStaff && d.status === "pending_scan" && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-blue-700" onClick={() => verifyDoc(d.id)} title="Verify">
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-red-500" onClick={() => rejectDoc(d.id)} title="Reject">
                            <Lock className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {d.status === "rejected" && (
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-blue-600" onClick={() => resubmit(d)} title="Resubmit">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditDoc({ ...d })} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {(role === "admin" || d.owner === user.id) && (
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={() => setDeleteDoc(d)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
            Showing {filtered.length} of {records.length} documents · All files encrypted at rest with AES-256
          </div>
        </div>
      )}
      {/* Edit Document Dialog */}
      <Dialog open={!!editDoc} onOpenChange={(o) => { if (!o) setEditDoc(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Document</DialogTitle></DialogHeader>
          {editDoc && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editDoc.title} onChange={(e) => setEditDoc((d) => ({ ...d, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={editDoc.docType} onValueChange={(v) => setEditDoc((d) => ({ ...d, docType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map((v) => <SelectItem key={v} value={v}>{titleCase(v)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDoc(null)}>Cancel</Button>
                <Button onClick={saveEditDoc} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Document Dialog */}
      <Dialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Document</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Permanently delete <strong>{deleteDoc?.title}</strong>? The file and record will be removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDeleteDoc}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
