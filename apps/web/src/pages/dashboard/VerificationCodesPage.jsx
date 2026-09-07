import React, { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import {
  KeyRound, Plus, Copy, Check, Trash2, Eye, RefreshCw, ShieldCheck, Filter,
  Calendar, Users, Activity, ToggleLeft, ToggleRight, Search, Download,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { useHierarchy } from "@/hooks/useHierarchy";
import { PageHeader, SectionCard, StatCard, Spinner, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GH", { year: "numeric", month: "short", day: "numeric" });
}

function timeAgo(d) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(d);
}

function daysUntil(d) {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function genCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function CodeStatusBadge({ code }) {
  const now = new Date();
  const expired = code.expiresAt && new Date(code.expiresAt) < now;
  const maxReached = code.maxUsage && code.usageCount >= code.maxUsage;
  if (!code.isActive || maxReached) return <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[11px] font-medium">Inactive</span>;
  if (expired) return <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px] font-medium">Expired</span>;
  const remaining = code.expiresAt ? daysUntil(code.expiresAt) : null;
  if (remaining !== null && remaining <= 7) return <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[11px] font-medium">Expires in {remaining}d</span>;
  return <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[11px] font-medium">Active</span>;
}

const EMPTY_FORM = {
  codeType: "community",
  officeRef: "", areaCouncilRef: "", communityRef: "",
  customCode: "", autoGenerate: true,
  maxUsage: "", expiresInDays: "30", description: "",
};

export default function VerificationCodesPage() {
  const { user, log } = useAuth();
  const { toast } = useToast();
  const { offices, acForOffice, commForAC } = useHierarchy();

  const [codes, setCodes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailCode, setDetailCode] = useState(null);
  const [editCode, setEditCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [generatedCode, setGeneratedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOffice, setFilterOffice] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterAC, setFilterAC] = useState("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        pb.collection("verification_codes").getFullList({ sort: "-created", expand: "createdBy", requestKey: "vc-list" }).catch(() => []),
        pb.collection("verification_logs").getFullList({ sort: "-created", requestKey: "vl-list" }).catch(() => []),
      ]);
      setCodes(c);
      setLogs(l);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const setF = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === "string" ? v : v?.target?.value ?? "" }));

  const acOptions = form.officeRef ? acForOffice(form.officeRef) : [];
  const commOptions = form.areaCouncilRef ? commForAC(form.areaCouncilRef) : [];

  const handleGenerate = () => {
    setGeneratedCode(genCode());
  };

  const copyCode = (c) => {
    navigator.clipboard.writeText(c).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const createCode = async () => {
    const codeVal = generatedCode.trim().toUpperCase();
    const isAdminCode = form.codeType === "admin";
    if (!isAdminCode) {
      if (!form.officeRef) { toast({ variant: "destructive", title: "Office required" }); return; }
      if (!form.areaCouncilRef) { toast({ variant: "destructive", title: "Area Council required" }); return; }
      if (!form.communityRef) { toast({ variant: "destructive", title: "Community required" }); return; }
    }
    if (!codeVal) { toast({ variant: "destructive", title: "Generate a code first" }); return; }
    if (!/^[A-Z0-9]{10}$/.test(codeVal)) {
      toast({ variant: "destructive", title: "Invalid code format", description: "Exactly 10 uppercase alphanumeric characters (e.g. A1B2C3D4E5)" }); return;
    }

    setSaving(true);
    try {
      const expiresAt = form.expiresInDays
        ? new Date(Date.now() + parseInt(form.expiresInDays) * 86400000).toISOString()
        : null;
      await pb.collection("verification_codes").create({
        code: codeVal,
        codeType: form.codeType || "community",
        officeRef: isAdminCode ? "" : form.officeRef,
        areaCouncilRef: isAdminCode ? "" : form.areaCouncilRef,
        communityRef: isAdminCode ? "" : form.communityRef,
        description: form.description,
        maxUsage: form.maxUsage ? parseInt(form.maxUsage) : 0,
        usageCount: 0,
        expiresAt,
        isActive: true,
        createdBy: user.id,
      });
      await log("verification_code_created", "verification_codes", `Code ${codeVal} for ${form.communityRef}`);
      toast({ title: "Verification code created", description: codeVal });
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM });
      setGeneratedCode("");
      loadData();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c) => {
    await pb.collection("verification_codes").update(c.id, { isActive: !c.isActive });
    await log(c.isActive ? "verification_code_deactivated" : "verification_code_activated", "verification_codes", c.code);
    loadData();
  };

  const deleteCode = async (c) => {
    if (!window.confirm(`Delete verification code ${c.code}?`)) return;
    await pb.collection("verification_codes").delete(c.id);
    await log("verification_code_deleted", "verification_codes", c.code);
    toast({ title: "Code deleted" });
    loadData();
  };

  const saveEdit = async () => {
    if (!editCode) return;
    setSaving(true);
    try {
      const expiresAt = editCode.expiresInDays
        ? new Date(Date.now() + parseInt(editCode.expiresInDays) * 86400000).toISOString()
        : editCode.expiresAt || null;
      await pb.collection("verification_codes").update(editCode.id, {
        description: editCode.description,
        maxUsage: editCode.maxUsage ? parseInt(editCode.maxUsage) : 0,
        expiresAt,
      });
      await log("verification_code_edited", "verification_codes", editCode.code);
      toast({ title: "Code updated" });
      setEditCode(null);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const now = new Date();
    return codes.filter((c) => {
      const expired = c.expiresAt && new Date(c.expiresAt) < now;
      const maxReached = c.maxUsage && c.usageCount >= c.maxUsage;
      const effectiveStatus = !c.isActive || maxReached ? "inactive" : expired ? "expired" : "active";
      if (filterStatus !== "all" && effectiveStatus !== filterStatus) return false;
      if (filterType !== "all" && (c.codeType || "community") !== filterType) return false;
      if (filterOffice !== "all" && c.officeRef !== filterOffice) return false;
      if (filterAC !== "all" && c.areaCouncilRef !== filterAC) return false;
      const q = searchQ.toLowerCase();
      if (q && !c.code.toLowerCase().includes(q) && !c.communityRef?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [codes, filterStatus, filterType, filterOffice, filterAC, searchQ]);

  const now = new Date();
  const activeCodes = codes.filter((c) => c.isActive && !(c.expiresAt && new Date(c.expiresAt) < now));
  const expiredCodes = codes.filter((c) => c.expiresAt && new Date(c.expiresAt) < now);
  const totalUsage = codes.reduce((s, c) => s + (c.usageCount || 0), 0);

  const exportCSV = () => {
    const rows = [["Code", "Community", "Area Council", "Office", "Status", "Usage", "Max", "Expires", "Description", "Created"]];
    filtered.forEach((c) => rows.push([c.code, c.communityRef, c.areaCouncilRef, c.officeRef,
      c.isActive ? "Active" : "Inactive", c.usageCount, c.maxUsage || "Unlimited",
      formatDate(c.expiresAt), c.description || "", formatDate(c.created)]));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "verification-codes.csv"; a.click();
  };

  const uniqueOffices = [...new Set(codes.map((c) => c.officeRef).filter(Boolean))];
  const uniqueACs = [...new Set(codes.map((c) => c.areaCouncilRef).filter(Boolean))];

  return (
    <>
      <Helmet>
        <title>Verification Codes — Techiman North Land Registry</title>
        <meta name="description" content="Manage public land verification access codes for Techiman North District." />
      </Helmet>

      <PageHeader
        title="Verification Codes"
        subtitle="Generate and manage public land verification access codes"
        icon={KeyRound}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1 h-4 w-4" /> Export</Button>
            <Button variant="outline" size="sm" onClick={() => { setForm({ ...EMPTY_FORM, codeType: "admin" }); setGeneratedCode(genCode()); setCreateOpen(true); }}>
              <ShieldCheck className="mr-1 h-4 w-4" /> Admin Code (all lands)
            </Button>
            <Button size="sm" onClick={() => { setForm({ ...EMPTY_FORM }); setGeneratedCode(""); setCreateOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Generate Code
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total codes" value={codes.length} icon={KeyRound} accent="primary" />
        <StatCard label="Active" value={activeCodes.length} icon={ShieldCheck} accent="amber" />
        <StatCard label="Expired" value={expiredCodes.length} icon={Calendar} accent="gold" />
        <StatCard label="Total uses" value={totalUsage} icon={Activity} accent="blue" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search by code or community…" className="pl-9 h-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All code types</SelectItem>
            <SelectItem value="community">Community codes</SelectItem>
            <SelectItem value="admin">Admin codes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterOffice} onValueChange={setFilterOffice}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All offices" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All offices</SelectItem>
            {uniqueOffices.filter(Boolean).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAC} onValueChange={setFilterAC}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All area councils" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All area councils</SelectItem>
            {uniqueACs.filter(Boolean).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Code list */}
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={KeyRound} title="No verification codes"
          message="Generate your first verification code to enable public land verification." />
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="hidden sm:table-cell px-5 py-3 font-medium">Community</th>
                <th className="hidden md:table-cell px-5 py-3 font-medium">Area Council</th>
                <th className="hidden lg:table-cell px-5 py-3 font-medium">Usage</th>
                <th className="hidden lg:table-cell px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-muted px-2 py-1 rounded">{c.code}</span>
                      <button onClick={() => copyCode(c.code)} className="text-muted-foreground hover:text-foreground transition">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                  </td>
                  <td className="hidden sm:table-cell px-5 py-3 text-muted-foreground">
                    {(c.codeType || "community") === "admin"
                      ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">All lands (Admin)</span>
                      : (c.communityRef || "—")}
                  </td>
                  <td className="hidden md:table-cell px-5 py-3 text-muted-foreground">{c.areaCouncilRef || "—"}</td>
                  <td className="hidden lg:table-cell px-5 py-3">
                    <span className="font-medium">{c.usageCount || 0}</span>
                    {c.maxUsage ? <span className="text-muted-foreground">/{c.maxUsage}</span> : <span className="text-muted-foreground"> / ∞</span>}
                  </td>
                  <td className="hidden lg:table-cell px-5 py-3 text-xs text-muted-foreground">{formatDate(c.expiresAt)}</td>
                  <td className="px-5 py-3"><CodeStatusBadge code={c} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 px-2" title="Details" onClick={() => setDetailCode(c)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" title="Edit" onClick={() => setEditCode({ ...c, expiresInDays: "" })}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className={cn("h-8 px-2", c.isActive ? "text-blue-600" : "text-blue-700")}
                        title={c.isActive ? "Deactivate" : "Activate"} onClick={() => toggleActive(c)}>
                        {c.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" title="Delete" onClick={() => deleteCode(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border bg-muted/20 px-5 py-2.5 text-xs text-muted-foreground">
            Showing {filtered.length} of {codes.length} codes
          </div>
        </div>
      )}

      {/* Recent verification activity */}
      {logs.length > 0 && (
        <SectionCard title="Recent Verification Activity">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Community</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Results</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.slice(0, 20).map((l) => (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="py-2 pr-4 font-mono text-xs">{l.code || "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{l.communityRef || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
                        l.status === "success" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-700")}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{l.resultsCount ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{timeAgo(l.created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Generate Verification Code</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Code type</Label>
              <Select value={form.codeType} onValueChange={(v) => setForm((f) => ({ ...f, codeType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="community">Community code — one community only</SelectItem>
                  <SelectItem value="admin">Admin code — verifies all lands district-wide</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Hierarchy */}
            <div className={cn("space-y-3 rounded-xl border border-border bg-muted/20 p-4", form.codeType === "admin" && "hidden")}>
              <p className="text-xs font-semibold text-primary">Assign to Hierarchy</p>
              {(form.officeRef || form.areaCouncilRef || form.communityRef) && (
                <p className="text-xs text-primary bg-primary/5 rounded px-2 py-1">
                  {[form.officeRef, form.areaCouncilRef, form.communityRef].filter(Boolean).join(" > ")}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Office *</Label>
                  <Select value={form.officeRef || "none"} onValueChange={(v) => setForm((f) => ({ ...f, officeRef: v === "none" ? "" : v, areaCouncilRef: "", communityRef: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {offices.filter((o) => o && o.name).map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Area Council *</Label>
                  <Select value={form.areaCouncilRef || "none"} onValueChange={(v) => setForm((f) => ({ ...f, areaCouncilRef: v === "none" ? "" : v, communityRef: "" }))} disabled={!form.officeRef}>
                    <SelectTrigger><SelectValue placeholder={form.officeRef ? "Select" : "Select office first"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {acOptions.filter((a) => a && a.name).map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Community *</Label>
                  <Select value={form.communityRef || "none"} onValueChange={(v) => setForm((f) => ({ ...f, communityRef: v === "none" ? "" : v }))} disabled={!form.areaCouncilRef}>
                    <SelectTrigger><SelectValue placeholder={form.areaCouncilRef ? "Select community" : "Select area council first"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {commOptions.filter((c) => c && c.name).map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Code format */}
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold text-primary">Verification Code — 10-character alphanumeric</p>
              <div className="flex gap-2">
                <Input value={generatedCode} readOnly placeholder="Click Generate to create a code" className="font-mono text-lg font-bold tracking-widest flex-1" />
                <Button variant="outline" onClick={handleGenerate} type="button">Generate</Button>
                {generatedCode && (
                  <Button variant="ghost" size="icon" onClick={() => copyCode(generatedCode)}>
                    {copied ? <Check className="h-4 w-4 text-blue-700" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Format: 10 uppercase letters/numbers (e.g. A1B2C3D4E5)</p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Max usage (0 = unlimited)</Label>
                <Input type="number" min="0" value={form.maxUsage} onChange={setF("maxUsage")} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expires in (days, 0 = never)</Label>
                <Input type="number" min="0" value={form.expiresInDays} onChange={setF("expiresInDays")} placeholder="30" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Input value={form.description} onChange={setF("description")} placeholder="e.g. Issued for community land day event" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createCode} disabled={saving}>{saving ? "Creating…" : "Create Code"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailCode} onOpenChange={() => setDetailCode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Code Details</DialogTitle></DialogHeader>
          {detailCode && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <span className="font-mono text-xl font-bold">{detailCode.code}</span>
                <button onClick={() => copyCode(detailCode.code)} className="ml-auto text-muted-foreground hover:text-foreground">
                  {copied ? <Check className="h-5 w-5 text-blue-700" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Office", detailCode.officeRef],
                  ["Area Council", detailCode.areaCouncilRef],
                  ["Community", detailCode.communityRef],
                  ["Usage", `${detailCode.usageCount || 0} / ${detailCode.maxUsage || "∞"}`],
                  ["Created", formatDate(detailCode.created)],
                  ["Expires", formatDate(detailCode.expiresAt)],
                  ["Description", detailCode.description || "—"],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="font-medium">{v || "—"}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold mb-2 text-muted-foreground">Verification URL</p>
                <p className="text-xs font-mono break-all text-primary">{window.location.origin}/verify-land?code={detailCode.code}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailCode(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editCode} onOpenChange={() => setEditCode(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit Code — {editCode?.code}</DialogTitle></DialogHeader>
          {editCode && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={editCode.description || ""} onChange={(e) => setEditCode((c) => ({ ...c, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max usage (0 = unlimited)</Label>
                <Input type="number" min="0" value={editCode.maxUsage || ""} onChange={(e) => setEditCode((c) => ({ ...c, maxUsage: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Extend by days (0 = keep current)</Label>
                <Input type="number" min="0" value={editCode.expiresInDays || ""} onChange={(e) => setEditCode((c) => ({ ...c, expiresInDays: e.target.value }))} placeholder="e.g. 30" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCode(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
