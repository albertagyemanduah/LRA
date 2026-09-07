import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  MapPinned, Plus, MapPin, Download, Clock, Pencil, FileCheck,
  AlertTriangle, RefreshCw, Filter, Search, Upload, CheckCircle2,
  ChevronDown, ChevronUp, FileSpreadsheet, ArrowRightLeft, Bell,
  XCircle, Check, X, LayoutList, Grid2X2, LayoutGrid, Maximize2,
  Trash2, RotateCcw, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown, Columns, Copy, ArrowRight,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { startOperation, endOperation } from "@/lib/operationGuard";
import { useAuth } from "@/lib/auth";
import { useCollection, notify } from "@/lib/useCollection";
import { PageHeader, StatusBadge, Spinner, EmptyState } from "@/components/shared";
import OtherSelect from "@/components/OtherSelect";
import { titleCase, formatDate } from "@/lib/format";
import { getUserAreaCouncils, filterParcelsForUser, ALL_AREA_COUNCILS, OFFICES } from "@/lib/offices";
import { useHierarchy } from "@/hooks/useHierarchy";
import { loadActiveCertTemplate } from "@/lib/certTemplates";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { sendSms } from "@/lib/messaging";
import PaginationControl, { usePagination } from "@/components/Pagination";
import DuplicateCheck from "@/components/DuplicateCheck";
import { findExistingParcel, findAllDuplicates } from "@/lib/duplicateCheck";
import { generateParcelId } from "@/lib/parcelId";
import { deleteParcelCompletely } from "@/lib/deleteUtils";
import SearchableSelect from "@/components/SearchableSelect";
import { parseImportFile, validateRows, fileKind, logImport } from "@/lib/importParsers";
import { downloadSQL } from "@/lib/sqlExport";


const STATUSES = ["all", "draft", "submitted", "under_survey", "under_review", "registered", "disputed", "rejected"];

const VIEW_MODES = [
  { key: "medium", label: "Medium", icon: Grid2X2 },
  { key: "list",   label: "List",   icon: LayoutList },
  { key: "small",  label: "Small",  icon: LayoutGrid },
  { key: "large",  label: "Large",  icon: Maximize2 },
];

const ALL_PARCEL_COLUMNS = [
  { key: "parcelNumber", label: "Parcel No.", default: true },
  { key: "applicantName", label: "Applicant", default: true },
  { key: "areaCouncil", label: "Area Council", default: true },
  { key: "community", label: "Community", default: true },
  { key: "sector", label: "Sector", default: false },
  { key: "plotNumber", label: "Plot", default: true },
  { key: "block", label: "Block", default: true },
  { key: "status", label: "Status", default: true },
  { key: "contactPhone", label: "Phone", default: false },
  { key: "alternateMobile", label: "Alt Mobile", default: false },
  { key: "alternateNumber2", label: "Alt No. 2", default: false },
  { key: "registrationDate", label: "Reg. Date", default: false },
  { key: "allocationDate", label: "Alloc. Date", default: false },
  { key: "religion", label: "Religion", default: false },
  { key: "tribe", label: "Tribe", default: false },
];

const SORT_FIELDS = [
  { value: "parcelNumber", label: "Parcel No." },
  { value: "applicantName", label: "Applicant Name" },
  { value: "areaCouncil", label: "Area Council" },
  { value: "community", label: "Community" },
  { value: "sector", label: "Sector" },
  { value: "plotNumber", label: "Plot Number" },
  { value: "status", label: "Status" },
  { value: "registrationDate", label: "Registration Date" },
  { value: "created", label: "Date Added" },
];

