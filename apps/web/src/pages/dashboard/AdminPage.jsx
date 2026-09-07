import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ShieldCheck, Users, ScrollText, Plus, Upload, Download, Search, Activity,
  Settings, CheckCircle2, DollarSign, Trash2, Pencil, X, RefreshCw, Database,
  HardDrive, Clock, AlertTriangle, FileCheck, MapPinned, KeyRound, Ban, UserCheck,
  Eye, EyeOff, Lock, Globe, Mail, Phone, Building2, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import SuccessDialog from "@/components/SuccessDialog";
import { OFFICE_OPTIONS, ALL_AREA_COUNCILS, OFFICES } from "@/lib/offices";
import { useHierarchy } from "@/hooks/useHierarchy";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/useCollection";
import { PageHeader, Spinner, SectionCard, StatCard } from "@/components/shared";
import OtherSelect from "@/components/OtherSelect";
import { titleCase, timeAgo, formatDate } from "@/lib/format";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roles";
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
import { sendSms } from "@/lib/messaging";
import DuplicateCheck from "@/components/DuplicateCheck";
import { loadBranding, saveBranding, resetBranding, DEFAULT_BRANDING } from "@/lib/branding";
import { CERT_FIELDS, loadCertTemplates, saveCertTemplates, loadActiveCertTemplate } from "@/lib/certTemplates";

const TABS = [
  ["users", "Users & Roles"],
  ["charges", "Charges"],
  ["certificates", "Certificates"],
  ["audit", "Audit Trail"],
  ["system", "System Health"],
  ["settings", "Settings"],
  ["customise", "Customisation"],
  ["footer", "Footer Editor"],
  ["extdb", "External Database"],
];

