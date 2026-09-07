import React, { useState, useMemo, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Search, CheckSquare, Square, AlertTriangle, Check, X, Lock, Edit2 } from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/useCollection";
import { PageHeader, StatusBadge, Spinner } from "@/components/shared";
import { titleCase, formatDate } from "@/lib/format";
import { getUserAreaCouncils, filterParcelsForUser, ALL_AREA_COUNCILS } from "@/lib/offices";
import { useHierarchy } from "@/hooks/useHierarchy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { findExistingParcel } from "@/lib/duplicateCheck";

// ── Read-only field display ────────────────────────────────────────────────
function ROField({ label, value }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        <Lock className="h-3 w-3 opacity-50" /> {label}
      </Label>
      <div className="px-3 py-2 text-sm rounded-md bg-muted/50 border border-border/50 text-muted-foreground min-h-[36px]">
        {value || <span className="italic text-muted-foreground/60">—</span>}
      </div>
    </div>
  );
}

// ── Editable field display ─────────────────────────────────────────────────
function EditField({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-primary flex items-center gap-1">
        <Edit2 className="h-3 w-3" /> {label} <span className="text-xs text-muted-foreground font-normal">(editable)</span>
      </Label>
      {children}
    </div>
  );
}

export default function AmendmentPage() {
  const { user, role, roles } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin" || roles?.includes("admin");
  const userACs = getUserAreaCouncils(user);
  const { records: allParcels, loading } = useCollection("parcels");

  // Filter parcels the user can see
  const parcels = useMemo(
    () => filterParcelsForUser(user, allParcels || []),
    [allParcels, user]
  );

  const { commForAC, sectForComm, areaCouncils: acRecords, loading: hierLoading } = useHierarchy();

  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [focusedId, setFocusedId] = useState(null);
  const [search, setSearch] = useState("");

  // Amendment values (applied to ALL selected)
  const [amendAC, setAmendAC] = useState("");
  const [amendCommunity, setAmendCommunity] = useState("");
  const [amendSector, setAmendSector] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const focusedParcel = useMemo(
    () => parcels.find((p) => p.id === focusedId),
    [parcels, focusedId]
  );

  // When a parcel is focused, pre-populate the editable fields
  useEffect(() => {
    if (focusedParcel) {
      setAmendAC(focusedParcel.areaCouncil || "");
      setAmendCommunity(focusedParcel.community || "");
      setAmendSector(focusedParcel.sector || "");
    }
  }, [focusedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hierarchy options driven by amendAC / amendCommunity
  const safeList = (fn, arg) => {
    try { const r = fn(arg); return Array.isArray(r) ? r.filter((x) => x?.name) : []; }
    catch { return []; }
  };
  const acOptions = useMemo(() => {
    const fromDb = (acRecords || []).map((a) => a.name).filter(Boolean);
    const base = fromDb.length ? fromDb : ALL_AREA_COUNCILS;
    const allowed = userACs && userACs.length ? userACs.map((n) => n.toLowerCase()) : null;
    const names = base.filter((n) => !allowed || allowed.includes(String(n).toLowerCase()));
    const list = names.length ? names : base;
    return Array.from(new Set(list)).map((n) => ({ id: n, name: n }));
  }, [acRecords, userACs]);
  const commOptions = useMemo(() => safeList(commForAC, amendAC), [commForAC, amendAC]);
  const sectOptions = useMemo(() => safeList(sectForComm, amendCommunity), [sectForComm, amendCommunity]);

  // Filtered parcels for the list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return parcels;
    return parcels.filter(
      (p) =>
        p.parcelNumber?.toLowerCase().includes(q) ||
        p.applicantName?.toLowerCase().includes(q) ||
        p.areaCouncil?.toLowerCase().includes(q) ||
        p.community?.toLowerCase().includes(q)
    );
  }, [parcels, search]);

  // Selection helpers
  const toggleSelect = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const selectAll = () => setSelectedIds(new Set(filtered.map((p) => p.id)));
  const clearAll = () => setSelectedIds(new Set());

  const handleFocus = (p) => {
    setFocusedId(p.id);
    // auto-select when clicking
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(p.id);
      return next;
    });
  };

  // Submission
  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      toast({ variant: "destructive", title: "Select at least one land record" });
      return;
    }
    const hasChange = amendAC || amendCommunity || amendSector;
    if (!hasChange) {
      toast({ variant: "destructive", title: "Set at least one field (Area Council, Community, or Sector)" });
      return;
    }
    if (!isAdmin && !reason.trim()) {
      toast({ variant: "destructive", title: "Please enter a reason for the amendment" });
      return;
    }

    setSaving(true);
    const ids = Array.from(selectedIds);
    try {
      // Duplicate check: when Sector is being changed, the new
      // Sector + Plot Number + Block combination must not collide with another parcel.
      if (amendSector) {
        const conflicts = [];
        for (const id of ids) {
          const p = parcels.find((x) => x.id === id);
          if (!p) continue;
          const dup = await findExistingParcel(
            { plotNumber: p.plotNumber, block: p.block, sector: amendSector },
            `amend-dupchk-${id}`,
            id,
          );
          if (dup) conflicts.push({ parcel: p, dup });
        }
        if (conflicts.length) {
          const first = conflicts[0];
          toast({
            variant: "destructive",
            title: "Duplicate Sector/Plot/Block combination",
            description: `Changing to Sector "${amendSector}" would create a duplicate for ${first.parcel.parcelNumber} (Plot ${first.parcel.plotNumber}/${first.parcel.block}) — already used by ${first.dup.parcelNumber}. Use a different Sector or fix the Plot/Block first.`,
          });
          setSaving(false);
          return;
        }
      }
      if (isAdmin) {
        // Admin: apply immediately
        const updates = {};
        if (amendAC) updates.areaCouncil = amendAC;
        if (amendCommunity) updates.community = amendCommunity;
        if (amendSector) updates.sector = amendSector;

        await Promise.all(
          ids.map((id, i) =>
            pb.collection("parcels").update(id, updates, { requestKey: `amend-${id}-${i}` })
          )
        );
        // Audit
        await Promise.all(
          ids.map((id, i) =>
            pb.collection("audit_logs").create(
              {
                actor: user.id,
                action: "parcel_amended_immediate",
                entity: id,
                details: JSON.stringify({ changes: updates, amendedBy: user.email, timestamp: new Date().toISOString() }),
              },
              { requestKey: `audit-amend-${id}-${i}` }
            )
          )
        );
        toast({ title: `${ids.length} record(s) amended successfully` });
      } else {
        // Non-admin: submit for approval
        const proposedChanges = {};
        if (amendAC) proposedChanges.areaCouncil = amendAC;
        if (amendCommunity) proposedChanges.community = amendCommunity;
        if (amendSector) proposedChanges.sector = amendSector;

        await Promise.all(
          ids.map((id, i) =>
            pb.collection("land_edit_requests").create(
              {
                parcel: id,
                requestedBy: user.id,
                type: "edit",
                proposedChanges,
                reason: reason.trim(),
                status: "pending",
              },
              { requestKey: `amend-req-${id}-${i}` }
            )
          )
        );
        toast({ title: `${ids.length} amendment request(s) submitted for approval` });
      }
      // Reset
      setSelectedIds(new Set());
      setFocusedId(null);
      setAmendAC("");
      setAmendCommunity("");
      setAmendSector("");
      setReason("");
    } catch (err) {
      toast({ variant: "destructive", title: "Amendment failed", description: err?.message || "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Bulk Amendment — Techiman North Land Registry</title>
        <meta name="description" content="Unified interface for amending Area Council, Community, and Sector fields across multiple land records." />
      </Helmet>

      <div className="flex flex-col h-full gap-0">
        <PageHeader
          title="Bulk Amendment"
          subtitle="Select land records, then edit Area Council, Community, or Sector in bulk"
          icon={Edit2}
        />

        <div className="flex flex-1 gap-4 p-4 overflow-hidden min-h-0">
          {/* ── LEFT: Land selection list ──────────────────────────── */}
          <div className="flex flex-col w-[42%] min-w-[280px] bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {/* Search + select-all header */}
            <div className="p-3 border-b border-border space-y-2 bg-muted/30">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, name, area council…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{filtered.length} records</span>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="hover:text-primary transition-colors">Select all</button>
                  <span>/</span>
                  <button onClick={clearAll} className="hover:text-destructive transition-colors">Clear</button>
                </div>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                    <CheckSquare className="h-3 w-3 mr-1" />
                    {selectedIds.size} selected
                  </Badge>
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center p-8"><Spinner /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No records found</div>
              ) : (
                filtered.map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  const isFocused = focusedId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleFocus(p)}
                      className={cn(
                        "flex items-start gap-2.5 px-3 py-2.5 cursor-pointer border-b border-border/50 transition-colors text-sm",
                        isFocused && "bg-primary/8 border-l-2 border-l-primary",
                        isSelected && !isFocused && "bg-primary/5",
                        !isSelected && !isFocused && "hover:bg-muted/40"
                      )}
                    >
                      <button
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                      >
                        {isSelected
                          ? <CheckSquare className="h-4 w-4 text-primary" />
                          : <Square className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{p.parcelNumber}</span>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {[p.applicantName, p.areaCouncil, p.community].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT: Details + amendment panel ──────────────────── */}
          <div className="flex-1 flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {!focusedParcel ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8 text-muted-foreground gap-3">
                <Edit2 className="h-10 w-10 opacity-20" />
                <p className="text-sm">Click a land record on the left to view its details and set amendment values.</p>
                <p className="text-xs opacity-70">Only <strong className="font-medium">Area Council</strong>, <strong className="font-medium">Community</strong>, and <strong className="font-medium">Sector</strong> can be edited.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-y-auto">
                {/* Header */}
                <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-foreground">{focusedParcel.parcelNumber}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {focusedParcel.applicantName || "—"} · {formatDate(focusedParcel.created)}
                    </div>
                  </div>
                  <StatusBadge status={focusedParcel.status} />
                </div>

                <div className="p-4 space-y-5 flex-1">
                  {/* Read-only info */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Read-only Fields
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <ROField label="Parcel Number" value={focusedParcel.parcelNumber} />
                      <ROField label="Applicant Name" value={focusedParcel.applicantName} />
                      <ROField label="Plot Number" value={focusedParcel.plotNumber} />
                      <ROField label="Block" value={focusedParcel.block} />
                      <ROField label="Phone" value={focusedParcel.contactPhone} />
                      <ROField label="Allocation Date" value={formatDate(focusedParcel.allocationDate)} />
                      <ROField label="Registration Date" value={formatDate(focusedParcel.registrationDate)} />
                      <ROField label="Status" value={titleCase(focusedParcel.status)} />
                    </div>
                  </div>

                  {/* Selected parcels summary */}
                  {selectedIds.size > 0 && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                        <CheckSquare className="h-3.5 w-3.5" /> {selectedIds.size} parcel{selectedIds.size !== 1 ? "s" : ""} will be updated:
                      </p>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {Array.from(selectedIds).map((id) => {
                          const p = parcels.find((x) => x.id === id);
                          return p ? (
                            <span key={id} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                              {p.parcelNumber || id.slice(0, 8)}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 italic">All other records are unaffected.</p>
                    </div>
                  )}

                  {/* Editable fields */}
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <Edit2 className="h-3 w-3" /> Editable Fields — Applied to {selectedIds.size} Selected Record{selectedIds.size !== 1 ? "s" : ""} Only
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {/* Area Council */}
                      <EditField label="Area Council">
                        <Select
                          value={amendAC || "_none"}
                          onValueChange={(v) => {
                            setAmendAC(v === "_none" ? "" : v);
                            setAmendCommunity("");
                            setAmendSector("");
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="— Keep existing / select new —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Keep existing —</SelectItem>
                            {acOptions.map((ac) => (
                              <SelectItem key={ac.id} value={ac.name}>{ac.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {amendAC && (
                          <p className="text-xs text-primary mt-1">Will set Area Council to: <strong>{amendAC}</strong></p>
                        )}
                      </EditField>

                      {/* Community */}
                      <EditField label="Community">
                        <Select
                          value={amendCommunity || "_none"}
                          onValueChange={(v) => {
                            setAmendCommunity(v === "_none" ? "" : v);
                            setAmendSector("");
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="— Keep existing / select new —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Keep existing —</SelectItem>
                            {commOptions.length > 0
                              ? commOptions.map((c) => (
                                  <SelectItem key={c.id} value={c.name}>{c.name}{c.code ? ` (${c.code})` : ""}</SelectItem>
                                ))
                              : <SelectItem value="_empty" disabled>{hierLoading ? "Loading communities…" : "No communities found for this Area Council"}</SelectItem>
                            }
                          </SelectContent>
                        </Select>
                        {amendCommunity && (
                          <p className="text-xs text-primary mt-1">Will set Community to: <strong>{amendCommunity}</strong></p>
                        )}
                      </EditField>

                      {/* Sector */}
                      <EditField label="Sector">
                        <Select
                          value={amendSector || "_none"}
                          onValueChange={(v) => setAmendSector(v === "_none" ? "" : v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="— Keep existing / select new —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Keep existing —</SelectItem>
                            {sectOptions.length > 0
                              ? sectOptions.map((s) => (
                                  <SelectItem key={s.id} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>
                                ))
                              : <SelectItem value="_empty" disabled>{hierLoading ? "Loading sectors…" : "No sectors found for this Community"}</SelectItem>
                            }
                          </SelectContent>
                        </Select>
                        {amendSector && (
                          <p className="text-xs text-primary mt-1">Will set Sector to: <strong>{amendSector}</strong></p>
                        )}
                      </EditField>

                      {/* Reason (required for non-admin) */}
                      {!isAdmin && (
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Reason for Amendment <span className="text-destructive">*</span></Label>
                          <Input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Explain why these fields need to be amended…"
                            className="h-9"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer: submit */}
                <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-muted-foreground">
                    {isAdmin
                      ? <span className="text-green-600 font-medium flex items-center gap-1"><Check className="h-3 w-3" /> Admin: changes apply immediately</span>
                      : <span className="text-amber-600 font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Changes require approval</span>
                    }
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { clearAll(); setFocusedId(null); setAmendAC(""); setAmendCommunity(""); setAmendSector(""); setReason(""); }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={saving || selectedIds.size === 0}
                    >
                      {saving ? "Saving…" : isAdmin
                        ? `Apply to ${selectedIds.size} Record${selectedIds.size !== 1 ? "s" : ""}`
                        : `Submit ${selectedIds.size} Request${selectedIds.size !== 1 ? "s" : ""}`
                      }
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
