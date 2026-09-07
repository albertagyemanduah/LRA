export function ghs(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function timeAgo(value) {
  if (!value) return "";
  const d = new Date(value).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function titleCase(str) {
  return String(str || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PREFIX = {
  parcel: "TND-P",
  application: "TND-A",
  invoice: "TND-INV",
  survey: "TND-S",
};
export function genRef(kind) {
  const p = PREFIX[kind] || "TND";
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${p}-${year}-${rand}`;
}

export const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-700",
  planning_review: "bg-blue-100 text-blue-700",
  survey: "bg-indigo-100 text-indigo-700",
  under_survey: "bg-indigo-100 text-indigo-700",
  under_review: "bg-blue-100 text-blue-700",
  registrar_review: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  registered: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  verified: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-blue-100 text-blue-700",
  pending_scan: "bg-blue-100 text-blue-700",
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  disputed: "bg-orange-100 text-orange-700",
  rejected: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-slate-200 text-slate-700",
};