function getVisibleCols() {
  try {
    const saved = localStorage.getItem("parcels_visible_cols");
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set(ALL_PARCEL_COLUMNS.filter((c) => c.default).map((c) => c.key));
}
function saveVisibleCols(cols) {
  try { localStorage.setItem("parcels_visible_cols", JSON.stringify([...cols])); } catch {}
}

function sortParcels(arr, field, dir) {
  if (!field) return arr;
  return [...arr].sort((a, b) => {
    let av = a[field] ?? "";
    let bv = b[field] ?? "";
    if (field === "registrationDate" || field === "allocationDate" || field === "created") {
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
      return dir === "asc" ? av - bv : bv - av;
    }
    av = String(av).toLowerCase();
    bv = String(bv).toLowerCase();
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

function getViewMode() {
  try { return localStorage.getItem("parcels_view") || "list"; } catch { return "list"; }
}
function setViewMode(v) {
  try { localStorage.setItem("parcels_view", v); } catch {}
}
const RELIGIONS = ["Christian", "Muslim", "Traditionalist", "Other"];
const TRIBES = ["Akan", "Ewe", "Ga", "Dagomba", "Fante", "Brong", "Bono", "Other"];

const EMPTY_FORM = {
  applicantName: "", contactPhone: "", alternateMobile: "", alternateNumber2: "", whatsapp: "", applicantEmail: "",
  religion: "", tribe: "", office: "", areaCouncil: "", community: "", sector: "",
  plotNumber: "", block: "", allocationDate: "", registrationDate: "",
  // Additional land references (owner's other lands)
  additionalLands: [],
  // Payment fields
  paymentAmount: "", paymentMethod: "", paymentStatus: "pending", paymentDate: "", paymentReference: "", paymentNotes: "",
};

// ── Parcel Number Generator ─────────────────────────────────────────────────
// Format: TeNDA-PPD-[COMMUNITY ABBREVIATION]-XXXX  e.g. TeNDA-PPD-ADUM-0001
// Delegates to the shared parcelId library so the admin correction tool and
// the registration/import flows share one source of truth.
async function generateParcelNumber(community, registrationDate) {
  return generateParcelId(community);
}

// ── Date normalisation helper ────────────────────────────────────────────────
// Accepts: yyyy-mm-dd, mm-dd-yyyy, dd-mm-yyyy (with / - . separators)
// Also: "January 15, 2024", "15 January 2024", "Jan 15 2024", etc.
// Returns yyyy-mm-dd string or null.
const MONTH_NAMES = {
  january:1,february:2,march:3,april:4,may:5,june:6,
  july:7,august:8,september:9,october:10,november:11,december:12,
  jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
};
function normaliseDate(str) {
  if (!str || !String(str).trim()) return null;
  const s = String(str).trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Text month: "January 15, 2024" or "15 January 2024" or "Jan 15, 2024"
  const textMonth = s.match(/^(\d{1,2})\s+([a-zA-Z]+),?\s+(\d{4})$/) ||
                    s.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (textMonth) {
    let day, mo, yr;
    if (/^\d/.test(s)) {
      [, day, mo, yr] = textMonth;
    } else {
      [, mo, day, yr] = textMonth;
    }
    const mNum = MONTH_NAMES[mo.toLowerCase()];
    if (mNum) {
      const d = new Date(Number(yr), mNum - 1, Number(day));
      if (!isNaN(d.getTime())) return `${yr}-${String(mNum).padStart(2,"0")}-${String(Number(day)).padStart(2,"0")}`;
    }
  }
  // Numeric with separators
  const parts = s.split(/[\/\-\.]/); 
  if (parts.length === 3) {
    const nums = parts.map(Number);
    const yearIdx = nums.findIndex((n) => n > 31);
    if (yearIdx === 2) {
      const [a, b, yr] = nums;
      if (a > 12) {
        // dd/mm/yyyy
        const d = new Date(yr, b - 1, a);
        if (!isNaN(d.getTime()) && d.getDate() === a) return `${yr}-${String(b).padStart(2,"0")}-${String(a).padStart(2,"0")}`;
      } else if (b > 12) {
        // mm/dd/yyyy
        const d = new Date(yr, a - 1, b);
        if (!isNaN(d.getTime()) && d.getDate() === b) return `${yr}-${String(a).padStart(2,"0")}-${String(b).padStart(2,"0")}`;
      } else {
        // Ambiguous — assume dd/mm/yyyy (Ghana standard)
        const d = new Date(yr, b - 1, a);
        if (!isNaN(d.getTime()) && b >= 1 && b <= 12 && a >= 1 && a <= 31) return `${yr}-${String(b).padStart(2,"0")}-${String(a).padStart(2,"0")}`;
      }
    } else if (yearIdx === 0) {
      const [yr, a, b] = nums;
      const d = new Date(yr, a - 1, b);
      if (!isNaN(d.getTime())) return `${yr}-${String(a).padStart(2,"0")}-${String(b).padStart(2,"0")}`;
    }
  }
  return null;
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function FGroup({ label }) {
  return (
    <h4 className="mt-1 border-b border-border pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </h4>
  );
}
function FRow({ children }) { return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>; }
// Read-only labelled value used in confirmation / summary panels
function ReadField({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold" title={String(value ?? "")}>{value || "—"}</p>
    </div>
  );
}
function FF({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ── Certificate ──────────────────────────────────────────────────────────────
const CERT_FIELD_LABELS = {
  parcelNumber: "Land / Parcel ID", applicantName: "Name of Applicant",
  areaCouncil: "Area Council", community: "Community", sector: "Sector",
  plotNumber: "Plot Number", block: "Block", allocationDate: "Allocation Date",
  registrationDate: "Registration Date", contactPhone: "Mobile",
  alternateMobile: "Alternate Mobile", alternateNumber2: "Alternate Number 2", whatsapp: "WhatsApp",
  applicantEmail: "Email", tribe: "Tribe", religion: "Religion", status: "Status",
};

function CertificateModal({ parcel, onClose }) {
  const tpl = loadActiveCertTemplate();
  const { toast } = useToast();

  // Determine which fields to show: if template exists use its fields, else show all
  const fieldKeys = tpl
    ? Object.entries(tpl.fields || {}).filter(([, v]) => v !== false).map(([k]) => k)
    : Object.keys(CERT_FIELD_LABELS);

  const activeFields = (fieldKeys.length > 0 ? fieldKeys : Object.keys(CERT_FIELD_LABELS))
    .map((k) => ({ key: k, label: CERT_FIELD_LABELS[k] || k }));

  const getValue = (key) => {
    const v = parcel[key];
    if (!v) return "—";
    if (key.includes("Date")) return formatDate(v);
    return v;
  };

  const printCertificate = () => {
    const printWin = window.open("", "_blank", "width=800,height=1100");
    if (!printWin) { toast({ variant: "destructive", title: "Pop-up blocked. Allow pop-ups for this site." }); return; }
    const rows = activeFields.map(({ key, label }) => `
      <tr>
        <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:500;width:40%">${label}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${getValue(key)}</td>
      </tr>`).join("");
    const bgImg = tpl?.imageData ? `background-image:url(${tpl.imageData});background-size:cover;background-position:center;` : "";
    printWin.document.write(`<!DOCTYPE html><html><head><title>Land Certificate — ${parcel.parcelNumber}</title>
      <style>body{font-family:Georgia,serif;margin:0;padding:0} @media print{body{margin:0}}</style></head>
      <body style="${bgImg}">
      <div style="background:rgba(255,255,255,0.93);min-height:100vh;padding:40px 50px;box-sizing:border-box">
        <div style="text-align:center;border-bottom:3px double #1a4731;padding-bottom:20px;margin-bottom:24px">
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:2px">Republic of Ghana · Techiman North District Assembly</p>
          <h1 style="margin:8px 0 4px;font-size:26px;color:#1a4731">${tpl?.headerText || "LAND USE CERTIFICATE"}</h1>
          <p style="margin:0;font-size:12px;color:#6b7280">Certificate No: ${parcel.parcelNumber}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:50px">
          <div style="text-align:center"><div style="height:60px;border-bottom:2px dashed #ccc;margin-bottom:8px"></div><p style="font-size:11px;color:#6b7280;margin:0">Land Registrar Signature & Stamp</p></div>
          <div style="text-align:center"><div style="height:60px;border-bottom:2px dashed #ccc;margin-bottom:8px"></div><p style="font-size:11px;color:#6b7280;margin:0">District Assembly Administrator</p></div>
        </div>
        <div style="text-align:center;margin-top:40px;border-top:2px solid #1a4731;padding-top:16px">
          <p style="font-size:11px;color:#6b7280;margin:0">${tpl?.footerText || "Issued under the Land Registration Act 2020 (Act 1036)."}</p>
          <p style="font-size:10px;color:#9ca3af;margin:6px 0 0">Issued: ${new Date().toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div></body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 500);
    onClose();
  };

  const downloadTxt = () => {
    const lines = [
      tpl?.headerText || "LAND USE CERTIFICATE",
      "Techiman North District Assembly",
      "─".repeat(50),
      ...activeFields.map(({ key, label }) => `${label.padEnd(25)}: ${getValue(key)}`),
      "─".repeat(50),
      tpl?.footerText || "Issued under the Land Registration Act 2020 (Act 1036).",
      `Issued: ${new Date().toLocaleDateString()}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `certificate-${parcel.parcelNumber}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {tpl && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
          <FileCheck className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-primary font-medium">Using template: <strong>{tpl.name}</strong></p>
        </div>
      )}
      <div className="relative rounded-xl border-2 border-primary/20 overflow-hidden">
        {tpl?.imageData && (
          <img src={tpl.imageData} alt="Template" className="absolute inset-0 w-full h-full object-cover opacity-10" />
        )}
        <div className="relative z-10 bg-gradient-to-br from-primary/5 to-accent/5 p-5">
          <div className="mb-4 text-center border-b border-primary/20 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Republic of Ghana · Techiman North District Assembly</p>
            <h3 className="font-display text-lg font-bold text-primary mt-1">{tpl?.headerText || "LAND USE CERTIFICATE"}</h3>
            <p className="text-xs text-muted-foreground">No: {parcel.parcelNumber}</p>
          </div>
          <div className="space-y-1.5">
            {activeFields.map(({ key, label }) => (
              <div key={key} className="flex justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0">
                <span className="shrink-0 text-muted-foreground">{label}</span>
                <span className="text-right font-medium">{getValue(key)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-primary/20 pt-3 text-center">
            <p className="text-[10px] text-muted-foreground">{tpl?.footerText || "Issued under the Land Registration Act 2020 (Act 1036)."}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={printCertificate} className="flex-1"><Download className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
        <Button variant="outline" onClick={downloadTxt}><Download className="mr-1 h-4 w-4" /> .txt</Button>
      </div>
      {!tpl && (
        <p className="text-center text-xs text-muted-foreground">No template configured. Go to Admin → Certificates to add one.</p>
      )}
    </div>
  );
}

// ── History ──────────────────────────────────────────────────────────────────
function HistoryModal({ parcel }) {
  const [transfers, setTransfers] = useState([]);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  useEffect(() => {
    pb.collection("land_transfers").getFullList({
      filter: `parcel = "${parcel.id}"`, sort: "-created", requestKey: `hist-${parcel.id}`,
      expand: "fromOwner,reviewedBy",
    }).then(setTransfers).catch(() => {});
  }, [parcel.id]);

  const approvedTransfers = transfers.filter((t) => t.status === "approved");

  const history = [
    { date: parcel.created, event: "Parcel registered", by: "Applicant", icon: "🏠" },
    parcel.allocationDate && { date: parcel.allocationDate, event: "Land allocated", by: "Authority", icon: "📋" },
    parcel.registrationDate && { date: parcel.registrationDate, event: "Title registered", by: "Land Registrar", icon: "📜" },
    ...transfers.map((t) => ({
      date: t.updated,
      event: `Transfer ${t.status === "approved" ? "completed" : t.status}: to ${t.toOwnerName || "new owner"}`,
      by: t.expand?.reviewedBy?.fullName || t.expand?.reviewedBy?.email || "Land Registry",
      icon: t.status === "approved" ? "🔄" : "⏳",
      transfer: t,
    })),
    { date: parcel.updated, event: `Current status: ${titleCase(parcel.status)}`, by: "System", icon: "ℹ️" },
  ].filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-4">
      {/* Current Owner Card */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Current Owner</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span><span className="font-medium">Name:</span> {parcel.applicantName || "—"}</span>
          <span><span className="font-medium">Phone:</span> {parcel.contactPhone || "—"}</span>
          {parcel.applicantEmail && <span><span className="font-medium">Email:</span> {parcel.applicantEmail}</span>}
          {parcel.alternateMobile && <span><span className="font-medium">Alt. Mobile:</span> {parcel.alternateMobile}</span>}
          {parcel.whatsapp && <span><span className="font-medium">WhatsApp:</span> {parcel.whatsapp}</span>}
          {parcel.religion && <span><span className="font-medium">Religion:</span> {parcel.religion}</span>}
          {parcel.tribe && <span><span className="font-medium">Tribe:</span> {parcel.tribe}</span>}
        </div>
        {approvedTransfers.length > 0 && (
          <p className="text-xs text-primary font-medium">🔄 {approvedTransfers.length} transfer{approvedTransfers.length !== 1 ? "s" : ""} recorded</p>
        )}
        {(() => {
          const lands = normalizeAdditionalLands(parcel.additionalLands);
          if (!lands.length) return null;
          return (
            <div className="border-t border-primary/20 pt-2 mt-1 space-y-1">
              <p className="text-xs font-semibold text-primary">Additional Lands ({lands.length})</p>
              {lands.map((l, i) => (
                <p key={i} className="text-xs text-muted-foreground">• {l.community || "—"} · {l.areaCouncil || "—"} · {l.sector || "—"} · Plot {l.plotNumber || "—"}/{l.block || "—"}</p>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Timeline */}
      <p className="text-sm font-semibold text-foreground">Ownership Timeline — <span className="text-muted-foreground font-normal">{parcel.parcelNumber}</span></p>
      <ol className="space-y-3 border-l-2 border-primary/20 pl-5">
        {history.map((h, i) => (
          <li key={i} className="relative text-sm">
            <span className="absolute -left-[21px] top-1 text-base leading-none">{h.icon}</span>
            <p className="font-semibold">{h.event}</p>
            <p className="text-xs text-muted-foreground">{h.by} · {formatDate(h.date)}</p>
            {h.transfer && (
              <button onClick={() => setSelectedTransfer(selectedTransfer?.id === h.transfer.id ? null : h.transfer)}
                className="mt-1 text-xs text-primary hover:underline">
                {selectedTransfer?.id === h.transfer.id ? "Hide details ▲" : "View details ▼"}
              </button>
            )}
            {selectedTransfer?.id === h.transfer?.id && (() => {
              const hist = Array.isArray(selectedTransfer.ownershipHistory) ? selectedTransfer.ownershipHistory : [];
              const newOwner = hist.find((e) => e.newOwnerName) || {};
              const oldOwner = hist.find((e) => e.snapshotType === "oldOwner") || {};
              return (
                <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-red-700 dark:text-red-400">Previous Owner</p>
                      {oldOwner.applicantName && <p><span className="text-muted-foreground">Name:</span> {oldOwner.applicantName}</p>}
                      {oldOwner.contactPhone && <p><span className="text-muted-foreground">Phone:</span> {oldOwner.contactPhone}</p>}
                      {oldOwner.applicantEmail && <p><span className="text-muted-foreground">Email:</span> {oldOwner.applicantEmail}</p>}
                      {oldOwner.religion && <p><span className="text-muted-foreground">Religion:</span> {oldOwner.religion}</p>}
                      {oldOwner.tribe && <p><span className="text-muted-foreground">Tribe:</span> {oldOwner.tribe}</p>}
                      {!oldOwner.applicantName && <p className="text-muted-foreground italic">Details from account</p>}
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-green-700 dark:text-green-400">New Owner</p>
                      {newOwner.newOwnerName && <p><span className="text-muted-foreground">Name:</span> {newOwner.newOwnerName}</p>}
                      {newOwner.newOwnerPhone && <p><span className="text-muted-foreground">Phone:</span> {newOwner.newOwnerPhone}</p>}
                      {newOwner.newOwnerEmail && <p><span className="text-muted-foreground">Email:</span> {newOwner.newOwnerEmail}</p>}
                      {newOwner.newOwnerReligion && <p><span className="text-muted-foreground">Religion:</span> {newOwner.newOwnerReligion}</p>}
                      {newOwner.newOwnerTribe && <p><span className="text-muted-foreground">Tribe:</span> {newOwner.newOwnerTribe}</p>}
                      {newOwner.newOwnerAlternateMobile && <p><span className="text-muted-foreground">Alt. Mobile:</span> {newOwner.newOwnerAlternateMobile}</p>}
                    </div>
                  </div>
                  {oldOwner.approvedBy && (
                    <p className="border-t border-border pt-2 text-muted-foreground">
                      Approved by <span className="font-medium text-foreground">{oldOwner.approvedBy}</span> · {formatDate(oldOwner.approvedAt)}
                    </p>
                  )}
                  {selectedTransfer.reason && (
                    <p className="text-muted-foreground">Reason: {selectedTransfer.reason}</p>
                  )}
                </div>
              );
            })()}
          </li>
        ))}
      </ol>

      {/* Previous Owners Summary Table (if any approved transfers) */}
      {approvedTransfers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Previous Owners</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Owner Name</th>
                  <th className="px-3 py-2 text-left font-medium">Contact</th>
                  <th className="px-3 py-2 text-left font-medium">Transfer Date</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedTransfers.map((t) => {
                  const hist = Array.isArray(t.ownershipHistory) ? t.ownershipHistory : [];
                  const oldOwner = hist.find((h) => h.snapshotType === "oldOwner") || {};
                  return (
                    <tr key={t.id} className="border-t border-border">
                      <td className="px-3 py-2">{oldOwner.applicantName || t.expand?.fromOwner?.fullName || t.expand?.fromOwner?.email || "—"}</td>
                      <td className="px-3 py-2">{oldOwner.contactPhone || "—"}</td>
                      <td className="px-3 py-2">{formatDate(t.updated)}</td>
                      <td className="px-3 py-2"><span className="rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-[10px] font-medium dark:bg-green-900/30 dark:text-green-400">Transferred</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transfer Modal ───────────────────────────────────────────────────────────
function TransferModal({ parcel, userId, onClose, onDone, isAdmin }) {
  const { toast } = useToast();
  const allUsersRef = React.useRef([]);
  const [allUsers, setAllUsers] = useState([]);
  // Convert a PocketBase date value (ISO string or "yyyy-mm-dd") to the
  // "yyyy-mm-dd" value an <input type="date"> expects. Returns "" when empty.
  const toDateInput = (v) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [form, setForm] = useState({
    toOwnerUser: "",
    toOwnerName: "",
    toOwnerPhone: "",
    toOwnerAlternateMobile: "",
    toOwnerWhatsapp: "",
    toOwnerEmail: "",
    toOwnerReligion: "",
    toOwnerTribe: "",
    allocationDate: toDateInput(parcel?.allocationDate),
    registrationDate: toDateInput(parcel?.registrationDate),
    reason: "",
    // Payment details captured with the transfer
    paymentAmount: "",
    paymentMethod: "mobile_money",
    paymentStatus: "pending",
    paymentDate: toDateInput(new Date().toISOString()),
    paymentReference: "",
  });
  const [transferLetterFile, setTransferLetterFile] = useState(null);
  const [transferLetterError, setTransferLetterError] = useState("");
  const [saving, setSaving] = useState(false);

  const TRANSFER_FEE = 150; // default suggested transfer processing fee (GHS)

  useEffect(() => {
    pb.collection("users").getFullList({ sort: "fullName", requestKey: "transfer-users" })
      .then((u) => {
        const filtered = u.filter((x) => x.id !== userId);
        setAllUsers(filtered);
        allUsersRef.current = filtered;
      })
      .catch(() => {});
  }, [userId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async () => {
    if (!form.toOwnerName && !form.toOwnerUser) {
      toast({ variant: "destructive", title: "Specify new owner name or select an existing user" });
      return;
    }
    if (!form.toOwnerUser) {
      if (!form.toOwnerPhone) {
        toast({ variant: "destructive", title: "New owner phone is required" });
        return;
      }
      if (!form.toOwnerReligion) {
        toast({ variant: "destructive", title: "New owner religion is required" });
        return;
      }
      if (!form.toOwnerTribe) {
        toast({ variant: "destructive", title: "New owner tribe is required" });
        return;
      }
    }
    if (!transferLetterFile) {
      toast({ variant: "destructive", title: "Transfer letter required", description: "Please attach a transfer letter (PDF, DOC, DOCX, JPG, PNG — max 900KB)." });
      return;
    }
    // Validate allocation & registration dates when provided
    const toIsoDate = (v) => {
      if (!v) return "";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return "";
      return d.toISOString().split("T")[0];
    };
    if (!form.allocationDate) {
      toast({ variant: "destructive", title: "Allocation date is required", description: "Please provide the land allocation date." });
      return;
    }
    if (!form.registrationDate) {
      toast({ variant: "destructive", title: "Registration date is required", description: "Please provide the land registration date." });
      return;
    }
    if (!toIsoDate(form.allocationDate)) {
      toast({ variant: "destructive", title: "Invalid allocation date" });
      return;
    }
    if (!toIsoDate(form.registrationDate)) {
      toast({ variant: "destructive", title: "Invalid registration date" });
      return;
    }
    if (form.allocationDate && form.registrationDate && new Date(form.allocationDate) > new Date(form.registrationDate)) {
      toast({ variant: "destructive", title: "Registration date cannot be before allocation date" });
      return;
    }
    const allocationDateIso = toIsoDate(form.allocationDate);
    const registrationDateIso = toIsoDate(form.registrationDate);
    setSaving(true);
    try {
      // Safety check: surface any pre-existing parcel sharing this
      // Sector + Plot + Block combination (excluding the parcel being transferred).
      const dup = await findExistingParcel(
        { plotNumber: parcel.plotNumber, block: parcel.block, sector: parcel.sector },
        "transfer-dupchk",
        parcel.id,
      );
      if (dup) {
        toast({ variant: "destructive", title: "Duplicate land identity", description: `Another parcel (${dup.parcelNumber}) already shares Sector ${parcel.sector || "—"}, Plot ${parcel.plotNumber}, Block ${parcel.block}. Resolve the duplicate before transferring.` });
        setSaving(false);
        return;
      }
      const selectedUser = form.toOwnerUser ? allUsersRef.current.find((u) => u.id === form.toOwnerUser) : null;
      const ownershipHistory = {
        previousOwner: parcel.expand?.owner?.fullName || parcel.owner,
        previousOwnerId: parcel.owner,
        transferDate: new Date().toISOString(),
      };
      // Trim values to the exact PocketBase field limits — over-long strings
      // are the usual cause of a 400 "Failed to create record".
      const clamp = (v, max) => String(v ?? "").trim().slice(0, max);
      const newOwnerName = clamp(selectedUser ? (selectedUser.fullName || selectedUser.email) : form.toOwnerName, 200);
      const newOwnerPhone = clamp(selectedUser ? (selectedUser.phone || form.toOwnerPhone) : form.toOwnerPhone, 30);
      if (!newOwnerName) {
        toast({ variant: "destructive", title: "New owner name is required" });
        setSaving(false);
        return;
      }
      if (!userId) {
        toast({ variant: "destructive", title: "Session expired", description: "Please sign in again to submit a transfer." });
        setSaving(false);
        return;
      }
      const fd = new FormData();
      fd.append("parcel", parcel.id);
      fd.append("fromOwner", userId);
      if (form.toOwnerUser) fd.append("toOwnerUser", form.toOwnerUser);
      fd.append("toOwnerName", newOwnerName);
      fd.append("toOwnerPhone", newOwnerPhone);
      fd.append("reason", clamp(form.reason, 1000));
      fd.append("ownershipHistory", JSON.stringify([{
        ...ownershipHistory,
        newOwnerName,
        newOwnerPhone,
        newOwnerEmail: form.toOwnerEmail,
        newOwnerReligion: form.toOwnerReligion,
        newOwnerTribe: form.toOwnerTribe,
        newOwnerAlternateMobile: form.toOwnerAlternateMobile,
        newOwnerWhatsapp: form.toOwnerWhatsapp,
        allocationDate: allocationDateIso,
        registrationDate: registrationDateIso,
      }]));
      // Admin transfers are auto-approved immediately
      fd.append("status", isAdmin ? "approved" : "pending");
      const certNum = clamp(`TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`, 80);
      fd.append("certificateNumber", certNum);
      if (transferLetterFile) fd.append("transferLetter", transferLetterFile);
      const trf = await pb.collection("land_transfers").create(fd, { requestKey: `trf-create-${parcel.id}` });

      // Create a linked payment record when a payment amount was provided
      const payAmount = parseFloat(form.paymentAmount);
      if (payAmount > 0) {
        try {
          await pb.collection("payments").create({
            payer: userId,
            parcel: parcel.id,
            transfer: trf.id,
            invoiceNumber: `INV-${certNum}`,
            purpose: "transfer_fee",
            amount: payAmount,
            method: form.paymentMethod || "mobile_money",
            status: form.paymentStatus || "pending",
            parcelNumber: parcel.parcelNumber || "",
            plotNumber: parcel.plotNumber || "",
            block: parcel.block || "",
            areaCouncil: parcel.areaCouncil || "",
            community: parcel.community || "",
            sector: parcel.sector || "",
            ownerName: newOwnerName,
            ownerPhone: newOwnerPhone,
            ownerEmail: form.toOwnerEmail || "",
          }, { requestKey: `trf-pay-${trf.id}` });
        } catch (_) {}
      }

      if (isAdmin) {
        // Apply ownership change immediately
        const parcelUpdates = {};
        if (form.toOwnerUser) parcelUpdates.owner = form.toOwnerUser;
        if (newOwnerName) parcelUpdates.applicantName = newOwnerName;
        if (newOwnerPhone) parcelUpdates.contactPhone = newOwnerPhone;
        if (form.toOwnerEmail) parcelUpdates.applicantEmail = form.toOwnerEmail;
        if (form.toOwnerReligion) parcelUpdates.religion = form.toOwnerReligion;
        if (form.toOwnerTribe) parcelUpdates.tribe = form.toOwnerTribe;
        if (allocationDateIso) parcelUpdates.allocationDate = allocationDateIso;
        if (registrationDateIso) parcelUpdates.registrationDate = registrationDateIso;
        await pb.collection("parcels").update(parcel.id, parcelUpdates, { requestKey: `admin-trf-${trf.id}` });
        await pb.collection("land_transfers").update(trf.id, { reviewedBy: userId, reviewComment: "Auto-approved by Admin" }, { requestKey: `admin-trf-review-${trf.id}` });
      }
      toast({ title: isAdmin ? "Transfer applied immediately" : "Transfer request submitted", description: isAdmin ? "Ownership updated. Transfer certificate reference: " + certNum : "Awaiting approval from Land Registrar or Admin." });

      // Notify registration officers / planning officers / admins of the new transfer request
      if (!isAdmin) {
        try {
          const officers = await pb.collection("users").getFullList({
            filter: "role = 'registrar' || role = 'planning_officer' || role = 'admin'",
            requestKey: `trf-officers-${Date.now()}`,
          });
          const landDesc = `${parcel.community || "—"} · Sector ${parcel.sector || "—"} · Plot ${parcel.plotNumber || "—"}/${parcel.block || "—"}`;
          const officerMsg = `New transfer request: ${parcel.parcelNumber} (${landDesc}) from ${parcel.applicantName || "—"} to ${newOwnerName}. Ref: ${certNum}. Please review. - TeNDA PPD`;
          for (const off of officers) {
            await notify(off.id, `New transfer request ${certNum} for ${parcel.parcelNumber} pending review.`, "/app/transfer-requests").catch(() => {});
            const offPhone = off.phone || off.whatsappNumber;
            if (offPhone) await sendSms(offPhone, officerMsg).catch(() => {});
          }
        } catch (_) {}
      }

      onDone?.();
      onClose();
    } catch (err) {
      // Surface PocketBase field-level validation details so the cause is visible.
      const data = err?.response?.data || err?.data?.data || {};
      const details = Object.entries(data)
        .map(([k, v]) => `${k}: ${v?.message || v}`)
        .join(" · ");
      toast({
        variant: "destructive",
        title: "Failed to create transfer",
        description: details || err?.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pr-1">
      <div className={isAdmin ? "rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800" : "rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800"}>
        <AlertTriangle className="inline h-4 w-4 mr-1" />
        {isAdmin ? "Admin transfer: ownership will be updated immediately without approval." : "Transfers require approval from the Land Registrar or Admin."}
      </div>

      {/* ── Confirmation: land being transferred (read-only) ── */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Land Being Transferred (confirmation)</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <ReadField label="Land ID" value={parcel?.parcelNumber} />
          <ReadField label="Community" value={parcel?.community} />
          <ReadField label="Sector" value={parcel?.sector} />
          <ReadField label="Plot Number" value={parcel?.plotNumber} />
          <ReadField label="Block" value={parcel?.block} />
          <ReadField label="Area Council" value={parcel?.areaCouncil} />
          <ReadField label="Status" value={parcel?.status ? titleCase(parcel.status) : "—"} />
          <ReadField label="Office" value={parcel?.office} />
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 border-t border-border pt-3">
          <ReadField label="Current Owner" value={parcel?.applicantName} />
          <ReadField label="Owner Contact" value={parcel?.contactPhone} />
          <ReadField label="Allocation Date" value={parcel?.allocationDate ? formatDate(parcel.allocationDate) : "—"} />
          <ReadField label="Registration Date" value={parcel?.registrationDate ? formatDate(parcel.registrationDate) : "—"} />
        </div>
      </div>

      <FF label={<span>Transfer Letter <span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(PDF, DOC, DOCX, JPG, PNG — max 900KB)</span></span>}>
        <div className="space-y-1.5">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setTransferLetterError("");
              if (!file) { setTransferLetterFile(null); return; }
              const allowed = ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/jpeg","image/png"];
              if (!allowed.includes(file.type)) {
                setTransferLetterError("Invalid file type. Accepted: PDF, DOC, DOCX, JPG, PNG.");
                setTransferLetterFile(null);
                e.target.value = "";
                return;
              }
              if (file.size > 921600) {
                setTransferLetterError(`File too large (${(file.size/1024).toFixed(0)}KB). Maximum size is 900KB.`);
                setTransferLetterFile(null);
                e.target.value = "";
                return;
              }
              setTransferLetterFile(file);
            }}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
          />
          {transferLetterError && <p className="text-xs text-destructive">{transferLetterError}</p>}
          {transferLetterFile && <p className="text-xs text-blue-700">Selected: {transferLetterFile.name} ({(transferLetterFile.size/1024).toFixed(0)}KB)</p>}
        </div>
      </FF>

      <FF label="New Owner (existing user — optional)">
        <Select value={form.toOwnerUser || "none"} onValueChange={(v) => setForm((f) => ({ ...f, toOwnerUser: v === "none" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="Select registered user (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Enter manually below —</SelectItem>
            {allUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName || u.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </FF>

      {!form.toOwnerUser && (
        <>
          <FGroup label="New Owner Personal Information" />
          <FRow>
            <FF label="Full Legal Name" required>
              <Input value={form.toOwnerName} onChange={set("toOwnerName")} placeholder="Full legal name" />
            </FF>
            <FF label="Mobile Number" required>
              <Input value={form.toOwnerPhone} onChange={set("toOwnerPhone")} placeholder="+233 XX XXX XXXX" />
            </FF>
          </FRow>
          <FRow>
            <FF label="Alternate Mobile">
              <Input value={form.toOwnerAlternateMobile} onChange={set("toOwnerAlternateMobile")} placeholder="+233 XX XXX XXXX" />
            </FF>
            <FF label="WhatsApp (Optional)">
              <Input value={form.toOwnerWhatsapp} onChange={set("toOwnerWhatsapp")} placeholder="+233 XX XXX XXXX" />
            </FF>
          </FRow>
          <FF label="Email Address (Optional)">
            <Input type="text" value={form.toOwnerEmail} onChange={set("toOwnerEmail")} placeholder="newowner@example.com" />
          </FF>
          <FRow>
            <FF label="Religion" required>
              <OtherSelect options={RELIGIONS} value={form.toOwnerReligion} onChange={(v) => setForm((f) => ({ ...f, toOwnerReligion: v }))} placeholder="Select religion" inputLabel="Specify religion" inputPlaceholder="Enter religion" required />
            </FF>
            <FF label="Tribe" required>
              <OtherSelect options={TRIBES} value={form.toOwnerTribe} onChange={(v) => setForm((f) => ({ ...f, toOwnerTribe: v }))} placeholder="Select tribe" inputLabel="Specify tribe" inputPlaceholder="Enter tribe" required />
            </FF>
          </FRow>
        </>
      )}

      <FF label="Transfer Reason">
        <Input value={form.reason} onChange={set("reason")} placeholder="e.g. Sale, inheritance, gift…" />
      </FF>

      <FGroup label="Land Dates (transferred with the parcel)" />
      <FRow>
        <FF label={<span>Allocation Date <span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(from land record)</span></span>}>
          <Input
            type="date"
            required
            value={form.allocationDate}
            onChange={set("allocationDate")}
            max={form.registrationDate || undefined}
          />
        </FF>
        <FF label={<span>Registration Date <span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(from land record)</span></span>}>
          <Input
            type="date"
            required
            value={form.registrationDate}
            onChange={set("registrationDate")}
            min={form.allocationDate || undefined}
          />
        </FF>
      </FRow>

      {/* ── Payment details for the transfer ── */}
      <FGroup label="Transfer Payment Details" />
      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
        <FRow>
          <FF label={<span>Payment Amount (GHS) <span className="text-xs font-normal text-muted-foreground">(suggested fee: GHS {TRANSFER_FEE})</span></span>}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.paymentAmount}
              onChange={set("paymentAmount")}
              placeholder={String(TRANSFER_FEE)}
            />
          </FF>
          <FF label="Payment Method">
            <Select value={form.paymentMethod} onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["mobile_money", "card", "bank_transfer", "cash"].map((m) => (
                  <SelectItem key={m} value={m}>{titleCase(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FF>
        </FRow>
        <FRow>
          <FF label="Payment Status">
            <Select value={form.paymentStatus} onValueChange={(v) => setForm((f) => ({ ...f, paymentStatus: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["pending", "paid", "failed", "refunded"].map((s) => (
                  <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FF>
          <FF label="Payment Date">
            <Input type="date" value={form.paymentDate} onChange={set("paymentDate")} />
          </FF>
        </FRow>
        <FF label="Payment Reference (Optional)">
          <Input value={form.paymentReference} onChange={set("paymentReference")} placeholder="e.g. MoMo transaction ID" />
        </FF>

        {/* Payment summary + status indicator */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Payment Summary</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Transfer fee</span>
            <span className="font-mono">GHS {(parseFloat(form.paymentAmount) || 0).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Total payable</span>
            <span className="font-mono">GHS {(parseFloat(form.paymentAmount) || 0).toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
                form.paymentStatus === "paid"
                  ? "border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-900/30"
                  : form.paymentStatus === "failed"
                    ? "border-red-300 bg-red-50 text-red-800 dark:bg-red-900/30"
                    : "border-yellow-300 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30",
              )}
            >
              {form.paymentStatus === "paid" ? <FileCheck className="h-3 w-3" /> : form.paymentStatus === "failed" ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {titleCase(form.paymentStatus)}
            </span>
            <span className="text-muted-foreground">{titleCase(form.paymentMethod)}</span>
            {form.paymentDate && <span className="text-muted-foreground">{formatDate(form.paymentDate)}</span>}
            {form.paymentReference && <span className="text-muted-foreground truncate">Ref: {form.paymentReference}</span>}
          </div>
          {!(parseFloat(form.paymentAmount) > 0) && (
            <p className="text-xs text-muted-foreground">No payment amount entered — no payment record will be created for this transfer.</p>
          )}
        </div>
      </div>

      <DuplicateCheck
        type="transfer"
        label="Check for duplicate transfer"
        getData={() => ({ parcelId: parcel.id, toOwnerName: form.toOwnerName, toOwnerUser: form.toOwnerUser })}
      />
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={submit} disabled={saving} className="flex-1">
          {saving ? (isAdmin ? "Applying…" : "Submitting…") : (isAdmin ? "Apply Transfer Now" : "Submit Transfer Request")}
        </Button>
      </div>
    </div>
  );
}

// ── Edit Request Modal (for registered parcels) ──────────────────────────────
function EditRequestModal({ parcel, userId, onClose, onDone }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    applicantName: parcel.applicantName || "", contactPhone: parcel.contactPhone || "",
    alternateMobile: parcel.alternateMobile || "", alternateNumber2: parcel.alternateNumber2 || "", whatsapp: parcel.whatsapp || "",
    applicantEmail: parcel.applicantEmail || "", religion: parcel.religion || "",
    tribe: parcel.tribe || "", areaCouncil: parcel.areaCouncil || "",
    community: parcel.community || "", sector: parcel.sector || "",
    plotNumber: parcel.plotNumber || "", block: parcel.block || "",
    allocationDate: parcel.allocationDate?.split(" ")[0] || "",
    registrationDate: parcel.registrationDate?.split(" ")[0] || "",
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async () => {
    setSaving(true);
    try {
      // Duplicate check: Sector + Plot + Block must not match another parcel
      const existing = await findExistingParcel(
        { plotNumber: form.plotNumber, block: form.block, sector: form.sector },
        "editreq-dupchk",
        parcel.id,
      );
      if (existing) {
        toast({ variant: "destructive", title: "Duplicate combination", description: `Another parcel with Sector ${form.sector || "—"}, Plot ${form.plotNumber}, Block ${form.block} already exists (Land ID: ${existing.parcelNumber}). Use a different Sector/Plot/Block combination.` });
        setSaving(false);
        return;
      }
      await pb.collection("land_edit_requests").create({
        parcel: parcel.id,
        requestedBy: userId,
        type: "edit",
        proposedChanges: form,
        reason,
        status: "pending",
      });
      toast({ title: "Edit request submitted", description: "Awaiting approval from Planning Officer or Admin." });
      onDone?.();
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
        <AlertTriangle className="inline h-4 w-4 mr-1" />
        Edits to registered parcels require approval from Planning Officer or Admin.
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.entries(form).map(([k, v]) => (
          <FF key={k} label={titleCase(k)}>
            <Input value={v} onChange={set(k)} placeholder={k} type={k.includes("Date") ? "date" : "text"} />
          </FF>
        ))}
      </div>
      <FF label="Reason for edit" required>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain the reason for this change" />
      </FF>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={submit} disabled={saving} className="flex-1">{saving ? "Submitting…" : "Submit Edit Request"}</Button>
      </div>
    </div>
  );
}

// ── Approvals Panel ──────────────────────────────────────────────────────────
function ApprovalsPanel({ userId, isApprover }) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [reqs, trfs] = await Promise.all([
        pb.collection("land_edit_requests").getFullList({
          filter: isApprover ? "status = 'pending'" : `requestedBy = "${userId}" && status = 'pending'`,
          sort: "-created", expand: "parcel,requestedBy", requestKey: "approvals-reqs",
        }),
        pb.collection("land_transfers").getFullList({
          filter: isApprover ? "status = 'pending'" : `fromOwner = "${userId}" && status = 'pending'`,
          sort: "-created", expand: "parcel,fromOwner", requestKey: "approvals-trfs",
        }),
      ]);
      setRequests(reqs);
      setTransfers(trfs);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [isApprover, userId]);

  const total = requests.length + transfers.length;
  if (total === 0 && !loading) return null;

  // The Approvals page (/app/approvals) is the single approval workspace.
  // This panel only surfaces pending counts and links there — no inline actions.
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-100/60 px-5 py-3">
        <Bell className="h-4 w-4 text-blue-700" />
        <h3 className="font-display text-sm font-semibold text-blue-900">
          {isApprover ? "Pending Approvals" : "My Pending Requests"} ({total})
        </h3>
        <Button size="sm" className="ml-auto h-7 text-xs" onClick={() => navigate("/app/approvals")}>
          Review in Approvals <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
      {loading ? <div className="p-4"><Spinner /></div> : (
        <div className="divide-y divide-blue-200">
          {requests.map((req) => (
            <div key={req.id} className="px-5 py-4">
              <p className="text-sm font-medium">
                {titleCase(req.type)} request — {req.expand?.parcel?.parcelNumber || req.parcel}
              </p>
              {isApprover && req.expand?.requestedBy && (
                <p className="text-xs text-muted-foreground">By: {req.expand.requestedBy.fullName || req.expand.requestedBy.email}</p>
              )}
              {req.reason && <p className="text-xs text-muted-foreground mt-0.5">Reason: {req.reason}</p>}
              <p className="text-xs text-muted-foreground">{formatDate(req.created)}</p>
            </div>
          ))}
          {transfers.map((trf) => (
            <div key={trf.id} className="px-5 py-4">
              <p className="text-sm font-medium">
                Transfer request — {trf.expand?.parcel?.parcelNumber || trf.parcel}
              </p>
              <p className="text-xs text-muted-foreground">To: {trf.toOwnerName || "—"} {trf.toOwnerPhone && `(${trf.toOwnerPhone})`}</p>
              {trf.reason && <p className="text-xs text-muted-foreground">Reason: {trf.reason}</p>}
              <p className="text-xs text-muted-foreground">{formatDate(trf.created)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Parcel card ──────────────────────────────────────────────────────────────
function ParcelCard({ p, isStaff, isCitizen, isApprover, isAdmin, isDeleted, isTransferred, transferInfo,
  onCert, onHistory, onEdit, onSetStatus, onDispute, onTransfer, onDelete, onRestore, onPermDelete, viewMode = "medium", visibleCols }) {
  const [expanded, setExpanded] = useState(false);
  const [listExpanded, setListExpanded] = useState(false);

  // Color grading
  const cardClass = isDeleted
    ? "rounded-2xl border-2 border-red-300 bg-red-50/80 shadow-sm"
    : isTransferred
    ? "rounded-2xl border-2 border-blue-300 bg-blue-50/70 shadow-sm"
    : "rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow";

  // Small view
  if (viewMode === "small") {
    return (
      <div className={cn(cardClass, "p-3")}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="font-mono text-[10px] text-muted-foreground truncate">{p.parcelNumber}</p>
          <div className="flex gap-1 shrink-0">
            {isDeleted && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide">Deleted</span>}
            {isTransferred && <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide">Transferred</span>}
            {!isDeleted && <StatusBadge status={p.status} />}
          </div>
        </div>
        <p className="text-xs font-semibold truncate">{p.applicantName || "—"}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Plot {p.plotNumber || "—"} · Block {p.block || "—"}</p>
        <div className="flex gap-1 mt-2">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => onHistory(p)}><Clock className="h-3 w-3" /></Button>
          {isDeleted && isApprover && <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-blue-700" onClick={() => onRestore(p)}><RotateCcw className="h-3 w-3" /></Button>}
          {isDeleted && isAdmin && <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-700" title="Permanently delete" onClick={() => onPermDelete(p)}><Trash2 className="h-3 w-3" /></Button>}
        </div>
      </div>
    );
  }

  // List view (table row style) with column visibility
  if (viewMode === "list") {
    const colVal = (key) => {
      if (key === "status") return null; // rendered separately
      if (key === "registrationDate" || key === "allocationDate") return p[key] ? formatDate(p[key]) : "—";
      return p[key] || "—";
    };
    const visibleDataCols = (visibleCols || new Set(["parcelNumber","applicantName","areaCouncil","community","plotNumber","block","status"]));
    const allCols = ALL_PARCEL_COLUMNS;
    const shown = allCols.filter((c) => visibleDataCols.has(c.key) && c.key !== "status" && c.key !== "parcelNumber" && c.key !== "applicantName");
    return (
      <div className={cn(cardClass, "px-4 py-2.5 rounded-xl")}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-28 shrink-0">
            <p className="font-mono text-[11px] text-muted-foreground truncate">{p.parcelNumber}</p>
          </div>
          <div className="w-40 shrink-0 min-w-0">
            <p className="text-sm font-semibold truncate">{p.applicantName || "—"}</p>
          </div>
          {shown.map((c) => (
            <div key={c.key} className="hidden md:block min-w-0 flex-1 text-xs text-muted-foreground truncate" title={colVal(c.key)}>
              <span className="font-medium text-foreground/60">{c.label}:</span> {colVal(c.key)}
            </div>
          ))}
          <div className="flex items-center gap-1 shrink-0">
            {isDeleted && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Deleted</span>}
            {isTransferred && <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Transferred</span>}
            {!isDeleted && visibleDataCols.has("status") && <StatusBadge status={p.status} />}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View history" onClick={() => onHistory(p)}><Clock className="h-3.5 w-3.5" /></Button>
            {isStaff && !isDeleted && <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>}
            {isStaff && !isDeleted && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" title={isAdmin ? "Permanently delete" : "Delete"} onClick={() => onDelete(p)}><Trash2 className="h-3.5 w-3.5" /></Button>}
            {isDeleted && isApprover && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-700" onClick={() => onRestore(p)}><RotateCcw className="h-3.5 w-3.5" /></Button>}
            {isDeleted && isAdmin && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-700" title="Permanently delete" onClick={() => onPermDelete(p)}><Trash2 className="h-3.5 w-3.5" /></Button>}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" title="Expand details" onClick={() => setListExpanded((v) => !v)}>
              {listExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        {/* Mobile row */}
        <div className="md:hidden text-xs text-muted-foreground mt-1 truncate">
          {p.areaCouncil && <span>{p.areaCouncil}</span>}
          {p.community && <span> · {p.community}</span>}
          {p.plotNumber && <span> · Plot {p.plotNumber}</span>}
          {p.block && <span>/{p.block}</span>}
        </div>
        {listExpanded && (
          <div className="mt-2 pt-2 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {ALL_PARCEL_COLUMNS.map((c) => {
              const val = c.key === "status" ? p.status : (c.key === "registrationDate" || c.key === "allocationDate") ? (p[c.key] ? formatDate(p[c.key]) : null) : p[c.key];
              if (!val) return null;
              return <div key={c.key} className="truncate"><span className="font-medium text-foreground/70">{c.label}:</span> {val}</div>;
            })}
            {isTransferred && transferInfo && (
              <div className="col-span-full mt-1 p-2 rounded bg-blue-50 text-blue-800 border border-blue-200">
                Transferred to: {transferInfo.toOwnerName || "—"} {transferInfo.certificateNumber ? `(Ref: ${transferInfo.certificateNumber})` : ""}
              </div>
            )}
            {(() => {
              const lands = normalizeAdditionalLands(p.additionalLands);
              if (!lands.length) return null;
              return (
                <div className="col-span-full mt-1 p-2 rounded bg-muted/40 border border-border">
                  <p className="font-medium text-foreground/70 mb-0.5">Additional Lands ({lands.length}):</p>
                  {lands.map((l, i) => (
                    <div key={i}>• {l.community || "—"} · {l.areaCouncil || "—"} · {l.sector || "—"} · Plot {l.plotNumber || "—"}/{l.block || "—"}</div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // Large view
  const isLarge = viewMode === "large";

  return (
    <div className={cn(cardClass)}>
      <div className="p-5">
        {/* Status strips */}
        {(isDeleted || isTransferred) && (
          <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-xs font-semibold",
            isDeleted ? "bg-red-100 text-red-800 border border-red-200" : "bg-blue-100 text-blue-800 border border-blue-200")}>
            {isDeleted ? <><Trash2 className="h-3.5 w-3.5" /> DELETED RECORD — this land has been soft-deleted</> 
              : <><ArrowRightLeft className="h-3.5 w-3.5" /> TRANSFERRED — ownership changed on {transferInfo?.updated ? formatDate(transferInfo.updated) : "—"}</>}
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{p.parcelNumber}</p>
            <h3 className="mt-0.5 truncate font-display text-base font-semibold">{p.applicantName || "—"}</h3>
            {isTransferred && transferInfo && (
              <p className="text-[10px] text-blue-700 mt-0.5">Ref: {transferInfo.certificateNumber || "—"}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {isDeleted && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">Deleted</span>}
            {isTransferred && <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">Transferred</span>}
            {!isDeleted && <StatusBadge status={p.status} />}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
          {p.areaCouncil && <span><span className="font-medium text-foreground/70">Area Council:</span> {p.areaCouncil}</span>}
          {p.community && <span><span className="font-medium text-foreground/70">Community:</span> {p.community}</span>}
          {p.sector && <span><span className="font-medium text-foreground/70">Sector:</span> {p.sector}</span>}
          {p.plotNumber && <span><span className="font-medium text-foreground/70">Plot:</span> {p.plotNumber}</span>}
          {p.block && <span><span className="font-medium text-foreground/70">Block:</span> {p.block}</span>}
          {p.contactPhone && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {p.contactPhone}</span>}
        </div>

        {(expanded || isLarge) && (
          <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
            {p.alternateMobile && <div><span className="font-medium text-foreground/70">Alt Mobile:</span> {p.alternateMobile}</div>}
            {p.alternateNumber2 && <div><span className="font-medium text-foreground/70">Alt No. 2:</span> {p.alternateNumber2}</div>}
            {p.whatsapp && <div><span className="font-medium text-foreground/70">WhatsApp:</span> {p.whatsapp}</div>}
            {p.applicantEmail && <div><span className="font-medium text-foreground/70">Email:</span> {p.applicantEmail}</div>}
            {p.religion && <div><span className="font-medium text-foreground/70">Religion:</span> {p.religion}</div>}
            {p.tribe && <div><span className="font-medium text-foreground/70">Tribe:</span> {p.tribe}</div>}
            {p.allocationDate && <div><span className="font-medium text-foreground/70">Allocation Date:</span> {formatDate(p.allocationDate)}</div>}
            {p.registrationDate && <div><span className="font-medium text-foreground/70">Registration Date:</span> {formatDate(p.registrationDate)}</div>}
            {(() => {
              const lands = normalizeAdditionalLands(p.additionalLands);
              if (!lands.length) return null;
              return (
                <div className="border-t border-border pt-1.5 mt-1 space-y-1">
                  <p className="font-medium text-foreground/70">Additional Lands ({lands.length}):</p>
                  {lands.map((l, i) => (
                    <div key={i} className="pl-2">• {l.community || "—"} · {l.areaCouncil || "—"} · {l.sector || "—"} · Plot {l.plotNumber || "—"}/{l.block || "—"}</div>
                  ))}
                </div>
              );
            })()}
            {isStaff && p.expand?.owner && <div className="border-t border-border pt-1.5 mt-1"><span className="font-medium text-foreground/70">Registered Owner:</span> {p.expand.owner.fullName || p.expand.owner.email}</div>}
            {isTransferred && transferInfo && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 mt-2 space-y-1">
                <p className="font-semibold text-blue-800">Transfer Details</p>
                {transferInfo.toOwnerName && <p><span className="font-medium text-blue-700">New Owner:</span> {transferInfo.toOwnerName}</p>}
                {transferInfo.toOwnerPhone && <p><span className="font-medium text-blue-700">New Phone:</span> {transferInfo.toOwnerPhone}</p>}
                {transferInfo.certificateNumber && <p><span className="font-medium text-blue-700">Reference:</span> {transferInfo.certificateNumber}</p>}
              </div>
            )}
          </div>
        )}

        {!isLarge && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {formatDate(p.created)}
            </span>
            <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? "Less" : "More"}
            </button>
          </div>
        )}

        {/* Actions — hidden for deleted unless restoring */}
        {isDeleted ? (
          isApprover && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-red-200 pt-3">
              <Button size="sm" variant="outline" className="text-blue-800 border-blue-200 hover:bg-blue-50" onClick={() => onRestore(p)}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore Record
              </Button>
              <Button size="sm" variant="outline" onClick={() => onHistory(p)}>
                <Clock className="mr-1 h-3.5 w-3.5" /> History
              </Button>
              {isAdmin && (
                <Button size="sm" variant="outline" className="text-red-700 border-red-300 hover:bg-red-100 font-semibold" onClick={() => onPermDelete(p)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Permanent Delete
                </Button>
              )}
            </div>
          )
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onHistory(p)}>
              <Clock className="mr-1 h-3.5 w-3.5" /> History
            </Button>
            {p.status === "registered" && (
              <Button size="sm" variant="outline" onClick={() => onCert(p)}>
                <Download className="mr-1 h-3.5 w-3.5" /> Certificate
              </Button>
            )}
            {isStaff && (
              <Button size="sm" variant="outline" onClick={() => onEdit(p)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {isApprover ? "Amend" : "Request Edit"}
              </Button>
            )}
            {(p.status === "registered") && isStaff && (
              <Button size="sm" variant="outline" onClick={() => onTransfer(p)}>
                <ArrowRightLeft className="mr-1 h-3.5 w-3.5" /> Transfer
              </Button>
            )}
            {isStaff && p.status !== "registered" && p.status !== "rejected" && (
              <Button size="sm" onClick={() => onSetStatus(p.id, "registered")}>
                <FileCheck className="mr-1 h-3.5 w-3.5" /> Register
              </Button>
            )}
            {isStaff && p.status !== "disputed" && p.status !== "rejected" && (
              <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => onDispute(p)}>
                <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Dispute
              </Button>
            )}
            {isStaff && p.status === "disputed" && (
              <Button size="sm" variant="outline" onClick={() => onSetStatus(p.id, "under_review")}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Resolve
              </Button>
            )}
            {isStaff && (
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => onDelete(p)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> {isAdmin ? "Delete" : isApprover ? "Soft Delete" : "Request Delete"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CSV Import ───────────────────────────────────────────────────────────────
// ── Hierarchy alignment helper ───────────────────────────────────────────────
// Case-insensitive best-match: exact → starts-with → includes
function alignToSystem(input, systemItems) {
  if (!input || !systemItems || systemItems.length === 0) return input;
  const norm = (s) => (s || "").toLowerCase().trim();
  const inp = norm(input);
  if (!inp) return input;
  // exact
  let match = systemItems.find((item) => norm(item.name) === inp);
  if (match) return match.name;
  // starts-with
  match = systemItems.find((item) => norm(item.name).startsWith(inp) || inp.startsWith(norm(item.name)));
  if (match) return match.name;
  // includes
  match = systemItems.find((item) => norm(item.name).includes(inp) || inp.includes(norm(item.name)));
  if (match) return match.name;
  return input; // return original if no match
}

function ImportModal({ userId, onDone, onClose }) {
  const { log } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const cancelRef = useRef(false);
  const [results, setResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState(null); // store parsed data in state
  const [sourceFile, setSourceFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [sheetName, setSheetName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [validation, setValidation] = useState(null);
  const [parseError, setParseError] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("landImportHistory") || "[]"); } catch { return []; }
  });
  const { offices, areaCouncils, communities, sectors } = useHierarchy();

  const TEMPLATE_HEADERS = [
    "applicantName", "contactPhone", "alternateMobile", "whatsapp", "applicantEmail",
    "religion", "tribe", "office", "areaCouncil", "community", "sector",
    "plotNumber", "block", "allocationDate", "registrationDate",
  ];

  const downloadTemplate = () => {
    const sample = [
      "Ama Serwaa", "0244123456", "0554987654", "0244123456", "ama@email.com",
      "Christian", "Akan", "Tuobodom Office", "Tuobodom", "Tanoso", "Sector 2",
      "12/A", "", "2024-01-15", "2024-03-20",
    ];
    const csv = [TEMPLATE_HEADERS.join(","), sample.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "land-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Template downloaded", description: "Tip: Plot column supports 123/A format — Block is auto-extracted." });
  };


  // Parse date: accepts YYYY-MM-DD, dd/mm/yyyy, mm/dd/yyyy, dd-mm-yyyy
  const parseSmartDate = (str) => normaliseDate(str);

  // Parse phone field: supports "/" as separator between multiple contacts
  // "0501234567" → { mobile: "0501234567", alternate: "", alternate2: "" }
  // "0501234567/0509876543" → { mobile: "0501234567", alternate: "0509876543", alternate2: "" }
  // "0501234567/0509876543/0502468135" → { mobile: "0501234567", alternate: "0509876543", alternate2: "0502468135" }
  // 4th+ contacts are ignored; first = primary, second = alternate, third = alternate2
  const parsePhoneField = (str) => {
    if (!str || !str.trim()) return { mobile: "", alternate: "", alternate2: "" };
    const raw = str.trim();
    // Split by "/" (all occurrences); first = primary, second = alternate, third = alternate2
    const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
    return {
      mobile: parts[0] || "",
      alternate: parts[1] || "",
      alternate2: parts[2] || "",
    };
  };

  // Parse plot/block from slash notation
  const parsePlotBlock = (row) => {
    let plotNumber = row.plotNumber || "";
    let block = row.block || "";
    if (plotNumber.includes("/")) {
      const parts = plotNumber.split("/");
      plotNumber = parts[0].trim();
      if (!block) block = parts.slice(1).join("/").trim();
    }
    // Parse phone fields (supports // double-slash separator)
    const phoneData = parsePhoneField(row.contactPhone || "");
    const contactPhone = phoneData.mobile || row.contactPhone || "";
    const alternateMobile = row.alternateMobile || phoneData.alternate || "";
    const alternateNumber2 = row.alternateNumber2 || phoneData.alternate2 || "";
    // Parse dates
    const allocationDate = parseSmartDate(row.allocationDate);
    const registrationDate = parseSmartDate(row.registrationDate);
    return { ...row, plotNumber, block, contactPhone, alternateMobile, alternateNumber2, allocationDate, registrationDate };
  };

  const loadFile = async (file, sheet) => {
    if (!file) return;
    setLoadingFile(true);
    setParseError("");
    try {
      const parsed = await parseImportFile(file, sheet);
      const normalised = parsed.rows.map((r) => parsePlotBlock(r));
      const report = validateRows(normalised, { offices, areaCouncils, communities, sectors });
      setSourceFile(file);
      setFileInfo({ name: file.name, size: file.size, kind: parsed.kind });
      setSheets(parsed.sheets || []);
      setSheetName(parsed.sheetName || "");
      setHeaders(parsed.headers || []);
      setParsedRows(parsed.rows);
      setValidation(report);
      setResults(null);
      logImport("file:ready", `${parsed.rows.length} rows, ${report.invalid} invalid`);
      toast({ title: `${parsed.rows.length} rows ready`, description: report.invalid > 0 ? `${report.invalid} row(s) need attention.` : "Review the preview, then start the import." });
    } catch (err) {
      logImport("file:error", err?.message || String(err));
      setParsedRows(null);
      setValidation(null);
      setFileInfo(file ? { name: file.name, size: file.size, kind: fileKind(file) } : null);
      setParseError(err?.message || "Could not read this file");
      toast({ variant: "destructive", title: "Import file could not be read", description: err?.message || "Unknown error" });
    } finally {
      setLoadingFile(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) void loadFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void loadFile(file);
  };

  const changeSheet = (name) => { setSheetName(name); if (sourceFile) void loadFile(sourceFile, name); };

  const [importProgress, setImportProgress] = useState(null);

  const doImport = async () => {
    if (!parsedRows || parsedRows.length === 0) {
      toast({ variant: "destructive", title: "No data to import", description: "Please select a valid CSV file first." });
      return;
    }

    cancelRef.current = false;
    setImporting(true);
    startOperation();
    const startTime = Date.now();
    let created = 0, updated = 0, skipped = 0, failed = 0;
    const errors = [];
    const total = parsedRows.length;

    setImportProgress({ done: 0, total, created: 0, failed: 0, pct: 0, speed: 0, eta: "—", currentRow: "", cancelled: false });

    for (let i = 0; i < total; i++) {
      if (cancelRef.current) {
        setImportProgress((prev) => ({ ...prev, cancelled: true, currentRow: "⏹ Upload cancelled by user" }));
        break;
      }
      const raw = parsedRows[i];
      const row = parsePlotBlock(raw);

      if (!row.applicantName) {
        failed++;
        errors.push(`Row ${i + 2}: Missing applicantName`);
        setImportProgress({ done: i + 1, total, created, failed, pct: Math.round(((i + 1) / total) * 100), speed: Math.round((i + 1) / ((Date.now() - startTime) / 1000)), eta: `${Math.round(((total - i - 1) / Math.max(1, (i + 1) / ((Date.now() - startTime) / 1000))))}s`, currentRow: `Row ${i + 2}: skipped (no name)`, cancelled: false });
        continue;
      }

      try {
        // Auto-align hierarchy fields with system data
        const alignedOffice = alignToSystem(row.office, offices);
        const alignedAC = alignToSystem(row.areaCouncil, areaCouncils);
        const alignedComm = alignToSystem(row.community, communities);
        const alignedSector = alignToSystem(row.sector, sectors);

        // Duplicate check: same Sector + Plot Number + Block combination
        let existingRecord = null;
        try {
          existingRecord = await findExistingParcel(
            { plotNumber: row.plotNumber, block: row.block, sector: alignedSector || row.sector },
            `import-dupchk-${i}`,
          );
        } catch (_) { existingRecord = null; }

        const importData = {
          applicantName: row.applicantName,
          contactPhone: row.contactPhone || "",
          alternateMobile: row.alternateMobile || "",
          alternateNumber2: row.alternateNumber2 || "",
          whatsapp: row.whatsapp || "",
          applicantEmail: row.applicantEmail || "",
          religion: row.religion || "",
          tribe: row.tribe || "",
          office: alignedOffice || "",
          areaCouncil: alignedAC || "",
          community: alignedComm || "",
          sector: alignedSector || "",
          plotNumber: row.plotNumber || "",
          block: row.block || "",
          allocationDate: row.allocationDate || null,
          registrationDate: row.registrationDate || null,
        };

        if (existingRecord) {
          // Existing record found — REPLACE all fields with the imported data
          const before = {};
          for (const k of Object.keys(importData)) before[k] = existingRecord[k] ?? "";
          await pb.collection("parcels").update(existingRecord.id, importData, { requestKey: `import-upd-${i}-${Date.now()}` });
          try {
            await pb.collection("audit_logs").create({
              actor: userId,
              action: "parcel_import_replaced",
              entity: existingRecord.id,
              details: JSON.stringify({ parcelNumber: existingRecord.parcelNumber, before, after: importData, timestamp: new Date().toISOString() }).slice(0, 1900),
            }, { requestKey: `import-audit-${i}-${Date.now()}` });
          } catch (_) {}
          updated++;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = Math.round((i + 1) / Math.max(0.1, elapsed));
          setImportProgress({ done: i + 1, total, created, failed, pct: Math.round(((i + 1) / total) * 100), speed, eta: speed > 0 ? `${Math.round((total - i - 1) / speed)}s` : "—", currentRow: `↻ Replaced: ${existingRecord.parcelNumber} (${row.applicantName})`, cancelled: false });
        } else {
          // New record — insert
          const pn = await generateParcelNumber(alignedComm || row.community, row.registrationDate);
          const rec = await pb.collection("parcels").create({
            owner: userId,
            parcelNumber: pn,
            ...importData,
            status: "registered",
          }, { requestKey: `import-${i}-${Date.now()}` });
          created++;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = Math.round((i + 1) / Math.max(0.1, elapsed));
          const remaining = total - i - 1;
          setImportProgress({ done: i + 1, total, created, failed, pct: Math.round(((i + 1) / total) * 100), speed, eta: speed > 0 ? `${Math.round(remaining / speed)}s` : "—", currentRow: `✓ New: ${row.applicantName} — ${rec.parcelNumber}`, cancelled: false });
        }
      } catch (err) {
        // ── Error recovery: retry the row once as a fresh insert, then continue ──
        let recovered = false;
        logImport("row:error", `Row ${i + 2}: ${err?.message || err}`);
        try {
          const pn = await generateParcelNumber(row.community, row.registrationDate);
          await pb.collection("parcels").create({
            owner: userId,
            parcelNumber: pn,
            applicantName: row.applicantName,
            contactPhone: row.contactPhone || "",
            alternateMobile: row.alternateMobile || "",
            alternateNumber2: row.alternateNumber2 || "",
            whatsapp: row.whatsapp || "",
            applicantEmail: row.applicantEmail || "",
            religion: row.religion || "",
            tribe: row.tribe || "",
            office: row.office || "",
            areaCouncil: row.areaCouncil || "",
            community: row.community || "",
            sector: row.sector || "",
            plotNumber: row.plotNumber || "",
            block: row.block || "",
            allocationDate: row.allocationDate || null,
            registrationDate: row.registrationDate || null,
            status: "registered",
          }, { requestKey: `import-retry-${i}-${Date.now()}` });
          created++;
          recovered = true;
          logImport("row:recovered", `Row ${i + 2}`);
        } catch (retryErr) {
          logImport("row:failed", `Row ${i + 2}: ${retryErr?.message || retryErr}`);
        }
        if (!recovered) {
          failed++;
          const detail = err?.response?.data
            ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${v?.message || v}`).join(", ")
            : err?.message || "Unknown error";
          errors.push(`Row ${i + 2}: ${detail}`);
        }
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = Math.round((i + 1) / Math.max(0.1, elapsed));
        setImportProgress({ done: i + 1, total, created, failed, pct: Math.round(((i + 1) / total) * 100), speed, eta: speed > 0 ? `${Math.round((total - i - 1) / speed)}s` : "—", currentRow: `✗ Row ${i + 2}: ${err?.message || "Error"}`, cancelled: false });
      }
    }

    try {
      const entry = {
        at: new Date().toISOString(),
        file: fileInfo?.name || "unknown",
        kind: fileInfo?.kind || "csv",
        total, created, updated, failed,
        status: cancelRef.current ? "cancelled" : failed === 0 ? "success" : "partial",
      };
      const next = [entry, ...history].slice(0, 20);
      setHistory(next);
      localStorage.setItem("landImportHistory", JSON.stringify(next));
    } catch (e) { logImport("history:error", String(e)); }

    await log("bulk_import", "parcels", `Import: ${created} new, ${updated} replaced, ${skipped} skipped, ${failed} failed${cancelRef.current ? " (cancelled)" : ""}`);
    setResults({ created, updated, skipped, failed, errors, total, cancelled: cancelRef.current });
    setImportProgress(null);
    setImporting(false);
    endOperation();
    if (created > 0 || updated > 0) onDone();
  };

  const cancelImport = () => { cancelRef.current = true; };

  const fmtSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary/60" />
          <div>
            <p className="text-sm font-medium">Import Template (CSV / XLS / XLSX)</p>
            <p className="text-xs text-muted-foreground">Plot format: "123/A" auto-splits into Plot=123, Block=A</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-1 h-4 w-4" /> Template
        </Button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-xl border border-dashed p-6 text-center transition-colors",
          dragging ? "border-primary bg-primary/10" : "border-border bg-muted/20"
        )}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drag &amp; drop a CSV, XLS or XLSX file here</p>
        <p className="mt-1 text-xs text-muted-foreground">Only applicant name is required; all other fields are optional. Max 20 MB.</p>
        <Button variant="outline" size="sm" className="mt-3" disabled={loadingFile} onClick={() => fileRef.current?.click()}>
          {loadingFile ? "Reading file…" : "Choose file"}
        </Button>
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.xls,.xlsx,.xlsm" className="hidden" onChange={handleFile} />
        {fileInfo && (
          <p className="mt-3 text-xs text-muted-foreground truncate">
            <strong className="text-foreground">{fileInfo.name}</strong> · {fmtSize(fileInfo.size)} · {fileInfo.kind.toUpperCase()}
          </p>
        )}
      </div>

      {parseError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-300">
          <strong>Could not read this file:</strong> {parseError}
        </div>
      )}

      {sheets.length > 1 && (
        <div className="space-y-1">
          <Label className="text-xs">Worksheet</Label>
          <Select value={sheetName} onValueChange={changeSheet}>
            <SelectTrigger><SelectValue placeholder="Select sheet" /></SelectTrigger>
            <SelectContent>
              {sheets.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {validation && !results && (
        <div className="rounded-xl border border-border bg-card p-3 text-xs space-y-2">
          <p className="font-semibold text-foreground">
            Validation — {validation.valid} valid · {validation.invalid} invalid · {validation.warnings.length} warning(s)
          </p>
          {headers.length > 0 && (
            <p className="text-muted-foreground truncate">Columns: {headers.join(", ")}</p>
          )}
          {(validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="max-h-28 overflow-y-auto space-y-0.5">
              {validation.errors.slice(0, 25).map((e, i) => <p key={`e${i}`} className="text-red-600">✗ {e}</p>)}
              {validation.warnings.slice(0, 25).map((w, i) => <p key={`w${i}`} className="text-amber-600">⚠ {w}</p>)}
            </div>
          )}
          {validation.suggestions.map((s, i) => <p key={i} className="text-muted-foreground">💡 {s}</p>)}
        </div>
      )}

      {importProgress && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">
              {importProgress.cancelled ? "⏹ Upload Cancelled" : "Auto-Registering Records…"}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-primary">{importProgress.pct}%</span>
              {!importProgress.cancelled && (
                <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50" onClick={cancelImport}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
          <div className="h-2.5 w-full rounded-full bg-border overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-150", importProgress.cancelled ? "bg-red-400" : "bg-primary")} style={{ width: `${importProgress.pct}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Processed: <strong className="text-foreground">{importProgress.done}/{importProgress.total}</strong></span>
            <span>Success: <strong className="text-blue-700">{importProgress.created}</strong> | Failed: <strong className="text-red-600">{importProgress.failed}</strong></span>
            <span>Speed: <strong className="text-foreground">{importProgress.speed} rec/s</strong></span>
            <span>ETA: <strong className="text-foreground">{importProgress.cancelled ? "—" : importProgress.eta}</strong></span>
          </div>
          {importProgress.currentRow && <p className="text-xs text-muted-foreground truncate">{importProgress.currentRow}</p>}
        </div>
      )}

      {parsedRows && !results && !importProgress && (
        <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">{parsedRows.length} rows parsed — ready to import</p>
          {parsedRows.slice(0, 5).map((row, i) => {
            const processed = parsePlotBlock(row);
            return (
              <p key={i} className="truncate">
                {i + 1}. {processed.applicantName || "(no name)"} — Plot: {processed.plotNumber || "—"} Block: {processed.block || "—"} · {processed.areaCouncil || "—"} · {processed.contactPhone || "—"}
              </p>
            );
          })}
          {parsedRows.length > 5 && <p>… and {parsedRows.length - 5} more rows</p>}
        </div>
      )}

      {results && (
        <div className={cn("rounded-xl p-4 text-sm space-y-2", results.failed === 0 ? "bg-blue-50 border border-blue-200" : "bg-blue-50 border border-blue-200")}>
          <div className="flex items-center gap-2 font-semibold">
            {results.cancelled ? <XCircle className="h-4 w-4 text-orange-600" /> : results.failed === 0 ? <CheckCircle2 className="h-4 w-4 text-blue-700" /> : <AlertTriangle className="h-4 w-4 text-blue-600" />}
            {results.cancelled ? `Upload cancelled — ${results.created + (results.updated || 0)}/${results.total} processed` : `Import complete — ${results.total} processed`}
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span className="text-blue-800">✓ New: <strong>{results.created}</strong></span>
            <span className="text-green-700">↻ Replaced: <strong>{results.updated || 0}</strong></span>
            <span className="text-red-700">✗ Failed: <strong>{results.failed}</strong></span>
          </div>
          {results.errors.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-0.5">
              {results.errors.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
            </div>
          )}
          {results.created > 0 && (
            <Button size="sm" variant="outline" onClick={() => {
              const lines = ["Row,Status,Details", ...results.errors.map((e) => `FAILED,"${e}"`)];
              const blob = new Blob([lines.join("\n")], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "import-report.csv"; a.click();
            }} className="text-xs h-7">
              <Download className="mr-1 h-3 w-3" /> Download Report
            </Button>
          )}
        </div>
      )}

      {history.length > 0 && !importProgress && (
        <details className="rounded-xl border border-border bg-muted/20 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-foreground">Import history ({history.length})</summary>
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {history.map((h, i) => (
              <p key={i} className="text-muted-foreground truncate">
                {new Date(h.at).toLocaleString()} · {h.file} ({(h.kind || "csv").toUpperCase()}) — {h.created} new, {h.updated} replaced, {h.failed} failed · {h.status}
              </p>
            ))}
          </div>
        </details>
      )}

      <div className="flex gap-2">
        {!results && (
          <Button onClick={doImport} disabled={importing || !parsedRows} className="flex-1">
            {importing ? "Auto-Registering…" : parsedRows ? `Auto-Register ${parsedRows.length} Records` : "Select a file first"}
          </Button>
        )}
        <Button variant={results ? "default" : "outline"} onClick={onClose} className={results ? "flex-1" : ""}>
          {results ? "Done" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

// ── Additional land references (owner's other lands) ─────────────────────────
// Normalises whatever is stored on a parcel record into a clean array of
// { community, areaCouncil, plotNumber, block } objects.
function normalizeAdditionalLands(raw) {
  let arr = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch (_) { arr = []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      community: String(x.community || "").trim(),
      areaCouncil: String(x.areaCouncil || "").trim(),
      sector: String(x.sector || "").trim(),
      plotNumber: String(x.plotNumber || "").trim(),
      block: String(x.block || "").trim(),
    }));
}

function AdditionalLandsEditor({ value, onChange, areaCouncils, communities, sectors, commForAC, sectForComm }) {
  const rows = Array.isArray(value) ? value : [];
  const acNames = (areaCouncils || []).map((a) => (a && (a.name || a))).filter(Boolean);
  const commList = Array.isArray(communities) ? communities : [];
  const sectList = Array.isArray(sectors) ? sectors : [];

  // Communities visible for a given area council name (cascade). Uses the
  // shared hierarchy cascade when available (handles id OR name storage),
  // falling back to a tolerant name match. When the area council is empty
  // or a custom "Other" value, show all communities.
  const commOptionsFor = (acName) => {
    if (!acName) return commList.map((c) => c.name).filter(Boolean);
    if (typeof commForAC === "function") {
      const list = commForAC(acName);
      if (Array.isArray(list) && list.length) return list.map((c) => c.name).filter(Boolean);
    }
    const norm = (v) => String(v ?? "").trim().toLowerCase();
    const matched = commList.filter((c) => {
      const raw = c.areaCouncil;
      const exp = c.expand && c.expand.areaCouncil ? c.expand.areaCouncil.name : "";
      if (norm(raw) && norm(raw) === norm(acName)) return true;
      if (exp && norm(exp) === norm(acName)) return true;
      return false;
    });
    return (matched.length ? matched : commList).map((c) => c.name).filter(Boolean);
  };

  // Sectors visible for a given community name (cascade). Uses the shared
  // hierarchy cascade when available; falls back to a tolerant name match.
  // Synchronises additional-land sectors with the authoritative structure.
  const sectOptionsFor = (commName) => {
    if (!commName) return sectList.map((s) => s.name).filter(Boolean);
    if (typeof sectForComm === "function") {
      const list = sectForComm(commName);
      if (Array.isArray(list) && list.length) return list.map((s) => s.name).filter(Boolean);
    }
    const norm = (v) => String(v ?? "").trim().toLowerCase();
    const matched = sectList.filter((s) => {
      const raw = s.community;
      const exp = s.expand && s.expand.community ? s.expand.community.name : "";
      if (norm(raw) && norm(raw) === norm(commName)) return true;
      if (exp && norm(exp) === norm(commName)) return true;
      return false;
    });
    return (matched.length ? matched : sectList).map((s) => s.name).filter(Boolean);
  };

  const update = (idx, patch) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };
  const addRow = () => {
    onChange([...rows, { community: "", areaCouncil: "", sector: "", plotNumber: "", block: "" }]);
  };
  const removeRow = (idx) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  // Detect duplicate Sector + Plot + Block combinations within the list
  const dupKeys = new Set();
  const seen = {};
  rows.forEach((r) => {
    const key = `${r.sector}|${r.plotNumber}|${r.block}`.toLowerCase();
    if (r.plotNumber && r.block) {
      if (seen[key]) dupKeys.add(key);
      seen[key] = true;
    }
  });

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">Additional Land Details</p>
          <p className="text-[11px] text-muted-foreground">List the other lands this owner holds (optional). Each land is saved as a separate parcel with the owner's details.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add land
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No additional lands added.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, idx) => {
            const isDup = r.plotNumber && r.block && dupKeys.has(`${r.sector}|${r.plotNumber}|${r.block}`.toLowerCase());
            return (
              <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Land #{idx + 1}</p>
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => removeRow(idx)} title="Remove">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <FRow>
                  <FF label="Area Council" required>
                    <OtherSelect
                      options={[...acNames, "Other"]}
                      value={r.areaCouncil || ""}
                      onChange={(v) => update(idx, { areaCouncil: v, community: "", sector: "" })}
                      placeholder="Select area council"
                      inputLabel="Specify area council"
                      inputPlaceholder="Enter area council name"
                      required
                    />
                  </FF>
                  <FF label="Community" required>
                    <OtherSelect
                      options={[...commOptionsFor(r.areaCouncil), "Other"]}
                      value={r.community || ""}
                      onChange={(v) => update(idx, { community: v, sector: "" })}
                      placeholder="Select community"
                      inputLabel="Specify community"
                      inputPlaceholder="Enter community name"
                      required
                    />
                  </FF>
                </FRow>
                <FRow>
                  <FF label="Sector" required>
                    <OtherSelect
                      options={[...sectOptionsFor(r.community), "Other"]}
                      value={r.sector || ""}
                      onChange={(v) => update(idx, { sector: v })}
                      placeholder="Select sector"
                      inputLabel="Specify sector"
                      inputPlaceholder="Enter sector name"
                      required
                    />
                  </FF>
                  <FF label="Plot Number" required>
                    <Input value={r.plotNumber} onChange={(e) => update(idx, { plotNumber: e.target.value })} placeholder="e.g. Plot 12" className="h-9 text-xs" />
                  </FF>
                </FRow>
                <FRow>
                  <FF label="Block" required>
                    <Input value={r.block} onChange={(e) => update(idx, { block: e.target.value })} placeholder="e.g. Block A" className="h-9 text-xs" />
                  </FF>
                </FRow>
                {isDup && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Duplicate Sector/Plot/Block combination in this list.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Parcel form ──────────────────────────────────────────────────────────────
function ParcelForm({ form, setForm, onSubmit, onCancel, saving, submitLabel, userAreaCouncils, user, mode = "register" }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const { offices, areaCouncils, communities, sectors, acForOffice, commForAC, sectForComm, loading: hierLoading } = useHierarchy();

  // Determine if office/AC are locked by user assignment
  const lockedOffice = user?.officeRef ? user.officeRef.trim() : "";
  const lockedAC = user?.areaCouncilRef ? user.areaCouncilRef.trim() : "";

  // Cascading select handlers
  const setOfficeVal = (v) => {
    if (lockedOffice) return; // locked
    setForm((f) => ({ ...f, office: v === "none" ? "" : v, areaCouncil: "", community: "", sector: "" }));
  };
  const setACVal = (v) => {
    if (lockedAC) return; // locked
    setForm((f) => ({ ...f, areaCouncil: v === "none" ? "" : v, community: "", sector: "" }));
  };
  const setCommVal = (v) => setForm((f) => ({ ...f, community: v === "none" ? "" : v, sector: "" }));
  const setSectVal = (v) => setForm((f) => ({ ...f, sector: v === "none" ? "" : v }));

  const safeList = (fn, arg, fallback) => {
    try {
      const out = fn(arg);
      return Array.isArray(out) ? out.filter((x) => x && x.name) : (fallback || []);
    } catch (err) {
      console.error("Hierarchy dropdown error", err);
      return fallback || [];
    }
  };

  const acOptions = (offices.length || form.office)
    ? safeList(acForOffice, form.office, [])
    : (userAreaCouncils || ALL_AREA_COUNCILS).filter(Boolean).map((n) => ({ id: n, name: n }));
  const commOptions = safeList(commForAC, form.areaCouncil, []);
  const sectOptions = safeList(sectForComm, form.community, []);

  // Breadcrumb path
  const hierPath = [form.office, form.areaCouncil, form.community, form.sector].filter(Boolean).join(" > ");

  return (
    <div className="space-y-5 py-1">
      <FGroup label="Personal Information" />
      <FRow>
        <FF label="Name" required><Input value={form.applicantName} onChange={set("applicantName")} placeholder="Full legal name" /></FF>
        <FF label="Mobile" required><Input value={form.contactPhone} onChange={set("contactPhone")} placeholder="+233 XX XXX XXXX" /></FF>
      </FRow>
      <FRow>
        <FF label="Alternate Mobile (Optional)"><Input value={form.alternateMobile} onChange={set("alternateMobile")} placeholder="+233 XX XXX XXXX" /></FF>
        <FF label="Alternate Number 2 (Optional)"><Input value={form.alternateNumber2 || ""} onChange={set("alternateNumber2")} placeholder="+233 XX XXX XXXX" /></FF>
        <FF label="WhatsApp (Optional)"><Input value={form.whatsapp} onChange={set("whatsapp")} placeholder="+233 XX XXX XXXX" /></FF>
      </FRow>
      <FF label="Email (Optional)"><Input type="text" value={form.applicantEmail} onChange={set("applicantEmail")} placeholder="applicant@email.com" /></FF>
      <FRow>
        <FF label="Religion" required>
          <OtherSelect options={RELIGIONS} value={form.religion} onChange={(v) => setForm((f) => ({ ...f, religion: v }))} placeholder="Select religion" inputLabel="Specify religion" inputPlaceholder="Enter religion" required />
        </FF>
        <FF label="Tribe" required>
          <OtherSelect options={TRIBES} value={form.tribe} onChange={(v) => setForm((f) => ({ ...f, tribe: v }))} placeholder="Select tribe" inputLabel="Specify tribe" inputPlaceholder="Enter tribe" required />
        </FF>
      </FRow>

      <FGroup label="Location Details" />
      {hierPath && (
        <p className="text-xs text-primary bg-primary/5 rounded-lg px-3 py-1.5 font-medium">{hierPath}</p>
      )}
      <FRow>
        <FF label="Office" required>
          {lockedOffice ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground text-xs">🔒</span>
              <span className="font-medium">{lockedOffice}</span>
            </div>
          ) : (
            <Select value={form.office || "none"} onValueChange={setOfficeVal}>
              <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select Office —</SelectItem>
                {offices.filter((o) => o && o.name).map((o) => <SelectItem key={o.id} value={o.name}>{o.name}{o.code ? ` (${o.code})` : ""}</SelectItem>)}
                {offices.length === 0 && !hierLoading && <SelectItem value="_none" disabled>No offices configured</SelectItem>}
              </SelectContent>
            </Select>
          )}
        </FF>
        <FF label="Area Council" required>
          {lockedAC ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground text-xs">🔒</span>
              <span className="font-medium">{lockedAC}</span>
            </div>
          ) : (
            <Select value={form.areaCouncil || "none"} onValueChange={setACVal} disabled={!form.office && offices.length > 0}>
              <SelectTrigger><SelectValue placeholder={form.office ? "Select area council" : "Select office first"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select Area Council —</SelectItem>
                {acOptions.filter((ac) => ac && (ac.name || typeof ac === "string")).map((ac) => <SelectItem key={ac.id || ac} value={ac.name || ac}>{ac.name || ac}</SelectItem>)}
                {acOptions.length === 0 && <SelectItem value="_empty_ac" disabled>No area councils available</SelectItem>}
              </SelectContent>
            </Select>
          )}
        </FF>
      </FRow>
      <FRow>
        <FF label="Community" required>
          <Select value={form.community || "none"} onValueChange={setCommVal} disabled={!form.areaCouncil}>
            <SelectTrigger><SelectValue placeholder={form.areaCouncil ? "Select community" : "Select area council first"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select Community —</SelectItem>
              {commOptions.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}{c.code ? ` (${c.code})` : ""}</SelectItem>)}
              {/* guarded above via safeList */}
              {commOptions.length === 0 && <SelectItem value="_empty" disabled>No communities for this area council</SelectItem>}
            </SelectContent>
          </Select>
        </FF>
        <FF label="Sector" required>
          <Select value={form.sector || "none"} onValueChange={setSectVal} disabled={!form.community}>
            <SelectTrigger><SelectValue placeholder={form.community ? "Select sector" : "Select community first"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select Sector —</SelectItem>
              {sectOptions.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>)}
              {/* guarded above via safeList */}
              {sectOptions.length === 0 && <SelectItem value="_empty" disabled>No sectors for this community</SelectItem>}
            </SelectContent>
          </Select>
        </FF>
      </FRow>
      <FRow>
        <FF label="Plot Number" required><Input value={form.plotNumber} onChange={set("plotNumber")} placeholder="e.g. Plot 12" /></FF>
        <FF label="Block" required><Input value={form.block} onChange={set("block")} placeholder="e.g. Block A" /></FF>
      </FRow>

      {mode === "register" && (
        <>
          <FGroup label="Additional Land Details (Optional)" />
          <AdditionalLandsEditor
            value={Array.isArray(form.additionalLands) ? form.additionalLands : normalizeAdditionalLands(form.additionalLands)}
            onChange={(next) => setForm((f) => ({ ...f, additionalLands: next }))}
            areaCouncils={areaCouncils}
            communities={communities}
            sectors={sectors}
            commForAC={commForAC}
            sectForComm={sectForComm}
          />
        </>
      )}

      <FGroup label="Registration Dates" />
      <FRow>
        <FF label="Allocation Date" required><Input type="date" required value={form.allocationDate} onChange={set("allocationDate")} max={form.registrationDate || undefined} /></FF>
        <FF label="Registration Date" required><Input type="date" required value={form.registrationDate} onChange={set("registrationDate")} min={form.allocationDate || undefined} /></FF>
      </FRow>

      <FGroup label="Payment Information (Optional)" />
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <p className="text-xs text-muted-foreground">Attach a payment record to this land registration. Leave blank to skip.</p>
        <FRow>
          <FF label="Payment Amount (GHS)">
            <Input type="number" min="0" step="0.01" value={form.paymentAmount} onChange={set("paymentAmount")} placeholder="e.g. 250.00" />
          </FF>
          <FF label="Payment Method">
            <Select value={form.paymentMethod || "none"} onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select —</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </FF>
        </FRow>
        <FRow>
          <FF label="Payment Status">
            <Select value={form.paymentStatus || "pending"} onValueChange={(v) => setForm((f) => ({ ...f, paymentStatus: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </FF>
          <FF label="Payment Date">
            <Input type="date" value={form.paymentDate} onChange={set("paymentDate")} />
          </FF>
        </FRow>
        <FRow>
          <FF label="Reference Number">
            <Input value={form.paymentReference} onChange={set("paymentReference")} placeholder="e.g. REF-2024-001" />
          </FF>
          <FF label="Payment Notes">
            <Input value={form.paymentNotes} onChange={set("paymentNotes")} placeholder="Optional notes" />
          </FF>
        </FRow>
      </div>

      <DuplicateCheck
        type="parcel"
        label="Check for duplicate parcel"
        getData={() => ({ plotNumber: form.plotNumber, block: form.block, sector: form.sector })}
      />

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={onSubmit} disabled={saving} className="flex-1">{saving ? "Saving…" : submitLabel || "Register"}</Button>
      </div>
    </div>
  );
}

// ── Column selector portal (renders outside DOM tree to avoid z-index clipping) ──
function ColumnSelectorPortal({ showColSelector, setShowColSelector, visibleCols, toggleCol, columns }) {
  const btnRef = useRef(null);
  const [rect, setRect] = useState(null);

  const open = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setRect(r);
    setShowColSelector((v) => !v);
  }, [setShowColSelector]);

  useEffect(() => {
    if (!showColSelector) return;
    const onKey = (e) => { if (e.key === "Escape") setShowColSelector(false); };
    const onClickOutside = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setShowColSelector(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [showColSelector, setShowColSelector]);

  const dropdownStyle = rect ? {
    position: "fixed",
    top: rect.bottom + 6,
    right: window.innerWidth - rect.right,
    zIndex: 9999,
    width: 224,
  } : {};

  return (
    <>
      <button
        ref={btnRef}
        onClick={open}
        className={cn("flex items-center gap-1.5 rounded-lg border px-3 h-9 text-xs font-medium transition",
          showColSelector ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50")}
      >
        <Columns className="h-3.5 w-3.5" /> Columns
      </button>
      {showColSelector && rect && createPortal(
        <div
          style={dropdownStyle}
          className="rounded-xl border border-border bg-popover shadow-2xl p-3 space-y-1"
        >
          <p className="text-xs font-semibold text-foreground mb-2">Show/Hide Columns</p>
          {columns.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
              <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)}
                className="h-3 w-3 rounded accent-primary" />
              {c.label}
            </label>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ParcelsPage() {
  const { user, role, log } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isCitizen = false;
  const isStaff = true;
  const isAdmin = role === "admin";
  const isApprover = role === "admin" || role === "planning_officer";
  const canBulkRegister = role === "admin" || role === "registrar";
  const canBulkUpdateHierarchy = role === "admin" || role === "registrar";

  const userACs = useMemo(() => getUserAreaCouncils(user), [user]);

  const { records, loading, reload } = useCollection("parcels", {
    filter: isCitizen ? `owner = "${user.id}"` : "",
    expand: "owner",
    realtime: true,
  });

  // Visibility is hierarchy-based (office + area council) and never depends on
  // who uploaded the record — registrars see Admin/Planner uploads too.
  const accessibleRecords = useMemo(
    () => filterParcelsForUser(user, records),
    [records, user]
  );

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("registered");
  // Amendment dialogs moved to /app/amendments (unified interface)
  const [bulkProgress, setBulkProgress] = useState(null);
  const [permDeleteDialog, setPermDeleteDialog] = useState(null);
  const [permDeleteReason, setPermDeleteReason] = useState("");
  const [permDeleting, setPermDeleting] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dupReportOpen, setDupReportOpen] = useState(false);
  const [dupReport, setDupReport] = useState(null);
  const [dupScanning, setDupScanning] = useState(false);

  const runDuplicateScan = async () => {
    setDupReportOpen(true);
    setDupScanning(true);
    setDupReport(null);
    try {
      const rep = await findAllDuplicates();
      setDupReport(rep);
      await log("duplicate_scan", "parcels", `Parcels: ${rep.parcels.length}, Users: ${rep.users.length}, Transfers: ${rep.transfers.length} duplicate groups`);
    } catch (err) {
      toast({ variant: "destructive", title: "Duplicate scan failed", description: err?.message });
    } finally {
      setDupScanning(false);
    }
  };
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAC, setFilterAC] = useState("all");
  const [filterCommunity, setFilterCommunity] = useState("all");
  const [filterSector, setFilterSector] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [certParcel, setCertParcel] = useState(null);
  const [historyParcel, setHistoryParcel] = useState(null);
  const [editParcel, setEditParcel] = useState(null);
  const [editRequestParcel, setEditRequestParcel] = useState(null);
  const [transferParcel, setTransferParcel] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [viewMode, setViewModeRaw] = useState(() => getViewMode());
  const [sortField, setSortField] = useState("parcelNumber");
  const [sortDir, setSortDir] = useState("asc");
  const [visibleCols, setVisibleColsState] = useState(() => getVisibleCols());
  const [showColSelector, setShowColSelector] = useState(false);
  const toggleCol = (key) => {
    setVisibleColsState((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveVisibleCols(next);
      return next;
    });
  };
  const [deletionFilter, setDeletionFilter] = useState("active"); // active | deleted | all
  const [softDeletedIds, setSoftDeletedIds] = useState(new Set());
  const [transferMap, setTransferMap] = useState({});
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");

  const switchViewMode = (v) => { setViewModeRaw(v); setViewMode(v); };

  // Load soft-deleted audit log entries and approved transfers
  useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      try {
        const [auditLogs, transfers] = await Promise.all([
          pb.collection("audit_logs").getFullList({
            filter: `action = "parcel_soft_deleted" || action = "parcel_restored"`,
            sort: "created",
            requestKey: "softdel-audit",
          }).catch(() => []),
          pb.collection("land_transfers").getFullList({
            filter: `status = "approved"`,
            sort: "-created",
            requestKey: "transfer-approved-map",
          }).catch(() => []),
        ]);
        if (cancelled) return;
        const stateMap = {};
        for (const entry of auditLogs) { stateMap[entry.entity] = entry.action === "parcel_soft_deleted"; }
        setSoftDeletedIds(new Set(Object.entries(stateMap).filter(([, v]) => v).map(([k]) => k)));
        const tmap = {};
        for (const t of transfers) { if (!tmap[t.parcel]) tmap[t.parcel] = t; }
        setTransferMap(tmap);
      } catch (_) {}
    };
    loadMeta();
    return () => { cancelled = true; };
  }, [records]);

  const defaultAC = userACs?.length === 1 ? userACs[0] : "";

  const filtered = accessibleRecords.filter((p) => {
    const isDel = softDeletedIds.has(p.id);
    if (deletionFilter === "active" && isDel) return false;
    if (deletionFilter === "deleted" && !isDel) return false;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchAC = filterAC === "all" || p.areaCouncil === filterAC;
    const matchCommunity = filterCommunity === "all" || p.community === filterCommunity;
    const matchSector = filterSector === "all" || p.sector === filterSector;
    const matchYear = filterYear === "all" || (p.registrationDate && p.registrationDate.startsWith(filterYear)) || (p.created && p.created.startsWith(filterYear));
    const q = searchQ.toLowerCase();
    const matchQ = !q || [p.parcelNumber, p.applicantName, p.areaCouncil, p.community, p.sector, p.plotNumber, p.block, p.contactPhone]
      .filter(Boolean).some((v) => v.toLowerCase().includes(q));
    return matchStatus && matchQ && matchAC && matchCommunity && matchSector && matchYear;
  });

  const sortedFiltered = useMemo(() => sortParcels(filtered, sortField, sortDir), [filtered, sortField, sortDir]);

  // Pagination — reset to page 1 whenever filters change
  const { page: parcelPage, setPage: setParcelPage, pageSize: parcelPageSize, setPageSize: setParcelPageSize, totalPages: parcelTotalPages, totalRecords: parcelTotalRecords, pageItems: parcelPageItems } = usePagination(sortedFiltered, "tnda-parcels-page-size", 50);
  const prevFilterRef = useRef("");
  const curFilterKey = `${filterStatus}|${filterAC}|${filterCommunity}|${filterSector}|${filterYear}|${searchQ}|${deletionFilter}`;
  useEffect(() => { if (prevFilterRef.current !== curFilterKey) { setParcelPage(1); prevFilterRef.current = curFilterKey; } }, [curFilterKey]); // eslint-disable-line

  const uniqueACs = ["all", ...Array.from(new Set(accessibleRecords.map((p) => p.areaCouncil).filter(Boolean))).sort()];
  const uniqueCommunities = ["all", ...Array.from(new Set(accessibleRecords.map((p) => p.community).filter(Boolean))).sort()];
  const uniqueSectors = ["all", ...Array.from(new Set(accessibleRecords.map((p) => p.sector).filter(Boolean))).sort()];
  const uniqueYears = ["all", ...Array.from(new Set(accessibleRecords.map((p) => (p.registrationDate || p.created || "").substring(0, 4)).filter((y) => y && y.length === 4))).sort().reverse()];
  const activeFilterCount = [filterStatus !== "all", filterAC !== "all", filterCommunity !== "all", filterSector !== "all", filterYear !== "all", searchQ !== ""].filter(Boolean).length;

  const validateForm = (f) => {
    const required = ["applicantName", "contactPhone", "religion", "tribe", "office", "areaCouncil", "community", "sector", "plotNumber", "block", "allocationDate", "registrationDate"];
    for (const k of required) {
      if (!f[k]) {
        toast({ variant: "destructive", title: "Required field missing", description: `Please fill in ${titleCase(k)}` });
        return false;
      }
    }
    // Validate additional land entries — each must be complete or empty
    const lands = normalizeAdditionalLands(f.additionalLands);
    for (let i = 0; i < lands.length; i++) {
      const r = lands[i];
      if (!r.areaCouncil || !r.community || !r.sector || !r.plotNumber || !r.block) {
        toast({ variant: "destructive", title: "Incomplete additional land", description: `Additional land #${i + 1}: Area Council, Community, Sector, Plot Number and Block are all required.` });
        return false;
      }
    }
    // Reject duplicate Sector + Plot + Block within additional lands
    const seen = {};
    for (const r of lands) {
      const key = `${r.sector}|${r.plotNumber}|${r.block}`.toLowerCase();
      if (seen[key]) {
        toast({ variant: "destructive", title: "Duplicate additional land", description: `Sector ${r.sector || "—"} / Plot ${r.plotNumber} / Block ${r.block} appears more than once in the additional lands list.` });
        return false;
      }
      seen[key] = true;
    }
    // Reject an additional land that duplicates the main land (same community + sector + plot + block)
    const mainKey = `${f.community}|${f.sector}|${f.plotNumber}|${f.block}`.toLowerCase();
    for (let i = 0; i < lands.length; i++) {
      const r = lands[i];
      const key = `${r.community}|${r.sector}|${r.plotNumber}|${r.block}`.toLowerCase();
      if (key === mainKey) {
        toast({ variant: "destructive", title: "Duplicate additional land", description: `Additional land #${i + 1} matches the main land (Community ${r.community}, Sector ${r.sector}, Plot ${r.plotNumber}, Block ${r.block}). Remove the duplicate or change the details.` });
        return false;
      }
    }
    return true;
  };

  const submit = async () => {
    if (!validateForm(form)) return;

    // Extra field-level validation with specific messages
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.applicantEmail && !emailRe.test(form.applicantEmail)) {
      toast({ variant: "destructive", title: "Invalid email", description: "Enter a valid email address, e.g. name@example.com" });
      return;
    }
    const phoneRe = /^\+?[\d\s-]{9,15}$/;
    if (!phoneRe.test(form.contactPhone)) {
      toast({ variant: "destructive", title: "Invalid mobile number", description: "Enter a valid phone number (9–15 digits), e.g. +233 24 123 4567" });
      return;
    }
    if (form.allocationDate && form.registrationDate && new Date(form.allocationDate) > new Date(form.registrationDate)) {
      toast({ variant: "destructive", title: "Invalid dates", description: "Allocation date must be on or before the registration date." });
      return;
    }

    setSaving(true);
    await log("parcel_registration_attempt", "parcels", `Attempt by ${user.email} — ${form.applicantName}, Plot ${form.plotNumber}/${form.block}, Sector ${form.sector}, ${form.areaCouncil}`);
    try {
      const { paymentAmount, paymentMethod, paymentStatus, paymentDate, paymentReference, paymentNotes, ...parcelFields } = form;
      const additional = normalizeAdditionalLands(form.additionalLands);

      // Each land (the main land + every additional land) is registered as a
      // SEPARATE parcel record sharing the owner's identity. The owner is
      // registered once; every land gets its own parcel ID, status, audit
      // trail, payment/reference, search, export, transfer, approval,
      // certificate and verification behaviour.
      const landSpecs = [
        { community: form.community, areaCouncil: form.areaCouncil, sector: form.sector, plotNumber: form.plotNumber, block: form.block },
        ...additional.map((l) => ({ community: l.community, areaCouncil: l.areaCouncil, sector: l.sector || "", plotNumber: l.plotNumber, block: l.block })),
      ];

      // Pre-flight duplicate check for every land spec (Sector + Plot + Block).
      // Additional lands carry an empty sector; they conflict only with other
      // empty-sector parcels sharing the same Plot/Block.
      for (let i = 0; i < landSpecs.length; i++) {
        const s = landSpecs[i];
        const existing = await findExistingParcel(
          { plotNumber: s.plotNumber, block: s.block, sector: s.sector },
          `register-dupchk-${i}`
        );
        if (existing) {
          const which = i === 0 ? "The main land" : `Additional land #${i}`;
          await log("parcel_registration_failed", "parcels", `Duplicate ${which} Sector ${s.sector || "—"} · Plot ${s.plotNumber}/${s.block} (matches ${existing.parcelNumber})`);
          toast({ variant: "destructive", title: "Duplicate registration", description: `${which} (Sector ${s.sector || "—"}, Plot ${s.plotNumber}, Block ${s.block}) already exists (Land ID: ${existing.parcelNumber}, Owner: ${existing.applicantName || "—"}). Use a different Plot/Block combination or edit the existing record.` });
          setSaving(false);
          return;
        }
      }

      // Register each land spec as its own parcel record. Partial failures
      // are reported truthfully per land without losing successful records.
      const results = [];
      for (let i = 0; i < landSpecs.length; i++) {
        const s = landSpecs[i];
        try {
          const autoPN = await generateParcelNumber(s.community, parcelFields.registrationDate);
          const rec = await pb.collection("parcels").create({
            owner: user.id,
            parcelNumber: autoPN,
            office: parcelFields.office || "",
            applicantName: parcelFields.applicantName,
            contactPhone: parcelFields.contactPhone,
            alternateMobile: parcelFields.alternateMobile,
            alternateNumber2: parcelFields.alternateNumber2 || "",
            whatsapp: parcelFields.whatsapp,
            applicantEmail: parcelFields.applicantEmail,
            religion: parcelFields.religion,
            tribe: parcelFields.tribe,
            areaCouncil: s.areaCouncil,
            community: s.community,
            sector: s.sector || "",
            plotNumber: s.plotNumber,
            block: s.block,
            additionalLands: [],
            allocationDate: parcelFields.allocationDate || null,
            registrationDate: parcelFields.registrationDate || null,
            status: "registered",
          }, { requestKey: `reg-${i}-${Date.now()}` });
          await log("parcel_registered", "parcels", `${rec.parcelNumber} — ${rec.applicantName}${i > 0 ? " (additional land)" : ""}`);
          results.push({ ok: true, rec, spec: s, index: i });

          // Linked payment record only for the main parcel — the registration
          // fee covers the whole session, so it is not duplicated per land
          // (keeps revenue statistics accurate).
          if (i === 0 && paymentAmount && parseFloat(paymentAmount) > 0) {
            try {
              await pb.collection("payments").create({
                payer: user.id,
                parcel: rec.id,
                invoiceNumber: `INV-${rec.parcelNumber}`,
                purpose: "registration_fee",
                amount: parseFloat(paymentAmount),
                method: paymentMethod || "cash",
                status: paymentStatus || "pending",
                parcelNumber: rec.parcelNumber,
                plotNumber: s.plotNumber,
                block: s.block,
                areaCouncil: s.areaCouncil,
                community: s.community,
                sector: s.sector,
                ownerName: parcelFields.applicantName,
                ownerPhone: parcelFields.contactPhone,
                ownerEmail: parcelFields.applicantEmail,
              }, { requestKey: `pay-${rec.id}` });
              await log("payment_created", "payments", `Payment GHS ${paymentAmount} for ${rec.parcelNumber}`);
            } catch (_) {}
          }

          // Confirmation SMS per registered land (all contact numbers except WhatsApp)
          {
            const smsMsg = `Dear ${parcelFields.applicantName}, your land registration (ID: ${rec.parcelNumber}) for Plot ${s.plotNumber || 'N/A'}/Block ${s.block || 'N/A'} in ${s.areaCouncil || 'N/A'}, ${s.community || 'N/A'} has been successfully registered. Ref: ${rec.parcelNumber}. Status: Registered. - TeNDA PPD`;
            const phones = [parcelFields.contactPhone, parcelFields.alternateMobile, parcelFields.alternateNumber2].filter(Boolean);
            for (const ph of phones) await sendSms(ph, smsMsg).catch(() => {});
          }
        } catch (err) {
          const data = err?.response?.data || err?.data;
          let reason = err?.message || "Unknown error";
          if (data && typeof data === "object" && Object.keys(data).length) {
            reason = Object.entries(data).map(([f, e]) => `${titleCase(f)}: ${e?.message || e}`).join(" · ");
          }
          results.push({ ok: false, reason, spec: s, index: i });
        }
      }

      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);

      if (succeeded.length === 0) {
        toast({ variant: "destructive", title: "Registration failed", description: `No lands could be registered. ${failed[0]?.reason || "Please try again."}` });
      } else {
        const ids = succeeded.map((r) => r.rec.parcelNumber).join(", ");
        toast({
          title: `${succeeded.length} parcel${succeeded.length !== 1 ? "s" : ""} registered`,
          description: `${ids} registered successfully.${failed.length ? ` ${failed.length} additional land(s) failed.` : ""}${(paymentAmount && parseFloat(paymentAmount) > 0) ? " Payment record created." : ""}`,
        });
        setRegisterOpen(false);
        setForm({ ...EMPTY_FORM });
        reload();
      }
    } catch (err) {
      const data = err?.response?.data || err?.data;
      let desc = err?.message || "Please try again.";
      if (data && typeof data === "object" && Object.keys(data).length) {
        desc = Object.entries(data).map(([f, e]) => `${titleCase(f)}: ${e?.message || e}`).join(" · ");
      }
      await log("parcel_registration_failed", "parcels", `${form.applicantName}: ${desc}`);
      toast({ variant: "destructive", title: "Could not register", description: desc });
    } finally {
      setSaving(false);
    }
  };

  // Bulk operations (admin only)
  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const selectAll = () => setSelectedIds(filtered.map((p) => p.id));
  const clearSelection = () => setSelectedIds([]);

  const runBulk = async (op, label, fn) => {
    const ids = [...selectedIds];
    const total = ids.length;
    setBulkProgress({ done: 0, total, op: label });
    let done = 0, failed = 0;
    const BATCH = 5;
    startOperation();
    try {
      for (let i = 0; i < total; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const results = await Promise.allSettled(batch.map((id) => fn(id)));
        results.forEach((r) => { if (r.status === "fulfilled") done++; else failed++; });
        setBulkProgress({ done: i + batch.length, total, op: label });
      }
    } finally {
      endOperation();
    }
    await log(`bulk_${op}`, "parcels", `${label}: ${done}/${total} succeeded`);
    toast({ title: `Bulk ${label} complete`, description: `${done} succeeded${failed ? `, ${failed} failed` : ""}.` });
    setBulkProgress(null); clearSelection(); reload();
  };

  const bulkRegister = async () => {
    if (!window.confirm(`Register ${selectedIds.length} selected parcels?`)) return;
    await runBulk("register", "Register", (id) => pb.collection("parcels").update(id, { status: "registered" }, { requestKey: `breg-${id}` }));
  };

  const bulkDispute = async () => {
    if (!window.confirm(`Mark ${selectedIds.length} selected parcels as disputed?`)) return;
    await runBulk("dispute", "Dispute", (id) => pb.collection("parcels").update(id, { status: "disputed" }, { requestKey: `bdisp-${id}` }));
  };

  // submitBulkAmend, submitBulkCommunity, submitBulkSector moved to /app/amendments

  const bulkUpdateStatus = async () => {
    if (!window.confirm(`Update ${selectedIds.length} parcels to "${bulkStatus}"?`)) return;
    await runBulk("status", `Set ${bulkStatus}`, (id) => pb.collection("parcels").update(id, { status: bulkStatus }, { requestKey: `bst-${id}` }));
  };

  const bulkDelete = async () => {
    const reason = window.prompt(`Permanently delete ${selectedIds.length} selected parcels? This CANNOT be undone.\nEnter reason (required):`, "Bulk permanent deletion by admin");
    if (reason === null) return;
    // Snapshot ids and parcel numbers before deletion
    const toDelete = records.filter((r) => selectedIds.includes(r.id));
    await runBulk("permanent_delete", "Permanent Delete", async (id) => {
      const parcel = toDelete.find((r) => r.id === id);
      const { errors } = await deleteParcelCompletely(id, parcel?.parcelNumber || "");
      if (errors.length) console.warn("deleteParcelCompletely errors", id, errors);
      await log("parcel_permanent_deleted", "parcels", `Bulk permanent delete — Reason: ${reason} — By: ${user.email}`);
    });
    setSoftDeletedIds((prev) => { const n = new Set(prev); selectedIds.forEach((id) => n.delete(id)); return n; });
  };

  const saveEdit = async () => {
    if (!editParcel) return;
    // Validate additional land entries
    const lands = normalizeAdditionalLands(editParcel.additionalLands);
    for (let i = 0; i < lands.length; i++) {
      const r = lands[i];
      if (!r.areaCouncil || !r.community || !r.sector || !r.plotNumber || !r.block) {
        toast({ variant: "destructive", title: "Incomplete additional land", description: `Additional land #${i + 1}: Area Council, Community, Sector, Plot Number and Block are all required.` });
        return;
      }
    }
    const seenEdit = {};
    for (const r of lands) {
      const key = `${r.sector}|${r.plotNumber}|${r.block}`.toLowerCase();
      if (seenEdit[key]) {
        toast({ variant: "destructive", title: "Duplicate additional land", description: `Sector ${r.sector || "—"} / Plot ${r.plotNumber} / Block ${r.block} appears more than once.` });
        return;
      }
      seenEdit[key] = true;
    }
    setSaving(true);
    try {
      // Duplicate check: Sector + Plot + Block must not match another parcel
      const existing = await findExistingParcel(
        { plotNumber: editParcel.plotNumber, block: editParcel.block, sector: editParcel.sector },
        "edit-dupchk",
        editParcel.id,
      );
      if (existing) {
        toast({ variant: "destructive", title: "Duplicate combination", description: `Another parcel with Sector ${editParcel.sector || "—"}, Plot ${editParcel.plotNumber}, Block ${editParcel.block} already exists (Land ID: ${existing.parcelNumber}). Use a different Sector/Plot/Block combination.` });
        setSaving(false);
        return;
      }
      await pb.collection("parcels").update(editParcel.id, {
        applicantName: editParcel.applicantName,
        contactPhone: editParcel.contactPhone,
        alternateMobile: editParcel.alternateMobile,
        alternateNumber2: editParcel.alternateNumber2 || "",
        whatsapp: editParcel.whatsapp,
        applicantEmail: editParcel.applicantEmail,
        religion: editParcel.religion,
        tribe: editParcel.tribe,
        office: editParcel.office || "",
        areaCouncil: editParcel.areaCouncil,
        community: editParcel.community,
        sector: editParcel.sector,
        plotNumber: editParcel.plotNumber,
        block: editParcel.block,
        additionalLands: normalizeAdditionalLands(editParcel.additionalLands),
        allocationDate: editParcel.allocationDate || null,
        registrationDate: editParcel.registrationDate || null,
      });
      await log("parcel_amended", "parcels", `${editParcel.parcelNumber} amended`);
      toast({ title: "Parcel updated" });
      setEditParcel(null);
      reload();
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    await pb.collection("parcels").update(id, { status });
    await log("parcel_status_update", "parcels", `Set ${status} on ${id}`);
    reload();
  };

  const flagDispute = async (parcel) => {
    await pb.collection("parcels").update(parcel.id, { status: "disputed" });
    await log("parcel_disputed", "parcels", `Dispute flagged for ${parcel.parcelNumber}`);
    toast({ title: "Dispute flagged" });
    reload();
  };

  const handleEdit = (p) => {
    // Admin and planning_officer can edit directly; others request approval
    if (isApprover) {
      setEditParcel({ ...p });
    } else {
      setEditRequestParcel(p);
    }
  };

  const handleDelete = (p) => {
    if (isAdmin) {
      // Admin always gets permanent delete directly
      setPermDeleteDialog(p);
      setPermDeleteReason("");
    } else if (isApprover) {
      // Planning officer gets soft-delete dialog
      setDeleteDialog(p);
      setDeleteReason("");
    } else {
      // Create delete request
      pb.collection("land_edit_requests").create({
        parcel: p.id, requestedBy: user.id, type: "delete",
        proposedChanges: {}, reason: "User requested deletion", status: "pending",
      }).then(() => toast({ title: "Delete request submitted", description: "Awaiting approval." }))
        .catch((err) => toast({ variant: "destructive", title: "Failed", description: err?.message }));
    }
  };

  const confirmSoftDelete = async () => {
    if (!deleteDialog) return;
    const p = deleteDialog;
    if (!deleteReason.trim()) {
      toast({ variant: "destructive", title: "Please enter a deletion reason" }); return;
    }
    try {
      await pb.collection("audit_logs").create({
        actor: user.id, action: "parcel_soft_deleted", entity: p.id,
        details: JSON.stringify({ reason: deleteReason, deletedBy: user.email, parcelNumber: p.parcelNumber, timestamp: new Date().toISOString() }),
      });
      setSoftDeletedIds((prev) => new Set([...prev, p.id]));
      toast({ title: "Record soft-deleted", description: `${p.parcelNumber} marked as deleted. It remains in the system.` });
      await log("parcel_soft_deleted", "parcels", `Soft-deleted ${p.parcelNumber}: ${deleteReason}`);
      setDeleteDialog(null); setDeleteReason("");
    } catch (err) {
      toast({ variant: "destructive", title: "Failed", description: err?.message });
    }
  };

  const confirmPermDelete = async () => {
    if (!permDeleteDialog || permDeleting) return;
    const p = permDeleteDialog;
    if (!permDeleteReason.trim()) {
      toast({ variant: "destructive", title: "Please enter a reason for permanent deletion" }); return;
    }
    setPermDeleting(true);
    try {
      // Log before deletion so the entry still belongs to the record context
      await log("parcel_permanent_deleted", "parcels", `Permanently deleted — Reason: ${permDeleteReason} — By: ${user.email} — Parcel: ${p.parcelNumber}`);
      // Comprehensive cascade delete: related records, audit_logs refs, notifications
      const { errors } = await deleteParcelCompletely(p.id, p.parcelNumber);
      if (errors.length) console.warn("deleteParcelCompletely errors", p.id, errors);
      toast({ title: "Record permanently deleted", description: "The record and all related data have been removed." });
      setSoftDeletedIds((prev) => { const next = new Set(prev); next.delete(p.id); return next; });
      setPermDeleteDialog(null); setPermDeleteReason("");
      reload();
    } catch (err) {
      console.error("Permanent delete failed", err);
      const detail = err?.status === 403
        ? "You do not have permission to permanently delete this record."
        : (err?.response?.data?.message || err?.response?.message || err?.message || "Unknown error");
      try { await log("parcel_permanent_delete_failed", "parcels", `${p.parcelNumber}: ${detail}`); } catch (_) {}
      toast({ variant: "destructive", title: "Permanent delete failed", description: `${detail} You can retry.` });
    } finally {
      setPermDeleting(false);
    }
  };

  const handleRestore = async (p) => {
    if (!window.confirm(`Restore parcel ${p.parcelNumber}?`)) return;
    try {
      await pb.collection("audit_logs").create({
        actor: user.id, action: "parcel_restored", entity: p.id,
        details: JSON.stringify({ restoredBy: user.email, parcelNumber: p.parcelNumber, timestamp: new Date().toISOString() }),
      });
      setSoftDeletedIds((prev) => { const n = new Set(prev); n.delete(p.id); return n; });
      toast({ title: "Record restored", description: `${p.parcelNumber} is now active again.` });
      await log("parcel_restored", "parcels", `Restored ${p.parcelNumber}`);
    } catch (err) {
      toast({ variant: "destructive", title: "Restore failed", description: err?.message });
    }
  };

  const EXPORT_FIELDS = ["parcelNumber", "applicantName", "contactPhone", "alternateMobile", "alternateNumber2", "whatsapp", "applicantEmail",
    "religion", "tribe", "areaCouncil", "community", "sector", "plotNumber", "block", "allocationDate", "registrationDate", "status", "created", "additionalLands"];
  const EXPORT_HEADERS = [...EXPORT_FIELDS, "hiddenStatus", "hiddenReason"];

  const getExportData = (includeHidden) => {
    const list = includeHidden ? accessibleRecords : filtered;
    return list.map((p) => {
      const isDel = softDeletedIds.has(p.id);
      const row = {};
      EXPORT_FIELDS.forEach((h) => {
        if (h === "additionalLands") {
          const lands = normalizeAdditionalLands(p.additionalLands);
          row[h] = lands.length ? lands.map((l) => `${l.community}|${l.areaCouncil}|${l.sector}|${l.plotNumber}|${l.block}`).join("; ") : "";
        } else {
          row[h] = p[h] || "";
        }
      });
      row.hiddenStatus = isDel ? "DELETED" : "ACTIVE";
      row.hiddenReason = isDel ? "soft-deleted" : "";
      return row;
    });
  };

  const handleSQLExport = (includeHidden = false) => {
    downloadSQL({ scope: "schema+data", includeHidden })
      .then((res) => toast({ title: "SQL exported", description: res.filename }))
      .catch((e) => toast({ variant: "destructive", title: "SQL export failed", description: e.message }));
  };

  const exportCSV = (includeHidden = false) => {
    const data = getExportData(includeHidden);
    const rows = [EXPORT_HEADERS, ...data.map((r) => EXPORT_HEADERS.map((h) => r[h] || ""))];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const suffix = includeHidden ? "-all-including-hidden" : "";
    const a = document.createElement("a"); a.href = url; a.download = `parcels${suffix}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = (includeHidden = false, fmt = "xlsx") => {
    const XLSX = window.__XLSX__ || null;
    // XLSX is already imported at top for import parsing — use the same bundle
    import("xlsx").then((XL) => {
      const data = getExportData(includeHidden);
      const wsData = [EXPORT_HEADERS, ...data.map((r) => EXPORT_HEADERS.map((h) => r[h] || ""))];
      const ws = XL.utils.aoa_to_sheet(wsData);
      // Column widths
      ws["!cols"] = EXPORT_HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
      const wb = XL.utils.book_new();
      XL.utils.book_append_sheet(wb, ws, "Parcels");
      const suffix = includeHidden ? "-all-including-hidden" : "";
      const bookType = fmt === "xls" ? "biff8" : "xlsx";
      XL.writeFile(wb, `parcels${suffix}.${fmt}`, { bookType, type: "binary" });
    }).catch(() => toast({ variant: "destructive", title: "Export failed", description: "Could not load spreadsheet library." }));
  };

  const exportPDF = (includeHidden = false) => {
    import("jspdf").then(({ default: jsPDF }) => {
      const data = getExportData(includeHidden);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const title = "Techiman North District — Land Parcels Export";
      const dateStr = new Date().toLocaleDateString();
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, 14);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${dateStr}  |  Records: ${data.length}${includeHidden ? "  (including hidden)" : ""}`, 14, 21);

      // Table columns — use a subset that fits landscape A4
      const cols = ["parcelNumber", "applicantName", "contactPhone", "areaCouncil", "community", "plotNumber", "block", "status", "hiddenStatus"];
      const colLabels = ["Parcel No.", "Applicant", "Phone", "Area Council", "Community", "Plot", "Block", "Status", "Hidden"];
      const colWidths = [28, 36, 26, 30, 28, 18, 16, 24, 16];
      const startY = 27;
      let y = startY;
      const rowH = 7;
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 10;

      // Header row
      doc.setFillColor(30, 64, 120);
      doc.rect(margin, y, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      let x = margin;
      colLabels.forEach((lbl, i) => { doc.text(lbl, x + 1, y + 5); x += colWidths[i]; });
      y += rowH;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      data.forEach((row, idx) => {
        if (y + rowH > pageH - margin) {
          doc.addPage();
          y = margin;
          // re-draw header
          doc.setFillColor(30, 64, 120);
          doc.rect(margin, y, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          let hx = margin;
          colLabels.forEach((lbl, i) => { doc.text(lbl, hx + 1, y + 5); hx += colWidths[i]; });
          y += rowH;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
        }
        const bg = row.hiddenStatus === "DELETED" ? [255, 235, 230] : (idx % 2 === 0 ? [248, 250, 252] : [255, 255, 255]);
        doc.setFillColor(...bg);
        doc.rect(margin, y, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
        doc.setTextColor(40, 40, 40);
        let cx = margin;
        cols.forEach((key, i) => {
          const val = String(row[key] || "");
          const maxChars = Math.floor(colWidths[i] / 1.8);
          const txt = val.length > maxChars ? val.slice(0, maxChars - 1) + "…" : val;
          doc.text(txt, cx + 1, y + 5);
          cx += colWidths[i];
        });
        y += rowH;
      });

      // Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Page ${p} of ${totalPages}`, doc.internal.pageSize.getWidth() / 2, pageH - 5, { align: "center" });
      }

      const suffix = includeHidden ? "-all-including-hidden" : "";
      doc.save(`parcels${suffix}.pdf`);
    }).catch(() => toast({ variant: "destructive", title: "Export failed", description: "Could not load PDF library." }));
  };

  const editFormValue = editParcel ? {
    applicantName: editParcel.applicantName || "",
    contactPhone: editParcel.contactPhone || "",
    alternateMobile: editParcel.alternateMobile || "",
    alternateNumber2: editParcel.alternateNumber2 || "",
    whatsapp: editParcel.whatsapp || "",
    applicantEmail: editParcel.applicantEmail || "",
    religion: editParcel.religion || "",
    tribe: editParcel.tribe || "",
    office: editParcel.office || "",
    areaCouncil: editParcel.areaCouncil || "",
    community: editParcel.community || "",
    sector: editParcel.sector || "",
    plotNumber: editParcel.plotNumber || "",
    block: editParcel.block || "",
    allocationDate: editParcel.allocationDate ? editParcel.allocationDate.split(" ")[0] : "",
    registrationDate: editParcel.registrationDate ? editParcel.registrationDate.split(" ")[0] : "",
    additionalLands: normalizeAdditionalLands(editParcel.additionalLands),
  } : { ...EMPTY_FORM };

  const setEditFormValue = (updater) => {
    setEditParcel((prev) => {
      const updated = typeof updater === "function" ? updater(editFormValue) : updater;
      return { ...prev, ...updated };
    });
  };

  const formACs = userACs || ALL_AREA_COUNCILS;

  return (
    <>
      <PageHeader
        title="Land Registration"
        subtitle={isCitizen ? "Register and manage your land parcels" : "District land parcel register"}
        icon={MapPinned}
        action={
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="mr-1 h-4 w-4" /> Import
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={runDuplicateScan}>
              <Copy className="mr-1 h-4 w-4" /> Duplicates
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-1 h-4 w-4" /> Export
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => handleSQLExport(false)}><span className="font-mono text-xs mr-1">.sql</span> SQL — Active records</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCSV(false)}>CSV — Active records</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportXLSX(false, "xlsx")}>XLSX — Active records</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportXLSX(false, "xls")}>XLS — Active records</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPDF(false)}>PDF — Active records</DropdownMenuItem>
                {softDeletedIds.size > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleSQLExport(true)} className="text-orange-700"><span className="font-mono text-xs mr-1">.sql</span> SQL — All incl. hidden</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportCSV(true)} className="text-orange-700">CSV — All incl. {softDeletedIds.size} hidden</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportXLSX(true, "xlsx")} className="text-orange-700">XLSX — All incl. hidden</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportXLSX(true, "xls")} className="text-orange-700">XLS — All incl. hidden</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportPDF(true)} className="text-orange-700">PDF — All incl. hidden</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => { setForm({ ...EMPTY_FORM, areaCouncil: user?.areaCouncilRef || defaultAC, office: user?.officeRef || "" }); setRegisterOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Register parcel
            </Button>
          </div>
        }
      />

      {/* Approvals panel */}
      <ApprovalsPanel userId={user.id} isApprover={isApprover} reload={reload} />

      {/* Hidden lands alert banner */}
      {softDeletedIds.size > 0 && deletionFilter === "active" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <EyeOff className="h-5 w-5 shrink-0 text-orange-600" />
            <div>
              <p className="text-sm font-semibold text-orange-900 dark:text-orange-300">
                {softDeletedIds.size} hidden land record{softDeletedIds.size !== 1 ? "s" : ""} not shown
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400">
                These records are soft-deleted and hidden from the active view. They can be restored at any time.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="border-orange-300 text-orange-800 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300"
              onClick={() => setDeletionFilter("deleted")}>
              <EyeOff className="mr-1 h-3.5 w-3.5" /> View hidden
            </Button>
            <Button size="sm" variant="outline" className="border-orange-300 text-orange-800 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300"
              onClick={() => setDeletionFilter("all")}>
              Show all
            </Button>
          </div>
        </div>
      )}

      {/* Filters + View Mode */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search by name, ID, plot, community…" className="pl-9 h-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : titleCase(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={deletionFilter} onValueChange={setDeletionFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="all">Show all</SelectItem>
              <SelectItem value="deleted">Deleted only</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={() => setShowMoreFilters((v) => !v)}
            className={cn("flex items-center gap-1.5 rounded-lg border px-3 h-9 text-xs font-medium transition",
              showMoreFilters ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
            <Filter className="h-3.5 w-3.5" />
            More filters
            {activeFilterCount > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{activeFilterCount}</span>}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={() => { setFilterStatus("all"); setFilterAC("all"); setFilterCommunity("all"); setFilterSector("all"); setFilterYear("all"); setSearchQ(""); }}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 px-2 h-9">
              Clear all
            </button>
          )}
          {/* Sort controls */}
          <Select value={sortField} onValueChange={setSortField}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
            className="flex items-center gap-1 rounded-lg border border-border px-3 h-9 text-xs font-medium text-muted-foreground hover:border-primary/50 transition"
            title={sortDir === "asc" ? "Sort A-Z (click for Z-A)" : "Sort Z-A (click for A-Z)"}>
            {sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            {sortDir === "asc" ? "A-Z" : "Z-A"}
          </button>
          {/* Column selector (for list view) — portal-rendered to avoid stacking context clipping */}
          <ColumnSelectorPortal
            showColSelector={showColSelector}
            setShowColSelector={setShowColSelector}
            visibleCols={visibleCols}
            toggleCol={toggleCol}
            columns={ALL_PARCEL_COLUMNS}
          />
          <div className="flex rounded-lg border border-border bg-background overflow-hidden ml-auto">
            {VIEW_MODES.map(({ key, label, icon: Icon }) => (
              <button key={key} title={label} onClick={() => switchViewMode(key)}
                className={cn("flex items-center gap-1 px-2.5 py-1.5 text-xs transition",
                  viewMode === key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
        {showMoreFilters && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 border-t border-border pt-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Area Council</label>
              <SearchableSelect value={filterAC} onValueChange={setFilterAC} options={uniqueACs.map((v) => ({ value: v, label: v === "all" ? "All area councils" : v }))} placeholder="All area councils" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Community</label>
              <SearchableSelect value={filterCommunity} onValueChange={setFilterCommunity} options={uniqueCommunities.map((v) => ({ value: v, label: v === "all" ? "All communities" : v }))} placeholder="All communities" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sector</label>
              <SearchableSelect value={filterSector} onValueChange={setFilterSector} options={uniqueSectors.map((v) => ({ value: v, label: v === "all" ? "All sectors" : v }))} placeholder="All sectors" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Year</label>
              <SearchableSelect value={filterYear} onValueChange={setFilterYear} options={uniqueYears.map((v) => ({ value: v, label: v === "all" ? "All years" : v }))} placeholder="All years" className="h-8 text-xs" />
            </div>
          </div>
        )}
      </div>

      {/* Stats pills */}
      <div className="flex flex-wrap gap-2">
        {["registered", "submitted", "disputed", "under_review"].map((s) => {
          const count = accessibleRecords.filter((r) => !softDeletedIds.has(r.id) && r.status === s).length;
          return count > 0 ? (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
              className={cn("rounded-full px-3 py-1 text-xs font-medium transition border",
                filterStatus === s ? "bg-primary text-white border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40")}>
              {titleCase(s)}: {count}
            </button>
          ) : null;
        })}
        {softDeletedIds.size > 0 && (
          <button onClick={() => setDeletionFilter(deletionFilter === "deleted" ? "active" : "deleted")}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition border",
              deletionFilter === "deleted" ? "bg-red-600 text-white border-red-600" : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100")}>
            Deleted: {softDeletedIds.size}
          </button>
        )}
        {Object.keys(transferMap).length > 0 && (
          <span className="rounded-full bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 text-xs font-medium">
            Transferred: {Object.keys(transferMap).length}
          </span>
        )}
        <span className="ml-auto self-center text-xs text-muted-foreground">
          {filtered.length} of {accessibleRecords.length} parcels
        </span>
      </div>
      {/* Bulk operations toolbar */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bulk operations</span>
          <Button size="sm" variant="outline" onClick={selectAll}>Select all ({filtered.length})</Button>
          {selectedIds.length > 0 && <span className="text-sm text-primary font-semibold">{selectedIds.length} selected</span>}
          {selectedIds.length > 0 && <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>}
        </div>
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {canBulkRegister && (
              <Button size="sm" onClick={bulkRegister} disabled={!!bulkProgress}>
                <FileCheck className="mr-1 h-3.5 w-3.5" /> Bulk Register
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50"
              onClick={bulkDispute} disabled={!!bulkProgress}>
              <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Bulk Dispute
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/app/amendments")} disabled={!!bulkProgress}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Bulk Amendment
            </Button>
            {canBulkUpdateHierarchy && (
              <Button size="sm" variant="outline" onClick={() => navigate("/app/amendments")} disabled={!!bulkProgress}>
                Update Area / Community / Sector
              </Button>
            )}
            {isAdmin && (
              <>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["submitted","under_survey","under_review","registered","rejected"].map((s) => (
                      <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={bulkUpdateStatus} disabled={!!bulkProgress}>Set Status</Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={bulkDelete} disabled={!!bulkProgress}>
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Bulk Permanent Delete
                </Button>
              </>
            )}
          </div>
        )}
        {bulkProgress && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-primary">{bulkProgress.op}</span>
              <span className="font-mono font-bold text-primary">{Math.round((bulkProgress.done / bulkProgress.total) * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                <div className="h-full bg-primary transition-all duration-150 rounded-full"
                  style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{bulkProgress.done}/{bulkProgress.total}</span>
            </div>
          </div>
        )}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={MapPinned} title="No parcels found"
          message={accessibleRecords.length === 0 ? "Register your first land parcel to begin the titling process." : "No parcels match your current filters."} />
      ) : (
        <div className={cn(
          "gap-3",
          viewMode === "small" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" :
          viewMode === "list" ? "flex flex-col" :
          viewMode === "large" ? "grid gap-4 lg:grid-cols-2" :
          "grid gap-4 md:grid-cols-2"
        )}>
          {parcelPageItems.map((p) => {
            const isDel = softDeletedIds.has(p.id);
            const tInfo = transferMap[p.id] || null;
            return (
              <div key={p.id} className="relative">
                {viewMode !== "list" && (
                  <input type="checkbox" checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="absolute left-3 top-3 z-10 h-4 w-4 rounded accent-primary cursor-pointer" />
                )}
                {viewMode === "list" && (
                  <input type="checkbox" checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-4 w-4 rounded accent-primary cursor-pointer" />
                )}
                <div className={viewMode === "list" ? "pl-7" : ""}>
                  <ParcelCard p={p} isStaff={isStaff} isCitizen={isCitizen} isApprover={isApprover} isAdmin={isAdmin}
                    isDeleted={isDel} isTransferred={!!tInfo} transferInfo={tInfo} viewMode={viewMode} visibleCols={visibleCols}
                    onCert={setCertParcel} onHistory={setHistoryParcel}
                    onEdit={handleEdit} onSetStatus={setStatus} onDispute={flagDispute}
                    onTransfer={setTransferParcel} onDelete={handleDelete} onRestore={handleRestore}
                    onPermDelete={(p) => { setPermDeleteDialog(p); setPermDeleteReason(""); }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination bottom */}
      {filtered.length > 0 && (
        <PaginationControl currentPage={parcelPage} totalPages={parcelTotalPages} totalRecords={parcelTotalRecords} pageSize={parcelPageSize} onPageChange={(p) => { setParcelPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onPageSizeChange={setParcelPageSize} />
      )}

      {/* Register dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-4">
            <DialogTitle>Register a Land Parcel</DialogTitle>
          </DialogHeader>
          <div className="dialog-scroll flex-1 px-6 py-5">
            <ParcelForm form={form} setForm={setForm} onSubmit={submit} onCancel={() => setRegisterOpen(false)}
              saving={saving} submitLabel="Register Parcel" userAreaCouncils={formACs} user={user} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Direct edit dialog (for staff or draft parcels) */}
      <Dialog open={!!editParcel} onOpenChange={(o) => { if (!o) setEditParcel(null); }}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-4">
            <DialogTitle>Amend Parcel — {editParcel?.parcelNumber}</DialogTitle>
          </DialogHeader>
          <div className="dialog-scroll flex-1 px-6 py-5">
            {editParcel && (
              <ParcelForm form={editFormValue} setForm={setEditFormValue}
                onSubmit={saveEdit} onCancel={() => setEditParcel(null)}
                saving={saving} submitLabel="Save Changes" userAreaCouncils={formACs} user={user} mode="edit" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit request dialog (for registered parcels by non-approvers) */}
      <Dialog open={!!editRequestParcel} onOpenChange={(o) => { if (!o) setEditRequestParcel(null); }}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-4">
            <DialogTitle>Request Edit — {editRequestParcel?.parcelNumber}</DialogTitle>
          </DialogHeader>
          <div className="dialog-scroll flex-1 px-6 py-5">
            {editRequestParcel && (
              <EditRequestModal parcel={editRequestParcel} userId={user.id}
                onClose={() => setEditRequestParcel(null)} onDone={reload} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={!!transferParcel} onOpenChange={(o) => { if (!o) setTransferParcel(null); }}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-4">
            <DialogTitle>Transfer Land — {transferParcel?.parcelNumber}</DialogTitle>
          </DialogHeader>
          <div className="dialog-scroll flex-1 px-6 py-5">
            {transferParcel && (
              <TransferModal parcel={transferParcel} userId={user.id} isAdmin={isAdmin}
                onClose={() => setTransferParcel(null)} onDone={reload} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Certificate modal */}
      <Dialog open={!!certParcel} onOpenChange={() => setCertParcel(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Land Title Certificate</DialogTitle></DialogHeader>
          {certParcel && <CertificateModal parcel={certParcel} onClose={() => setCertParcel(null)} />}
        </DialogContent>
      </Dialog>

      {/* History modal */}
      <Dialog open={!!historyParcel} onOpenChange={() => setHistoryParcel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Parcel History</DialogTitle></DialogHeader>
          {historyParcel && <HistoryModal parcel={historyParcel} />}
        </DialogContent>
      </Dialog>

      {/* Amendment dialogs replaced by unified /app/amendments page */}

      {/* Import modal (Admin only) */}
      {isAdmin && (
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-xl max-h-[92vh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0"><DialogTitle>Bulk Import Parcels (Admin)</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <ImportModal userId={user.id} onDone={reload} onClose={() => setImportOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Permanent Delete Confirmation Dialog — Admin only */}
      <Dialog open={!!permDeleteDialog} onOpenChange={(o) => { if (!o) { setPermDeleteDialog(null); setPermDeleteReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-800"><Trash2 className="h-4 w-4" /> Permanent Delete — {permDeleteDialog?.parcelNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-red-100 border-2 border-red-400 p-3 text-sm text-red-900">
              <p className="font-bold mb-1 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> WARNING: THIS ACTION IS IRREVERSIBLE</p>
              <p>This will <strong>permanently remove</strong> the record from the database. It cannot be recovered. All related documents, payments, surveys, and transfers will also be deleted.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
              <span><span className="font-medium">Owner:</span> {permDeleteDialog?.applicantName || "—"}</span>
              <span><span className="font-medium">Plot:</span> {permDeleteDialog?.plotNumber || "—"} / {permDeleteDialog?.block || "—"}</span>
              <span><span className="font-medium">Area Council:</span> {permDeleteDialog?.areaCouncil || "—"}</span>
              <span><span className="font-medium">Land ID:</span> {permDeleteDialog?.parcelNumber || "—"}</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reason for Permanent Deletion <span className="text-destructive">*</span></Label>
              <Input value={permDeleteReason} onChange={(e) => setPermDeleteReason(e.target.value)}
                placeholder="Enter reason for permanent deletion…" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPermDeleteDialog(null); setPermDeleteReason(""); }} className="flex-1">Cancel</Button>
              <Button variant="destructive" onClick={confirmPermDelete} disabled={permDeleting} className="flex-1 bg-red-800 hover:bg-red-900">
                <Trash2 className="mr-1 h-4 w-4" /> {permDeleting ? "Deleting…" : "Permanently Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Report Dialog */}
      <Dialog open={dupReportOpen} onOpenChange={setDupReportOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Copy className="h-4 w-4" /> Duplicate Report</DialogTitle></DialogHeader>
          {dupScanning ? <Spinner /> : dupReport ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-muted-foreground">Parcel groups</p><p className="text-lg font-bold">{dupReport.parcels.length}</p></div>
                <div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-muted-foreground">User groups</p><p className="text-lg font-bold">{dupReport.users.length}</p></div>
                <div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-muted-foreground">Transfer groups</p><p className="text-lg font-bold">{dupReport.transfers.length}</p></div>
              </div>
              {[
                { title: "Duplicate land parcels (sector + plot + block)", groups: dupReport.parcels, describe: (r) => `${r.parcelNumber} — ${r.applicantName || "—"} · Sector ${r.sector || "—"} · Plot ${r.plotNumber || "—"}/${r.block || "—"}`, canDelete: isAdmin, col: "parcels" },
                { title: "Duplicate users (phone / name)", groups: dupReport.users, describe: (r) => `${r.fullName || r.name || r.email} · ${r.phone || "—"}`, canDelete: false },
                { title: "Duplicate pending transfers", groups: dupReport.transfers, describe: (r) => `${r.toOwnerName || "—"} · ${formatDate(r.created)}`, canDelete: isAdmin, col: "land_transfers" },
              ].map((section) => (
                <div key={section.title} className="space-y-2">
                  <p className="font-semibold">{section.title}</p>
                  {section.groups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No duplicates found.</p>
                  ) : section.groups.map((g) => (
                    <div key={g.key} className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/20 p-3 space-y-1">
                      {g.records.map((r, idx) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate">{idx === 0 ? "★ Keep: " : "• "}{section.describe(r)}</span>
                          {section.canDelete && idx > 0 && (
                            <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-red-600 border-red-200"
                              onClick={async () => {
                                if (!window.confirm("Permanently delete this duplicate record?")) return;
                                try {
                                  await pb.collection(section.col).delete(r.id);
                                  await log("duplicate_resolved", section.col, `Deleted duplicate ${r.id}`);
                                  toast({ title: "Duplicate removed" });
                                  runDuplicateScan();
                                  reload();
                                } catch (err) {
                                  toast({ variant: "destructive", title: "Delete failed", description: err?.message });
                                }
                              }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
          <Button variant="outline" onClick={() => setDupReportOpen(false)}>Close</Button>
        </DialogContent>
      </Dialog>

      {/* Soft Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(o) => { if (!o) { setDeleteDialog(null); setDeleteReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-700"><Trash2 className="h-4 w-4" /> Soft Delete — {deleteDialog?.parcelNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <p className="font-semibold mb-1">This is a soft delete — the record will remain in the system.</p>
              <p>The land record will be hidden from active listings and color-graded <strong>RED</strong> as DELETED. You can restore it anytime.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
              <span><span className="font-medium">Owner:</span> {deleteDialog?.applicantName || "—"}</span>
              <span><span className="font-medium">Plot:</span> {deleteDialog?.plotNumber || "—"} / {deleteDialog?.block || "—"}</span>
              <span><span className="font-medium">Area Council:</span> {deleteDialog?.areaCouncil || "—"}</span>
              <span><span className="font-medium">Status:</span> {deleteDialog?.status || "—"}</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Deletion Reason <span className="text-destructive">*</span></Label>
              <Input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Enter reason for deleting this record…" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setDeleteDialog(null); setDeleteReason(""); }} className="flex-1">Cancel</Button>
              <Button variant="destructive" onClick={confirmSoftDelete} className="flex-1">
                <Trash2 className="mr-1 h-4 w-4" /> Confirm Soft Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
