import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet";
import {
  Wallet, Download, RefreshCw, FileText, TrendingUp, TrendingDown,
  CheckCircle2, Clock, XCircle, RotateCcw, Receipt, Filter,
  AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, AreaChart, Area,
} from "recharts";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner, SectionCard, StatCard, EmptyState } from "@/components/shared";
import { titleCase, formatDate, ghs } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

const COLORS = ["#1e3a8a", "#2563eb", "#0891b2", "#16a34a", "#e0a422", "#ea580c", "#dc2626", "#7c3aed"];

const PURPOSE_LABELS = {
  registration_fee: "Registration Fee",
  search_fee: "Search Fee",
  survey_fee: "Survey Fee",
  processing_fee: "Processing Fee",
  ground_rent: "Ground Rent",
  penalty: "Penalty",
  transfer_fee: "Transfer Fee",
};
const purposeLabel = (p) => PURPOSE_LABELS[p] || (p ? titleCase(p) : "Unspecified");

const METHOD_LABELS = {
  mobile_money: "Mobile Money",
  card: "Card",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
};
const methodLabel = (m) => METHOD_LABELS[m] || (m ? titleCase(m) : "Unspecified");

const STATUS_LIST = ["paid", "pending", "failed", "refunded"];

function monthKey(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  if (!key) return "—";
  const [y, m] = key.split("-");
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1] || ""} ${y}`;
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function FinancialReportsPage() {
  const { toast } = useToast();
  const { user, log } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [payments, setPayments] = useState([]);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterPurpose, setFilterPurpose] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAC, setFilterAC] = useState("all");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(false);
    try {
      const list = await pb.collection("payments").getFullList({
        sort: "-created",
        requestKey: "fin-rep-payments",
      });
      setPayments(list);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime refresh so reports stay current with new payments
  useEffect(() => {
    void pb.collection("payments").subscribe("*", () => { load(true); })
      .catch((err) => console.error("financial reports subscription failed", err));
    return () => { void pb.collection("payments").unsubscribe("*").catch(() => {}); };
  }, [load]);

  // Filter options
  const purposeOptions = useMemo(
    () => ["all", ...Array.from(new Set(payments.map((p) => p.purpose).filter(Boolean))).sort()],
    [payments],
  );
  const methodOptions = useMemo(
    () => ["all", ...Array.from(new Set(payments.map((p) => p.method).filter(Boolean))).sort()],
    [payments],
  );
  const acOptions = useMemo(
    () => ["all", ...Array.from(new Set(payments.map((p) => p.areaCouncil).filter(Boolean))).sort()],
    [payments],
  );

  // Filtered payments (date range + filters). Date filtering uses `created`.
  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    return payments.filter((p) => {
      const d = new Date(p.created);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (filterPurpose !== "all" && p.purpose !== filterPurpose) return false;
      if (filterMethod !== "all" && p.method !== filterMethod) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterAC !== "all" && p.areaCouncil !== filterAC) return false;
      return true;
    });
  }, [payments, dateFrom, dateTo, filterPurpose, filterMethod, filterStatus, filterAC]);

  // Totals — revenue is the sum of `amount` on paid payment records (the
  // authoritative Payment Amount values from registration/transfer forms).
  const totals = useMemo(() => {
    const byStatus = { paid: [], pending: [], failed: [], refunded: [] };
    filtered.forEach((p) => {
      const s = byStatus[p.status] ? p.status : "pending";
      byStatus[s].push(p);
    });
    const sum = (arr) => arr.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return {
      count: filtered.length,
      paidCount: byStatus.paid.length,
      pendingCount: byStatus.pending.length,
      failedCount: byStatus.failed.length,
      refundedCount: byStatus.refunded.length,
      paid: sum(byStatus.paid),
      pending: sum(byStatus.pending),
      failed: sum(byStatus.failed),
      refunded: sum(byStatus.refunded),
      avgPaid: byStatus.paid.length ? sum(byStatus.paid) / byStatus.paid.length : 0,
    };
  }, [filtered]);

  // Breakdown by purpose / method / area council (paid only for revenue)
  const byPurpose = useMemo(() => {
    const m = {};
    filtered.filter((p) => p.status === "paid").forEach((p) => {
      const k = p.purpose || "unspecified";
      m[k] = (m[k] || 0) + (Number(p.amount) || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name: purposeLabel(name), value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const byMethod = useMemo(() => {
    const m = {};
    filtered.filter((p) => p.status === "paid").forEach((p) => {
      const k = p.method || "unspecified";
      m[k] = (m[k] || 0) + (Number(p.amount) || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name: methodLabel(name), value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const byAC = useMemo(() => {
    const m = {};
    filtered.filter((p) => p.status === "paid").forEach((p) => {
      const k = p.areaCouncil || "Unassigned";
      m[k] = (m[k] || 0) + (Number(p.amount) || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Monthly revenue trend (paid)
  const byMonth = useMemo(() => {
    const m = {};
    filtered.filter((p) => p.status === "paid").forEach((p) => {
      const k = monthKey(p.created);
      if (!k) return;
      if (!m[k]) m[k] = { key: k, revenue: 0, count: 0 };
      m[k].revenue += Number(p.amount) || 0;
      m[k].count += 1;
    });
    return Object.values(m).sort((a, b) => a.key.localeCompare(b.key)).slice(-12)
      .map((r) => ({ name: monthLabel(r.key).split(" ")[0], full: r.key, revenue: Math.round(r.revenue), count: r.count }));
  }, [filtered]);

  // Year-on-year comparison (paid revenue by year)
  const byYear = useMemo(() => {
    const m = {};
    filtered.filter((p) => p.status === "paid").forEach((p) => {
      const y = new Date(p.created).getFullYear();
      if (isNaN(y)) return;
      if (!m[y]) m[y] = { year: y, revenue: 0, count: 0 };
      m[y].revenue += Number(p.amount) || 0;
      m[y].count += 1;
    });
    return Object.values(m).sort((a, b) => a.year - b.year);
  }, [filtered]);

  const yoy = useMemo(() => {
    if (byYear.length < 2) return null;
    const cur = byYear[byYear.length - 1];
    const prev = byYear[byYear.length - 2];
    const pct = prev.revenue > 0 ? Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 100) : null;
    return { cur, prev, pct };
  }, [byYear]);

  const clearFilters = () => {
    setDateFrom(""); setDateTo(""); setFilterPurpose("all"); setFilterMethod("all");
    setFilterStatus("all"); setFilterAC("all");
  };
  const hasFilters = dateFrom || dateTo || filterPurpose !== "all" || filterMethod !== "all" || filterStatus !== "all" || filterAC !== "all";

  // ── Exports ────────────────────────────────────────────────────────
  const auditExport = async (fmt, label) => {
    try {
      await pb.collection("audit_logs").create({
        actor: user.id,
        action: "financial_report_export",
        entity: "payments",
        details: JSON.stringify({
          format: fmt,
          label,
          filters: { dateFrom, dateTo, filterPurpose, filterMethod, filterStatus, filterAC },
          recordCount: filtered.length,
          totalRevenue: totals.paid,
          exportedBy: user.email,
          exportedAt: new Date().toISOString(),
        }),
      }, { requestKey: `fin-rep-audit-${fmt}-${Date.now()}` });
    } catch (_) {}
  };

  const exportCSV = () => {
    if (filtered.length === 0) { toast({ variant: "destructive", title: "No records to export" }); return; }
    const headers = ["Invoice No", "Parcel No", "Owner Name", "Purpose", "Method", "Status", "Amount (GHS)", "Area Council", "Community", "Date"];
    const rows = filtered.map((p) => [
      p.invoiceNumber || "", p.parcelNumber || "", p.ownerName || "",
      purposeLabel(p.purpose), methodLabel(p.method), titleCase(p.status),
      Number(p.amount) || 0, p.areaCouncil || "", p.community || "", formatDate(p.created),
    ]);
    const lines = [
      ["TeNDA Land Registry — Financial Report"],
      ["Generated", new Date().toLocaleString()],
      ["Records", filtered.length],
      ["Total Revenue (Paid)", `GHS ${totals.paid.toFixed(2)}`],
      ["Pending", `GHS ${totals.pending.toFixed(2)}`, "Failed", `GHS ${totals.failed.toFixed(2)}`, "Refunded", `GHS ${totals.refunded.toFixed(2)}`],
      [],
      headers,
      ...rows,
    ];
    const csv = lines.map((r) => r.map(csvEscape).join(",")).join("\n");
    downloadBlob(csv, `financial-report-${Date.now()}.csv`, "text/csv");
    auditExport("CSV", "Financial Report (CSV)");
    log?.("financial_report_export", "payments", `CSV export — ${filtered.length} records, GHS ${totals.paid.toFixed(2)}`);
    toast({ title: "Financial report exported (CSV)" });
  };

  const exportXLSX = () => {
    if (filtered.length === 0) { toast({ variant: "destructive", title: "No records to export" }); return; }
    const wb = XLSX.utils.book_new();
    // Summary sheet
    const summary = [
      ["TeNDA Land Registry — Financial Report"],
      ["Generated", new Date().toLocaleString()],
      [],
      ["SUMMARY"],
      ["Total Transactions", totals.count],
      ["Paid Transactions", totals.paidCount],
      ["Pending Transactions", totals.pendingCount],
      ["Failed Transactions", totals.failedCount],
      ["Refunded Transactions", totals.refundedCount],
      [],
      ["Total Revenue (Paid)", Number(totals.paid.toFixed(2))],
      ["Pending Value", Number(totals.pending.toFixed(2))],
      ["Failed Value", Number(totals.failed.toFixed(2))],
      ["Refunded Value", Number(totals.refunded.toFixed(2))],
      ["Average Paid Transaction", Number(totals.avgPaid.toFixed(2))],
      [],
      ["REVENUE BY PURPOSE"],
      ...byPurpose.map((r) => [r.name, r.value]),
      [],
      ["REVENUE BY METHOD"],
      ...byMethod.map((r) => [r.name, r.value]),
      [],
      ["REVENUE BY AREA COUNCIL"],
      ...byAC.map((r) => [r.name, r.value]),
      [],
      ["YEAR-ON-YEAR"],
      ...byYear.map((r) => [r.year, r.revenue, r.count]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
    // Transactions sheet
    const txHeaders = ["Invoice No", "Parcel No", "Owner Name", "Purpose", "Method", "Status", "Amount (GHS)", "Area Council", "Community", "Date"];
    const txRows = filtered.map((p) => [
      p.invoiceNumber || "", p.parcelNumber || "", p.ownerName || "",
      purposeLabel(p.purpose), methodLabel(p.method), titleCase(p.status),
      Number(p.amount) || 0, p.areaCouncil || "", p.community || "", formatDate(p.created),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]);
    ws["!cols"] = txHeaders.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `financial-report-${Date.now()}.xlsx`);
    auditExport("XLSX", "Financial Report (Excel)");
    log?.("financial_report_export", "payments", `Excel export — ${filtered.length} records`);
    toast({ title: "Financial report exported (Excel)" });
  };

  const exportPDF = () => {
    if (filtered.length === 0) { toast({ variant: "destructive", title: "No records to export" }); return; }
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("TeNDA Land Registry — Financial Report", pageW / 2, 14, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}  |  Records: ${filtered.length}  |  Total Revenue: ${ghs(totals.paid)}`, pageW / 2, 20, { align: "center" });

    // Statement summary box
    let y = 28;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Financial Statement Summary", 10, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    const summaryRows = [
      ["Total Transactions", String(totals.count), "Total Revenue (Paid)", ghs(totals.paid)],
      ["Paid", String(totals.paidCount), "Pending Value", ghs(totals.pending)],
      ["Pending", String(totals.pendingCount), "Failed Value", ghs(totals.failed)],
      ["Failed", String(totals.failedCount), "Refunded Value", ghs(totals.refunded)],
      ["Refunded", String(totals.refundedCount), "Avg Paid Transaction", ghs(totals.avgPaid)],
    ];
    summaryRows.forEach((r) => {
      doc.text(`${r[0]}: ${r[1]}`, 12, y);
      doc.text(`${r[2]}: ${r[3]}`, 110, y);
      y += 4.5;
    });
    y += 4;

    // Transactions table
    const cols = ["Invoice", "Parcel", "Owner", "Purpose", "Method", "Status", "Amount", "Area Council", "Date"];
    const widths = [26, 26, 36, 30, 26, 20, 22, 30, 26];
    const drawHeader = () => {
      doc.setFillColor(30, 64, 120); doc.rect(10, y, widths.reduce((a, b) => a + b, 0), 6, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      let x = 10; cols.forEach((c, i) => { doc.text(c, x + 1, y + 4); x += widths[i]; });
      y += 6; doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(40, 40, 40);
    };
    drawHeader();
    filtered.forEach((p, idx) => {
      if (y > doc.internal.pageSize.getHeight() - 10) { doc.addPage(); y = 10; drawHeader(); }
      doc.setFillColor(idx % 2 ? 248 : 255); doc.rect(10, y, widths.reduce((a, b) => a + b, 0), 5, "F");
      const vals = [
        p.invoiceNumber || "", p.parcelNumber || "", (p.ownerName || "").slice(0, 22),
        purposeLabel(p.purpose).slice(0, 18), methodLabel(p.method).slice(0, 16),
        titleCase(p.status), ghs(p.amount), (p.areaCouncil || "").slice(0, 18), formatDate(p.created),
      ];
      let x = 10; vals.forEach((v, i) => { const maxC = Math.floor(widths[i] / 1.7); const s = String(v); doc.text(s.length > maxC ? s.slice(0, maxC - 1) + "…" : s, x + 1, y + 4); x += widths[i]; });
      y += 5;
    });
    doc.save(`financial-report-${Date.now()}.pdf`);
    auditExport("PDF", "Financial Report (PDF)");
    log?.("financial_report_export", "payments", `PDF export — ${filtered.length} records`);
    toast({ title: "Financial report exported (PDF)" });
  };

  if (loading) return <Spinner />;

  const ExportButtons = () => (
    <div className="flex flex-wrap gap-1">
      <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1 h-3 w-3" /> CSV</Button>
      <Button variant="outline" size="sm" onClick={exportXLSX}><Download className="mr-1 h-3 w-3" /> Excel</Button>
      <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="mr-1 h-3 w-3" /> PDF</Button>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Financial Reports — Techiman North Land Registry</title>
        <meta name="description" content="Generate financial reports and statements from payment records — revenue totals, transaction breakdowns, year-on-year comparisons and exports." />
      </Helmet>

      <div className="flex flex-col gap-5">
        <PageHeader
          title="Financial Reports"
          subtitle="Generate financial reports & statements from payment records"
          icon={Wallet}
          action={
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={cn("mr-1 h-4 w-4", refreshing && "animate-spin")} /> Refresh
            </Button>
          }
        />

        {error ? (
          <EmptyState icon={AlertCircle} title="Could not load payments"
            message="There was a problem fetching payment records. Please try refreshing." />
        ) : (
          <>
            {/* Filters */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Filter className="h-4 w-4 text-primary" /> Filters
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date from</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date to</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Purpose</Label>
                  <Select value={filterPurpose} onValueChange={setFilterPurpose}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {purposeOptions.map((o) => <SelectItem key={o} value={o}>{o === "all" ? "All purposes" : purposeLabel(o)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Method</Label>
                  <Select value={filterMethod} onValueChange={setFilterMethod}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {methodOptions.map((o) => <SelectItem key={o} value={o}>{o === "all" ? "All methods" : methodLabel(o)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Area Council</Label>
                  <Select value={filterAC} onValueChange={setFilterAC}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {acOptions.map((o) => <SelectItem key={o} value={o}>{o === "all" ? "All area councils" : o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasFilters && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearFilters}>Clear filters</Button>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{filtered.length} transactions</span>
                <ExportButtons />
              </div>
            </div>

            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Revenue (Paid)" value={ghs(totals.paid)} hint={`${totals.paidCount} paid transaction${totals.paidCount !== 1 ? "s" : ""}`} icon={Wallet} accent="primary" />
              <StatCard label="Pending Value" value={ghs(totals.pending)} hint={`${totals.pendingCount} pending`} icon={Clock} accent="amber" />
              <StatCard label="Failed Value" value={ghs(totals.failed)} hint={`${totals.failedCount} failed`} icon={XCircle} accent="gold" />
              <StatCard label="Refunded Value" value={ghs(totals.refunded)} hint={`${totals.refundedCount} refunded`} icon={RotateCcw} accent="blue" />
            </div>

            {/* Financial statement summary */}
            <SectionCard title="Financial Statement Summary" description="Authoritative revenue from payment amount records">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> Transaction Counts</p>
                  <dl className="text-sm space-y-1.5">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Total</dt><dd className="font-semibold">{totals.count}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Paid</dt><dd className="font-semibold">{totals.paidCount}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3 text-blue-600" /> Pending</dt><dd className="font-semibold">{totals.pendingCount}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3 text-red-600" /> Failed</dt><dd className="font-semibold">{totals.failedCount}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1"><RotateCcw className="h-3 w-3 text-amber-600" /> Refunded</dt><dd className="font-semibold">{totals.refundedCount}</dd></div>
                  </dl>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Revenue Breakdown</p>
                  <dl className="text-sm space-y-1.5">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Collected (Paid)</dt><dd className="font-semibold text-emerald-700">{ghs(totals.paid)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Outstanding (Pending)</dt><dd className="font-semibold text-blue-700">{ghs(totals.pending)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Failed</dt><dd className="font-semibold text-red-700">{ghs(totals.failed)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Refunded</dt><dd className="font-semibold text-amber-700">{ghs(totals.refunded)}</dd></div>
                    <div className="flex justify-between border-t border-border pt-1.5"><dt className="text-muted-foreground">Avg Paid Transaction</dt><dd className="font-semibold">{ghs(totals.avgPaid)}</dd></div>
                  </dl>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Year-on-Year</p>
                  {yoy ? (
                    <dl className="text-sm space-y-1.5">
                      <div className="flex justify-between"><dt className="text-muted-foreground">{yoy.cur.year} Revenue</dt><dd className="font-semibold">{ghs(yoy.cur.revenue)}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">{yoy.prev.year} Revenue</dt><dd className="font-semibold">{ghs(yoy.prev.revenue)}</dd></div>
                      <div className="flex justify-between border-t border-border pt-1.5">
                        <dt className="text-muted-foreground">Change</dt>
                        <dd className={cn("font-semibold flex items-center gap-1", yoy.pct == null ? "text-muted-foreground" : yoy.pct >= 0 ? "text-emerald-700" : "text-red-700")}>
                          {yoy.pct == null ? "—" : (<>{yoy.pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{yoy.pct >= 0 ? "+" : ""}{yoy.pct}%</>)}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not enough yearly data for comparison.</p>
                  )}
                </div>
              </div>
            </SectionCard>

            {filtered.length === 0 ? (
              <EmptyState icon={Wallet} title="No payment records"
                message="No payments match your current filters. Adjust the filters above or record payments in the Land Registration form." />
            ) : (
              <>
                {/* Charts */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <SectionCard title="Revenue trend (last 12 months)">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={byMonth}>
                          <defs>
                            <linearGradient id="finRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `GHS ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                          <Tooltip formatter={(v) => ghs(v)} />
                          <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#finRev)" dot={{ r: 3, fill: "#16a34a" }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </SectionCard>

                  <SectionCard title="Revenue by purpose">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byPurpose} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `GHS ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                          <Tooltip formatter={(v) => ghs(v)} />
                          <Bar dataKey="value" fill="#1e3a8a" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </SectionCard>

                  <SectionCard title="Revenue by payment method">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={byMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                            {byMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v) => ghs(v)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </SectionCard>

                  <SectionCard title="Revenue by area council">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byAC}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `GHS ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                          <Tooltip formatter={(v) => ghs(v)} />
                          <Bar dataKey="value" fill="#0891b2" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </SectionCard>
                </div>

                {/* Year-on-year table */}
                <SectionCard title="Year-on-Year Revenue">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                        <tr><th className="py-2 pr-4">Year</th><th className="py-2 pr-4">Transactions</th><th className="py-2 pr-4">Revenue</th></tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {byYear.map((y) => (
                          <tr key={y.year} className="hover:bg-muted/20">
                            <td className="py-2 pr-4 font-medium">{y.year}</td>
                            <td className="py-2 pr-4">{y.count}</td>
                            <td className="py-2 pr-4 font-semibold">{ghs(y.revenue)}</td>
                          </tr>
                        ))}
                        {byYear.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">No yearly data.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>

                {/* Transactions detail */}
                <SectionCard title="Payment Transactions" description={`${filtered.length} record${filtered.length !== 1 ? "s" : ""} matching filters`}>
                  <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card border-b border-border text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-4">Invoice</th><th className="py-2 pr-4">Parcel</th><th className="py-2 pr-4">Owner</th>
                          <th className="py-2 pr-4">Purpose</th><th className="py-2 pr-4">Method</th><th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4 text-right">Amount</th><th className="py-2 pr-4">Area Council</th><th className="py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filtered.map((p) => (
                          <tr key={p.id} className="hover:bg-muted/20">
                            <td className="py-2 pr-4 font-mono text-xs">{p.invoiceNumber || "—"}</td>
                            <td className="py-2 pr-4 font-medium">{p.parcelNumber || "—"}</td>
                            <td className="py-2 pr-4">{p.ownerName || "—"}</td>
                            <td className="py-2 pr-4 text-xs">{purposeLabel(p.purpose)}</td>
                            <td className="py-2 pr-4 text-xs">{methodLabel(p.method)}</td>
                            <td className="py-2 pr-4">
                              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                                p.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                                p.status === "pending" ? "bg-blue-100 text-blue-700" :
                                p.status === "refunded" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                                {titleCase(p.status)}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right font-semibold">{ghs(p.amount)}</td>
                            <td className="py-2 pr-4 text-xs">{p.areaCouncil || "—"}</td>
                            <td className="py-2 text-xs text-muted-foreground">{formatDate(p.created)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