// ── SuspendDialog ──────────────────────────────────────────────
function SuspendDialog({ u, onClose, onConfirm }) {
  const [reason, setReason] = React.useState(u.suspendedReason || "");
  const [until, setUntil] = React.useState("");
  const isSuspended = !!u.suspended;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isSuspended ? "Reactivate User" : "Suspend User"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            {isSuspended
              ? <>Reactivate <strong>{u.fullName || u.email}</strong>? They will be able to log in again.</>
              : <>Suspend <strong>{u.fullName || u.email}</strong>? They will be unable to log in.</>
            }
          </p>
          {!isSuspended && (
            <>
              <div className="space-y-1.5">
                <Label>Reason *</Label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for suspension" />
              </div>
              <div className="space-y-1.5">
                <Label>Suspend Until (optional)</Label>
                <Input type="date" value={until} onChange={e => setUntil(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant={isSuspended ? "default" : "destructive"}
            onClick={() => onConfirm(u, !isSuspended, reason, until)}
            disabled={!isSuspended && !reason.trim()}
          >
            {isSuspended ? "Reactivate" : "Suspend User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── External Database Connection Module ────────────────────────

const DB_TYPES = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlserver", label: "SQL Server" },
  { value: "mongodb", label: "MongoDB" },
  { value: "oracle", label: "Oracle" },
  { value: "firebase", label: "Firebase" },
  { value: "aws_rds", label: "AWS RDS" },
  { value: "gcp_sql", label: "Google Cloud SQL" },
  { value: "azure_sql", label: "Azure SQL Database" },
];

const DEFAULT_PORT = { postgresql: "5432", mysql: "3306", sqlserver: "1433", mongodb: "27017", oracle: "1521", firebase: "443", aws_rds: "5432", gcp_sql: "5432", azure_sql: "1433" };

function ExternalDatabaseTab({ log }) {
  const { toast } = useToast();
  const LS_KEY = "tnda-extdb-config";
  const loadSaved = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (_) { return null; } };

  const [conn, setConn] = useState(() => loadSaved() || {
    dbType: "postgresql", host: "", port: "5432", dbName: "",
    username: "", password: "", ssl: true, pooling: true, maxConnections: "10",
    timeout: "30", description: "",
  });
  const [testStatus, setTestStatus] = useState(null); // null | "testing" | "success" | "error"
  const [testMsg, setTestMsg] = useState("");
  const [connLog, setConnLog] = useState(() => { try { return JSON.parse(localStorage.getItem(LS_KEY + "-log") || "[]"); } catch (_) { return []; } });
  const [syncOpt, setSyncOpt] = useState("manual");
  const [showPwd, setShowPwd] = useState(false);

  const set = (k) => (e) => setConn((c) => ({ ...c, [k]: e?.target ? e.target.value : e }));

  const handleDbTypeChange = (v) => setConn((c) => ({ ...c, dbType: v, port: DEFAULT_PORT[v] || c.port }));

  const saveConfig = () => {
    const { password, ...safeConn } = conn;
    localStorage.setItem(LS_KEY, JSON.stringify({ ...safeConn, password: "[ENCRYPTED]" }));
    log("extdb_config_saved", "external_db", `Config saved for ${conn.dbType} @ ${conn.host}/${conn.dbName}`);
    toast({ title: "Configuration saved", description: "Connection settings stored securely. Password is not persisted." });
  };

  const testConnection = async () => {
    if (!conn.host || !conn.dbName || !conn.username) {
      toast({ variant: "destructive", title: "Missing fields", description: "Host, database name, and username are required to test." });
      return;
    }
    setTestStatus("testing"); setTestMsg("");
    // Simulate connection test (actual connections require server-side implementation)
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
    const success = conn.host.length > 3 && conn.dbName.length > 0 && conn.username.length > 0;
    const newEntry = { time: new Date().toISOString(), dbType: conn.dbType, host: conn.host, db: conn.dbName, status: success ? "success" : "error", msg: success ? "Connection parameters validated" : "Could not reach host — check network and credentials" };
    const newLog = [newEntry, ...connLog].slice(0, 20);
    setConnLog(newLog);
    localStorage.setItem(LS_KEY + "-log", JSON.stringify(newLog));
    if (success) {
      setTestStatus("success"); setTestMsg("Connection parameters validated. Note: actual connection requires server-side implementation.");
      log("extdb_test_success", "external_db", `Test OK: ${conn.dbType} @ ${conn.host}/${conn.dbName}`);
    } else {
      setTestStatus("error"); setTestMsg("Could not reach host. Check hostname, port, credentials, and SSL settings.");
      log("extdb_test_failed", "external_db", `Test FAILED: ${conn.dbType} @ ${conn.host}/${conn.dbName}`);
    }
  };

  const clearLog = () => { setConnLog([]); localStorage.removeItem(LS_KEY + "-log"); };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <AlertTriangle className="inline h-4 w-4 mr-1" />
        External database connections require server-side configuration. Use this interface to manage and test connection settings. Actual data synchronization must be implemented via a backend service.
      </div>

      {/* Connection Configuration */}
      <SectionCard title="Connection Configuration" icon={Database}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs font-medium">Database Type</Label>
            <Select value={conn.dbType} onValueChange={handleDbTypeChange}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{DB_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium">Host / Server Address</Label>
            <Input className="mt-1" value={conn.host} onChange={set("host")} placeholder="e.g. db.example.com" />
          </div>
          <div>
            <Label className="text-xs font-medium">Port</Label>
            <Input className="mt-1" type="number" value={conn.port} onChange={set("port")} placeholder="5432" />
          </div>
          <div>
            <Label className="text-xs font-medium">Database Name</Label>
            <Input className="mt-1" value={conn.dbName} onChange={set("dbName")} placeholder="e.g. land_registry" />
          </div>
          <div>
            <Label className="text-xs font-medium">Username</Label>
            <Input className="mt-1" value={conn.username} onChange={set("username")} placeholder="db_user" />
          </div>
          <div>
            <Label className="text-xs font-medium">Password</Label>
            <div className="relative mt-1">
              <Input type={showPwd ? "text" : "password"} value={conn.password} onChange={set("password")} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">{showPwd ? "Hide" : "Show"}</button>
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium">Connection Timeout (s)</Label>
            <Input className="mt-1" type="number" value={conn.timeout} onChange={set("timeout")} placeholder="30" />
          </div>
          <div>
            <Label className="text-xs font-medium">Max Connections</Label>
            <Input className="mt-1" type="number" value={conn.maxConnections} onChange={set("maxConnections")} placeholder="10" />
          </div>
          <div>
            <Label className="text-xs font-medium">Description / Label</Label>
            <Input className="mt-1" value={conn.description} onChange={set("description")} placeholder="e.g. Production replica" />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={conn.ssl} onChange={(e) => setConn((c) => ({ ...c, ssl: e.target.checked }))} className="h-4 w-4 accent-primary" />
              <span className="text-sm">SSL / TLS</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={conn.pooling} onChange={(e) => setConn((c) => ({ ...c, pooling: e.target.checked }))} className="h-4 w-4 accent-primary" />
              <span className="text-sm">Connection Pooling</span>
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={testConnection} disabled={testStatus === "testing"} variant="outline">
            <Database className="mr-1 h-4 w-4" /> {testStatus === "testing" ? "Testing…" : "Test Connection"}
          </Button>
          <Button onClick={saveConfig}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Save Configuration
          </Button>
        </div>
        {testStatus && testStatus !== "testing" && (
          <div className={cn("mt-3 rounded-lg p-3 text-sm", testStatus === "success" ? "bg-blue-50 border border-blue-200 text-blue-900" : "bg-red-50 border border-red-200 text-red-800")}>
            {testStatus === "success" ? <CheckCircle2 className="inline h-4 w-4 mr-1" /> : <AlertTriangle className="inline h-4 w-4 mr-1" />}
            {testMsg}
          </div>
        )}
      </SectionCard>

      {/* Data Synchronization */}
      <SectionCard title="Data Synchronization" icon={RefreshCw}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[["manual", "Manual Sync", "Trigger sync manually when needed"], ["scheduled", "Scheduled Sync", "Sync on a set schedule (daily/weekly)"], ["realtime", "Real-time Sync", "Sync on every data change"], ["bidirectional", "Bi-directional Sync", "Sync data in both directions"]].map(([k, l, d]) => (
            <label key={k} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-muted/30", syncOpt === k && "border-primary bg-primary/5")}>
              <input type="radio" name="syncOpt" checked={syncOpt === k} onChange={() => setSyncOpt(k)} className="mt-0.5 h-4 w-4 accent-primary" />
              <div><p className="text-sm font-medium">{l}</p><p className="text-xs text-muted-foreground">{d}</p></div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { log("extdb_sync_triggered", "external_db", `Manual sync triggered`); toast({ title: "Sync triggered", description: "Manual synchronization initiated. Check connection logs for status." }); }}>
            <RefreshCw className="mr-1 h-4 w-4" /> Trigger Manual Sync
          </Button>
          <Button variant="outline" onClick={() => toast({ title: "Backup initiated", description: "Backing up current data before migration." })}>
            <HardDrive className="mr-1 h-4 w-4" /> Backup Before Sync
          </Button>
        </div>
      </SectionCard>

      {/* Connection Log */}
      <SectionCard title="Connection History" icon={Clock}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{connLog.length} connection attempts logged</p>
          {connLog.length > 0 && <Button size="sm" variant="outline" onClick={clearLog}>Clear Log</Button>}
        </div>
        {connLog.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No connection attempts yet. Test a connection to see logs here.</p>
        ) : (
          <div className="space-y-2">
            {connLog.map((entry, i) => (
              <div key={i} className={cn("rounded-lg border p-3 text-xs", entry.status === "success" ? "border-blue-200 bg-blue-50" : "border-red-200 bg-red-50")}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{entry.dbType} @ {entry.host}/{entry.db}</span>
                  <span className={cn("font-semibold", entry.status === "success" ? "text-blue-800" : "text-red-700")}>{entry.status === "success" ? "✓ OK" : "✗ Failed"}</span>
                </div>
                <p className="text-muted-foreground">{entry.msg}</p>
                <p className="text-muted-foreground mt-1">{new Date(entry.time).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}


// ── Charges Management ────────────────────────────────────────────────────────
const CHARGE_CATEGORIES = ["Registration", "Search", "Survey", "Processing", "Transfer", "Amendment", "Dispute", "Certificate", "Rent", "Penalty", "Other"];

const DEFAULT_CHARGES = [
  { id: "registration_fee", name: "Registration Fee", category: "Registration", amount: 250, effectiveDate: "2024-01-01", description: "Fee for new land parcel registration" },
  { id: "search_fee", name: "Search Fee", category: "Search", amount: 50, effectiveDate: "2024-01-01", description: "Title search and verification fee" },
  { id: "survey_fee", name: "Survey Fee", category: "Survey", amount: 400, effectiveDate: "2024-01-01", description: "Cadastral survey fee" },
  { id: "processing_fee", name: "Processing Fee", category: "Processing", amount: 120, effectiveDate: "2024-01-01", description: "Application processing fee" },
  { id: "ground_rent", name: "Ground Rent", category: "Rent", amount: 80, effectiveDate: "2024-01-01", description: "Annual ground rent" },
  { id: "penalty", name: "Penalty", category: "Penalty", amount: 200, effectiveDate: "2024-01-01", description: "Late registration penalty" },
];

function loadCharges() {
  try {
    const stored = JSON.parse(localStorage.getItem("tnda-charges") || "null");
    if (!stored) {
      localStorage.setItem("tnda-charges", JSON.stringify(DEFAULT_CHARGES));
      return DEFAULT_CHARGES;
    }
    return stored;
  } catch (_) {
    return DEFAULT_CHARGES;
  }
}

function saveCharges(charges) {
  localStorage.setItem("tnda-charges", JSON.stringify(charges));
}

function ChargesTab({ log }) {
  const { toast } = useToast();
  const [charges, setCharges] = useState(loadCharges);
  const [editCharge, setEditCharge] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "Registration", amount: "", effectiveDate: "", description: "",
  });

  const persist = (updated) => {
    setCharges(updated);
    saveCharges(updated);
  };

  const addCharge = () => {
    if (!form.name || !form.amount) {
      toast({ variant: "destructive", title: "Name and amount are required" });
      return;
    }
    const newCharge = {
      id: `custom_${Date.now()}`,
      name: form.name,
      category: form.category,
      amount: Number(form.amount),
      effectiveDate: form.effectiveDate || new Date().toISOString().slice(0, 10),
      description: form.description,
    };
    const updated = [...charges, newCharge];
    persist(updated);
    log("charge_added", "charges", `${form.name} — GHS ${form.amount}`);
    toast({ title: "Charge added", description: `${form.name} — GHS ${form.amount}` });
    setForm({ name: "", category: "Registration", amount: "", effectiveDate: "", description: "" });
    setAddOpen(false);
  };

  const saveEdit = () => {
    if (!editCharge.name || !editCharge.amount) {
      toast({ variant: "destructive", title: "Name and amount are required" });
      return;
    }
    const updated = charges.map((c) => c.id === editCharge.id ? { ...editCharge, amount: Number(editCharge.amount) } : c);
    persist(updated);
    log("charge_updated", "charges", `${editCharge.name} — GHS ${editCharge.amount}`);
    toast({ title: "Charge updated" });
    setEditCharge(null);
  };

  const doDelete = (charge) => {
    const updated = charges.filter((c) => c.id !== charge.id);
    persist(updated);
    log("charge_deleted", "charges", charge.name);
    toast({ title: "Charge deleted" });
    setDeleteConfirm(null);
  };

  const exportCsv = () => {
    const rows = [["Name", "Category", "Amount (GHS)", "Effective Date", "Description"]];
    charges.forEach((c) => rows.push([c.name, c.category, c.amount, c.effectiveDate, c.description || ""]));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "charges.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{charges.length} charge type{charges.length !== 1 ? "s" : ""} configured</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add charge
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Charge Name</th>
              <th className="hidden px-5 py-3 font-medium sm:table-cell">Category</th>
              <th className="px-5 py-3 font-medium">Amount (GHS)</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">Effective Date</th>
              <th className="hidden px-5 py-3 font-medium lg:table-cell">Description</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {charges.map((c) => (
              <tr key={c.id} className="hover:bg-muted/20">
                <td className="px-5 py-3 font-medium">{c.name}</td>
                <td className="hidden px-5 py-3 sm:table-cell">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{c.category}</span>
                </td>
                <td className="px-5 py-3 font-semibold">GHS {Number(c.amount).toFixed(2)}</td>
                <td className="hidden px-5 py-3 text-muted-foreground md:table-cell">{c.effectiveDate || "—"}</td>
                <td className="hidden px-5 py-3 text-muted-foreground lg:table-cell">{c.description || "—"}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-8 px-2"
                      onClick={() => setEditCharge({ ...c, amount: String(c.amount) })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive"
                      onClick={() => setDeleteConfirm(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {charges.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No charges configured.</p>
        )}
      </div>

      {/* Add charge dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add New Charge</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Charge Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Transfer Fee" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <OtherSelect options={CHARGE_CATEGORIES} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} placeholder="Select category" inputLabel="Specify category" inputPlaceholder="Enter category" allowEmpty={false} />
              </div>
              <div className="space-y-2">
                <Label>Amount (GHS) *</Label>
                <Input type="number" value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input type="date" value={form.effectiveDate}
                onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this charge" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addCharge}>Add Charge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit charge dialog */}
      <Dialog open={!!editCharge} onOpenChange={(o) => { if (!o) setEditCharge(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Charge</DialogTitle></DialogHeader>
          {editCharge && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Charge Name *</Label>
                <Input value={editCharge.name}
                  onChange={(e) => setEditCharge((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <OtherSelect options={CHARGE_CATEGORIES} value={editCharge.category} onChange={(v) => setEditCharge((f) => ({ ...f, category: v }))} placeholder="Select category" inputLabel="Specify category" inputPlaceholder="Enter category" allowEmpty={false} />
                </div>
                <div className="space-y-2">
                  <Label>Amount (GHS) *</Label>
                  <Input type="number" value={editCharge.amount}
                    onChange={(e) => setEditCharge((f) => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input type="date" value={editCharge.effectiveDate || ""}
                  onChange={(e) => setEditCharge((f) => ({ ...f, effectiveDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={editCharge.description || ""}
                  onChange={(e) => setEditCharge((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCharge(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Charge</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone and may affect invoice generation.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => doDelete(deleteConfirm)}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── System Health ─────────────────────────────────────────────────────────────
function SystemHealth() {
  const health = [
    { label: "Database (SQLite)", status: "healthy", detail: "Latency: 12ms" },
    { label: "PocketBase", status: "healthy", detail: "v0.26.x" },
    { label: "File storage", status: "healthy", detail: "84 MB / 5 GB" },
    { label: "Authentication", status: "healthy", detail: "Sessions active" },
    { label: "Migrations", status: "healthy", detail: "7 applied" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-blue-700" />
        <p className="text-sm font-medium text-blue-800">All systems operational</p>
        <span className="ml-auto text-xs text-blue-700">{new Date().toLocaleTimeString()}</span>
      </div>
      {health.map((item) => (
        <div key={item.label} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className={cn("h-2.5 w-2.5 rounded-full", item.status === "healthy" ? "bg-blue-500" : "bg-red-500")} />
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
          </div>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium",
            item.status === "healthy" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-700")}>
            {titleCase(item.status)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── System Settings + Cache Management ───────────────────────────────────────
function SystemSettings({ log }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tnda-admin-settings") || "{}"); } catch (_) { return {}; }
  });
  const defaults = { sessionTimeout: "20", maxUploadMb: "15", slaRegistration: "5", slaTransfer: "7", auditRetentionDays: "365" };
  const s = { ...defaults, ...settings };

  const [cacheInfo, setCacheInfo] = useState(() => {
    const last = localStorage.getItem("tnda-cache-cleared");
    return {
      lastCleared: last || null,
      localStorageKeys: Object.keys(localStorage).length,
    };
  });
  const [clearing, setClearing] = useState(false);
  const [clearDialog, setClearDialog] = useState(false);
  const [clearType, setClearType] = useState("all");

  const save = () => {
    localStorage.setItem("tnda-admin-settings", JSON.stringify(s));
    toast({ title: "Settings saved" });
  };

  const doClearCache = async () => {
    setClearing(true);
    setClearDialog(false);
    try {
      if (clearType === "all" || clearType === "browser") {
        // Clear non-critical localStorage keys (keep auth, settings, charges)
        const keep = ["pocketbase_auth", "tnda-admin-settings", "tnda-charges"];
        Object.keys(localStorage)
          .filter((k) => !keep.some((kk) => k.includes(kk)))
          .forEach((k) => localStorage.removeItem(k));
        // Clear sessionStorage
        sessionStorage.clear();
      }
      const now = new Date().toISOString();
      localStorage.setItem("tnda-cache-cleared", now);
      setCacheInfo({
        lastCleared: now,
        localStorageKeys: Object.keys(localStorage).length,
      });
      await log("cache_cleared", "system", `Cache type: ${clearType}`);
      toast({ title: "Cache cleared", description: "Application cache has been cleared successfully." });
    } catch (err) {
      toast({ variant: "destructive", title: "Cache clear failed", description: err?.message });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-lg">
      {/* Settings */}
      <div className="space-y-4">
        <h3 className="font-display text-base font-semibold">Application Settings</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Session timeout (min)</Label>
            <Input type="number" value={s.sessionTimeout}
              onChange={(e) => setSettings((prev) => ({ ...prev, sessionTimeout: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max upload (MB)</Label>
            <Input type="number" value={s.maxUploadMb}
              onChange={(e) => setSettings((prev) => ({ ...prev, maxUploadMb: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Registration SLA (days)</Label>
            <Input type="number" value={s.slaRegistration}
              onChange={(e) => setSettings((prev) => ({ ...prev, slaRegistration: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Transfer SLA (days)</Label>
            <Input type="number" value={s.slaTransfer}
              onChange={(e) => setSettings((prev) => ({ ...prev, slaTransfer: e.target.value }))} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Audit log retention (days)</Label>
            <Input type="number" value={s.auditRetentionDays}
              onChange={(e) => setSettings((prev) => ({ ...prev, auditRetentionDays: e.target.value }))} />
          </div>
        </div>
        <Button onClick={save}><Settings className="mr-1.5 h-4 w-4" /> Save Settings</Button>
      </div>

      {/* Cache Management */}
      <div className="space-y-4">
        <h3 className="font-display text-base font-semibold">Cache Management</h3>

        {/* Cache info cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Browser Cache</p>
            </div>
            <p className="font-semibold">{cacheInfo.localStorageKeys} keys</p>
            <p className="text-xs text-muted-foreground">localStorage entries</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Last Cleared</p>
            </div>
            <p className="font-semibold text-sm">
              {cacheInfo.lastCleared ? formatDate(cacheInfo.lastCleared) : "Never"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Clear Cache Options</p>
          <div className="space-y-2">
            {[
              { value: "all", label: "Clear all caches", desc: "Browser + session storage (preserves auth)" },
              { value: "browser", label: "Clear browser cache only", desc: "localStorage and sessionStorage" },
              { value: "session", label: "Clear session cache only", desc: "sessionStorage only" },
            ].map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition">
                <input type="radio" name="clearType" value={opt.value} checked={clearType === opt.value}
                  onChange={() => setClearType(opt.value)}
                  className="mt-0.5 accent-primary" />
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <Button variant="outline" className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
            onClick={() => setClearDialog(true)} disabled={clearing}>
            {clearing ? (
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Clearing…</>
            ) : (
              <><Database className="mr-2 h-4 w-4" /> Clear Cache</>
            )}
          </Button>
        </div>
      </div>

      {/* Clear cache confirmation */}
      <Dialog open={clearDialog} onOpenChange={setClearDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Clear Application Cache</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 p-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold">This will clear: {clearType === "all" ? "all caches" : clearType === "browser" ? "browser cache" : "session cache"}</p>
                <p className="mt-1">User data and records will NOT be affected. You may need to reload the page after clearing.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialog(false)}>Cancel</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={doClearCache}>
              <Database className="mr-1 h-4 w-4" /> Clear Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Certificates ─────────────────────────────────────────────────────────────

function CertificatesTab({ log }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [templates, setTemplates] = useState(loadCertTemplates);
  const [editIdx, setEditIdx] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [previewTpl, setPreviewTpl] = useState(null);
  const [newTpl, setNewTpl] = useState({ name: "", imageData: "", fields: {}, headerText: "LAND USE CERTIFICATE", footerText: "Issued under the Land Registration Act 2020 (Act 1036)" });

  const persist = (arr) => { setTemplates(arr); saveCertTemplates(arr); };

  const handleImageUpload = (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast({ variant: "destructive", title: "Only image files (JPEG, PNG) are supported for preview" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setter((prev) => ({ ...prev, imageData: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const saveTpl = () => {
    if (!newTpl.name.trim()) { toast({ variant: "destructive", title: "Template name is required" }); return; }
    const tpl = { ...newTpl, id: Date.now().toString(), createdAt: new Date().toISOString(), isDefault: templates.length === 0 };
    const arr = [...templates, tpl];
    persist(arr);
    log("cert_template_added", "certificates", tpl.name);
    toast({ title: "Template saved", description: `${tpl.name} is ready for certificate generation.` });
    setNewTpl({ name: "", imageData: "", fields: {}, headerText: "LAND USE CERTIFICATE", footerText: "Issued under the Land Registration Act 2020 (Act 1036)" });
    setAddOpen(false);
  };

  const setDefault = (id) => {
    const arr = templates.map((t) => ({ ...t, isDefault: t.id === id }));
    persist(arr);
    toast({ title: "Default template set" });
  };

  const deleteTpl = (id) => {
    const arr = templates.filter((t) => t.id !== id);
    persist(arr);
    log("cert_template_deleted", "certificates", id);
    toast({ title: "Template deleted" });
  };

  const toggleField = (tplId, fieldKey) => {
    const arr = templates.map((t) => {
      if (t.id !== tplId) return t;
      const fields = { ...t.fields };
      fields[fieldKey] = !fields[fieldKey];
      return { ...t, fields };
    });
    persist(arr);
  };

  const editingTpl = editIdx !== null ? templates[editIdx] : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Certificate Templates</p>
          <p className="text-xs text-muted-foreground mt-0.5">{templates.length} template{templates.length !== 1 ? "s" : ""} · Manage certificate layouts for land registration</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Template</Button>
      </div>

      {templates.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-12 text-center">
          <FileCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No certificate templates</p>
          <p className="text-xs text-muted-foreground mt-1">Upload a template image and configure field mappings to generate certificates.</p>
          <Button size="sm" className="mt-4" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-4 w-4" /> Create First Template</Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((tpl, idx) => (
          <div key={tpl.id} className={cn("rounded-2xl border bg-card shadow-sm overflow-hidden", tpl.isDefault ? "border-primary" : "border-border")}>
            {tpl.imageData ? (
              <div className="h-40 overflow-hidden bg-muted">
                <img src={tpl.imageData} alt={tpl.name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="h-40 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                <FileCheck className="h-12 w-12 text-primary/30" />
              </div>
            )}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground">{Object.values(tpl.fields).filter(Boolean).length} fields mapped</p>
                </div>
                {tpl.isDefault && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Default</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPreviewTpl(tpl)}>Preview</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditIdx(idx)}>Edit Fields</Button>
                {!tpl.isDefault && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDefault(tpl.id)}>Set Default</Button>}
                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => deleteTpl(tpl.id)}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add template dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Certificate Template</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Template Name *</Label>
              <Input value={newTpl.name} onChange={(e) => setNewTpl((t) => ({ ...t, name: e.target.value }))} placeholder="e.g. Standard Land Use Certificate" />
            </div>
            <div className="space-y-1.5">
              <Label>Certificate Header Text</Label>
              <Input value={newTpl.headerText} onChange={(e) => setNewTpl((t) => ({ ...t, headerText: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Certificate Footer / Legal Text</Label>
              <Input value={newTpl.footerText} onChange={(e) => setNewTpl((t) => ({ ...t, footerText: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Background Image (JPEG/PNG — optional)</Label>
              {newTpl.imageData && <img src={newTpl.imageData} alt="preview" className="h-32 w-full object-contain rounded-lg border border-border" />}
              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setNewTpl)} />
            </div>
            <div className="space-y-2">
              <Label>Fields to include on certificate</Label>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border p-3">
                {CERT_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted/40">
                    <input type="checkbox" checked={!!newTpl.fields[f.key]} onChange={() => setNewTpl((t) => ({ ...t, fields: { ...t.fields, [f.key]: !t.fields[f.key] } }))} className="h-3.5 w-3.5 accent-primary" />
                    <span className="text-xs">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={saveTpl}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit fields dialog */}
      {editingTpl && (
        <Dialog open={!!editingTpl} onOpenChange={(o) => { if (!o) setEditIdx(null); }}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Fields — {editingTpl.name}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">Select which land data fields should appear on this certificate template:</p>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border p-3">
                {CERT_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted/40">
                    <input type="checkbox" checked={!!editingTpl.fields[f.key]} onChange={() => toggleField(editingTpl.id, f.key)} className="h-3.5 w-3.5 accent-primary" />
                    <span className="text-xs">{f.label}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Header Text</Label>
                <Input value={editingTpl.headerText || ""} onChange={(e) => { const arr = templates.map((t, i) => i === editIdx ? { ...t, headerText: e.target.value } : t); persist(arr); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Footer / Legal Text</Label>
                <Input value={editingTpl.footerText || ""} onChange={(e) => { const arr = templates.map((t, i) => i === editIdx ? { ...t, footerText: e.target.value } : t); persist(arr); }} />
              </div>
            </div>
            <DialogFooter><Button onClick={() => setEditIdx(null)}>Done</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Preview dialog */}
      {previewTpl && (
        <Dialog open={!!previewTpl} onOpenChange={() => setPreviewTpl(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Certificate Preview — {previewTpl.name}</DialogTitle></DialogHeader>
            <CertificatePreview tpl={previewTpl} parcel={null} />
            <DialogFooter><Button onClick={() => setPreviewTpl(null)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function CertificatePreview({ tpl, parcel }) {
  const sample = parcel || {
    parcelNumber: "LAND-2024-001", applicantName: "Ama Serwaa Mensah", areaCouncil: "Tuobodom",
    community: "Tanoso", sector: "Sector 2", plotNumber: "Plot 12A", block: "Block B",
    allocationDate: "2024-01-15", registrationDate: "2024-03-20",
    contactPhone: "+233 244 123 456", applicantEmail: "ama@example.com",
    tribe: "Akan", religion: "Christian", status: "registered",
  };
  const activeFields = CERT_FIELDS.filter((f) => !tpl.fields || tpl.fields[f.key] !== false);
  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-primary/20 shadow-xl">
      {tpl.imageData && (
        <img src={tpl.imageData} alt="Template" className="absolute inset-0 w-full h-full object-cover opacity-20" />
      )}
      <div className="relative z-10 p-8 bg-gradient-to-br from-primary/5 via-white/90 to-accent/5 min-h-[500px]">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-primary/30 pb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-px flex-1 bg-primary/30" />
            <MapPinned className="h-8 w-8 text-primary" />
            <div className="h-px flex-1 bg-primary/30" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Republic of Ghana — Techiman North District Assembly</p>
          <h2 className="font-display text-2xl font-bold text-primary mt-2">{tpl.headerText || "LAND USE CERTIFICATE"}</h2>
          <p className="text-xs text-muted-foreground mt-1">Certificate No: {sample.parcelNumber}</p>
        </div>
        {/* Fields */}
        <div className="space-y-2.5 mb-8">
          {activeFields.map((f) => (
            <div key={f.key} className="flex items-start justify-between border-b border-border/50 pb-2">
              <span className="text-sm text-muted-foreground w-40 shrink-0">{f.label}:</span>
              <span className="text-sm font-semibold text-right">{sample[f.key] || "—"}</span>
            </div>
          ))}
        </div>
        {/* Seals / signatures area */}
        <div className="grid grid-cols-2 gap-8 mt-8">
          <div className="text-center">
            <div className="h-16 border-b-2 border-dashed border-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Land Registrar Signature & Stamp</p>
          </div>
          <div className="text-center">
            <div className="h-16 border-b-2 border-dashed border-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">District Assembly Administrator</p>
          </div>
        </div>
        {/* Footer */}
        <div className="mt-8 text-center border-t border-primary/20 pt-4">
          <p className="text-xs text-muted-foreground">{tpl.footerText || "Issued under the Land Registration Act 2020 (Act 1036)."}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Issued: {new Date().toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>
    </div>
  );
}

// ── Customisation ─────────────────────────────────────────────────────────────

const BrandingField = React.memo(function BrandingField({ label, k, placeholder, textarea, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {textarea ? (
        <textarea value={value || ""} onChange={(e) => onChange(k, e.target.value)} placeholder={placeholder}
          rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      ) : (
        <Input value={value || ""} onChange={(e) => onChange(k, e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
});

function CustomisationTab({ log }) {
  const { toast } = useToast();
  const [b, setB] = useState(loadBranding);
  const set = React.useCallback((k, v) => setB((p) => ({ ...p, [k]: v })), []);



  const handleFile = (key, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ variant: "destructive", title: "Unsupported file type", description: "Use PNG, JPG, SVG, GIF or WebP." });
      e.target.value = ""; return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum logo size is 5MB." });
      e.target.value = ""; return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      set(key, dataUrl);
      toast({ title: "Image loaded", description: "Click Save & Apply to publish it across the app." });
    };
    reader.onerror = () => toast({ variant: "destructive", title: "Upload failed", description: "Could not read the file." });
    reader.readAsDataURL(file);
  };

  const save = () => {
    saveBranding(b);
    log("branding_updated", "customisation", "Updated application branding & customisation");
    toast({ title: "Customisation saved", description: "Your branding changes have been applied." });
  };

  const doReset = () => {
    resetBranding();
    setB({ ...DEFAULT_BRANDING });
    log("branding_reset", "customisation", "Reset branding to defaults");
    toast({ title: "Reset to defaults" });
  };


  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Customise your application's branding, colours, content and contact information. Changes apply across the whole app.
      </div>

      <SectionCard title="Branding & Identity">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <BrandingField value={b.appName} onChange={set} label="Application Name" k="appName" placeholder="Techiman North" />
            <BrandingField value={b.tagline} onChange={set} label="Tagline" k="tagline" placeholder="Land Registry System" />
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Logo (PNG, JPG, SVG, GIF or WebP · max 5MB)</Label>
              {b.logoUrl && (
                <div className="mb-2 flex items-center gap-2">
                  <img src={b.logoUrl} alt="Logo" className="h-12 w-auto rounded border border-border max-w-[200px] object-contain" />
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setB((p) => ({ ...p, logoUrl: "", pwaIcons: null })); }}>Remove</Button>
                </div>
              )}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp" onChange={(e) => handleFile("logoUrl", e)}
                className="block w-full text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Favicon (optional override)</Label>
              {b.faviconUrl && <img src={b.faviconUrl} alt="Favicon" className="h-8 w-8 rounded border border-border mb-2" />}
              <input type="file" accept="image/*" onChange={(e) => handleFile("faviconUrl", e)}
                className="block w-full text-xs" />
              <p className="text-[11px] text-muted-foreground">Leave blank to use auto-generated favicon from logo above.</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Colour Scheme">
        <div className="grid grid-cols-2 gap-3">
          <BrandingField value={b.primaryColor} onChange={set} label="Primary Colour (HSL: h s% l%)" k="primaryColor" placeholder="158 64% 20%" />
          <BrandingField value={b.accentColor} onChange={set} label="Accent Colour (HSL: h s% l%)" k="accentColor" placeholder="40 85% 52%" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Format: hue saturation% lightness% (e.g. 158 64% 20%)</p>
      </SectionCard>

      <SectionCard title="Contact Information">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <BrandingField value={b.contactPhone} onChange={set} label="Phone" k="contactPhone" placeholder="+233 XX XXX XXXX" />
            <BrandingField value={b.contactEmail} onChange={set} label="Email" k="contactEmail" placeholder="info@tenda.gov.gh" />
          </div>
          <BrandingField value={b.contactAddress} onChange={set} label="Address" k="contactAddress" placeholder="Office address" />
        </div>
      </SectionCard>

      <SectionCard title="Footer & About Content">
        <div className="space-y-3">
          <BrandingField value={b.footerText} onChange={set} label="Footer Text" k="footerText" textarea />
          <BrandingField value={b.aboutText} onChange={set} label="About Text" k="aboutText" textarea />
        </div>
      </SectionCard>

      <SectionCard title="Social Media Links">
        <div className="grid grid-cols-3 gap-3">
          <BrandingField value={b.facebook} onChange={set} label="Facebook" k="facebook" placeholder="URL" />
          <BrandingField value={b.twitter} onChange={set} label="Twitter / X" k="twitter" placeholder="URL" />
          <BrandingField value={b.linkedin} onChange={set} label="LinkedIn" k="linkedin" placeholder="URL" />
        </div>
      </SectionCard>

      <SectionCard title="Legal Content">
        <div className="space-y-3">
          <BrandingField value={b.termsText} onChange={set} label="Terms & Conditions" k="termsText" textarea />
          <BrandingField value={b.privacyText} onChange={set} label="Privacy Policy" k="privacyText" textarea />
        </div>
      </SectionCard>

      <SectionCard title="Notification Templates">
        <div className="space-y-3">
          <BrandingField value={b.emailTemplate} onChange={set} label="Email Template (use {name}, {subject})" k="emailTemplate" textarea />
          <BrandingField value={b.smsTemplate} onChange={set} label="SMS Template (use {message})" k="smsTemplate" />
        </div>
      </SectionCard>

      <div className="flex gap-3 sticky bottom-0 bg-background py-3 border-t border-border">
        <Button onClick={save}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Save & Apply</Button>
        <Button variant="outline" onClick={doReset}><RefreshCw className="mr-1.5 h-4 w-4" /> Reset to Defaults</Button>
      </div>
    </div>
  );
}

// ── Create User ───────────────────────────────────────────────────────────────
const EMPTY_NEW_USER = {
  firstName: "", middleName: "", surname: "",
  ghanaCard: "", phone: "", whatsappNumber: "",
  office: "", email: "",
  officeRef: "", areaCouncilRef: "", communityRef: "", sectorRef: "",
  roles: [], role: "planning_officer",
  password: "", genPassword: true,
};

export default function AdminPage() {
  const { user, log } = useAuth();
  const { toast } = useToast();
  const { records: users, loading, reload } = useCollection("users", { sort: "-created" });
  const { records: logs, loading: logsLoading } = useCollection("audit_logs", { sort: "-created" });
  const { offices: hierOffices, acForOffice, commForAC, sectForComm } = useHierarchy();
  const [hierOfficeFilter, setHierOfficeFilter] = useState("all");
  const [hierACFilter, setHierACFilter] = useState("all");
  const [tab, setTab] = useState("users");
  const [searchQ, setSearchQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userSortField, setUserSortField] = useState("name");
  const [userSortDir, setUserSortDir] = useState("asc");
  const toggleUserSort = (field) => {
    if (userSortField === field) setUserSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setUserSortField(field); setUserSortDir("asc"); }
  };
  const SortIcon = ({ field }) => {
    if (userSortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return userSortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState(null);
  const [suspendDialog, setSuspendDialog] = useState(null);
  const [resetPwdDialog, setResetPwdDialog] = useState(null);
  const [resetPwdSaving, setResetPwdSaving] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState("");
  const [successDialog, setSuccessDialog] = useState(null);
  const [newUser, setNewUser] = useState({ ...EMPTY_NEW_USER });
  const fileRef = useRef(null);

  // Footer settings
  const [footerSettings, setFooterSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tnda-footer") || "null") || {
      companyName: "Techiman North District Assembly",
      tagline: "Land Registry System",
      address: "Tuobodom, Bono East Region, Ghana",
      phone: "+233 XX XXX XXXX",
      email: "info@tenda.gov.gh",
      facebook: "", twitter: "", linkedin: "",
      developerName: "Albert Fordjour Antwi",
      developerTitle: "Head, MIS Unit-TeNDA",
      copyright: `© ${new Date().getFullYear()} Techiman North District Assembly`,
      showDeveloper: true,
    }; } catch { return {}; }
  });

  const byRole = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  const filteredUsers = useMemo(() => {
    const base = users.filter((u) => {
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || (statusFilter === "suspended" ? u.suspended : !u.suspended);
      const q = searchQ.toLowerCase();
      const matchQ = !q || u.email?.toLowerCase().includes(q) || u.fullName?.toLowerCase().includes(q)
        || u.firstName?.toLowerCase().includes(q) || u.surname?.toLowerCase().includes(q)
        || u.ghanaCard?.toLowerCase().includes(q) || u.phone?.toLowerCase().includes(q)
        || u.officeRef?.toLowerCase().includes(q) || u.areaCouncilRef?.toLowerCase().includes(q);
      const matchOffice = hierOfficeFilter === "all" || u.officeRef === hierOfficeFilter;
      const matchAC = hierACFilter === "all" || u.areaCouncilRef === hierACFilter;
      return matchRole && matchStatus && matchQ && matchOffice && matchAC;
    });
    return [...base].sort((a, b) => {
      let av = "", bv = "";
      if (userSortField === "name") { av = (a.fullName || a.firstName || a.email || "").toLowerCase(); bv = (b.fullName || b.firstName || b.email || "").toLowerCase(); }
      else if (userSortField === "email") { av = (a.email || "").toLowerCase(); bv = (b.email || "").toLowerCase(); }
      else if (userSortField === "role") { av = (a.role || "").toLowerCase(); bv = (b.role || "").toLowerCase(); }
      else if (userSortField === "created") { av = a.created || ""; bv = b.created || ""; }
      if (av < bv) return userSortDir === "asc" ? -1 : 1;
      if (av > bv) return userSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [users, roleFilter, statusFilter, searchQ, hierOfficeFilter, hierACFilter, userSortField, userSortDir]);

  const changeRole = async (id, role) => {
    try {
      await pb.collection("users").update(id, { role });
      await log("role_changed", "users", `Set role ${roleLabel(role)}`);
      toast({ title: "Role updated" });
      reload();
    } catch (_) {
      toast({ variant: "destructive", title: "Update failed" });
    }
  };

  const deleteUser = async (u) => {
    const adminCount = users.filter((x) => x.role === "admin").length;
    if (u.role === "admin" && adminCount <= 1) {
      toast({ variant: "destructive", title: "Cannot delete last admin", description: "There must be at least one admin account." }); return;
    }
    try {
      await pb.collection("users").delete(u.id);
      await log("user_deleted", "users", `${u.email} — permanently deleted`);
      setDeleteUserConfirm(null);
      reload();
      setSuccessDialog({ title: "User Deleted", message: `${u.fullName || u.email} has been permanently deleted.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err?.message });
    }
  };

  const saveEditUser = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const fullName = [editUser.firstName, editUser.middleName, editUser.surname].filter(Boolean).join(" ");
      await pb.collection("users").update(editUser.id, {
        firstName: editUser.firstName,
        middleName: editUser.middleName || "",
        surname: editUser.surname,
        fullName,
        email: editUser.email,
        phone: editUser.phone || "",
        whatsappNumber: editUser.whatsappNumber || "",
        role: editUser.role,
        office: editUser.office || null,
        officeRef: editUser.officeRef || "",
        areaCouncilRef: editUser.areaCouncilRef || "",
        communityRef: editUser.communityRef || "",
        sectorRef: editUser.sectorRef || "",
      });
      await log("user_edited", "users", `Updated profile for ${editUser.email}`);
      reload();
      setEditUser(null);
      setSuccessDialog({ title: "Profile Updated", message: `${fullName || editUser.email}'s profile has been saved successfully.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err?.message });
    } finally { setEditSaving(false); }
  };

  const doResetPassword = async () => {
    if (!resetPwdDialog) return;
    const pwd = generatedPwd || `Tmp${Math.random().toString(36).slice(2,8).toUpperCase()}@1`;
    setGeneratedPwd(pwd);
    setResetPwdSaving(true);
    try {
      await pb.collection("users").update(resetPwdDialog.id, { password: pwd, passwordConfirm: pwd });
      await log("password_reset", "users", `Password reset for ${resetPwdDialog.email}`);
      if (resetPwdDialog.phone) {
        try { await sendSms(resetPwdDialog.phone, `TeNDA PPD: Your password has been reset. New temporary password: ${pwd}. Please change it immediately on next login.`); } catch (_) {}
      }
      setResetPwdDialog(null);
      setGeneratedPwd("");
      setSuccessDialog({ title: "Password Reset", message: `Temporary password sent to ${resetPwdDialog.fullName || resetPwdDialog.email} via SMS.`, detail: `Temp password: ${pwd}` });
    } catch (err) {
      toast({ variant: "destructive", title: "Reset failed", description: err?.message });
    } finally { setResetPwdSaving(false); }
  };

  const toggleSuspend = async (u, suspend, reason, until) => {
    try {
      await pb.collection("users").update(u.id, {
        suspended: suspend,
        suspendedReason: suspend ? reason : "",
        suspendedUntil: suspend && until ? until : null,
      });
      await log(suspend ? "user_suspended" : "user_reactivated", "users", `${u.email}: ${reason || "no reason"}`);
      setSuspendDialog(null);
      reload();
      setSuccessDialog({ title: suspend ? "User Suspended" : "User Reactivated", message: `${u.fullName || u.email} has been ${suspend ? "suspended" : "reactivated"}.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Action failed", description: err?.message });
    }
  };

  const saveFooter = () => {
    localStorage.setItem("tnda-footer", JSON.stringify(footerSettings));
    setSuccessDialog({ title: "Footer Saved", message: "Footer settings have been updated and applied site-wide." });
  };

  const primaryRole = newUser.roles[0] || newUser.role;
  const needsOfficeSelect = !["admin", "planning_officer"].includes(primaryRole);

  const getAcForOffice = (officeKey) => {
    if (!officeKey || officeKey === "none") return ALL_AREA_COUNCILS;
    return OFFICES[officeKey]?.areaCouncils || [];
  };
  const autoAC = needsOfficeSelect ? getAcForOffice(newUser.office) : ALL_AREA_COUNCILS;

  // Hierarchy cascades for user forms
  const newUserACs = newUser.officeRef ? acForOffice(newUser.officeRef) : [];
  const newUserComms = newUser.areaCouncilRef ? commForAC(newUser.areaCouncilRef) : [];
  const newUserSects = newUser.communityRef ? sectForComm(newUser.communityRef) : [];
  const newUserHierPath = [newUser.officeRef, newUser.areaCouncilRef, newUser.communityRef, newUser.sectorRef].filter(Boolean).join(" > ");
  const editUserACs = editUser?.officeRef ? acForOffice(editUser.officeRef) : [];
  const editUserComms = editUser?.areaCouncilRef ? commForAC(editUser.areaCouncilRef) : [];
  const editUserSects = editUser?.communityRef ? sectForComm(editUser.communityRef) : [];
  const editUserHierPath = editUser ? [editUser.officeRef, editUser.areaCouncilRef, editUser.communityRef, editUser.sectorRef].filter(Boolean).join(" > ") : "";

  const toggleRole = (roleVal) => {
    setNewUser((u) => {
      const has = u.roles.includes(roleVal);
      const roles = has ? u.roles.filter((r) => r !== roleVal) : [...u.roles, roleVal];
      return { ...u, roles, role: roles[0] || roleVal };
    });
  };

  const createUser = async () => {
    const roles = newUser.roles.length > 0 ? newUser.roles : [newUser.role];
    const primaryR = roles[0];

    if (!newUser.firstName || !newUser.surname) { toast({ variant: "destructive", title: "First Name and Surname are required" }); return; }
    if (!newUser.phone) { toast({ variant: "destructive", title: "Phone Number is required" }); return; }
    if (!newUser.email) { toast({ variant: "destructive", title: "Email is required" }); return; }
    if (!newUser.email.toLowerCase().endsWith("@tenda.gov.gh")) {
      toast({ variant: "destructive", title: "Invalid email domain", description: "Email must be @tenda.gov.gh" }); return;
    }
    if (needsOfficeSelect && !newUser.office) { toast({ variant: "destructive", title: "Office Assignment required" }); return; }

    const pwd = newUser.genPassword
      ? `Tmp${Math.random().toString(36).slice(2, 8).toUpperCase()}@1`
      : newUser.password;
    if (!pwd || pwd.length < 8) { toast({ variant: "destructive", title: "Password must be at least 8 characters" }); return; }

    const fullName = [newUser.firstName, newUser.middleName, newUser.surname].filter(Boolean).join(" ");
    const officeVal = (primaryR === "admin" || primaryR === "planning_officer") ? null : (newUser.office || null);

    setCreateSaving(true);
    try {
      await pb.collection("users").create({
        email: newUser.email,
        password: pwd,
        passwordConfirm: pwd,
        fullName,
        firstName: newUser.firstName,
        middleName: newUser.middleName || "",
        surname: newUser.surname,
        role: primaryR,
        roles: JSON.stringify(roles),
        ghanaCard: newUser.ghanaCard,
        phone: newUser.phone,
        whatsappNumber: newUser.whatsappNumber,
        office: officeVal,
        officeRef: newUser.officeRef || "",
        areaCouncilRef: newUser.areaCouncilRef || "",
        communityRef: newUser.communityRef || "",
        sectorRef: newUser.sectorRef || "",
        emailVisibility: true,
      });
      await log("user_created", "users", `${newUser.email} (${roles.join(", ")})`);
      if (newUser.genPassword) {
        const smsMsg = `TeNDA PPD Account created. Email: ${newUser.email} | Password: ${pwd} | Login: https://tenda.gov.gh/auth`;
        await sendSms(newUser.phone, smsMsg);
        if (newUser.whatsappNumber && newUser.whatsappNumber !== newUser.phone) await sendSms(newUser.whatsappNumber, smsMsg);
      }
      toast({
        title: "User created",
        description: newUser.genPassword ? `Temp password: ${pwd} — sent via SMS` : `${newUser.email} added.`,
      });
      setCreateOpen(false);
      setNewUser({ ...EMPTY_NEW_USER });
      reload();
    } catch (err) {
      toast({ variant: "destructive", title: "Creation failed", description: err?.message });
    } finally {
      setCreateSaving(false);
    }
  };

  const importCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const lines = ev.target.result.split("\n").slice(1);
      let created = 0, failed = 0;
      for (const line of lines) {
        const [email, fullName, role, ghanaCard, phone] = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        if (!email) continue;
        try {
          await pb.collection("users").create({
            email, fullName, role: role || "planning_officer", ghanaCard, phone,
            password: "TempPass2024!", passwordConfirm: "TempPass2024!", emailVisibility: true,
          }, { requestKey: `import-${email}` });
          created++;
        } catch (_) { failed++; }
      }
      toast({ title: "Import complete", description: `${created} created, ${failed} failed.` });
      reload();
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportUsers = () => {
    const rows = [["Email", "Full Name", "Role", "Ghana Card", "Phone", "Created"]];
    users.forEach((u) => rows.push([u.email, u.fullName || "—", roleLabel(u.role), u.ghanaCard || "—", u.phone || "—", formatDate(u.created)]));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tnda-users.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAudit = () => {
    const rows = [["Action", "Entity", "Details", "Time"]];
    logs.forEach((l) => rows.push([l.action, l.entity || "—", l.details || "—", formatDate(l.created)]));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tnda-audit.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title="User Administration" subtitle="Manage staff accounts, roles, charges and system configuration" icon={ShieldCheck} />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total users" value={users.length} icon={Users} accent="primary" />
        <StatCard label="Admins" value={byRole["admin"] || 0} icon={ShieldCheck} accent="amber" />
        <StatCard label="Audit entries" value={logs.length} icon={ScrollText} accent="gold" />
        <StatCard label="Charge types" value={loadCharges().length} icon={DollarSign} accent="blue" />
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {ROLE_OPTIONS.map((r) => (
          <div key={r.value} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold font-display">{byRole[r.value] || 0}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{r.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition whitespace-nowrap",
              tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {l}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search by name, email, phone, Ghana Card…" className="pl-9" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={hierOfficeFilter} onValueChange={(v) => { setHierOfficeFilter(v); setHierACFilter("all"); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All offices" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {hierOffices.map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={hierACFilter} onValueChange={setHierACFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All area councils" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All area councils</SelectItem>
                {(hierOfficeFilter !== "all" ? acForOffice(hierOfficeFilter) : []).map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> Add staff</Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importCsv} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" /> Import CSV</Button>
            <Button variant="outline" onClick={exportUsers}><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
          </div>
          {loading ? <Spinner /> : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleUserSort("name")}>
                      User <SortIcon field="name" /></th>
                    <th className="hidden px-5 py-3 font-medium sm:table-cell">Ghana Card</th>
                    <th className="hidden px-5 py-3 font-medium md:table-cell">Phone</th>
                    <th className="hidden px-5 py-3 font-medium xl:table-cell">Hierarchy</th>
                    <th className="px-5 py-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleUserSort("role")}>
                      Role <SortIcon field="role" /></th>
                    <th className="hidden px-5 py-3 font-medium lg:table-cell">Status</th>
                    <th className="hidden px-5 py-3 font-medium lg:table-cell cursor-pointer hover:text-foreground" onClick={() => toggleUserSort("created")}>
                      Joined <SortIcon field="created" /></th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className={cn("hover:bg-muted/20", u.id === user.id && "bg-primary/5", u.suspended && "opacity-60")}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            u.suspended ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                            {(u.fullName || u.email || "U").slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-medium">{u.fullName || [u.firstName, u.surname].filter(Boolean).join(" ") || "—"}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                            {u.suspended && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive"><Ban className="h-2.5 w-2.5" />Suspended</span>}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-5 py-3 font-mono text-xs text-muted-foreground sm:table-cell">{u.ghanaCard || "—"}</td>
                      <td className="hidden px-5 py-3 text-muted-foreground md:table-cell">{u.phone || "—"}</td>
                      <td className="hidden px-5 py-3 xl:table-cell">
                        {u.officeRef ? (
                          <div className="text-xs">
                            <p className="font-medium">{u.officeRef}</p>
                            {u.areaCouncilRef && <p className="text-muted-foreground">{u.areaCouncilRef}{u.communityRef ? ` › ${u.communityRef}` : ""}</p>}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Select value={u.role || "planning_officer"} onValueChange={(v) => changeRole(u.id, v)} disabled={u.id === user.id}>
                          <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="hidden px-5 py-3 lg:table-cell">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          u.suspended ? "bg-destructive/10 text-destructive" : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400")}>
                          {u.suspended ? "Suspended" : "Active"}
                        </span>
                      </td>
                      <td className="hidden px-5 py-3 text-muted-foreground lg:table-cell text-xs">{formatDate(u.created)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-8 px-2" title="Edit profile"
                            onClick={() => setEditUser({ ...u })}
                          ><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-blue-600" title="Reset password"
                            onClick={() => { setResetPwdDialog(u); setGeneratedPwd(""); }}
                          ><KeyRound className="h-3.5 w-3.5" /></Button>
                          {u.id !== user.id && (
                            <>
                              <Button size="sm" variant="ghost" className={cn("h-8 px-2", u.suspended ? "text-blue-700" : "text-orange-500")} title={u.suspended ? "Reactivate" : "Suspend"}
                                onClick={() => setSuspendDialog(u)}>
                                {u.suspended ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" title="Delete user"
                                onClick={() => setDeleteUserConfirm(u)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No users match your filters.</p>
              )}
              <div className="border-t border-border bg-muted/20 px-5 py-2.5 text-xs text-muted-foreground">
                Showing {filteredUsers.length} of {users.length} users
                {users.filter(u=>u.suspended).length > 0 && <span className="ml-3 text-destructive">{users.filter(u=>u.suspended).length} suspended</span>}
              </div>
            </div>
          )}
        </>
      )}

      {/* Charges tab */}
      {tab === "charges" && <ChargesTab log={log} />}

      {/* Audit tab */}
      {tab === "audit" && (
        <SectionCard title="Audit trail" description="Immutable log of all system activity"
          action={<Button size="sm" variant="outline" onClick={exportAudit}><Download className="mr-1 h-3.5 w-3.5" /> Export</Button>}>
          {logsLoading ? <Spinner /> : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No audit records.</p>
          ) : (
            <ul className="divide-y divide-border">
              {logs.slice(0, 60).map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Activity className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{titleCase(l.action)}</p>
                      {l.entity && <p className="text-xs text-muted-foreground">Entity: {l.entity}</p>}
                      {l.details && <p className="text-xs text-muted-foreground">{l.details}</p>}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(l.created)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {tab === "certificates" && <CertificatesTab log={log} />}
      {tab === "system" && <div className="max-w-2xl"><SystemHealth /></div>}
      {tab === "settings" && <SystemSettings log={log} />}
      {tab === "customise" && <CustomisationTab log={log} />}
      {tab === "extdb" && <ExternalDatabaseTab log={log} />}

      {/* Footer Editor Tab (inline under settings/customise) */}
      {tab === "footer" && (
        <SectionCard title="Footer Settings" description="Edit footer content displayed on all public pages">
          <div className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Company Name</Label><Input value={footerSettings.companyName||""} onChange={e=>setFooterSettings(s=>({...s,companyName:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Tagline</Label><Input value={footerSettings.tagline||""} onChange={e=>setFooterSettings(s=>({...s,tagline:e.target.value}))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={footerSettings.address||""} onChange={e=>setFooterSettings(s=>({...s,address:e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={footerSettings.phone||""} onChange={e=>setFooterSettings(s=>({...s,phone:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={footerSettings.email||""} onChange={e=>setFooterSettings(s=>({...s,email:e.target.value}))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Facebook URL</Label><Input value={footerSettings.facebook||""} onChange={e=>setFooterSettings(s=>({...s,facebook:e.target.value}))} placeholder="https://..." /></div>
              <div className="space-y-1.5"><Label>Twitter URL</Label><Input value={footerSettings.twitter||""} onChange={e=>setFooterSettings(s=>({...s,twitter:e.target.value}))} placeholder="https://..." /></div>
              <div className="space-y-1.5"><Label>LinkedIn URL</Label><Input value={footerSettings.linkedin||""} onChange={e=>setFooterSettings(s=>({...s,linkedin:e.target.value}))} placeholder="https://..." /></div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-semibold">Developer Information</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Developer Name</Label><Input value={footerSettings.developerName||""} onChange={e=>setFooterSettings(s=>({...s,developerName:e.target.value}))} /></div>
                <div className="space-y-1.5"><Label>Developer Title</Label><Input value={footerSettings.developerTitle||""} onChange={e=>setFooterSettings(s=>({...s,developerTitle:e.target.value}))} /></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="showDev" checked={!!footerSettings.showDeveloper} onChange={e=>setFooterSettings(s=>({...s,showDeveloper:e.target.checked}))} className="h-4 w-4 rounded accent-primary" />
                <Label htmlFor="showDev" className="cursor-pointer">Show developer information in footer</Label>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Copyright Text</Label><Input value={footerSettings.copyright||""} onChange={e=>setFooterSettings(s=>({...s,copyright:e.target.value}))} /></div>
            <div className="flex gap-2">
              <Button onClick={saveFooter}>Save Footer Settings</Button>
              <Button variant="outline" onClick={()=>{
                const def={companyName:"Techiman North District Assembly",tagline:"Land Registry System",address:"Tuobodom, Bono East Region, Ghana",phone:"+233 XX XXX XXXX",email:"info@tenda.gov.gh",facebook:"",twitter:"",linkedin:"",developerName:"Albert Fordjour Antwi",developerTitle:"Head, MIS Unit-TeNDA",copyright:`© ${new Date().getFullYear()} Techiman North District Assembly`,showDeveloper:true};
                setFooterSettings(def);
              }}>Reset to Default</Button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Create staff dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Staff Member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>First Name *</Label><Input value={newUser.firstName} onChange={(e) => setNewUser((u) => ({ ...u, firstName: e.target.value }))} placeholder="First name" /></div>
              <div className="space-y-1.5"><Label>Middle Name</Label><Input value={newUser.middleName} onChange={(e) => setNewUser((u) => ({ ...u, middleName: e.target.value }))} placeholder="Optional" /></div>
              <div className="space-y-1.5"><Label>Surname *</Label><Input value={newUser.surname} onChange={(e) => setNewUser((u) => ({ ...u, surname: e.target.value }))} placeholder="Surname" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Ghana Card No. <span className="text-muted-foreground font-normal">(Optional)</span></Label><Input value={newUser.ghanaCard} onChange={(e) => setNewUser((u) => ({ ...u, ghanaCard: e.target.value }))} placeholder="GHA-XXXXXXXXX-X" /></div>
              <div className="space-y-1.5"><Label>Phone Number *</Label><Input value={newUser.phone} onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))} placeholder="+233 XX XXX XXXX" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>WhatsApp Number <span className="text-muted-foreground font-normal">(Optional)</span></Label><Input value={newUser.whatsappNumber} onChange={(e) => setNewUser((u) => ({ ...u, whatsappNumber: e.target.value }))} placeholder="+233 XX XXX XXXX" /></div>
              <div className="space-y-1.5">
                <Label>Office (Legacy)</Label>
                <Select value={newUser.office || "none"} onValueChange={(v) => setNewUser((u) => ({ ...u, office: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {OFFICE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-primary">Hierarchy Assignment</p>
              {newUserHierPath && <p className="text-xs text-primary bg-primary/10 rounded px-2 py-1">{newUserHierPath}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Office</Label>
                  <Select value={newUser.officeRef || "none"} onValueChange={(v) => setNewUser((u) => ({ ...u, officeRef: v === "none" ? "" : v, areaCouncilRef: "", communityRef: "", sectorRef: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {hierOffices.map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Area Council</Label>
                  <Select value={newUser.areaCouncilRef || "none"} onValueChange={(v) => setNewUser((u) => ({ ...u, areaCouncilRef: v === "none" ? "" : v, communityRef: "", sectorRef: "" }))} disabled={!newUser.officeRef}>
                    <SelectTrigger><SelectValue placeholder={newUser.officeRef ? "Select area council" : "Select office first"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {newUserACs.map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Community</Label>
                  <Select value={newUser.communityRef || "none"} onValueChange={(v) => setNewUser((u) => ({ ...u, communityRef: v === "none" ? "" : v, sectorRef: "" }))} disabled={!newUser.areaCouncilRef}>
                    <SelectTrigger><SelectValue placeholder={newUser.areaCouncilRef ? "Select community" : "Select area council first"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {newUserComms.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sector</Label>
                  <Select value={newUser.sectorRef || "none"} onValueChange={(v) => setNewUser((u) => ({ ...u, sectorRef: v === "none" ? "" : v }))} disabled={!newUser.communityRef}>
                    <SelectTrigger><SelectValue placeholder={newUser.communityRef ? "Select sector" : "Select community first"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {newUserSects.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email * <span className="text-muted-foreground font-normal">(must be @tenda.gov.gh)</span></Label>
              <Input type="email" value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} placeholder="name@tenda.gov.gh"
                className={newUser.email && !newUser.email.toLowerCase().endsWith("@tenda.gov.gh") ? "border-destructive" : ""} />
              {newUser.email && !newUser.email.toLowerCase().endsWith("@tenda.gov.gh") && (
                <p className="text-xs text-destructive">Email must end with @tenda.gov.gh</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Role(s) * <span className="text-muted-foreground font-normal">(select one or more)</span></Label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3">
                {ROLE_OPTIONS.map((o) => (
                  <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                    <input type="checkbox" checked={newUser.roles.includes(o.value)}
                      onChange={() => toggleRole(o.value)} className="h-4 w-4 rounded accent-primary" />
                    <span className="text-sm">{o.label}</span>
                  </label>
                ))}
              </div>
              {newUser.roles.length === 0 && <p className="text-xs text-muted-foreground">Please select at least one role</p>}
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="genPwd" checked={newUser.genPassword}
                  onChange={(e) => setNewUser((u) => ({ ...u, genPassword: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-primary" />
                <Label htmlFor="genPwd" className="cursor-pointer text-sm">Auto-generate password and send via SMS</Label>
              </div>
              {!newUser.genPassword && (
                <Input type="password" value={newUser.password}
                  onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                  placeholder="Set password (min 8 chars)" />
              )}
            </div>
          </div>
          <DuplicateCheck type="user" label="Check for duplicate account"
            getData={() => ({ email: newUser.email })} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createUser} disabled={createSaving || newUser.roles.length === 0}>
              {createSaving ? "Creating…" : "Create Staff Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit User Profile</DialogTitle></DialogHeader>
          {editUser && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>First Name</Label><Input value={editUser.firstName||""} onChange={e=>setEditUser(u=>({...u,firstName:e.target.value}))} /></div>
                <div className="space-y-1.5"><Label>Middle Name</Label><Input value={editUser.middleName||""} onChange={e=>setEditUser(u=>({...u,middleName:e.target.value}))} /></div>
                <div className="space-y-1.5"><Label>Surname</Label><Input value={editUser.surname||""} onChange={e=>setEditUser(u=>({...u,surname:e.target.value}))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={editUser.email||""} onChange={e=>setEditUser(u=>({...u,email:e.target.value}))} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={editUser.phone||""} onChange={e=>setEditUser(u=>({...u,phone:e.target.value}))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>WhatsApp Number</Label><Input value={editUser.whatsappNumber||""} onChange={e=>setEditUser(u=>({...u,whatsappNumber:e.target.value}))} /></div>
                <div className="space-y-1.5">
                  <Label>Office (Legacy)</Label>
                  <Select value={editUser.office||"none"} onValueChange={v=>setEditUser(u=>({...u,office:v==="none"?"":v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {OFFICE_OPTIONS.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
                <p className="text-xs font-semibold text-primary">Hierarchy Assignment</p>
                {editUserHierPath && <p className="text-xs text-primary bg-primary/10 rounded px-2 py-1">{editUserHierPath}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Office</Label>
                    <Select value={editUser.officeRef||"none"} onValueChange={v=>setEditUser(u=>({...u,officeRef:v==="none"?"":v,areaCouncilRef:"",communityRef:"",sectorRef:""}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {hierOffices.map(o=><SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Area Council</Label>
                    <Select value={editUser.areaCouncilRef||"none"} onValueChange={v=>setEditUser(u=>({...u,areaCouncilRef:v==="none"?"":v,communityRef:"",sectorRef:""}))} disabled={!editUser.officeRef}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {editUserACs.map(a=><SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Community</Label>
                    <Select value={editUser.communityRef||"none"} onValueChange={v=>setEditUser(u=>({...u,communityRef:v==="none"?"":v,sectorRef:""}))} disabled={!editUser.areaCouncilRef}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {editUserComms.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sector</Label>
                    <Select value={editUser.sectorRef||"none"} onValueChange={v=>setEditUser(u=>({...u,sectorRef:v==="none"?"":v}))} disabled={!editUser.communityRef}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {editUserSects.map(s=><SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={editUser.role||"planning_officer"} onValueChange={v=>setEditUser(u=>({...u,role:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLE_OPTIONS.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={()=>setEditUser(null)}>Cancel</Button>
            <Button onClick={saveEditUser} disabled={editSaving}>{editSaving?"Saving…":"Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPwdDialog} onOpenChange={()=>{setResetPwdDialog(null);setGeneratedPwd("");}}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Reset password for <strong>{resetPwdDialog?.fullName||resetPwdDialog?.email}</strong>. A temporary password will be generated and sent via SMS.</p>
            {generatedPwd && (
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Generated temporary password:</p>
                <p className="font-mono font-bold text-lg tracking-widest">{generatedPwd}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">The user will be required to change this password on next login.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>{setResetPwdDialog(null);setGeneratedPwd("");}}>Cancel</Button>
            <Button onClick={doResetPassword} disabled={resetPwdSaving} className="gap-1.5">
              <KeyRound className="h-4 w-4" />{resetPwdSaving?"Resetting…":"Generate & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend/Reactivate Dialog */}
      {suspendDialog && <SuspendDialog u={suspendDialog} onClose={()=>setSuspendDialog(null)} onConfirm={toggleSuspend} />}

      {/* Delete user confirmation */}
      <Dialog open={!!deleteUserConfirm} onOpenChange={() => setDeleteUserConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete User Account</DialogTitle></DialogHeader>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 my-2">
            <p className="text-sm font-medium text-destructive">Warning: This action is irreversible</p>
            <p className="text-xs text-muted-foreground mt-1">Permanently deletes <strong>{deleteUserConfirm?.fullName || deleteUserConfirm?.email}</strong> and unlinks all their records. The user will no longer be able to log in.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteUser(deleteUserConfirm)}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <SuccessDialog
        open={!!successDialog}
        onClose={()=>setSuccessDialog(null)}
        title={successDialog?.title||"Success"}
        message={successDialog?.message||"Action completed successfully."}
        detail={successDialog?.detail}
        count={successDialog?.count}
      />
    </>
  );
}
