import React, { useState, useMemo } from "react";
import { Network, Plus, Pencil, Trash2, Search, ChevronRight, Download, Archive, RotateCcw, AlertTriangle } from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/useCollection";
import { PageHeader, Spinner, StatCard, EmptyState } from "@/components/shared";
import SuccessDialog from "@/components/SuccessDialog";
import Pagination, { usePagination } from "@/components/Pagination";
import { canEditStructure } from "@/lib/accessControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Hierarchy: Office (top) → Area Council → Community → Sector (bottom)
const LEVELS = [
  {
    key: "offices_struct",
    label: "Office",
    plural: "Offices",
    parents: [],
  },
  {
    key: "area_councils",
    label: "Area Council",
    plural: "Area Councils",
    parents: [{ field: "office", col: "offices_struct", label: "Office" }],
  },
  {
    key: "communities",
    label: "Community",
    plural: "Communities",
    parents: [
      { field: "areaCouncil", col: "area_councils", label: "Area Council" },
      { field: "office", col: "offices_struct", label: "Office", auto: true },
    ],
  },
  {
    key: "sectors",
    label: "Sector",
    plural: "Sectors",
    parents: [
      { field: "community", col: "communities", label: "Community" },
      { field: "areaCouncil", col: "area_councils", label: "Area Council", auto: true },
      { field: "office", col: "offices_struct", label: "Office", auto: true },
    ],
  },
];

// Child relationship for each level
const CHILD_INFO = {
  offices_struct: { col: "area_councils", field: "office", label: "Area Councils" },
  area_councils: { col: "communities", field: "areaCouncil", label: "Communities" },
  communities: { col: "sectors", field: "community", label: "Sectors" },
};

const EMPTY = {
  name: "", description: "", code: "", status: "active",
  office: "", areaCouncil: "", community: "",
};

