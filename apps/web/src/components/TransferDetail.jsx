import React from "react";
import { titleCase, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Normalise a land_transfers record (with expansions) plus the payment list
// into a single flat row used by the transfer dashboards, detail view and exports.
export function buildTransferRow(t, payments = []) {
  const parcel = t.expand?.parcel || {};
  const fromOwner = t.expand?.fromOwner || {};
  const toOwnerUser = t.expand?.toOwnerUser || null;
  const history = Array.isArray(t.ownershipHistory) ? t.ownershipHistory : [];
  const latest = history[history.length - 1] || {};
  const payment = payments.find((p) => p.transfer === t.id)
    || payments.find((p) => p.parcel === t.parcel && p.purpose === "transfer_fee")
    || null;

  return {
    id: t.id,
    certificateNumber: t.certificateNumber || "",
    status: t.status || "pending",
    created: t.created,
    updated: t.updated,
    reason: t.reason || "",
    reviewComment: t.reviewComment || "",
    reviewedByName: t.expand?.reviewedBy?.fullName || t.expand?.reviewedBy?.name || t.expand?.reviewedBy?.email || "",
    reviewedByPhone: t.expand?.reviewedBy?.phone || "",
    transferLetter: t.transferLetter || "",

    // Land details
    parcelId: t.parcel,
    parcelNumber: parcel.parcelNumber || "",
    community: parcel.community || "",
    sector: parcel.sector || "",
    plotNumber: parcel.plotNumber || "",
    block: parcel.block || "",
    areaCouncil: parcel.areaCouncil || "",
    landStatus: parcel.status || "",
    allocationDate: latest.allocationDate || parcel.allocationDate || "",
    registrationDate: latest.registrationDate || parcel.registrationDate || "",

    // Current (initiating) owner
    applicantId: t.fromOwner,
    applicantName: fromOwner.fullName || fromOwner.name || fromOwner.email || parcel.applicantName || "—",
    applicantPhone: fromOwner.phone || parcel.contactPhone || "",
    applicantEmail: fromOwner.email || parcel.applicantEmail || "",

    // New owner
    toOwnerUserId: t.toOwnerUser || "",
    toOwnerName: t.toOwnerName || toOwnerUser?.fullName || "",
    toOwnerPhone: t.toOwnerPhone || toOwnerUser?.phone || "",
    newOwnerEmail: latest.newOwnerEmail || toOwnerUser?.email || "",
    newOwnerGhanaCard: latest.newOwnerGhanaCard || toOwnerUser?.ghanaCard || "",
    newOwnerAlternateMobile: latest.newOwnerAlternateMobile || "",
    newOwnerWhatsapp: latest.newOwnerWhatsapp || toOwnerUser?.whatsappNumber || "",
    newOwnerReligion: latest.newOwnerReligion || "",
    newOwnerTribe: latest.newOwnerTribe || "",

    // Payment
    paymentId: payment?.id || "",
    paymentAmount: payment?.amount ?? 0,
    paymentMethod: payment?.method || "",
    paymentStatus: payment?.status || "unpaid",
    paymentDate: payment?.created || "",
    paymentReference: payment?.invoiceNumber || "",

    ownershipHistory: history,
    raw: t,
  };
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

// Full read-only detail view of a transfer request.
export default function TransferDetail({ row }) {
  if (!row) return null;
  const ghs = (n) => `GHS ${(Number(n) || 0).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <Section title="Land Details">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Field label="Land ID" value={row.parcelNumber} />
          <Field label="Community" value={row.community} />
          <Field label="Sector" value={row.sector} />
          <Field label="Plot Number" value={row.plotNumber} />
          <Field label="Block" value={row.block} />
          <Field label="Area Council" value={row.areaCouncil} />
          <Field label="Land Status" value={row.landStatus ? titleCase(row.landStatus) : "—"} />
          <Field label="Allocation Date" value={row.allocationDate ? formatDate(row.allocationDate) : "—"} />
          <Field label="Registration Date" value={row.registrationDate ? formatDate(row.registrationDate) : "—"} />
        </div>
      </Section>

      <Section title="Current Owner (transfer initiator)">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Field label="Name" value={row.applicantName} />
          <Field label="Contact" value={row.applicantPhone} />
          <Field label="Email" value={row.applicantEmail} />
        </div>
      </Section>

      <Section title="New Owner Details">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Field label="Name" value={row.toOwnerName} />
          <Field label="Contact" value={row.toOwnerPhone} />
          <Field label="Email" value={row.newOwnerEmail} />
          <Field label="Ghana Card" value={row.newOwnerGhanaCard} />
          <Field label="Alternate Contact" value={row.newOwnerAlternateMobile} />
          <Field label="WhatsApp" value={row.newOwnerWhatsapp} />
          <Field label="Religion" value={row.newOwnerReligion} />
          <Field label="Tribe" value={row.newOwnerTribe} />
        </div>
      </Section>

      <Section title="Payment Details">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Field label="Amount" value={ghs(row.paymentAmount)} />
          <Field label="Method" value={row.paymentMethod ? titleCase(row.paymentMethod) : "—"} />
          <Field label="Status" value={titleCase(row.paymentStatus || "unpaid")} />
          <Field label="Payment Date" value={row.paymentDate ? formatDate(row.paymentDate) : "—"} />
          <Field label="Reference" value={row.paymentReference} />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
          <span>Total payable</span>
          <span className="font-mono">{ghs(row.paymentAmount)}</span>
        </div>
      </Section>

      <Section title="Transfer History">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Field label="Transfer Date" value={row.created ? formatDate(row.created) : "—"} />
          <Field label="Transfer Officer" value={row.reviewedByName} />
          <Field label="Transfer Reason" value={row.reason} />
          <Field label="Transfer Status" value={titleCase(row.status)} />
          {row.status === "approved" && <Field label="Approval Date" value={row.updated ? formatDate(row.updated) : "—"} />}
          {row.status === "rejected" && <Field label="Rejection Reason" value={row.reviewComment} />}
        </div>
        {row.ownershipHistory.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            {row.ownershipHistory.map((h, i) => (
              <div key={i} className={cn("rounded-lg border border-border bg-card p-2.5 text-xs")}>
                <p className="font-semibold">{h.previousOwner || "—"} → {h.newOwnerName || "—"}</p>
                <p className="text-muted-foreground">
                  {h.transferDate ? formatDate(h.transferDate) : "—"}
                  {h.newOwnerPhone ? ` · ${h.newOwnerPhone}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Exports ────────────────────────────────────────────────────────────────
const EXPORT_COLUMNS = [
  ["Transfer ID", (r) => r.certificateNumber || r.id],
  ["Status", (r) => titleCase(r.status)],
  ["Applicant", (r) => r.applicantName],
  ["Applicant Contact", (r) => r.applicantPhone],
  ["Land ID", (r) => r.parcelNumber],
  ["Community", (r) => r.community],
  ["Sector", (r) => r.sector],
  ["Plot Number", (r) => r.plotNumber],
  ["Block", (r) => r.block],
  ["Area Council", (r) => r.areaCouncil],
  ["New Owner", (r) => r.toOwnerName],
  ["New Owner Contact", (r) => r.toOwnerPhone],
  ["New Owner Email", (r) => r.newOwnerEmail],
  ["Payment Amount", (r) => Number(r.paymentAmount) || 0],
  ["Payment Method", (r) => (r.paymentMethod ? titleCase(r.paymentMethod) : "")],
  ["Payment Status", (r) => titleCase(r.paymentStatus || "unpaid")],
  ["Payment Reference", (r) => r.paymentReference],
  ["Transfer Date", (r) => (r.created ? formatDate(r.created) : "")],
  ["Officer", (r) => r.reviewedByName],
  ["Review Comment", (r) => r.reviewComment],
];

function statsRows(stats) {
  return [
    ["Metric", "Value"],
    ["Total transfer requests", stats.total],
    ["Pending requests", stats.pending],
    ["Approved requests", stats.approved],
    ["Rejected requests", stats.rejected],
    ["Paid requests", stats.paid],
    ["Unpaid requests", stats.unpaid],
  ];
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTransfersCSV(rows, filename = "transfers", stats = null) {
  const table = stats
    ? statsRows(stats)
    : [EXPORT_COLUMNS.map(([h]) => h), ...rows.map((r) => EXPORT_COLUMNS.map(([, fn]) => fn(r) ?? ""))];
  const csv = table.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadBlob(csv, `${filename}.csv`, "text/csv");
}

export function exportTransfersXLSX(rows, filename = "transfers") {
  return import("xlsx").then((XL) => {
    const data = [EXPORT_COLUMNS.map(([h]) => h), ...rows.map((r) => EXPORT_COLUMNS.map(([, fn]) => fn(r) ?? ""))];
    const ws = XL.utils.aoa_to_sheet(data);
    ws["!cols"] = EXPORT_COLUMNS.map(([h]) => ({ wch: Math.max(h.length + 2, 14) }));
    const wb = XL.utils.book_new();
    XL.utils.book_append_sheet(wb, ws, "Transfers");
    XL.writeFile(wb, `${filename}.xlsx`);
  });
}

export function exportTransferPDF(row) {
  return import("jspdf").then(({ default: jsPDF }) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Land Transfer Request", 14, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Reference: ${row.certificateNumber || row.id}`, 14, y);
    y += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
    y += 8;

    EXPORT_COLUMNS.forEach(([label, fn]) => {
      const value = String(fn(row) ?? "");
      if (y > 280) { doc.addPage(); y = 16; }
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(value.slice(0, 90), 70, y);
      y += 6;
    });

    doc.save(`transfer-${row.certificateNumber || row.id}.pdf`);
  });
}
