import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPinned, Wallet, Search, CheckCircle2, KeyRound, BarChart3, Users, Plus,
  TrendingUp, TrendingDown, ArrowRightLeft, ClipboardList, Download,
  ChevronDown, ChevronUp, Lightbulb, Sparkles, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
} from "recharts";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { roleLabel, canAccess } from "@/lib/roles";
import { useHierarchy } from "@/hooks/useHierarchy";
import { SectionCard, Spinner, StatusBadge } from "@/components/shared";
import { ghs, timeAgo, titleCase, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const COLORS = ["#1e3a8a", "#3d6ab5", "#2563eb", "#7c3aed", "#dc2626", "#0891b2", "#1e5aa0", "#1e5aa0"];
const FILTER_KEY = "tnda-dash-filters";

function KpiCard({ label, value, icon: Icon, trend, hint, accent = "primary" }) {
  const accents = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    amber: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  };
  const up = typeof trend === "number" && trend >= 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accents[accent])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {typeof trend === "number" && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-blue-700" : "text-red-600")}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, title, desc }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{desc}</span>
      </span>
    </Link>
  );
}

function RadialGauge({ value, max, label, color = "#1e3a8a", subLabel }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
          <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-display" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <p className="text-xs font-semibold text-center text-foreground">{label}</p>
      {subLabel && <p className="text-[10px] text-center text-muted-foreground">{subLabel}</p>}
    </div>
  );
}

