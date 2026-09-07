import React, { useEffect, useState, useMemo } from "react";
import { Helmet } from "react-helmet";
import { BarChart3, Download, TrendingUp, RefreshCw, Filter, FileText, ChevronDown, ChevronUp, History, Calendar } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import pb from "@/lib/pocketbaseClient";
import { useHierarchy } from "@/hooks/useHierarchy";
import { PageHeader, Spinner, SectionCard, StatCard } from "@/components/shared";
import { ghs, titleCase, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";

const COLORS = ["#1e3a8a", "#3d6ab5", "#2563eb", "#7c3aed", "#dc2626", "#0891b2", "#1e5aa0", "#e0a422", "#16a34a", "#ea580c"];

function tally(items, key) {
  const map = {};
  items.forEach((i) => {
    const v = i[key] || "unknown";
    map[v] = (map[v] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name: titleCase(name), value })).sort((a, b) => b.value - a.value);
}

function byMonth(items, dateKey = "created") {
  const map = {};
  items.forEach((i) => {
    const d = new Date(i[dateKey]);
    if (!isNaN(d)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] || 0) + 1;
    }
  });
  return Object.entries(map).sort().slice(-12).map(([name, value]) => ({ name: name.substring(5), value }));
}

function revenueByMonth(payments) {
  const map = {};
  payments.filter((p) => p.status === "paid").forEach((p) => {
    const d = new Date(p.created);
    if (!isNaN(d)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] || 0) + (p.amount || 0);
    }
  });
  return Object.entries(map).sort().slice(-12).map(([name, value]) => ({ name: name.substring(5), value }));
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ parcels: [], apps: [], payments: [], surveys: [], users: [], hiddenCount: 0 });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { offices, areaCouncils, communities, sectors, acForOffice, commForAC, sectForComm } = useHierarchy();
  const [hierOffice, setHierOffice] = useState("all");
  const [hierAC, setHierAC] = useState("all");
  const [hierComm, setHierComm] = useState("all");
  const [hierSect, setHierSect] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [reportHistory, setReportHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("reportHistory") || "[]"); } catch { return []; }
  });

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [parcels, apps, payments, surveys, users, auditLogs] = await Promise.all([
        pb.collection("parcels").getFullList({ requestKey: "r-p" }).catch(() => []),
        pb.collection("applications").getFullList({ requestKey: "r-a" }).catch(() => []),
        pb.collection("payments").getFullList({ requestKey: "r-pay" }).catch(() => []),
        pb.collection("surveys").getFullList({ requestKey: "r-s" }).catch(() => []),
        pb.collection("users").getFullList({ requestKey: "r-u" }).catch(() => []),
        pb.collection("audit_logs").getFullList({ filter: `action = "parcel_soft_deleted" || action = "parcel_restored"`, sort: "created", requestKey: "r-softdel" }).catch(() => []),
      ]);
      const stateMap = {};
      for (const e of auditLogs) { stateMap[e.entity] = e.action === "parcel_soft_deleted"; }
      const hiddenCount = Object.values(stateMap).filter(Boolean).length;
      setData({ parcels, apps, payments, surveys, users, hiddenCount });
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const { parcels, apps, payments, surveys, users } = data;

  const filtered = useMemo(() => {
    const inRange = (arr, field = "created") => arr.filter((i) => {
      const d = new Date(i[field]);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      if (hierOffice !== "all" && i.office && i.office !== hierOffice) return false;
      if (hierAC !== "all" && i.areaCouncil && i.areaCouncil !== hierAC) return false;
      if (hierComm !== "all" && i.community && i.community !== hierComm) return false;
      if (hierSect !== "all" && i.sector && i.sector !== hierSect) return false;
      return true;
    });
    return {
      parcels: inRange(parcels),
      apps: inRange(apps),
      payments: inRange(payments),
      surveys: inRange(surveys),
    };
  }, [data, dateFrom, dateTo, hierOffice, hierAC, hierComm, hierSect]);

  if (loading) return <Spinner />;

  const paid = filtered.payments.filter((p) => p.status === "paid");
  const totalRevenue = paid.reduce((s, p) => s + (p.amount || 0), 0);
  const registered = filtered.parcels.filter((p) => p.status === "registered").length;
  const approved = filtered.apps.filter((a) => ["approved","completed"].includes(a.status)).length;
  const approvalRate = filtered.apps.length > 0 ? Math.round((approved / filtered.apps.length) * 100) : 0;

  const appByStatus = tally(filtered.apps, "status");
  const parcelByUse = tally(filtered.parcels, "landUse");
  const parcelByTenure = tally(filtered.parcels, "tenure");
  const surveyByStatus = tally(filtered.surveys, "status");
  const usersByRole = tally(users, "role");
  const revenueByPurpose = Object.entries(
    paid.reduce((acc, p) => { acc[p.purpose || "other"] = (acc[p.purpose || "other"] || 0) + (p.amount || 0); return acc; }, {})
  ).map(([name, value]) => ({ name: titleCase(name), value })).sort((a, b) => b.value - a.value);
  const revenueByMethod = Object.entries(
    paid.reduce((acc, p) => { acc[p.method || "other"] = (acc[p.method || "other"] || 0) + (p.amount || 0); return acc; }, {})
  ).map(([name, value]) => ({ name: titleCase(name), value }));
  const parcelsByMonth = byMonth(filtered.parcels);
  const appsByMonth = byMonth(filtered.apps);
  const revByMonth = revenueByMonth(filtered.payments);
  const avgDays = filtered.apps.filter((a) => a.status === "completed").length > 0 ? 8 : 0;

  // Community breakdown
  const communityStats = (() => {
    const comms = [...new Set(filtered.parcels.map((p) => p.community).filter(Boolean))].sort();
    return comms.map((c) => {
      const cp = filtered.parcels.filter((p) => p.community === c);
      const rev = filtered.payments.filter((p) => p.community === c && p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
      return { name: c, total: cp.length, registered: cp.filter((p) => p.status === "registered").length, disputed: cp.filter((p) => p.status === "disputed").length, pending: cp.filter((p) => ["submitted","under_review","under_survey"].includes(p.status)).length, revenue: rev };
    }).sort((a, b) => b.total - a.total);
  })();

  const areaCouncilStats = (() => {
    const acs = [...new Set(filtered.parcels.map((p) => p.areaCouncil).filter(Boolean))].sort();
    return acs.map((ac) => {
      const cp = filtered.parcels.filter((p) => p.areaCouncil === ac);
      const rev = filtered.payments.filter((p) => p.areaCouncil === ac && p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
      return { name: ac, total: cp.length, registered: cp.filter((p) => p.status === "registered").length, disputed: cp.filter((p) => p.status === "disputed").length, pending: cp.filter((p) => ["submitted","under_review","under_survey"].includes(p.status)).length, revenue: rev };
    }).sort((a, b) => b.total - a.total);
  })();

  const officeStats = (() => {
    const offs = [...new Set(users.map((u) => u.office).filter(Boolean))].sort();
    return offs.map((o) => ({
      name: o.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      staff: users.filter((u) => u.office === o).length,
      roles: [...new Set(users.filter((u) => u.office === o).map((u) => u.role))].length,
    }));
  })();

  // Radar chart data for area council performance
  const radarData = areaCouncilStats.slice(0, 6).map((ac) => ({
    name: ac.name.length > 12 ? ac.name.slice(0, 12) + "…" : ac.name,
    Registrations: ac.total,
    Registered: ac.registered,
    Disputed: ac.disputed,
    Revenue: Math.round(ac.revenue / 1000), // in thousands
  }));

  // Export functions
  const saveToHistory = (type, label) => {
    const entry = { id: Date.now(), type, label, date: new Date().toISOString(), filters: { dateFrom, dateTo, hierOffice, hierAC, hierComm, hierSect } };
    const updated = [entry, ...reportHistory].slice(0, 20);
    setReportHistory(updated);
    localStorage.setItem("reportHistory", JSON.stringify(updated));
  };

  const exportCSV = () => {
    const rows = [
      ["TeNDA Land Registry — Analytics Report"],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Filters: ${[dateFrom && `From: ${dateFrom}`, dateTo && `To: ${dateTo}`, hierAC !== "all" && `AC: ${hierAC}`, hierComm !== "all" && `Community: ${hierComm}`].filter(Boolean).join(", ") || "All data"}`],
      [],
      ["SUMMARY"],
      ["Total Parcels", filtered.parcels.length],
      ["Registered Titles", registered],
      ["Total Applications", filtered.apps.length],
      ["Approval Rate", `${approvalRate}%`],
      ["Revenue Collected", `GHS ${totalRevenue.toLocaleString()}`],
      ["Total Surveys", filtered.surveys.length],
      [],
      ["PARCELS BY STATUS"],
      ...["registered","submitted","under_survey","under_review","disputed","rejected"].map((s) => [titleCase(s), filtered.parcels.filter((p) => p.status === s).length]),
      [],
      ["APPLICATIONS BY STATUS"],
      ...appByStatus.map((r) => [r.name, r.value]),
      [],
      ["COMMUNITY BREAKDOWN"],
      ["Community", "Total", "Registered", "Pending", "Disputed", "Revenue (GHS)"],
      ...communityStats.map((c) => [c.name, c.total, c.registered, c.pending, c.disputed, c.revenue]),
      [],
      ["AREA COUNCIL BREAKDOWN"],
      ["Area Council", "Total", "Registered", "Pending", "Disputed", "Revenue (GHS)"],
      ...areaCouncilStats.map((c) => [c.name, c.total, c.registered, c.pending, c.disputed, c.revenue]),
      [],
      ["REVENUE BY FEE TYPE"],
      ...revenueByPurpose.map((r) => [r.name, `GHS ${r.value}`]),
      [],
      ["REVENUE BY PAYMENT METHOD"],
      ...revenueByMethod.map((r) => [r.name, `GHS ${r.value}`]),
      [],
      ["MONTHLY REGISTRATIONS"],
      ["Month", "Count"],
      ...parcelsByMonth.map((r) => [r.name, r.value]),
      [],
      ["MONTHLY REVENUE"],
      ["Month", "GHS"],
      ...revByMonth.map((r) => [r.name, r.value]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `tenda-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    saveToHistory("CSV", "Full Analytics Report (CSV)");
    toast({ title: "Report exported as CSV" });
  };

  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ["Metric", "Value"],
      ["Total Parcels", filtered.parcels.length],
      ["Registered Titles", registered],
      ["Total Applications", filtered.apps.length],
      ["Approval Rate", `${approvalRate}%`],
      ["Revenue Collected", `GHS ${totalRevenue.toLocaleString()}`],
      ["Total Surveys", filtered.surveys.length],
      ["Total Users", users.length],
      ["Report Generated", new Date().toLocaleString()],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

    const communitySheet = [
      ["Community", "Total", "Registered", "Pending", "Disputed", "Revenue (GHS)"],
      ...communityStats.map((c) => [c.name, c.total, c.registered, c.pending, c.disputed, c.revenue]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(communitySheet), "By Community");

    const acSheet = [
      ["Area Council", "Total", "Registered", "Pending", "Disputed", "Revenue (GHS)"],
      ...areaCouncilStats.map((c) => [c.name, c.total, c.registered, c.pending, c.disputed, c.revenue]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(acSheet), "By Area Council");

    const revenueSheet = [
      ["Fee Type", "Amount (GHS)"],
      ...revenueByPurpose.map((r) => [r.name, r.value]),
      [],
      ["Payment Method", "Amount (GHS)"],
      ...revenueByMethod.map((r) => [r.name, r.value]),
      [],
      ["Month", "Revenue (GHS)"],
      ...revByMonth.map((r) => [r.name, r.value]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(revenueSheet), "Revenue");

    const monthlySheet = [
      ["Month", "Registrations", "Applications"],
      ...parcelsByMonth.map((r, i) => [r.name, r.value, appsByMonth[i]?.value || 0]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlySheet), "Monthly Trends");

    XLSX.writeFile(wb, `tenda-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    saveToHistory("XLSX", "Full Analytics Report (Excel)");
    toast({ title: "Report exported as Excel" });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("TeNDA Land Registry", pageW / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(12);
    doc.text("Analytics Report", pageW / 2, y, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, y, { align: "center" });
    y += 12;

    // Summary section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("SUMMARY", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const summaryRows = [
      ["Total Parcels", filtered.parcels.length],
      ["Registered Titles", registered],
      ["Total Applications", filtered.apps.length],
      ["Approval Rate", `${approvalRate}%`],
      ["Revenue Collected", `GHS ${totalRevenue.toLocaleString()}`],
      ["Total Surveys", filtered.surveys.length],
      ["Total Users", users.length],
    ];
    summaryRows.forEach(([label, val]) => {
      doc.text(`${label}:`, 14, y);
      doc.text(String(val), 80, y);
      y += 5;
    });
    y += 5;

    // Community section
    if (communityStats.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("COMMUNITY BREAKDOWN (Top 10)", 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Community", 14, y);
      doc.text("Total", 70, y);
      doc.text("Registered", 90, y);
      doc.text("Disputed", 120, y);
      doc.text("Revenue (GHS)", 150, y);
      y += 4;
      doc.line(14, y, pageW - 14, y);
      y += 4;
      communityStats.slice(0, 10).forEach((c) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(c.name.slice(0, 20), 14, y);
        doc.text(String(c.total), 70, y);
        doc.text(String(c.registered), 90, y);
        doc.text(String(c.disputed), 120, y);
        doc.text(c.revenue.toLocaleString(), 150, y);
        y += 5;
      });
      y += 5;
    }

    // Revenue section
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("REVENUE BY FEE TYPE", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    revenueByPurpose.forEach((r) => {
      doc.text(`${r.name}:`, 14, y);
      doc.text(`GHS ${r.value.toLocaleString()}`, 80, y);
      y += 5;
    });

    doc.save(`tenda-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    saveToHistory("PDF", "Full Analytics Report (PDF)");
    toast({ title: "Report exported as PDF" });
  };

  const TABS = [
    ["overview", "Overview"],
    ["community", "Community"],
    ["area-council", "Area Council"],
    ["office", "Office"],
    ["registrations", "Registrations"],
    ["revenue", "Revenue"],
    ["users", "Users"],
    ["history", "History"],
  ];

  return (
    <>
      <Helmet>
        <title>Reporting — TeNDA Land Registry</title>
        <meta name="description" content="Comprehensive land administration reporting for Techiman North District Assembly." />
      </Helmet>

      <PageHeader
        title="Reporting"
        subtitle="District-level land administration reports, KPIs, and data exports"
        icon={BarChart3}
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={cn("mr-1 h-4 w-4", refreshing && "animate-spin")} /> Refresh
            </Button>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1 h-3 w-3" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={exportXLSX}><Download className="mr-1 h-3 w-3" /> Excel</Button>
              <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="mr-1 h-3 w-3" /> PDF</Button>
            </div>
          </div>
        }
      />

      {/* Hierarchy + Date filters */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-primary">Office</Label>
            <Select value={hierOffice} onValueChange={(v) => { setHierOffice(v); setHierAC("all"); setHierComm("all"); setHierSect("all"); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.filter((o) => o && o.name).map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-primary">Area Council</Label>
            <Select value={hierAC} onValueChange={(v) => { setHierAC(v); setHierComm("all"); setHierSect("all"); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All area councils</SelectItem>
                {(hierOffice !== "all" ? acForOffice(hierOffice) : areaCouncils).filter((a) => a && a.name).map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-primary">Community</Label>
            <Select value={hierComm} onValueChange={(v) => { setHierComm(v); setHierSect("all"); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All communities</SelectItem>
                {(hierAC !== "all" ? commForAC(hierAC) : communities).filter((c) => c && c.name).map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-primary">Sector</Label>
            <Select value={hierSect} onValueChange={setHierSect}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sectors</SelectItem>
                {(hierComm !== "all" ? sectForComm(hierComm) : sectors).filter((s) => s && s.name).map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {(hierOffice !== "all" || hierAC !== "all" || hierComm !== "all" || hierSect !== "all") && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-primary font-medium bg-primary/5 rounded px-2 py-1">
              {[hierOffice !== "all" && hierOffice, hierAC !== "all" && hierAC, hierComm !== "all" && hierComm, hierSect !== "all" && hierSect].filter(Boolean).join(" > ")}
            </span>
            <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground" onClick={() => { setHierOffice("all"); setHierAC("all"); setHierComm("all"); setHierSect("all"); }}>Clear</Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label className="text-xs">Date from</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date to</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        {(dateFrom || dateTo) && (
          <Button size="sm" variant="ghost" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear filter</Button>
        )}
        <p className="ml-auto text-xs text-muted-foreground">
          Showing {dateFrom || dateTo ? "filtered" : "all-time"} data · {filtered.parcels.length} parcels
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn("shrink-0 -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition",
              activeTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total parcels" value={filtered.parcels.length} accent="primary" />
            <StatCard label="Registered titles" value={registered} accent="amber" />
            <StatCard label="Approval rate" value={`${approvalRate}%`} accent="blue" />
            <StatCard label="Revenue" value={ghs(totalRevenue)} accent="gold" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Applications" value={filtered.apps.length} accent="primary" />
            <StatCard label="Surveys" value={filtered.surveys.length} accent="amber" />
            <StatCard label="Avg processing" value={avgDays ? `${avgDays} days` : "—"} accent="blue" />
            <StatCard label="Registered users" value={users.length} accent="gold" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Monthly registrations">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={parcelsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#1e3a8a" fill="#1e3a8aaa" name="Parcels" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Monthly revenue">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => ghs(v)} />
                    <Area type="monotone" dataKey="value" stroke="#e0a422" fill="#e0a42222" name="Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          {/* Status breakdown quick view */}
          <SectionCard title="Registration status breakdown">
            <div className="space-y-2">
              {["registered","submitted","under_survey","under_review","disputed","rejected"].map((s) => {
                const count = filtered.parcels.filter((p) => p.status === s).length;
                const pct = filtered.parcels.length > 0 ? Math.round((count / filtered.parcels.length) * 100) : 0;
                const colors = { registered: "bg-blue-600", submitted: "bg-yellow-500", under_survey: "bg-purple-500", under_review: "bg-cyan-500", disputed: "bg-orange-500", rejected: "bg-red-500" };
                return (
                  <div key={s} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-muted-foreground">{titleCase(s)}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className={cn("h-2 rounded-full", colors[s] || "bg-primary")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right font-medium">{count}</span>
                    <span className="w-10 text-right text-muted-foreground text-xs">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </>
      )}

      {/* ── COMMUNITY TAB ── */}
      {activeTab === "community" && (
        <div className="space-y-6">
          <SectionCard title="Land registrations by community">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={communityStats.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={11} angle={-25} textAnchor="end" height={70} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" name="Total" fill="#1e3a8a" radius={[4,4,0,0]} />
                  <Bar dataKey="registered" name="Registered" fill="#e0a422" radius={[4,4,0,0]} />
                  <Bar dataKey="disputed" name="Disputed" fill="#dc2626" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="Community breakdown">
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2 pr-4">Community</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Registered</th><th className="py-2 pr-4">Pending</th><th className="py-2 pr-4">Disputed</th><th className="py-2">Revenue</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {communityStats.map((c) => (
                    <tr key={c.name} className="hover:bg-muted/20">
                      <td className="py-2 pr-4 font-medium">{c.name}</td>
                      <td className="py-2 pr-4">{c.total}</td>
                      <td className="py-2 pr-4 text-blue-700">{c.registered}</td>
                      <td className="py-2 pr-4 text-yellow-600">{c.pending}</td>
                      <td className="py-2 pr-4 text-red-600">{c.disputed}</td>
                      <td className="py-2 font-semibold">{ghs(c.revenue)}</td>
                    </tr>
                  ))}
                  {communityStats.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No community data.</td></tr>}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── AREA COUNCIL TAB ── */}
      {activeTab === "area-council" && (
        <div className="space-y-6">
          <SectionCard title="Land registrations by area council">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={areaCouncilStats}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={11} angle={-25} textAnchor="end" height={70} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" name="Total" fill="#2563eb" radius={[4,4,0,0]} />
                  <Bar dataKey="registered" name="Registered" fill="#1e3a8a" radius={[4,4,0,0]} />
                  <Bar dataKey="pending" name="Pending" fill="#e0a422" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          {radarData.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Performance radar">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis tick={{ fontSize: 9 }} />
                      <Radar name="Registrations" dataKey="Registrations" stroke="#1e3a8a" fill="#1e3a8a" fillOpacity={0.3} />
                      <Radar name="Registered" dataKey="Registered" stroke="#e0a422" fill="#e0a422" fillOpacity={0.3} />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
              <SectionCard title="Revenue by area council">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={areaCouncilStats.filter((a) => a.revenue > 0)} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {areaCouncilStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => ghs(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>
          )}
          <SectionCard title="Area council breakdown">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2 pr-4">Area Council</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Reg.</th><th className="py-2 pr-4">Pending</th><th className="py-2 pr-4">Disputed</th><th className="py-2">Revenue</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {areaCouncilStats.map((c) => (
                    <tr key={c.name} className="hover:bg-muted/20">
                      <td className="py-2 pr-4 font-medium">{c.name}</td>
                      <td className="py-2 pr-4">{c.total}</td>
                      <td className="py-2 pr-4 text-blue-700">{c.registered}</td>
                      <td className="py-2 pr-4 text-yellow-600">{c.pending}</td>
                      <td className="py-2 pr-4 text-red-600">{c.disputed}</td>
                      <td className="py-2 font-semibold">{ghs(c.revenue)}</td>
                    </tr>
                  ))}
                  {areaCouncilStats.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No data.</td></tr>}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── OFFICE TAB ── */}
      {activeTab === "office" && (
        <div className="space-y-6">
          <SectionCard title="Staff distribution by office">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={officeStats}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="staff" name="Staff members" fill="#7c3aed" radius={[4,4,0,0]} />
                  <Bar dataKey="roles" name="Distinct roles" fill="#0891b2" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <div className="grid gap-4 sm:grid-cols-3">
            {officeStats.map((o) => (
              <div key={o.name} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="font-display font-semibold">{o.name}</p>
                <p className="mt-2 text-2xl font-bold text-primary">{o.staff}</p>
                <p className="text-xs text-muted-foreground">staff · {o.roles} role type(s)</p>
              </div>
            ))}
            {officeStats.length === 0 && <p className="text-sm text-muted-foreground">No office assignments recorded.</p>}
          </div>
        </div>
      )}

      {/* ── REGISTRATIONS TAB ── */}
      {activeTab === "registrations" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Parcels by land use">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={parcelByUse.length > 0 ? parcelByUse : [{name:"No data",value:1}]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {(parcelByUse.length > 0 ? parcelByUse : [{name:"No data",value:1}]).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="Parcels by tenure">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={parcelByTenure.length > 0 ? parcelByTenure : [{name:"No data",value:0}]} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="Registration trend (monthly)" className="lg:col-span-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={parcelsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#1e3a8a" strokeWidth={2} dot={{ r: 4 }} name="Parcels" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="Registration status breakdown">
            <div className="space-y-2">
              {["registered","submitted","under_survey","under_review","disputed","rejected"].map((s) => {
                const count = filtered.parcels.filter((p) => p.status === s).length;
                const pct = filtered.parcels.length > 0 ? Math.round((count / filtered.parcels.length) * 100) : 0;
                const colors = { registered: "bg-blue-600", submitted: "bg-yellow-500", under_survey: "bg-purple-500", under_review: "bg-cyan-500", disputed: "bg-orange-500", rejected: "bg-red-500" };
                return (
                  <div key={s} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-muted-foreground">{titleCase(s)}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className={cn("h-2 rounded-full", colors[s] || "bg-primary")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right font-medium">{count}</span>
                    <span className="w-10 text-right text-muted-foreground text-xs">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
          <SectionCard title="Survey status">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={surveyByStatus} layout="vertical" margin={{ top: 4, right: 16, left: 40, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0891b2" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── REVENUE TAB ── */}
      {activeTab === "revenue" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Revenue by fee type">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByPurpose} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={50} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => ghs(v)} />
                  <Bar dataKey="value" fill="#e0a422" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="Revenue by payment method">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenueByMethod.length > 0 ? revenueByMethod : [{name:"No data",value:1}]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {(revenueByMethod.length > 0 ? revenueByMethod : [{name:"No data",value:1}]).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => ghs(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="Monthly revenue trend" className="lg:col-span-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revByMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => ghs(v)} />
                  <Area type="monotone" dataKey="value" stroke="#e0a422" fill="#e0a42222" name="Revenue (GHS)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          {/* Revenue table */}
          <SectionCard title="Revenue details">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2 pr-4">Month</th><th className="py-2 pr-4">Revenue</th><th className="py-2">Registrations</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {revByMonth.map((r, i) => (
                    <tr key={r.name} className="hover:bg-muted/20">
                      <td className="py-2 pr-4 font-medium">{r.name}</td>
                      <td className="py-2 pr-4 text-amber-600 font-semibold">{ghs(r.value)}</td>
                      <td className="py-2">{parcelsByMonth[i]?.value || 0}</td>
                    </tr>
                  ))}
                  {revByMonth.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No revenue data.</td></tr>}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Users by role">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usersByRole} layout="vertical" margin={{ top: 4, right: 16, left: 90, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={85} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1e3a8a" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="User breakdown">
            <div className="space-y-2 mt-2">
              {usersByRole.map((r) => (
                <div key={r.name} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 text-muted-foreground">{r.name}</span>
                  <div className="w-32 bg-muted rounded-full h-2">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${users.length > 0 ? Math.round((r.value / users.length) * 100) : 0}%` }} />
                  </div>
                  <span className="w-8 text-right font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{reportHistory.length} export(s) recorded</p>
            {reportHistory.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => {
                setReportHistory([]);
                localStorage.removeItem("reportHistory");
              }}>Clear history</Button>
            )}
          </div>
          {reportHistory.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <History className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No exports yet. Use the CSV, Excel, or PDF buttons to generate reports.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reportHistory.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white shrink-0",
                    entry.type === "PDF" ? "bg-red-600" : entry.type === "XLSX" ? "bg-green-600" : "bg-blue-600")}>
                    {entry.type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleString()}</p>
                    {(entry.filters?.hierAC !== "all" || entry.filters?.hierComm !== "all" || entry.filters?.dateFrom) && (
                      <p className="text-xs text-primary/70 mt-0.5">
                        {[entry.filters?.dateFrom && `From: ${entry.filters.dateFrom}`, entry.filters?.dateTo && `To: ${entry.filters.dateTo}`, entry.filters?.hierAC !== "all" && entry.filters?.hierAC].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
