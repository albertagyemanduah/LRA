import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet";
import {
  BarChart3, Download, RefreshCw, FileText, History, Users, TrendingUp,
  MapPin, Clock, Award, Search, GitBranch, ChevronDown, ChevronUp, CheckSquare, Square,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend, AreaChart, Area,
} from "recharts";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner, SectionCard, StatCard, EmptyState } from "@/components/shared";
import { titleCase, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

const COLORS = ["#1e3a8a", "#3d6ab5", "#2563eb", "#7c3aed", "#dc2626", "#0891b2", "#1e5aa0", "#e0a422", "#16a34a", "#ea580c"];

const TABS = [
  ["transfers", "Transfer Report", GitBranch],
  ["activity", "Owner Activity", Users],
  ["statistics", "Transfer Statistics", BarChart3],
  ["chain", "Ownership Chain", History],
  ["analytics", "Analytics Dashboard", TrendingUp],
  ["bulk", "Bulk Export", Download],
];

function safeParse(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  try { const v = JSON.parse(str); return Array.isArray(v) ? v : []; } catch { return []; }
}

function monthKey(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function OwnershipAnalyticsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("transfers");
  const [transfers, setTransfers] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [users, setUsers] = useState([]);

  // shared filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterOffice, setFilterOffice] = useState("all");
  const [filterAC, setFilterAC] = useState("all");
  const [filterCommunity, setFilterCommunity] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  // owner activity search
  const [ownerSearch, setOwnerSearch] = useState("");

  // ownership chain search
  const [chainSearch, setChainSearch] = useState("");

  // bulk export selection
  const [bulkSelected, setBulkSelected] = useState(new Set());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [t, p, a, u] = await Promise.all([
        pb.collection("land_transfers").getFullList({ sort: "-created", requestKey: "oa-transfers" }).catch(() => []),
        pb.collection("parcels").getFullList({ requestKey: "oa-parcels" }).catch(() => []),
        pb.collection("audit_logs").getFullList({ sort: "-created", requestKey: "oa-audit" }).catch(() => []),
        pb.collection("users").getFullList({ requestKey: "oa-users" }).catch(() => []),
      ]);
      setTransfers(t);
      setParcels(p);
      setAuditLogs(a);
      setUsers(u);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // build lookup maps
  const userMap = useMemo(() => {
    const m = {};
    users.forEach((u) => { m[u.id] = u; });
    return m;
  }, [users]);

  const parcelMap = useMemo(() => {
    const m = {};
    parcels.forEach((p) => { m[p.id] = p; });
    return m;
  }, [parcels]);

  const userName = useCallback((id) => {
    if (!id) return "—";
    const u = userMap[id];
    return u ? (u.fullName || u.name || u.email) : "External / Unknown";
  }, [userMap]);

  // enrich transfers with parcel + resolved names
  const enrichedTransfers = useMemo(() => transfers.map((t) => {
    const parcel = parcelMap[t.parcel];
    return {
      ...t,
      _parcel: parcel,
      _parcelNumber: parcel?.parcelNumber || "—",
      _applicantName: parcel?.applicantName || t.toOwnerName || "—",
      _areaCouncil: parcel?.areaCouncil || "—",
      _community: parcel?.community || "—",
      _office: parcel?.office || "—",
      _fromOwnerName: userName(t.fromOwner),
      _toOwnerName: t.toOwnerName || userName(t.toOwnerUser),
      _reviewerName: userName(t.reviewedBy),
    };
  }), [transfers, parcelMap, userName]);

  // filtered transfers (shared filters)
  const filteredTransfers = useMemo(() => {
    let list = enrichedTransfers.filter((t) => {
      const d = new Date(t.created);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      if (filterOffice !== "all" && t._office !== filterOffice) return false;
      if (filterAC !== "all" && t._areaCouncil !== filterAC) return false;
      if (filterCommunity !== "all" && t._community !== filterCommunity) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av, bv;
      if (sortBy === "date") { av = new Date(a.created).getTime(); bv = new Date(b.created).getTime(); }
      else if (sortBy === "officer") { av = a._reviewerName; bv = b._reviewerName; }
      else if (sortBy === "owner") { av = a._fromOwnerName; bv = b._fromOwnerName; }
      else { av = a._parcelNumber; bv = b._parcelNumber; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [enrichedTransfers, dateFrom, dateTo, filterOffice, filterAC, filterCommunity, sortBy, sortDir]);

  // unique filter option lists
  const officeOptions = useMemo(() => ["all", ...Array.from(new Set(parcels.map((p) => p.office).filter(Boolean))).sort()], [parcels]);
  const acOptions = useMemo(() => ["all", ...Array.from(new Set(parcels.map((p) => p.areaCouncil).filter(Boolean))).sort()], [parcels]);
  const communityOptions = useMemo(() => ["all", ...Array.from(new Set(parcels.map((p) => p.community).filter(Boolean))).sort()], [parcels]);

  // ── Statistics computations ────────────────────────────────────────
  const stats = useMemo(() => {
    const approved = filteredTransfers.filter((t) => t.status === "approved");
    const byMonth = {};
    approved.forEach((t) => { const k = monthKey(t.created); if (k) byMonth[k] = (byMonth[k] || 0) + 1; });
    const byOfficer = {};
    approved.forEach((t) => { const n = t._reviewerName; byOfficer[n] = (byOfficer[n] || 0) + 1; });
    const byOffice = {};
    approved.forEach((t) => { byOffice[t._office] = (byOffice[t._office] || 0) + 1; });
    const byAC = {};
    approved.forEach((t) => { byAC[t._areaCouncil] = (byAC[t._areaCouncil] || 0) + 1; });
    const byCommunity = {};
    approved.forEach((t) => { byCommunity[t._community] = (byCommunity[t._community] || 0) + 1; });

    // avg transfer time: created -> updated for approved
    const durations = approved
      .map((t) => { const c = new Date(t.created).getTime(); const u = new Date(t.updated).getTime(); return u > c ? (u - c) / 86400000 : null; })
      .filter((v) => v != null);
    const avgDays = durations.length ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length) : 0;

    return {
      total: filteredTransfers.length,
      approved: approved.length,
      pending: filteredTransfers.filter((t) => t.status === "pending").length,
      rejected: filteredTransfers.filter((t) => t.status === "rejected").length,
      byMonth: Object.entries(byMonth).sort().slice(-12).map(([name, value]) => ({ name: name.substring(5), value })),
      byOfficer: Object.entries(byOfficer).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      byOffice: Object.entries(byOffice).map(([name, value]) => ({ name: name === "—" ? "Unassigned" : titleCase(name), value })).sort((a, b) => b.value - a.value),
      byAC: Object.entries(byAC).map(([name, value]) => ({ name: name === "—" ? "Unassigned" : name, value })).sort((a, b) => b.value - a.value),
      byCommunity: Object.entries(byCommunity).map(([name, value]) => ({ name: name === "—" ? "Unassigned" : name, value })).sort((a, b) => b.value - a.value).slice(0, 12),
      avgDays,
    };
  }, [filteredTransfers]);

  // ── Ownership pattern analytics ────────────────────────────────────
  const patterns = useMemo(() => {
    const approved = filteredTransfers.filter((t) => t.status === "approved");
    // most active owners (appear as fromOwner most often)
    const ownerCount = {};
    approved.forEach((t) => { const n = t._fromOwnerName; if (n && n !== "—") ownerCount[n] = (ownerCount[n] || 0) + 1; });
    const mostActiveOwners = Object.entries(ownerCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

    // most transferred lands
    const parcelCount = {};
    approved.forEach((t) => { const n = t._parcelNumber; if (n && n !== "—") parcelCount[n] = (parcelCount[n] || 0) + 1; });
    const mostTransferredLands = Object.entries(parcelCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

    // average ownership duration from ownershipHistory snapshots
    const durations = [];
    approved.forEach((t) => {
      const hist = safeParse(t.ownershipHistory);
      hist.forEach((h) => {
        if (h.transferDate) {
          const d = new Date(h.transferDate).getTime();
          if (!isNaN(d)) durations.push(d);
        }
      });
    });
    durations.sort((a, b) => a - b);
    const avgOwnershipMs = durations.length > 1
      ? (durations[durations.length - 1] - durations[0]) / Math.max(durations.length - 1, 1)
      : 0;
    const avgOwnershipYears = avgOwnershipMs ? Math.round((avgOwnershipMs / (365.25 * 86400000)) * 10) / 10 : 0;

    // ownership change frequency (transfers per month)
    const months = new Set();
    approved.forEach((t) => { const k = monthKey(t.created); if (k) months.add(k); });
    const changeFrequency = months.size > 0 ? (approved.length / months.size).toFixed(1) : "0";

    // seasonal patterns (by quarter)
    const byQuarter = [0, 0, 0, 0];
    approved.forEach((t) => { const d = new Date(t.created); if (!isNaN(d)) byQuarter[Math.floor(d.getMonth() / 3)]++; });
    const seasonal = byQuarter.map((v, i) => ({ name: `Q${i + 1}`, value: v }));

    return { mostActiveOwners, mostTransferredLands, avgOwnershipYears, changeFrequency, seasonal };
  }, [filteredTransfers]);

  // ── Officer performance ────────────────────────────────────────────
  const officerPerf = useMemo(() => {
    const approved = filteredTransfers.filter((t) => t.status === "approved");
    const map = {};
    approved.forEach((t) => {
      const n = t._reviewerName;
      if (!n || n === "—") return;
      if (!map[n]) map[n] = { name: n, transfers: 0, totalDays: 0 };
      map[n].transfers++;
      const c = new Date(t.created).getTime(); const u = new Date(t.updated).getTime();
      if (u > c) map[n].totalDays += (u - c) / 86400000;
    });
    return Object.values(map).map((o) => ({
      ...o,
      avgDays: o.transfers ? Math.round(o.totalDays / o.transfers) : 0,
      efficiency: o.transfers ? Math.min(100, Math.round((o.transfers / Math.max(o.totalDays, 1)) * 100)) : 0,
    })).sort((a, b) => b.transfers - a.transfers);
  }, [filteredTransfers]);

  // ── Predictive: forecast next-month transfers (simple moving avg) ──
  const forecast = useMemo(() => {
    const monthly = stats.byMonth.map((m) => m.value);
    if (monthly.length === 0) return { nextMonth: 0, trend: "stable" };
    const avg = monthly.slice(-3).reduce((s, v) => s + v, 0) / Math.min(monthly.length, 3);
    const nextMonth = Math.round(avg);
    const recent = monthly.slice(-3);
    const trend = recent.length >= 2 && recent[recent.length - 1] > recent[0] ? "rising" :
                  recent.length >= 2 && recent[recent.length - 1] < recent[0] ? "declining" : "stable";
    return { nextMonth, trend };
  }, [stats.byMonth]);

  // ── Owner activity report ──────────────────────────────────────────
  const ownerActivity = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    if (!q) return null;
    // find parcels where applicantName matches
    const matchedParcels = parcels.filter((p) =>
      [p.applicantName, p.contactPhone, p.parcelNumber].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
    const parcelIds = new Set(matchedParcels.map((p) => p.id));
    const ownerTransfers = enrichedTransfers.filter((t) => parcelIds.has(t.parcel));
    const ownerEdits = auditLogs.filter((l) => parcelIds.has(l.entity) && /parcel_amended|parcel_edit/.test(l.action));
    const ownerDeletes = auditLogs.filter((l) => parcelIds.has(l.entity) && /parcel_soft_deleted|parcel_permanent_deleted|parcel_restored/.test(l.action));
    return { matchedParcels, ownerTransfers, ownerEdits, ownerDeletes };
  }, [ownerSearch, parcels, enrichedTransfers, auditLogs]);

  // ── Ownership chain report ─────────────────────────────────────────
  const ownershipChain = useMemo(() => {
    const q = chainSearch.trim().toLowerCase();
    if (!q) return null;
    const parcel = parcels.find((p) =>
      (p.parcelNumber || "").toLowerCase() === q || (p.parcelNumber || "").toLowerCase().includes(q)
    );
    if (!parcel) return { found: false };
    const parcelTransfers = enrichedTransfers
      .filter((t) => t.parcel === parcel.id && t.status === "approved")
      .sort((a, b) => new Date(a.created) - new Date(b.created));
    // build chain from ownershipHistory + transfers
    const chain = [];
    parcelTransfers.forEach((t, i) => {
      chain.push({
        order: i + 1,
        owner: t._fromOwnerName,
        role: "Previous Owner",
        transferDate: t.created,
        officer: t._reviewerName,
        status: t.status,
      });
      chain.push({
        order: i + 1,
        owner: t._toOwnerName,
        role: "New Owner",
        transferDate: t.created,
        officer: t._reviewerName,
        status: t.status,
      });
    });
    // current owner
    chain.push({
      order: chain.length / 2 + 1,
      owner: parcel.applicantName || "—",
      role: "Current Owner",
      transferDate: parcel.registrationDate || parcel.updated,
      officer: "—",
      status: "current",
    });
    return { found: true, parcel, parcelTransfers, chain };
  }, [chainSearch, parcels, enrichedTransfers]);

  // ── Export helpers ─────────────────────────────────────────────────
  const exportTransfersCSV = () => {
    const headers = ["Parcel No", "From Owner", "To Owner", "Reviewing Officer", "Area Council", "Community", "Status", "Transfer Date", "Certificate No"];
    const rows = filteredTransfers.map((t) => [t._parcelNumber, t._fromOwnerName, t._toOwnerName, t._reviewerName, t._areaCouncil, t._community, t.status, formatDate(t.created), t.certificateNumber || ""]);
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    downloadBlob(csv, `ownership-transfers-${Date.now()}.csv`, "text/csv");
    toast({ title: "Transfer report exported (CSV)" });
  };

  const exportTransfersXLSX = () => {
    const headers = ["Parcel No", "From Owner", "To Owner", "Reviewing Officer", "Area Council", "Community", "Status", "Transfer Date", "Certificate No"];
    const data = [headers, ...filteredTransfers.map((t) => [t._parcelNumber, t._fromOwnerName, t._toOwnerName, t._reviewerName, t._areaCouncil, t._community, t.status, formatDate(t.created), t.certificateNumber || ""])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transfers");
    XLSX.writeFile(wb, `ownership-transfers-${Date.now()}.xlsx`);
    toast({ title: "Transfer report exported (Excel)" });
  };

  const exportTransfersPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Ownership Transfer Report", pageW / 2, 14, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}  |  Records: ${filteredTransfers.length}`, pageW / 2, 20, { align: "center" });
    const cols = ["Parcel", "From Owner", "To Owner", "Officer", "Area Council", "Status", "Date"];
    const widths = [28, 40, 40, 36, 34, 22, 28];
    let y = 28; const rowH = 6; const margin = 10;
    const drawHeader = () => {
      doc.setFillColor(30, 64, 120); doc.rect(margin, y, widths.reduce((a, b) => a + b, 0), rowH, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      let x = margin; cols.forEach((c, i) => { doc.text(c, x + 1, y + 4); x += widths[i]; });
      y += rowH; doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    };
    drawHeader();
    filteredTransfers.forEach((t, idx) => {
      if (y + rowH > doc.internal.pageSize.getHeight() - 10) { doc.addPage(); y = margin; drawHeader(); }
      doc.setFillColor(idx % 2 ? 248 : 255); doc.rect(margin, y, widths.reduce((a, b) => a + b, 0), rowH, "F");
      doc.setTextColor(40, 40, 40);
      const vals = [t._parcelNumber, t._fromOwnerName, t._toOwnerName, t._reviewerName, t._areaCouncil, titleCase(t.status), formatDate(t.created)];
      let x = margin; vals.forEach((v, i) => { const maxC = Math.floor(widths[i] / 1.7); const s = String(v || ""); doc.text(s.length > maxC ? s.slice(0, maxC - 1) + "…" : s, x + 1, y + 4); x += widths[i]; });
      y += rowH;
    });
    doc.save(`ownership-transfers-${Date.now()}.pdf`);
    toast({ title: "Transfer report exported (PDF)" });
  };

  const exportActivity = (fmt) => {
    if (!ownerActivity) return;
    const { matchedParcels, ownerTransfers, ownerEdits, ownerDeletes } = ownerActivity;
    const headers = ["Category", "Parcel No", "Applicant", "Detail", "Date"];
    const rows = [];
    matchedParcels.forEach((p) => rows.push(["Land Owned", p.parcelNumber, p.applicantName, `${p.areaCouncil} / ${p.community}`, formatDate(p.created)]));
    ownerTransfers.forEach((t) => rows.push(["Transfer", t._parcelNumber, t._toOwnerName, `${t._fromOwnerName} → ${t._toOwnerName} (${t.status})`, formatDate(t.created)]));
    ownerEdits.forEach((l) => rows.push(["Edit", "—", "—", titleCase(l.action), formatDate(l.created)]));
    ownerDeletes.forEach((l) => rows.push(["Delete/Restore", "—", "—", titleCase(l.action), formatDate(l.created)]));
    if (fmt === "csv") {
      const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
      downloadBlob(csv, `owner-activity-${Date.now()}.csv`, "text/csv");
    } else if (fmt === "xlsx") {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Owner Activity");
      XLSX.writeFile(wb, `owner-activity-${Date.now()}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.setFontSize(14); doc.text("Owner Activity Report", 14, 18);
      doc.setFontSize(9); doc.text(`Owner search: "${ownerSearch}"  |  ${new Date().toLocaleString()}`, 14, 24);
      let y = 32;
      [headers, ...rows].forEach((r, i) => {
        if (y > 280) { doc.addPage(); y = 20; }
        if (i === 0) { doc.setFont("helvetica", "bold"); } else { doc.setFont("helvetica", "normal"); doc.setFontSize(8); }
        doc.text(r.map((v) => String(v).slice(0, 30)).join("  |  "), 14, y);
        y += 6;
      });
      doc.save(`owner-activity-${Date.now()}.pdf`);
    }
    toast({ title: `Owner activity exported (${fmt.toUpperCase()})` });
  };

  const exportChain = (fmt) => {
    if (!ownershipChain || !ownershipChain.found) return;
    const { parcel, chain } = ownershipChain;
    const headers = ["Order", "Owner", "Role", "Transfer Date", "Officer", "Status"];
    const rows = chain.map((c) => [c.order, c.owner, c.role, formatDate(c.transferDate), c.officer, titleCase(c.status)]);
    if (fmt === "csv") {
      const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
      downloadBlob(csv, `ownership-chain-${parcel.parcelNumber}.csv`, "text/csv");
    } else if (fmt === "xlsx") {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ownership Chain");
      XLSX.writeFile(wb, `ownership-chain-${parcel.parcelNumber}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.setFontSize(14); doc.text("Ownership Chain Report", 14, 18);
      doc.setFontSize(10); doc.text(`Parcel: ${parcel.parcelNumber} — ${parcel.applicantName}`, 14, 26);
      doc.setFontSize(8); doc.text(`Area Council: ${parcel.areaCouncil}  |  Community: ${parcel.community}`, 14, 32);
      let y = 42;
      [headers, ...rows].forEach((r, i) => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.setFont(i === 0 ? "helvetica" : "helvetica", i === 0 ? "bold" : "normal");
        doc.setFontSize(i === 0 ? 9 : 8);
        doc.text(r.map((v) => String(v).slice(0, 28)).join("   "), 14, y);
        y += 6;
      });
      doc.save(`ownership-chain-${parcel.parcelNumber}.pdf`);
    }
    toast({ title: `Ownership chain exported (${fmt.toUpperCase()})` });
  };

  const exportStatistics = (fmt) => {
    const sections = [
      ["SUMMARY", [["Total Transfers", stats.total], ["Approved", stats.approved], ["Pending", stats.pending], ["Rejected", stats.rejected], ["Avg Processing Days", stats.avgDays]]],
      ["BY OFFICER", [...stats.byOfficer.map((o) => [o.name, o.value])]],
      ["BY OFFICE", [...stats.byOffice.map((o) => [o.name, o.value])]],
      ["BY AREA COUNCIL", [...stats.byAC.map((o) => [o.name, o.value])]],
      ["BY COMMUNITY (Top 12)", [...stats.byCommunity.map((o) => [o.name, o.value])]],
      ["BY MONTH", [...stats.byMonth.map((o) => [o.name, o.value])]],
    ];
    if (fmt === "csv") {
      const lines = [];
      sections.forEach(([title, rows]) => { lines.push(title); rows.forEach((r) => lines.push(r.map(csvEscape).join(","))); lines.push(""); });
      downloadBlob(lines.join("\n"), `transfer-statistics-${Date.now()}.csv`, "text/csv");
    } else if (fmt === "xlsx") {
      const wb = XLSX.utils.book_new();
      sections.forEach(([title, rows]) => {
        const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => [r[0], r[1]]));
        XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 28));
      });
      XLSX.writeFile(wb, `transfer-statistics-${Date.now()}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.setFontSize(14); doc.text("Transfer Statistics Report", 14, 18);
      doc.setFontSize(8); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);
      let y = 32;
      sections.forEach(([title, rows]) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(title, 14, y); y += 6;
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        rows.forEach((r) => { doc.text(`${String(r[0]).slice(0, 40)}: ${r[1]}`, 16, y); y += 5; });
        y += 4;
      });
      doc.save(`transfer-statistics-${Date.now()}.pdf`);
    }
    toast({ title: `Statistics exported (${fmt.toUpperCase()})` });
  };

  // ── Bulk ownership history export ──────────────────────────────────
  const toggleBulk = (id) => setBulkSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkAll = () => setBulkSelected(new Set(parcels.map((p) => p.id)));
  const bulkClear = () => setBulkSelected(new Set());
  const bulkSelectedParcels = useMemo(() => parcels.filter((p) => bulkSelected.has(p.id)), [parcels, bulkSelected]);

  const exportBulkHistory = (fmt) => {
    if (bulkSelectedParcels.length === 0) { toast({ variant: "destructive", title: "Select at least one land" }); return; }
    const headers = ["Parcel No", "Owner Sequence", "Owner Name", "Role", "Transfer Date", "Officer", "Area Council", "Community"];
    const rows = [];
    bulkSelectedParcels.forEach((p) => {
      const pTransfers = enrichedTransfers.filter((t) => t.parcel === p.id && t.status === "approved").sort((a, b) => new Date(a.created) - new Date(b.created));
      let seq = 0;
      pTransfers.forEach((t) => {
        seq++;
        rows.push([p.parcelNumber, seq, t._fromOwnerName, "Previous Owner", formatDate(t.created), t._reviewerName, p.areaCouncil, p.community]);
        rows.push([p.parcelNumber, seq, t._toOwnerName, "New Owner", formatDate(t.created), t._reviewerName, p.areaCouncil, p.community]);
      });
      rows.push([p.parcelNumber, seq + 1, p.applicantName || "—", "Current Owner", formatDate(p.registrationDate || p.created), "—", p.areaCouncil, p.community]);
    });
    if (fmt === "csv") {
      const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
      downloadBlob(csv, `bulk-ownership-history-${Date.now()}.csv`, "text/csv");
    } else if (fmt === "xlsx") {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ownership History");
      XLSX.writeFile(wb, `bulk-ownership-history-${Date.now()}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14); doc.text("Bulk Ownership History Export", 14, 16);
      doc.setFontSize(8); doc.text(`Lands: ${bulkSelectedParcels.length}  |  ${new Date().toLocaleString()}`, 14, 22);
      let y = 30; const colW = [28, 18, 40, 24, 28, 36, 34, 34];
      const drawH = () => {
        doc.setFillColor(30, 64, 120); doc.rect(10, y, colW.reduce((a, b) => a + b, 0), 6, "F");
        doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "bold");
        let x = 10; headers.forEach((h, i) => { doc.text(h, x + 1, y + 4); x += colW[i]; });
        y += 6; doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      };
      drawH();
      rows.forEach((r, idx) => {
        if (y > 200) { doc.addPage(); y = 14; drawH(); }
        doc.setFillColor(idx % 2 ? 248 : 255); doc.rect(10, y, colW.reduce((a, b) => a + b, 0), 5, "F");
        doc.setTextColor(40, 40, 40);
        let x = 10; r.forEach((v, i) => { const s = String(v || ""); const maxC = Math.floor(colW[i] / 1.7); doc.text(s.length > maxC ? s.slice(0, maxC - 1) + "…" : s, x + 1, y + 4); x += colW[i]; });
        y += 5;
      });
      doc.save(`bulk-ownership-history-${Date.now()}.pdf`);
    }
    toast({ title: `Bulk history exported (${fmt.toUpperCase()})`, description: `${bulkSelectedParcels.length} lands` });
  };

  if (loading) return <Spinner />;

  const FilterBar = () => (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-primary">Office</Label>
          <Select value={filterOffice} onValueChange={setFilterOffice}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {officeOptions.map((o) => <SelectItem key={o} value={o}>{o === "all" ? "All offices" : titleCase(o)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-primary">Area Council</Label>
          <Select value={filterAC} onValueChange={setFilterAC}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {acOptions.map((o) => <SelectItem key={o} value={o}>{o === "all" ? "All area councils" : o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-primary">Community</Label>
          <Select value={filterCommunity} onValueChange={setFilterCommunity}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {communityOptions.map((o) => <SelectItem key={o} value={o}>{o === "all" ? "All communities" : o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date from</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date to</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by</span>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="officer">Officer</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="parcel">Parcel</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}>
          {sortDir === "asc" ? "↑ A-Z" : "↓ Z-A"}
        </Button>
        {(dateFrom || dateTo || filterOffice !== "all" || filterAC !== "all" || filterCommunity !== "all") && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDateFrom(""); setDateTo(""); setFilterOffice("all"); setFilterAC("all"); setFilterCommunity("all"); }}>Clear filters</Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filteredTransfers.length} transfers</span>
      </div>
    </div>
  );

  const ExportButtons = ({ onCsv, onXlsx, onPdf, disabled }) => (
    <div className="flex gap-1">
      <Button variant="outline" size="sm" onClick={onCsv} disabled={disabled}><Download className="mr-1 h-3 w-3" /> CSV</Button>
      <Button variant="outline" size="sm" onClick={onXlsx} disabled={disabled}><Download className="mr-1 h-3 w-3" /> Excel</Button>
      <Button variant="outline" size="sm" onClick={onPdf} disabled={disabled}><FileText className="mr-1 h-3 w-3" /> PDF</Button>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Ownership Analytics — TeNDA Land Registry</title>
        <meta name="description" content="Ownership transfer reports, advanced analytics on ownership patterns, and bulk ownership history exports for Techiman North District Assembly." />
      </Helmet>

      <PageHeader
        title="Ownership Analytics"
        subtitle="Transfer reports, ownership pattern analytics & bulk history exports"
        icon={BarChart3}
        action={
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={cn("mr-1 h-4 w-4", refreshing && "animate-spin")} /> Refresh
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn("shrink-0 -mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition",
              activeTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── TRANSFER REPORT ── */}
      {activeTab === "transfers" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ExportButtons onCsv={exportTransfersCSV} onXlsx={exportTransfersXLSX} onPdf={exportTransfersPDF} />
          </div>
          <FilterBar />
          {filteredTransfers.length === 0 ? (
            <EmptyState icon={GitBranch} title="No transfers found" message="No ownership transfers match your current filters." />
          ) : (
            <SectionCard title="Ownership Transfers">
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4">Parcel No</th><th className="py-2 pr-4">From Owner</th><th className="py-2 pr-4">To Owner</th>
                      <th className="py-2 pr-4">Officer</th><th className="py-2 pr-4">Area Council</th><th className="py-2 pr-4">Status</th><th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTransfers.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/20">
                        <td className="py-2 pr-4 font-medium">{t._parcelNumber}</td>
                        <td className="py-2 pr-4">{t._fromOwnerName}</td>
                        <td className="py-2 pr-4">{t._toOwnerName}</td>
                        <td className="py-2 pr-4">{t._reviewerName}</td>
                        <td className="py-2 pr-4">{t._areaCouncil}</td>
                        <td className="py-2 pr-4">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                            t.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                            t.status === "pending" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700")}>
                            {titleCase(t.status)}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{formatDate(t.created)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── OWNER ACTIVITY ── */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-64 space-y-1.5">
              <Label className="text-xs font-semibold text-primary">Search by owner name, phone, or parcel number</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={ownerSearch} onChange={(e) => setOwnerSearch(e.target.value)} placeholder="e.g. Kwame Mensah or +233…" className="pl-9" />
              </div>
            </div>
            {ownerActivity && (
              <ExportButtons onCsv={() => exportActivity("csv")} onXlsx={() => exportActivity("xlsx")} onPdf={() => exportActivity("pdf")} />
            )}
          </div>
          {!ownerActivity ? (
            <EmptyState icon={Users} title="Search for an owner" message="Enter an owner name, phone number, or parcel number to view their activity history." />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <StatCard label="Lands owned" value={ownerActivity.matchedParcels.length} accent="primary" />
                <StatCard label="Transfers" value={ownerActivity.ownerTransfers.length} accent="blue" />
                <StatCard label="Edits" value={ownerActivity.ownerEdits.length} accent="amber" />
                <StatCard label="Delete/Restore" value={ownerActivity.ownerDeletes.length} accent="gold" />
              </div>
              <SectionCard title={`Lands owned (${ownerActivity.matchedParcels.length})`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <tr><th className="py-2 pr-4">Parcel No</th><th className="py-2 pr-4">Applicant</th><th className="py-2 pr-4">Area Council</th><th className="py-2 pr-4">Community</th><th className="py-2">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ownerActivity.matchedParcels.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/20">
                          <td className="py-2 pr-4 font-medium">{p.parcelNumber}</td>
                          <td className="py-2 pr-4">{p.applicantName}</td>
                          <td className="py-2 pr-4">{p.areaCouncil}</td>
                          <td className="py-2 pr-4">{p.community}</td>
                          <td className="py-2 text-xs">{titleCase(p.status)}</td>
                        </tr>
                      ))}
                      {ownerActivity.matchedParcels.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No lands found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
              <SectionCard title={`Transfer history (${ownerActivity.ownerTransfers.length})`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <tr><th className="py-2 pr-4">Parcel</th><th className="py-2 pr-4">From → To</th><th className="py-2 pr-4">Status</th><th className="py-2">Date</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ownerActivity.ownerTransfers.map((t) => (
                        <tr key={t.id} className="hover:bg-muted/20">
                          <td className="py-2 pr-4 font-medium">{t._parcelNumber}</td>
                          <td className="py-2 pr-4">{t._fromOwnerName} → {t._toOwnerName}</td>
                          <td className="py-2 pr-4 text-xs">{titleCase(t.status)}</td>
                          <td className="py-2 text-xs text-muted-foreground">{formatDate(t.created)}</td>
                        </tr>
                      ))}
                      {ownerActivity.ownerTransfers.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No transfers.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      )}

      {/* ── TRANSFER STATISTICS ── */}
      {activeTab === "statistics" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ExportButtons onCsv={() => exportStatistics("csv")} onXlsx={() => exportStatistics("xlsx")} onPdf={() => exportStatistics("pdf")} />
          </div>
          <FilterBar />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total transfers" value={stats.total} accent="primary" />
            <StatCard label="Approved" value={stats.approved} accent="blue" />
            <StatCard label="Pending" value={stats.pending} accent="amber" />
            <StatCard label="Rejected" value={stats.rejected} accent="gold" />
            <StatCard label="Avg processing" value={stats.avgDays ? `${stats.avgDays}d` : "—"} accent="primary" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Transfers by month">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#1e3a8a" fill="#1e3a8aaa" name="Transfers" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Transfers by officer">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byOfficer} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#7c3aed" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Transfers by area council">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byAC}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Transfers by community (Top 12)">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byCommunity}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={70} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#e0a422" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── OWNERSHIP CHAIN ── */}
      {activeTab === "chain" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-64 space-y-1.5">
              <Label className="text-xs font-semibold text-primary">Search by parcel number</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={chainSearch} onChange={(e) => setChainSearch(e.target.value)} placeholder="e.g. Adum-2024-0001" className="pl-9" />
              </div>
            </div>
            {ownershipChain && ownershipChain.found && (
              <ExportButtons onCsv={() => exportChain("csv")} onXlsx={() => exportChain("xlsx")} onPdf={() => exportChain("pdf")} />
            )}
          </div>
          {!ownershipChain ? (
            <EmptyState icon={History} title="Search for a parcel" message="Enter a parcel number to view its complete ownership chain." />
          ) : !ownershipChain.found ? (
            <EmptyState icon={History} title="Parcel not found" message="No parcel matches that number. Try a partial match." />
          ) : (
            <div className="space-y-4">
              <SectionCard title={`Ownership chain — ${ownershipChain.parcel.parcelNumber}`}>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm mb-4">
                  <div><span className="text-muted-foreground">Applicant:</span> <span className="font-medium">{ownershipChain.parcel.applicantName}</span></div>
                  <div><span className="text-muted-foreground">Area Council:</span> <span className="font-medium">{ownershipChain.parcel.areaCouncil}</span></div>
                  <div><span className="text-muted-foreground">Community:</span> <span className="font-medium">{ownershipChain.parcel.community}</span></div>
                  <div><span className="text-muted-foreground">Transfers:</span> <span className="font-medium">{ownershipChain.parcelTransfers.length}</span></div>
                </div>
                <div className="relative pl-8">
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
                  {ownershipChain.chain.map((c, i) => (
                    <div key={i} className="relative pb-4">
                      <div className={cn("absolute -left-5 top-1 h-3 w-3 rounded-full border-2 border-card",
                        c.role === "Current Owner" ? "bg-emerald-500" : c.role === "New Owner" ? "bg-blue-500" : "bg-muted-foreground")} />
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold">{c.owner}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs",
                          c.role === "Current Owner" ? "bg-emerald-100 text-emerald-700" :
                          c.role === "New Owner" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground")}>
                          {c.role}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDate(c.transferDate)}</span>
                        {c.officer !== "—" && <span className="text-xs text-muted-foreground">· Officer: {c.officer}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS DASHBOARD ── */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <FilterBar />
          {/* Predictive summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Avg ownership duration" value={patterns.avgOwnershipYears ? `${patterns.avgOwnershipYears} yrs` : "—"} accent="primary" />
            <StatCard label="Change frequency" value={`${patterns.changeFrequency}/mo`} accent="blue" />
            <StatCard label="Forecast next month" value={forecast.nextMonth} hint={`Trend: ${forecast.trend}`} accent="amber" />
            <StatCard label="Active officers" value={officerPerf.length} accent="gold" />
          </div>

          {/* Ownership patterns */}
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Most active owners (by transfers)">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={patterns.mostActiveOwners} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1e3a8a" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Most transferred lands">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={patterns.mostTransferredLands} layout="vertical" margin={{ left: 90 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#dc2626" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          {/* Seasonal + temporal */}
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Seasonal patterns (by quarter)">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={patterns.seasonal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {patterns.seasonal.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Transfer trend over time">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#0891b2" strokeWidth={2} dot={{ r: 4 }} name="Transfers" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          {/* Officer performance */}
          <SectionCard title="Officer performance analytics">
            {officerPerf.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No approved transfers to analyse officer performance.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="py-2 pr-4">Officer</th><th className="py-2 pr-4">Transfers</th><th className="py-2 pr-4">Avg days</th><th className="py-2 pr-4">Efficiency</th><th className="py-2">Activity trend</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {officerPerf.map((o) => (
                      <tr key={o.name} className="hover:bg-muted/20">
                        <td className="py-2 pr-4 font-medium">{o.name}</td>
                        <td className="py-2 pr-4">{o.transfers}</td>
                        <td className="py-2 pr-4">{o.avgDays}d</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${o.efficiency}%` }} /></div>
                            <span className="text-xs">{o.efficiency}%</span>
                          </div>
                        </td>
                        <td className="py-2">
                          <div className="flex items-end gap-0.5 h-6">
                            {stats.byMonth.slice(-6).map((m, i) => (
                              <div key={i} className="w-2 bg-primary/60 rounded-t" style={{ height: `${Math.min(100, m.value * 20)}%` }} title={`${m.name}: ${m.value}`} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Geographic */}
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Geographic distribution — transfers by area council">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byAC}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Geographic distribution — by office">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.byOffice} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {stats.byOffice.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── BULK EXPORT ── */}
      {activeTab === "bulk" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={bulkAll}>Select all ({parcels.length})</Button>
              <Button size="sm" variant="outline" onClick={bulkClear} disabled={bulkSelected.size === 0}>Clear</Button>
              <span className="text-sm font-medium text-primary">{bulkSelected.size} selected</span>
            </div>
            <ExportButtons onCsv={() => exportBulkHistory("csv")} onXlsx={() => exportBulkHistory("xlsx")} onPdf={() => exportBulkHistory("pdf")} disabled={bulkSelected.size === 0} />
          </div>
          {parcels.length === 0 ? (
            <EmptyState icon={Download} title="No parcels" message="No land parcels available to export." />
          ) : (
            <SectionCard title="Select lands to export ownership history">
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 w-8"></th>
                      <th className="py-2 pr-4">Parcel No</th><th className="py-2 pr-4">Applicant</th>
                      <th className="py-2 pr-4">Area Council</th><th className="py-2 pr-4">Community</th><th className="py-2">Transfers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parcels.map((p) => {
                      const tCount = enrichedTransfers.filter((t) => t.parcel === p.id && t.status === "approved").length;
                      const sel = bulkSelected.has(p.id);
                      return (
                        <tr key={p.id} className={cn("cursor-pointer hover:bg-muted/20", sel && "bg-primary/5")} onClick={() => toggleBulk(p.id)}>
                          <td className="py-2 pr-4">
                            {sel ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                          </td>
                          <td className="py-2 pr-4 font-medium">{p.parcelNumber}</td>
                          <td className="py-2 pr-4">{p.applicantName}</td>
                          <td className="py-2 pr-4">{p.areaCouncil}</td>
                          <td className="py-2 pr-4">{p.community}</td>
                          <td className="py-2 text-xs">{tCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}