function MetricBar({ label, value, max, barColor = "bg-primary" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InsightsPanel({ stats }) {
  const registeredVal = stats.byStatus.find(s => s.name === "Registered")?.value || 0;
  const delta = stats.landsPrevMonth > 0
    ? Math.round(((stats.landsMonth - stats.landsPrevMonth) / stats.landsPrevMonth) * 100)
    : (stats.landsMonth > 0 ? 100 : 0);
  const monthStatus = delta > 10 ? { label: "Growing", color: "#16a34a" } : delta < -10 ? { label: "Declining", color: "#dc2626" } : { label: "Stable", color: "#0891b2" };
  const topComm = stats.byCommunity[0];
  const topCommPct = topComm && stats.totalLands > 0 ? Math.round((topComm.value / stats.totalLands) * 100) : 0;
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border bg-primary/5 px-5 py-3">
        <p className="text-sm font-semibold font-display text-foreground">Registry Health — Insights at a Glance</p>
        <p className="text-xs text-muted-foreground">Visual summary derived from current filtered data</p>
      </div>
      <div className="p-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <RadialGauge value={registeredVal} max={Math.max(stats.totalLands, 1)} label="Title Rate" subLabel={`${registeredVal} / ${stats.totalLands} parcels`} color="#1e3a8a" />
        <RadialGauge value={Math.max(0, stats.totalLands - stats.pendingApprovals)} max={Math.max(stats.totalLands, 1)} label="Clear of Backlog" subLabel={`${stats.pendingApprovals} pending request${stats.pendingApprovals !== 1 ? "s" : ""}`} color="#16a34a" />
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-24 w-24 flex items-center justify-center rounded-full border-8" style={{ borderColor: monthStatus.color + "33" }}>
            <div className="flex flex-col items-center">
              {delta >= 0 ? <TrendingUp className="h-6 w-6" style={{ color: monthStatus.color }} /> : <TrendingDown className="h-6 w-6" style={{ color: monthStatus.color }} />}
              <span className="text-lg font-bold font-display" style={{ color: monthStatus.color }}>{delta >= 0 ? "+" : ""}{delta}%</span>
            </div>
          </div>
          <p className="text-xs font-semibold text-center text-foreground">Monthly Trend</p>
          <p className="text-[10px] text-center text-muted-foreground">{monthStatus.label} — {stats.landsMonth} this month</p>
        </div>
        <RadialGauge value={topCommPct} max={100} label="Top Community" subLabel={topComm ? `${topComm.name}: ${topComm.value} parcels` : "No data yet"} color="#7c3aed" />
      </div>
      <div className="border-t border-border px-5 py-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status Breakdown</p>
          {stats.byStatus.slice(0, 4).map((s, i) => (
            <MetricBar key={s.name} label={s.name} value={s.value} max={Math.max(stats.totalLands, 1)}
              barColor={["bg-primary", "bg-blue-500", "bg-amber-500", "bg-red-500"][i] || "bg-muted"} />
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top Communities</p>
          {stats.byCommunity.slice(0, 4).map((c, i) => (
            <MetricBar key={c.name} label={c.name} value={c.value} max={Math.max(stats.totalLands, 1)}
              barColor={["bg-violet-600", "bg-indigo-500", "bg-cyan-500", "bg-teal-500"][i] || "bg-muted"} />
          ))}
          {stats.byCommunity.length === 0 && <p className="text-xs text-muted-foreground">Register parcels to see community distribution.</p>}
        </div>
      </div>
    </div>
  );
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function last12(items, dateKey, valueFn) {
  const out = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), name: d.toLocaleDateString("en-GB", { month: "short" }), value: 0 });
  }
  const idx = Object.fromEntries(out.map((r, i) => [r.key, i]));
  items.forEach((it) => {
    const d = new Date(it[dateKey]);
    if (isNaN(d)) return;
    const k = monthKey(d);
    if (k in idx) out[idx[k]].value += valueFn ? valueFn(it) : 1;
  });
  return out;
}

function tally(items, key) {
  const map = {};
  items.forEach((i) => {
    const v = i[key] || "unknown";
    map[v] = (map[v] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name: titleCase(name), value }))
    .sort((a, b) => b.value - a.value);
}

function pct(cur, prev) {
  if (!prev) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

function AiInsightsCard({ stats, filtered }) {
  const insights = useMemo(() => {
    const { totalLands, landsMonth, landsPrevMonth, revMonth, pendingApprovals, completedTransfers, byStatus, byCommunity } = stats;
    const results = [];

    // Registration trend
    const trendPct = landsPrevMonth > 0 ? Math.round(((landsMonth - landsPrevMonth) / landsPrevMonth) * 100) : (landsMonth > 0 ? 100 : 0);
    if (trendPct > 20) results.push({ type: "positive", icon: "📈", text: `Registration surge: ${trendPct}% increase this month vs last month. Capacity planning recommended.` });
    else if (trendPct < -20) results.push({ type: "warning", icon: "📉", text: `Registration decline: ${Math.abs(trendPct)}% fewer registrations this month. Review outreach programs.` });
    else results.push({ type: "neutral", icon: "📊", text: `Registrations are stable (${trendPct >= 0 ? "+" : ""}${trendPct}% vs last month). ${landsMonth} parcels added this month.` });

    // Disputed lands
    const disputed = byStatus.find(s => s.name.toLowerCase() === "disputed")?.value || 0;
    if (disputed > 0) results.push({ type: "warning", icon: "⚠️", text: `${disputed} disputed parcel${disputed > 1 ? "s" : ""} require legal or mediation attention.` });

    // Pending backlog
    if (pendingApprovals > 10) results.push({ type: "warning", icon: "🔔", text: `High backlog: ${pendingApprovals} pending approvals. Assign more reviewers to reduce processing time.` });
    else if (pendingApprovals > 0) results.push({ type: "neutral", icon: "⏳", text: `${pendingApprovals} approval request${pendingApprovals > 1 ? "s" : ""} awaiting review.` });

    // Title rate
    const registered = byStatus.find(s => s.name.toLowerCase() === "registered")?.value || 0;
    const titleRate = totalLands > 0 ? Math.round((registered / totalLands) * 100) : 0;
    if (titleRate > 70) results.push({ type: "positive", icon: "🏆", text: `Excellent title registration rate at ${titleRate}%. ${registered} of ${totalLands} parcels have formal titles.` });
    else if (titleRate > 40) results.push({ type: "neutral", icon: "📋", text: `Title rate is ${titleRate}%. ${totalLands - registered} parcels still lack formal titles — prioritize registration.` });
    else if (totalLands > 0) results.push({ type: "warning", icon: "🚨", text: `Low title rate: only ${titleRate}% of parcels are fully registered. Accelerate verification workflows.` });

    // Top community concentration
    if (byCommunity.length > 0 && totalLands > 0) {
      const top = byCommunity[0];
      const conc = Math.round((top.value / totalLands) * 100);
      if (conc > 50) results.push({ type: "neutral", icon: "📍", text: `${top.name} accounts for ${conc}% of all registrations. Consider expanding resources to underserved communities.` });
    }

    // Revenue insight
    if (revMonth > 0) results.push({ type: "positive", icon: "💰", text: `Revenue this month: GHS ${revMonth.toLocaleString()}. ${trendPct >= 0 ? "On track with" : "Below"} last month's performance.` });

    // Prediction
    const avgMonthly = landsPrevMonth > 0 ? Math.round((landsMonth + landsPrevMonth) / 2) : landsMonth;
    if (avgMonthly > 0) results.push({ type: "info", icon: "🔮", text: `AI Forecast: ~${avgMonthly} parcels expected next month based on 2-month average trend.` });

    return results.slice(0, 5);
  }, [stats]);

  const colors = { positive: "text-green-700 bg-green-50 border-green-200", warning: "text-amber-700 bg-amber-50 border-amber-200", neutral: "text-blue-700 bg-blue-50 border-blue-200", info: "text-purple-700 bg-purple-50 border-purple-200" };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border bg-gradient-to-r from-primary/10 to-violet-500/5 px-5 py-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold font-display text-foreground">AI-Powered Intelligence</p>
        <span className="ml-auto text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Live Analysis</span>
      </div>
      <div className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((ins, i) => (
          <div key={i} className={cn("rounded-xl border p-3 text-xs leading-snug", colors[ins.type] || colors.neutral)}>
            <span className="mr-1">{ins.icon}</span>{ins.text}
          </div>
        ))}
        {insights.length === 0 && (
          <p className="text-xs text-muted-foreground col-span-full py-4 text-center">Add land records to generate AI insights.</p>
        )}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { user, role, roles } = useAuth();
  const isAdmin = role === "admin";
  const canApprove = (roles.length > 0 ? roles : [role]).some((r) => canAccess(r, "approvals"));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ parcels: [], payments: [], transfers: [], requests: [], hiddenCount: 0 });
  const [qaCollapsed, setQaCollapsed] = useState(() => {
    try { return localStorage.getItem("qa-collapsed") === "true"; } catch { return false; }
  });
  const toggleQa = () => setQaCollapsed((prev) => { const next = !prev; localStorage.setItem("qa-collapsed", String(next)); return next; });
  const { offices, areaCouncils, communities, sectors, acForOffice, commForAC, sectForComm } = useHierarchy();

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"); } catch { return {}; }
  })();
  const [fOffice, setFOffice] = useState(saved.office || "all");
  const [fAC, setFAC] = useState(saved.ac || "all");
  const [fComm, setFComm] = useState(saved.comm || "all");
  const [fSect, setFSect] = useState(saved.sect || "all");
  const [fStatus, setFStatus] = useState(saved.status || "all");
  const [fFrom, setFFrom] = useState(saved.from || "");
  const [fTo, setFTo] = useState(saved.to || "");

  useEffect(() => {
    localStorage.setItem(
      FILTER_KEY,
      JSON.stringify({ office: fOffice, ac: fAC, comm: fComm, sect: fSect, status: fStatus, from: fFrom, to: fTo }),
    );
  }, [fOffice, fAC, fComm, fSect, fStatus, fFrom, fTo]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      pb.collection("parcels").getFullList({ sort: "-created", requestKey: "dash-p" }).catch(() => []),
      pb.collection("payments").getFullList({ sort: "-created", requestKey: "dash-pay" }).catch(() => []),
      pb.collection("land_transfers").getFullList({ sort: "-created", requestKey: "dash-t" }).catch(() => []),
      pb.collection("land_edit_requests").getFullList({ sort: "-created", requestKey: "dash-r" }).catch(() => []),
      pb.collection("audit_logs").getFullList({ filter: `action = "parcel_soft_deleted" || action = "parcel_restored"`, sort: "created", requestKey: "dash-softdel" }).catch(() => []),
    ]).then(([parcels, payments, transfers, requests, auditLogs]) => {
      if (!alive) return;
      // Compute soft-deleted set from audit_logs
      const stateMap = {};
      for (const e of auditLogs) { stateMap[e.entity] = e.action === "parcel_soft_deleted"; }
      const hiddenIds = new Set(Object.entries(stateMap).filter(([, v]) => v).map(([k]) => k));
      setData({ parcels, payments, transfers, requests, hiddenCount: hiddenIds.size });
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const activeFilters =
    [fOffice, fAC, fComm, fSect, fStatus].filter((v) => v !== "all").length + (fFrom ? 1 : 0) + (fTo ? 1 : 0);

  const matches = (rec) => {
    if (fOffice !== "all" && rec.office && rec.office !== fOffice) return false;
    if (fAC !== "all" && rec.areaCouncil && rec.areaCouncil !== fAC) return false;
    if (fComm !== "all" && rec.community && rec.community !== fComm) return false;
    if (fSect !== "all" && rec.sector && rec.sector !== fSect) return false;
    const d = new Date(rec.created);
    if (fFrom && d < new Date(fFrom)) return false;
    if (fTo && d > new Date(`${fTo}T23:59:59`)) return false;
    return true;
  };

  const filtered = useMemo(() => {
    const parcels = data.parcels.filter((p) => matches(p) && (fStatus === "all" || p.status === fStatus));
    return {
      parcels,
      payments: data.payments.filter(matches),
      transfers: data.transfers.filter((t) => {
        const d = new Date(t.created);
        if (fFrom && d < new Date(fFrom)) return false;
        if (fTo && d > new Date(`${fTo}T23:59:59`)) return false;
        return true;
      }),
      requests: data.requests,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, fOffice, fAC, fComm, fSect, fStatus, fFrom, fTo]);

  if (loading) return <Spinner />;

  const now = new Date();
  const thisMonth = monthKey(now);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = monthKey(prevMonthDate);
  const thisYear = now.getFullYear();

  const inMonth = (arr, mk) => arr.filter((r) => monthKey(new Date(r.created)) === mk);
  const inYear = (arr, y) => arr.filter((r) => new Date(r.created).getFullYear() === y);

  const paid = filtered.payments.filter((p) => p.status === "paid");
  const sum = (arr) => arr.reduce((s, p) => s + (p.amount || 0), 0);

  const landsMonth = inMonth(filtered.parcels, thisMonth).length;
  const landsPrevMonth = inMonth(filtered.parcels, prevMonth).length;
  const landsYear = inYear(filtered.parcels, thisYear).length;
  const landsPrevYear = inYear(filtered.parcels, thisYear - 1).length;
  const revMonth = sum(inMonth(paid, thisMonth));
  const revPrevMonth = sum(inMonth(paid, prevMonth));
  const revYear = sum(inYear(paid, thisYear));
  const revPrevYear = sum(inYear(paid, thisYear - 1));

  const myScope = data.parcels.filter(
    (p) =>
      (!user?.communityRef || p.community === user.communityRef) &&
      (!user?.areaCouncilRef || p.areaCouncil === user.areaCouncilRef),
  ).length;

  const pendingApprovals = filtered.requests.filter((r) => r.status === "pending").length;
  const completedTransfers = filtered.transfers.filter((t) => t.status === "approved").length;

  const regTrend = last12(filtered.parcels, "created");
  const revTrend = last12(paid, "created", (p) => p.amount || 0);
  const byCommunity = tally(filtered.parcels, "community").slice(0, 8);
  const byOffice = tally(filtered.parcels, "office").slice(0, 8);
  const byStatus = tally(filtered.parcels, "status");
  const approvalsByStatus = tally(filtered.requests, "status");

  const hierarchyPath = [user?.officeRef, user?.areaCouncilRef, user?.communityRef, user?.sectorRef]
    .filter(Boolean)
    .join(" › ");

  const exportStats = () => {
    const rows = [
      ["TeNDA Land Registry — Dashboard Statistics"],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Active filters: ${activeFilters}`],
      [],
      ["Metric", "Value"],
      ["Total lands", filtered.parcels.length],
      ["Lands this month", landsMonth],
      ["Lands this year", landsYear],
      ["Lands in my hierarchy", myScope],
      ["Pending approvals", pendingApprovals],
      ["Completed transfers", completedTransfers],
      ["Revenue (all time)", sum(paid)],
      ["Revenue this month", revMonth],
      ["Revenue this year", revYear],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dashboard_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;
    a.click();
  };

  const recentLands = filtered.parcels.slice(0, 10);
  const recentTransfers = filtered.transfers.slice(0, 10);
  const recentPayments = filtered.payments.slice(0, 10);

  return (
    <>
      {/* Welcome */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              Welcome back, {user?.fullName || user?.firstName || user?.email?.split("@")[0] || "Officer"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">{roleLabel(role)}</span>
              {hierarchyPath && (
                <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">{hierarchyPath}</span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportStats} className="min-h-11 sm:min-h-0">
            <Download className="mr-1.5 h-4 w-4" /> Export stats
          </Button>
        </div>
      </div>

      {/* Pending approvals blinking banner — approvers only */}
      {canApprove && pendingApprovals > 0 && (
        <Link
          to="/app/approvals"
          className="approval-blink block rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-900/20 px-5 py-3.5 shadow-sm transition hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 approval-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
            </span>
            <ClipboardList className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                {pendingApprovals} pending approval{pendingApprovals !== 1 ? "s" : ""} awaiting your review
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80">
                {filtered.requests.filter((r) => r.status === "pending").length} edit/delete request(s)
                {" · "}click to open the Approvals review queue
              </p>
            </div>
            <span className="ml-auto text-xs font-medium text-red-700 dark:text-red-300 shrink-0">Review now →</span>
          </div>
        </Link>
      )}

      {/* Quick actions — collapsible */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <button
          onClick={toggleQa}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition"
          aria-expanded={!qaCollapsed}
        >
          <div className="text-left">
            <p className="text-sm font-semibold font-display">Quick Actions</p>
            <p className="text-xs text-muted-foreground">Jump straight into the most common tasks</p>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary transition">
            {qaCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </span>
        </button>
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ maxHeight: qaCollapsed ? 0 : 600, opacity: qaCollapsed ? 0 : 1 }}
        >
          <div className="px-5 pb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction to="/app/parcels" icon={Plus} title="Register new land" desc="Start a new land registration record" />
            <QuickAction to="/app/search" icon={Search} title="Search land" desc="Find parcels across the hierarchy" />
            <QuickAction to="/verify-land" icon={CheckCircle2} title="Verify land" desc="Open the public verification portal" />
            <QuickAction to="/app/reports" icon={BarChart3} title="View reports" desc="Analytics, revenue and trends" />
            {canApprove && <QuickAction to="/app/approvals" icon={ClipboardList} title="Review approvals" desc={`${pendingApprovals} pending request${pendingApprovals !== 1 ? "s" : ""} awaiting review`} />}
            {isAdmin && <QuickAction to="/app/verification-codes" icon={KeyRound} title="Verification codes" desc="Generate and manage access codes" />}
            {isAdmin && <QuickAction to="/app/admin" icon={Users} title="Manage users" desc="Accounts, roles and hierarchy" />}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total lands" value={filtered.parcels.length} icon={MapPinned} hint="all time" />
        {data.hiddenCount > 0 && <KpiCard label="Hidden/deleted lands" value={data.hiddenCount} icon={MapPinned} accent="gold" hint="soft-deleted, click to view" />}
        <KpiCard label="Lands this month" value={landsMonth} icon={MapPinned} trend={pct(landsMonth, landsPrevMonth)} hint="vs last month" accent="amber" />
        <KpiCard label="Lands this year" value={landsYear} icon={MapPinned} trend={pct(landsYear, landsPrevYear)} hint="vs last year" accent="blue" />
        <KpiCard label="In my hierarchy" value={myScope} icon={ClipboardList} hint={hierarchyPath || "district-wide"} accent="gold" />
        <KpiCard label="Pending approvals" value={pendingApprovals} icon={ClipboardList} accent="gold" />
        <KpiCard label="Completed transfers" value={completedTransfers} icon={ArrowRightLeft} accent="blue" />
        <KpiCard label="Revenue this month" value={ghs(revMonth)} icon={Wallet} trend={pct(revMonth, revPrevMonth)} hint="vs last month" accent="amber" />
        <KpiCard label="Revenue this year" value={ghs(revYear)} icon={Wallet} trend={pct(revYear, revPrevYear)} hint={`all time ${ghs(sum(paid))}`} accent="gold" />
      </div>

      {/* AI Intelligence Panel */}
      <AiInsightsCard stats={{
        totalLands: filtered.parcels.length,
        landsMonth, landsPrevMonth,
        revMonth,
        pendingApprovals,
        completedTransfers,
        byStatus, byCommunity,
      }} filtered={filtered} />

      {/* Insights at a Glance */}
      <InsightsPanel stats={{
        totalLands: filtered.parcels.length,
        landsMonth, landsPrevMonth, landsYear,
        pendingApprovals, completedTransfers,
        revMonth, revYear,
        byStatus, byCommunity,
      }} />

      {/* Year-on-Year Analytics */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-gradient-to-r from-primary/10 to-blue-500/5 px-5 py-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold font-display">Year-on-Year Analytics</p>
          <span className="ml-auto text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{thisYear - 1} vs {thisYear}</span>
        </div>
        <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Land Registrations", cur: landsYear, prev: landsPrevYear, suffix: "parcels", icon: MapPinned, color: "#1e3a8a" },
            { label: "Revenue", cur: revYear, prev: revPrevYear, isCurrency: true, icon: Wallet, color: "#16a34a" },
            { label: "Transfers Completed", cur: completedTransfers, prev: 0, suffix: "transfers", icon: ArrowRightLeft, color: "#7c3aed" },
            { label: "Pending Approvals", cur: pendingApprovals, prev: 0, suffix: "pending", icon: ClipboardList, color: "#dc2626", invertTrend: true },
          ].map(({ label, cur, prev, isCurrency, suffix, icon: Icon, color, invertTrend }) => {
            const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0);
            const isPositive = invertTrend ? delta <= 0 : delta >= 0;
            const r = 32; const circ = 2 * Math.PI * r;
            const fillPct = Math.min(100, prev > 0 ? Math.round((Math.min(cur, cur + prev) / (cur + prev)) * 100) : 50);
            const dash = (fillPct / 100) * circ;
            return (
              <div key={label} className="rounded-xl border border-border bg-background/60 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: color + "22", color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 shrink-0">
                    <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
                      <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/20" />
                      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                        style={{ transition: "stroke-dasharray 0.8s ease" }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold" style={{ color }}>{delta >= 0 ? "+" : ""}{delta}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-display">{isCurrency ? ghs(cur) : cur.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">{thisYear}</p>
                    <p className="text-[11px] text-muted-foreground">{isCurrency ? ghs(prev) : prev.toLocaleString()} in {thisYear - 1}</p>
                  </div>
                </div>
                <div className={cn("text-[10px] rounded-full px-2 py-0.5 text-center font-medium w-fit",
                  isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                  {isPositive ? "▲" : "▼"} {Math.abs(delta)}% year-on-year
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-border px-5 py-3 bg-primary/5">
          <p className="text-xs text-muted-foreground">
            <Sparkles className="inline h-3 w-3 mr-1 text-primary" />
            <strong>AI Insight: </strong>
            {landsYear > landsPrevYear
              ? `Registration growth of ${pct(landsYear, landsPrevYear)}% YoY indicates strong land formalization progress. Revenue trajectory is ${revYear >= revPrevYear ? "on track" : "below pace"} vs ${thisYear - 1}.`
              : `Registration activity is ${Math.abs(pct(landsYear, landsPrevYear))}% below ${thisYear - 1}. Consider outreach programs to accelerate parcel formalization in underserved communities.`
            }
          </p>
        </div>
      </div>

      {/* Charts with AI Infographics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Land Registration Trend */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border px-5 py-3 flex items-center gap-2">
            <div>
              <p className="text-sm font-semibold font-display">Land registration trend</p>
              <p className="text-xs text-muted-foreground">Last 12 months — monthly registrations</p>
            </div>
            <span className={cn("ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium",
              pct(landsMonth, landsPrevMonth) >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
              {pct(landsMonth, landsPrevMonth) >= 0 ? "+" : ""}{pct(landsMonth, landsPrevMonth)}% vs last month
            </span>
          </div>
          <div className="p-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={regTrend}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="value" name="Registrations" stroke="#1e3a8a" strokeWidth={2.5} fill="url(#regGrad)" dot={{ r: 3, fill: "#1e3a8a" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-border bg-blue-50/50 dark:bg-blue-900/10 px-4 py-2.5 flex gap-4 text-[11px]">
            <span className="text-muted-foreground"><strong className="text-foreground">Peak:</strong> {regTrend.reduce((a, b) => b.value > a.value ? b : a, regTrend[0] || { name: "—", value: 0 }).name} ({regTrend.reduce((a, b) => b.value > a.value ? b : a, regTrend[0] || { value: 0 }).value} parcels)</span>
            <span className="text-muted-foreground"><strong className="text-foreground">Avg/month:</strong> {regTrend.length ? Math.round(regTrend.reduce((s, r) => s + r.value, 0) / regTrend.length) : 0}</span>
            <span className="ml-auto flex items-center gap-1 text-primary font-medium"><Sparkles className="h-3 w-3" /> AI: {landsMonth >= (regTrend.reduce((s, r) => s + r.value, 0) / Math.max(regTrend.length, 1)) ? "Above average month" : "Below average month"}</span>
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border px-5 py-3 flex items-center gap-2">
            <div>
              <p className="text-sm font-semibold font-display">Revenue trend</p>
              <p className="text-xs text-muted-foreground">Last 12 months — collected payments</p>
            </div>
            <span className={cn("ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium",
              pct(revMonth, revPrevMonth) >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
              {pct(revMonth, revPrevMonth) >= 0 ? "+" : ""}{pct(revMonth, revPrevMonth)}% vs last month
            </span>
          </div>
          <div className="p-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revTrend}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => ghs(v)} />
                <Area type="monotone" dataKey="value" name="Revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3, fill: "#16a34a" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-border bg-green-50/50 dark:bg-green-900/10 px-4 py-2.5 flex gap-4 text-[11px]">
            <span className="text-muted-foreground"><strong className="text-foreground">This year:</strong> {ghs(revYear)}</span>
            <span className="text-muted-foreground"><strong className="text-foreground">Last year:</strong> {ghs(revPrevYear)}</span>
            <span className="ml-auto flex items-center gap-1 text-green-700 font-medium"><Sparkles className="h-3 w-3" /> AI: {revYear >= revPrevYear ? "Revenue growing YoY" : "Revenue needs attention"}</span>
          </div>
        </div>

        {/* Lands by Community */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border px-5 py-3 flex items-center gap-2">
            <div>
              <p className="text-sm font-semibold font-display">Lands by community</p>
              <p className="text-xs text-muted-foreground">Click a bar to filter — top {byCommunity.length} communities</p>
            </div>
          </div>
          <div className="p-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCommunity} layout="vertical" onClick={(e) => e?.activeLabel && setFComm(e.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" name="Parcels" cursor="pointer" radius={[0, 6, 6, 0]}>
                  {byCommunity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {byCommunity.length > 0 && (
            <div className="border-t border-border bg-violet-50/50 dark:bg-violet-900/10 px-4 py-2.5 flex gap-4 text-[11px]">
              <span className="text-muted-foreground"><strong className="text-foreground">Top:</strong> {byCommunity[0]?.name} ({byCommunity[0]?.value} parcels)</span>
              <span className="text-muted-foreground"><strong className="text-foreground">Concentration:</strong> {filtered.parcels.length > 0 ? Math.round((byCommunity[0]?.value / filtered.parcels.length) * 100) : 0}%</span>
              <span className="ml-auto flex items-center gap-1 text-violet-700 font-medium"><Sparkles className="h-3 w-3" /> AI: {(byCommunity[0]?.value / Math.max(filtered.parcels.length, 1)) > 0.5 ? "High concentration — diversify" : "Well distributed"}</span>
            </div>
          )}
        </div>

        {/* Lands by Office */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border px-5 py-3 flex items-center gap-2">
            <div>
              <p className="text-sm font-semibold font-display">Lands by office</p>
              <p className="text-xs text-muted-foreground">Click a bar to filter — district offices</p>
            </div>
          </div>
          <div className="p-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byOffice} onClick={(e) => e?.activeLabel && setFOffice(e.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" name="Lands" radius={[6, 6, 0, 0]} cursor="pointer">
                  {byOffice.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {byOffice.length > 0 && (
            <div className="border-t border-border bg-cyan-50/50 dark:bg-cyan-900/10 px-4 py-2.5 flex gap-4 text-[11px]">
              <span className="text-muted-foreground"><strong className="text-foreground">Leading:</strong> {byOffice[0]?.name} ({byOffice[0]?.value})</span>
              <span className="text-muted-foreground"><strong className="text-foreground">Offices active:</strong> {byOffice.length}</span>
              <span className="ml-auto flex items-center gap-1 text-cyan-700 font-medium"><Sparkles className="h-3 w-3" /> AI: {byOffice.length > 2 ? "Multi-office coverage" : "Expand to more offices"}</span>
            </div>
          )}
        </div>

        {/* Approval Requests by Status */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden lg:col-span-2">
          <div className="border-b border-border px-5 py-3 flex items-center gap-2">
            <div>
              <p className="text-sm font-semibold font-display">Approval requests by status</p>
              <p className="text-xs text-muted-foreground">Land edit and deletion requests — current distribution</p>
            </div>
            {pendingApprovals > 0 && (
              <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {pendingApprovals} pending action{pendingApprovals > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="p-4 grid gap-4 sm:grid-cols-2">
            <div className="h-52">
              {approvalsByStatus.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">No approval requests yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={approvalsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75}>
                      {approvalsByStatus.map((_, i) => <Cell key={i} fill={["#1e3a8a", "#16a34a", "#dc2626"][i % 3]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex flex-col justify-center gap-3">
              {approvalsByStatus.map((s, i) => (
                <div key={s.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{s.name}</span>
                    <span className="font-semibold">{s.value} ({filtered.requests.length > 0 ? Math.round((s.value / filtered.requests.length) * 100) : 0}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${filtered.requests.length > 0 ? (s.value / filtered.requests.length) * 100 : 0}%`, background: ["#1e3a8a", "#16a34a", "#dc2626"][i % 3] }} />
                  </div>
                </div>
              ))}
              {approvalsByStatus.length === 0 && <p className="text-xs text-muted-foreground text-center">No requests to analyze.</p>}
              <div className="mt-2 rounded-lg bg-primary/5 border border-primary/10 p-2.5 text-[11px] text-muted-foreground">
                <Sparkles className="inline h-3 w-3 mr-1 text-primary" />
                <strong>AI: </strong>
                {pendingApprovals === 0 ? "All requests processed — excellent workflow efficiency." :
                  pendingApprovals > 5 ? `High backlog: ${pendingApprovals} pending. Assign dedicated reviewers.` :
                  `${pendingApprovals} pending request${pendingApprovals > 1 ? "s" : ""} — manageable workload.`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Recent land registrations"
          action={<Link to="/app/parcels" className="text-xs font-medium text-primary hover:underline">View all</Link>}
        >
          {recentLands.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No registrations yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recentLands.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to="/app/parcels" className="min-w-0 hover:underline">
                    <p className="truncate font-medium">{p.applicantName || p.parcelNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Plot {p.plotNumber || "—"}{p.block ? ` / ${p.block}` : ""} · {p.community || "—"} · {timeAgo(p.created)}
                    </p>
                  </Link>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent payments"
          action={<Link to="/app/payments" className="text-xs font-medium text-primary hover:underline">View all</Link>}
        >
          {recentPayments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.ownerName || p.invoiceNumber || "Payment"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {titleCase(p.purpose || "fee")} · {titleCase(p.method || "—")} · {formatDate(p.created)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{ghs(p.amount || 0)}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recent transfers" className="lg:col-span-2">
          {recentTransfers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No land transfers recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">New owner</th>
                    <th className="hidden py-2 pr-4 font-medium sm:table-cell">Certificate</th>
                    <th className="hidden py-2 pr-4 font-medium sm:table-cell">Date</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentTransfers.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/20">
                      <td className="py-2 pr-4 font-medium">{t.toOwnerName || "—"}</td>
                      <td className="hidden py-2 pr-4 font-mono text-xs text-muted-foreground sm:table-cell">{t.certificateNumber || "—"}</td>
                      <td className="hidden py-2 pr-4 text-muted-foreground sm:table-cell">{formatDate(t.created)}</td>
                      <td className="py-2"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