export default function StructurePage() {
  const { user, role, log } = useAuth();
  const { toast } = useToast();
  const canEdit = canEditStructure(role);
  const [tab, setTab] = useState("offices_struct");

  const off = useCollection("offices_struct", { sort: "name", realtime: true });
  const ac = useCollection("area_councils", { sort: "name", realtime: true });
  const comm = useCollection("communities", { sort: "name", realtime: true });
  const sec = useCollection("sectors", { sort: "name", realtime: true });

  const data = { offices_struct: off, area_councils: ac, communities: comm, sectors: sec };
  const nameById = (col, id) => data[col]?.records.find((r) => r.id === id)?.name || "—";

  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  // Delete state
  const [delTarget, setDelTarget] = useState(null); // {level, record}
  const [delType, setDelType] = useState(null);     // null | "soft" | "permanent"
  const [delReason, setDelReason] = useState("");

  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletionFilter, setDeletionFilter] = useState("active"); // active | deleted | all

  const levelCfg = LEVELS.find((l) => l.key === tab);
  const current = data[tab];

  // ── Create / Edit dialog ───────────────────────────────────────────────────

  const openCreate = () => {
    setForm({ ...EMPTY });
    setDialog({ level: levelCfg });
  };

  const openEdit = (r) => {
    setForm({
      name: r.name || "",
      description: r.description || "",
      code: r.code || "",
      status: r.status || "active",
      office: r.office || "",
      areaCouncil: r.areaCouncil || "",
      community: r.community || "",
    });
    setDialog({ level: levelCfg, record: r });
  };

  // Auto-populate ancestor fields when a parent is selected
  const setParent = (field, value) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "areaCouncil") {
        const parent = ac.records.find((x) => x.id === value);
        if (parent) next.office = parent.office || "";
      }
      if (field === "community") {
        const parent = comm.records.find((x) => x.id === value);
        if (parent) {
          next.areaCouncil = parent.areaCouncil || "";
          const parentAC = ac.records.find((x) => x.id === parent.areaCouncil);
          if (parentAC) next.office = parentAC.office || "";
        }
      }
      return next;
    });
  };

  // Filter parent options based on already-selected ancestor
  const parentOptions = (col) => {
    if (col === "area_councils") return ac.records.filter((x) => !form.office || x.office === form.office);
    if (col === "communities") return comm.records.filter((x) => !form.areaCouncil || x.areaCouncil === form.areaCouncil);
    return data[col]?.records || [];
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ variant: "destructive", title: "Name is required" }); return; }
    const cfg = dialog.level;
    for (const p of cfg.parents.filter((x) => !x.auto)) {
      if (!form[p.field]) { toast({ variant: "destructive", title: `${p.label} is required` }); return; }
    }
    if (form.code.trim()) {
      const dup = current.records.find(
        (r) => r.code?.toLowerCase() === form.code.trim().toLowerCase() && r.id !== dialog.record?.id
      );
      if (dup) { toast({ variant: "destructive", title: "Code already exists at this level" }); return; }
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        code: form.code.trim(),
        status: form.status,
      };
      cfg.parents.forEach((p) => { payload[p.field] = form[p.field] || null; });
      if (dialog.record) {
        await pb.collection(cfg.key).update(dialog.record.id, payload);
        await log(`${cfg.key}_updated`, cfg.key, `${cfg.label}: ${form.name}`);
      } else {
        await pb.collection(cfg.key).create(payload);
        await log(`${cfg.key}_created`, cfg.key, `${cfg.label}: ${form.name}`);
      }
      current.reload();
      setDialog(null);
      setSuccess({
        title: `${cfg.label} saved`,
        message: `${form.name} has been ${dialog.record ? "updated" : "created"}.`,
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err?.message });
    } finally { setSaving(false); }
  };

  // ── Delete helpers ─────────────────────────────────────────────────────────

  const countChildren = (level, id) => {
    const ci = CHILD_INFO[level.key];
    if (!ci) return 0;
    return data[ci.col]?.records.filter((r) => r[ci.field] === id).length || 0;
  };

  const openDelete = (r) => {
    setDelTarget({ level: levelCfg, record: r });
    setDelType(null);
    setDelReason("");
  };

  const doSoftDelete = async () => {
    if (!delReason.trim()) { toast({ variant: "destructive", title: "Please enter a reason" }); return; }
    const { level, record } = delTarget;
    setSaving(true);
    try {
      await pb.collection(level.key).update(record.id, { isDeleted: true, deletedReason: delReason });
      await log(`${level.key}_soft_deleted`, level.key, `${level.label}: ${record.name} — ${delReason}`);
      data[level.key].reload();
      setDelTarget(null); setDelType(null); setDelReason("");
      setSuccess({
        title: `${level.label} soft-deleted`,
        message: `${record.name} has been marked as deleted and can be restored.`,
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err?.message });
    } finally { setSaving(false); }
  };

  const doPermanentDelete = async () => {
    if (!delReason.trim()) { toast({ variant: "destructive", title: "Please enter a reason" }); return; }
    const { level, record } = delTarget;
    const cnt = countChildren(level, record.id);
    if (cnt > 0) {
      toast({ variant: "destructive", title: "Cannot permanently delete", description: `Remove or reassign the ${cnt} child record(s) first.` });
      return;
    }
    setSaving(true);
    try {
      await pb.collection(level.key).delete(record.id);
      await log(
        `${level.key}_permanent_deleted`, level.key,
        `PERMANENTLY DELETED ${level.label}: ${record.name} — Reason: ${delReason} — By: ${user.email}`
      );
      data[level.key].reload();
      setDelTarget(null); setDelType(null); setDelReason("");
      setSuccess({
        title: `${level.label} permanently deleted`,
        message: `${record.name} has been permanently removed from the system.`,
      });
    } catch (err) {
      console.error("Permanent delete failed", err);
      const detail = err?.status === 403
        ? "You do not have permission to permanently delete this record."
        : (err?.response?.message || err?.message || "Unknown error");
      toast({ variant: "destructive", title: "Permanent delete failed", description: `${detail} You can retry.` });
    } finally { setSaving(false); }
  };

  const doRestore = async (r) => {
    try {
      await pb.collection(levelCfg.key).update(r.id, { isDeleted: false, deletedReason: "" });
      await log(`${levelCfg.key}_restored`, levelCfg.key, `${levelCfg.label}: ${r.name} restored`);
      current.reload();
      toast({ title: "Record restored", description: `${r.name} is now active.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Restore failed", description: err?.message });
    }
  };

  // ── Filtered rows ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase();
    return (current.records || []).filter((r) => {
      const isDel = !!r.isDeleted;
      if (deletionFilter === "active" && isDel) return false;
      if (deletionFilter === "deleted" && !isDel) return false;
      const mq = !q || r.name?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q);
      const ms = statusFilter === "all" || (r.status || "active") === statusFilter;
      return mq && ms;
    });
  }, [current.records, searchQ, statusFilter, deletionFilter]);

  const exportCsv = () => {
    const visibleParents = levelCfg.parents.filter((p) => !p.auto);
    const cols = ["name", "code", "description", "status", ...visibleParents.map((p) => p.field)];
    const rows = [cols, ...filtered.map((r) =>
      cols.map((c) => {
        const p = visibleParents.find((x) => x.field === c);
        return p ? nameById(p.col, r[c]) : (r[c] || "");
      })
    )];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${tab}.csv`;
    a.click();
  };

  const softDeletedCount = (current.records || []).filter((r) => r.isDeleted).length;

  const { page, setPage, pageSize, setPageSize, totalPages, totalRecords, pageItems } =
    usePagination(filtered, `tnda-struct-${tab}-size`, 25);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Administrative Structure"
        subtitle="Office → Area Council → Community → Sector"
        icon={Network}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Offices" value={off.records.filter((r) => !r.isDeleted).length} accent="primary" />
        <StatCard label="Area Councils" value={ac.records.filter((r) => !r.isDeleted).length} accent="amber" />
        <StatCard label="Communities" value={comm.records.filter((r) => !r.isDeleted).length} accent="blue" />
        <StatCard label="Sectors" value={sec.records.filter((r) => !r.isDeleted).length} accent="gold" />
      </div>

      {/* Level tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {LEVELS.map((l) => (
          <button
            key={l.key}
            onClick={() => {
              setTab(l.key);
              setSearchQ("");
              setStatusFilter("all");
              setDeletionFilter("active");
            }}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition whitespace-nowrap",
              tab === l.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {l.plural}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search by name or code…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deletionFilter} onValueChange={setDeletionFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="all">Show all</SelectItem>
            <SelectItem value="deleted">Deleted only</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> New {levelCfg.label}
          </Button>
        )}
      </div>

      {softDeletedCount > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-medium dark:bg-red-900/30 dark:text-red-400">
            {softDeletedCount} soft-deleted
          </span>
          <button
            onClick={() => setDeletionFilter(deletionFilter === "deleted" ? "active" : "deleted")}
            className="underline text-muted-foreground hover:text-foreground"
          >
            {deletionFilter === "deleted" ? "Hide deleted" : "Show deleted"}
          </button>
        </div>
      )}

      {/* Table */}
      {current.loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Network}
          title={`No ${levelCfg.plural}`}
          message={`Create your first ${levelCfg.label.toLowerCase()} to build the administrative hierarchy.`}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Code</th>
                {levelCfg.parents.filter((p) => !p.auto).map((p) => (
                  <th key={p.field} className="hidden px-5 py-3 font-medium md:table-cell">{p.label}</th>
                ))}
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="hidden px-5 py-3 font-medium lg:table-cell">Children</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageItems.map((r) => {
                const isDel = !!r.isDeleted;
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "hover:bg-muted/20",
                      isDel && "bg-red-50/50 dark:bg-red-900/10"
                    )}
                  >
                    <td className="px-5 py-3">
                      <p className={cn("font-medium", isDel && "line-through text-muted-foreground")}>
                        {r.name}
                      </p>
                      {r.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{r.description}</p>
                      )}
                      {isDel && r.deletedReason && (
                        <p className="text-xs text-red-600 mt-0.5">Deleted: {r.deletedReason}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {r.code || "—"}
                    </td>
                    {levelCfg.parents.filter((p) => !p.auto).map((p) => (
                      <td key={p.field} className="hidden px-5 py-3 text-muted-foreground md:table-cell">
                        {nameById(p.col, r[p.field])}
                      </td>
                    ))}
                    <td className="px-5 py-3">
                      {isDel ? (
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Deleted
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            (r.status || "active") === "active"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {(r.status || "active") === "active" ? "Active" : "Inactive"}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-5 py-3 text-muted-foreground lg:table-cell">
                      {CHILD_INFO[levelCfg.key] ? countChildren(levelCfg, r.id) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!canEdit && <span className="text-xs text-muted-foreground">View only</span>}
                        {canEdit && !isDel && (
                          <Button
                            size="sm" variant="ghost" className="h-8 px-2"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canEdit && isDel ? (
                          <>
                            <Button
                              size="sm" variant="outline"
                              className="h-8 px-2 text-blue-800 border-blue-300 hover:bg-blue-50"
                              title="Restore"
                              onClick={() => doRestore(r)}
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              className="h-8 px-2 text-red-700 border-red-300 hover:bg-red-50"
                              title="Permanently delete"
                              onClick={() => { setDelTarget({ level: levelCfg, record: r }); setDelType("permanent"); setDelReason(""); }}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Permanent Delete
                            </Button>
                          </>
                        ) : canEdit ? (
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 px-2 text-destructive"
                            onClick={() => openDelete(r)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalRecords={totalRecords}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Hierarchy tree */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 font-display text-sm font-semibold">
          Hierarchy Tree: Office → Area Council → Community → Sector
        </h3>
        {off.records.filter((o) => !o.isDeleted).length === 0 ? (
          <p className="text-sm text-muted-foreground">No offices yet. Create an Office to begin building the hierarchy.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {off.records.filter((o) => !o.isDeleted).map((o) => (
              <li key={o.id}>
                <span className="font-semibold">{o.name}</span>
                <ul className="ml-4 border-l border-border pl-3 mt-0.5 space-y-0.5">
                  {ac.records.filter((a) => a.office === o.id && !a.isDeleted).map((a) => (
                    <li key={a.id}>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />{a.name}
                      </span>
                      <ul className="ml-4 border-l border-border pl-3 space-y-0.5">
                        {comm.records.filter((c) => c.areaCouncil === a.id && !c.isDeleted).map((c) => (
                          <li key={c.id}>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <ChevronRight className="h-3 w-3" />{c.name}
                            </span>
                            <ul className="ml-4 border-l border-border pl-3">
                              {sec.records.filter((s) => s.community === c.id && !s.isDeleted).map((s) => (
                                <li key={s.id} className="text-xs text-muted-foreground flex items-center gap-1">
                                  <ChevronRight className="h-3 w-3" />{s.name}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Create / Edit dialog ───────────────────────────────────────────── */}
      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.record ? "Edit" : "New"} {dialog?.level.label}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-4 py-2">
              {dialog.level.parents.map((p) => (
                <div key={p.field} className="space-y-1.5">
                  <Label>{p.label} {!p.auto && "*"}</Label>
                  {p.auto ? (
                    <div className="flex h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-sm text-muted-foreground">
                      {form[p.field] ? nameById(p.col, form[p.field]) : "— auto-populated —"}
                    </div>
                  ) : (
                    <Select
                      value={form[p.field] || "none"}
                      onValueChange={(v) => setParent(p.field, v === "none" ? "" : v)}
                    >
                      <SelectTrigger><SelectValue placeholder={`Select ${p.label}`} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Select —</SelectItem>
                        {parentOptions(p.col).map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="Unique code"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Type Dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={!!delTarget && delType === null}
        onOpenChange={(o) => { if (!o) setDelTarget(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {delTarget?.level.label}</DialogTitle>
          </DialogHeader>
          {delTarget && (() => {
            const cnt = CHILD_INFO[delTarget.level.key]
              ? countChildren(delTarget.level, delTarget.record.id)
              : 0;
            return (
              <div className="space-y-4 py-2">
                <p className="text-sm">
                  How do you want to delete <strong>{delTarget.record.name}</strong>?
                </p>
                {cnt > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-300">
                    <AlertTriangle className="inline h-4 w-4 mr-1" />
                    This {delTarget.level.label.toLowerCase()} has <strong>{cnt}</strong> child record(s).
                    Permanent deletion will fail unless children are removed first.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDelType("soft")}
                    className="flex flex-col items-start gap-2 rounded-xl border-2 border-blue-300 bg-blue-50 dark:bg-blue-900/20 p-4 hover:bg-blue-100 transition"
                  >
                    <Archive className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">Soft Delete</p>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                        Mark as deleted, keep in database, can be restored later
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setDelType("permanent")}
                    className="flex flex-col items-start gap-2 rounded-xl border-2 border-red-300 bg-red-50 dark:bg-red-900/20 p-4 hover:bg-red-100 transition"
                  >
                    <Trash2 className="h-6 w-6 text-red-600" />
                    <div>
                      <p className="font-semibold text-sm text-red-800 dark:text-red-300">Permanent Delete</p>
                      <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                        Remove from database forever, cannot be restored
                      </p>
                    </div>
                  </button>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDelTarget(null)}>Cancel</Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Soft Delete Confirmation ───────────────────────────────────────── */}
      <Dialog
        open={!!delTarget && delType === "soft"}
        onOpenChange={(o) => { if (!o) { setDelType(null); setDelReason(""); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <Archive className="h-4 w-4" /> Soft Delete — {delTarget?.record.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 p-3 text-sm text-blue-800 dark:text-blue-300">
              This record will be marked as deleted but kept in the database.
              It will appear with red color-grading and can be restored at any time.
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Deletion Reason <span className="text-destructive">*</span>
              </Label>
              <Input
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
                placeholder="Enter reason for soft deletion…"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDelType(null); setDelReason(""); }}>Back</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={doSoftDelete}
                disabled={saving}
              >
                <Archive className="mr-1 h-4 w-4" /> Soft Delete
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Permanent Delete Confirmation ─────────────────────────────────── */}
      <Dialog
        open={!!delTarget && delType === "permanent"}
        onOpenChange={(o) => { if (!o) { setDelType(null); setDelReason(""); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-800">
              <Trash2 className="h-4 w-4" /> Permanent Delete — {delTarget?.record.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-red-100 dark:bg-red-900/30 border-2 border-red-400 p-3 text-sm text-red-900 dark:text-red-300">
              <p className="font-bold mb-1 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> WARNING: THIS ACTION IS IRREVERSIBLE
              </p>
              <p>
                This will <strong>permanently remove</strong> this record from the database.
                It cannot be recovered. Records with children cannot be permanently deleted.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
              <span><span className="font-medium">Name:</span> {delTarget?.record.name}</span>
              <span><span className="font-medium">Code:</span> {delTarget?.record.code || "—"}</span>
              <span><span className="font-medium">Level:</span> {delTarget?.level.label}</span>
              <span>
                <span className="font-medium">Children:</span>{" "}
                {delTarget && CHILD_INFO[delTarget.level.key]
                  ? countChildren(delTarget.level, delTarget.record.id)
                  : 0}
              </span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Reason for Permanent Deletion <span className="text-destructive">*</span>
              </Label>
              <Input
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
                placeholder="Enter reason for permanent deletion…"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDelType(null); setDelReason(""); }}>Back</Button>
              <Button
                variant="destructive"
                onClick={doPermanentDelete}
                disabled={saving}
                className="bg-red-800 hover:bg-red-900"
              >
                <Trash2 className="mr-1 h-4 w-4" /> Permanently Delete
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessDialog
        open={!!success}
        onClose={() => setSuccess(null)}
        title={success?.title || "Success"}
        message={success?.message || ""}
      />
    </>
  );
}
