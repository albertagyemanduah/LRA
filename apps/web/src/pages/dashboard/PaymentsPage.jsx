import React, { useState, useMemo, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
import { Document as DocxDocument, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import {
  Wallet, Plus, CheckCircle2, Receipt, Download, RefreshCw, Bell, Filter,
  Search, TrendingUp, Smartphone, CreditCard, Building2, Banknote, Pencil,
  Trash2, MapPin, X,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { useCollection, notify } from "@/lib/useCollection";
import { PageHeader, StatusBadge, Spinner, EmptyState, StatCard } from "@/components/shared";
import { titleCase, formatDate, ghs, genRef } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { sendSms } from "@/lib/messaging";


// Load charges from localStorage
function loadCharges() {
  try {
    return JSON.parse(localStorage.getItem("tnda-charges") || "[]");
  } catch (_) {
    return [];
  }
}

const DEFAULT_PURPOSES = [
  { id: "registration_fee", name: "Registration Fee", amount: 250, category: "Registration" },
  { id: "search_fee", name: "Search Fee", amount: 50, category: "Search" },
  { id: "survey_fee", name: "Survey Fee", amount: 400, category: "Survey" },
  { id: "processing_fee", name: "Processing Fee", amount: 120, category: "Processing" },
  { id: "ground_rent", name: "Ground Rent", amount: 80, category: "Rent" },
  { id: "penalty", name: "Penalty", amount: 200, category: "Penalty" },
];

const METHODS = ["mobile_money", "card", "bank_transfer", "cash"];
const METHOD_ICONS = { mobile_money: Smartphone, card: CreditCard, bank_transfer: Building2, cash: Banknote };
const METHOD_LABELS = { mobile_money: "Mobile Money (MTN/Vodafone/AirtelTigo)", card: "Debit/Credit Card", bank_transfer: "Bank Transfer", cash: "Cash at Office" };

function buildReceiptRows(payment) {
  const ref = payment.invoiceNumber || payment.id;
  return [
    ["Receipt No", ref],
    ["Date", formatDate(payment.created)],
    ...(payment.parcelNumber ? [["Land ID", payment.parcelNumber]] : []),
    ...(payment.plotNumber ? [["Plot / Block", `${payment.plotNumber}${payment.block ? ` / ${payment.block}` : ""}`]] : []),
    ...(payment.areaCouncil ? [["Area Council", payment.areaCouncil]] : []),
    ...(payment.community ? [["Community", payment.community]] : []),
    ...(payment.sector ? [["Sector", payment.sector]] : []),
    ...(payment.ownerName ? [["Owner", payment.ownerName]] : []),
    ...(payment.ownerPhone ? [["Phone", payment.ownerPhone]] : []),
    ["Purpose", titleCase(payment.purpose)],
    ["Amount", ghs(payment.amount)],
    ["Method", titleCase(payment.method)],
    ["Status", titleCase(payment.status)],
  ];
}

function downloadReceiptPDF(payment) {
  const ref = payment.invoiceNumber || payment.id;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, margin = 20, cw = W - margin * 2;
  let y = 22;

  // Header band
  pdf.setFillColor(20, 90, 50);
  pdf.rect(0, 0, W, 14, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("TECHIMAN NORTH DISTRICT ASSEMBLY — LAND ADMINISTRATION REVENUE", W / 2, 9, { align: "center" });

  // Title
  pdf.setTextColor(20, 90, 50);
  pdf.setFontSize(18);
  pdf.text("OFFICIAL RECEIPT", W / 2, y + 8, { align: "center" });
  y += 14;

  // Divider
  pdf.setDrawColor(20, 90, 50);
  pdf.setLineWidth(0.6);
  pdf.line(margin, y, W - margin, y);
  y += 8;

  // Rows
  const rows = buildReceiptRows(payment);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(30, 30, 30);
  rows.forEach(([k, v]) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(String(k) + ":", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(v || "—"), margin + 52, y);
    y += 7;
  });

  y += 4;
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, W - margin, y);
  y += 8;

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text("This is an official receipt of payment. Retain for your records.", W / 2, y, { align: "center" });
  y += 5;
  pdf.text("Techiman North District Assembly | Bono East Region, Ghana | info@tenda.gov.gh", W / 2, y, { align: "center" });

  pdf.save(`receipt-${ref}.pdf`);
}

async function downloadReceiptWord(payment) {
  const ref = payment.invoiceNumber || payment.id;
  const rows = buildReceiptRows(payment);

  const doc = new DocxDocument({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: "TECHIMAN NORTH DISTRICT ASSEMBLY", bold: true, size: 28, color: "145A32" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Land Administration Revenue", size: 20, color: "555555" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "OFFICIAL RECEIPT", bold: true, size: 32, color: "145A32" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: rows.map(([k, v]) => new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: String(k), bold: true, size: 20 })] })],
                width: { size: 35, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: String(v || "—"), size: 20 })] })],
                width: { size: 65, type: WidthType.PERCENTAGE },
              }),
            ],
          })),
        }),
        new Paragraph({ children: [], spacing: { before: 300 } }),
        new Paragraph({
          children: [new TextRun({ text: "This is an official receipt of payment. Retain for your records.", size: 16, color: "777777", italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Techiman North District Assembly | Bono East Region, Ghana | info@tenda.gov.gh", size: 16, color: "777777" })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt-${ref}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

function ReceiptModal({ payment }) {
  const ref = payment.invoiceNumber || payment.id;
  const [wordLoading, setWordLoading] = useState(false);

  const handleWord = async () => {
    setWordLoading(true);
    try { await downloadReceiptWord(payment); }
    finally { setWordLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
        <div className="text-center mb-4">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Receipt className="h-6 w-6 text-blue-700" />
          </div>
          <h3 className="font-display font-bold text-lg">Official Receipt</h3>
          <p className="text-xs text-muted-foreground">Techiman North District Assembly</p>
        </div>
        <div className="space-y-2 text-sm">
          {buildReceiptRows(payment).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => downloadReceiptPDF(payment)} className="w-full">
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
        <Button variant="outline" onClick={handleWord} disabled={wordLoading} className="w-full">
          {wordLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {wordLoading ? "Generating…" : "Download Word"}
        </Button>
      </div>
    </div>
  );
}

// Group charges by category
function groupCharges(charges) {
  const groups = {};
  charges.forEach((c) => {
    const cat = c.category || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(c);
  });
  return groups;
}

function InvoiceForm({ onClose, onSaved, userId, log }) {
  const { toast } = useToast();
  const [parcels, setParcels] = useState([]);
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [parcelId, setParcelId] = useState("none");
  const [selectedChargeIds, setSelectedChargeIds] = useState([]);
  const [customAmounts, setCustomAmounts] = useState({});
  const [method, setMethod] = useState("mobile_money");
  const [status, setStatus] = useState("pending");

  const allCharges = [...DEFAULT_PURPOSES, ...loadCharges().filter((c) => !DEFAULT_PURPOSES.find((d) => d.id === c.id)).map((c) => ({
    id: c.id, name: c.name, amount: c.amount, category: c.category || "Other",
  }))];
  const chargeGroups = groupCharges(allCharges);

  useEffect(() => {
    pb.collection("parcels").getFullList({ sort: "applicantName", expand: "owner", requestKey: "inv-parcels" })
      .then(setParcels)
      .catch(() => {});
  }, []);

  const handleParcelChange = (id) => {
    const p = id !== "none" ? parcels.find((x) => x.id === id) : null;
    setSelectedParcel(p || null);
    setParcelId(id);
  };

  const toggleCharge = (id) => {
    setSelectedChargeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const getChargeAmount = (charge) =>
    customAmounts[charge.id] !== undefined ? Number(customAmounts[charge.id]) : Number(charge.amount);

  const selectedCharges = allCharges.filter((c) => selectedChargeIds.includes(c.id));
  const totalAmount = selectedCharges.reduce((sum, c) => sum + getChargeAmount(c), 0);
  const primaryPurpose = selectedCharges[0]?.id || "registration_fee";

  const submit = async () => {
    if (selectedChargeIds.length === 0) {
      toast({ variant: "destructive", title: "Select at least one charge" });
      return;
    }
    setSaving(true);
    try {
      const payerUserId = selectedParcel?.owner || userId;
      const invoiceNumber = genRef("invoice");
      const chargeBreakdown = selectedCharges.map((c) => ({
        id: c.id, name: c.name, amount: getChargeAmount(c), category: c.category,
      }));

      const rec = await pb.collection("payments").create({
        payer: payerUserId,
        parcel: selectedParcel?.id || null,
        invoiceNumber,
        purpose: primaryPurpose,
        amount: totalAmount,
        method,
        status,
        parcelNumber: selectedParcel?.parcelNumber || "",
        plotNumber: selectedParcel?.plotNumber || "",
        block: selectedParcel?.block || "",
        areaCouncil: selectedParcel?.areaCouncil || "",
        community: selectedParcel?.community || "",
        sector: selectedParcel?.sector || "",
        ownerName: selectedParcel?.applicantName || "",
        ownerPhone: selectedParcel?.contactPhone || selectedParcel?.alternateMobile || "",
        ownerEmail: selectedParcel?.applicantEmail || "",
      });

      const chargeNames = chargeBreakdown.map((c) => `${c.name} (${ghs(c.amount)})`).join(", ");
      await log("invoice_generated", "payments", `${invoiceNumber} — ${ghs(totalAmount)} | Charges: ${chargeNames} | Land: ${selectedParcel?.parcelNumber || "N/A"}`);

      const phone = selectedParcel?.contactPhone || selectedParcel?.alternateMobile;
      if (phone) {
        await sendSms(phone, `TeNDA PPD Invoice ${invoiceNumber}: ${chargeBreakdown.map((c) => c.name).join(", ")} — Total: ${ghs(totalAmount)}. Land: ${selectedParcel?.parcelNumber || "N/A"}.`);
      }
      toast({ title: "Invoice created", description: `${invoiceNumber} — ${ghs(totalAmount)} (${selectedChargeIds.length} charge${selectedChargeIds.length > 1 ? "s" : ""})` });
      onSaved(rec);
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      {/* Parcel selection */}
      <div className="space-y-2">
        <Label>Land / Parcel <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Select value={parcelId} onValueChange={handleParcelChange}>
          <SelectTrigger><SelectValue placeholder="Select land record…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— No specific land —</SelectItem>
            {parcels.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.parcelNumber} — {p.applicantName || "Unknown"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Auto-populated land details */}
      {selectedParcel && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5 text-xs">
          <p className="font-semibold text-primary uppercase tracking-wider">Land Details</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              ["Land ID", selectedParcel.parcelNumber],
              ["Owner", selectedParcel.applicantName],
              ["Mobile", selectedParcel.contactPhone],
              ["Plot / Block", [selectedParcel.plotNumber, selectedParcel.block].filter(Boolean).join(" / ")],
              ["Area Council", selectedParcel.areaCouncil],
              ["Community", selectedParcel.community],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><span className="text-muted-foreground">{k}: </span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* Charge selection — checkboxes grouped by category */}
      <div className="space-y-2">
        <Label>Select Charges <span className="text-destructive">*</span></Label>
        <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
          {Object.entries(chargeGroups).map(([category, charges]) => (
            <div key={category}>
              <p className="sticky top-0 bg-muted/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur">
                {category}
              </p>
              {charges.map((charge) => {
                const selected = selectedChargeIds.includes(charge.id);
                return (
                  <label key={charge.id} className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition",
                    selected && "bg-primary/5"
                  )}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleCharge(charge.id)}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{charge.name}</p>
                    </div>
                    {selected ? (
                      <Input
                        type="number"
                        value={customAmounts[charge.id] !== undefined ? customAmounts[charge.id] : charge.amount}
                        onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [charge.id]: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="w-24 h-7 text-xs text-right"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground w-24 text-right">{ghs(charge.amount)}</span>
                    )}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Running total summary */}
      {selectedCharges.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Invoice Summary</p>
          {selectedCharges.map((c) => (
            <div key={c.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{c.name}</span>
              <span className="font-medium">{ghs(getChargeAmount(c))}</span>
            </div>
          ))}
          <div className="border-t border-primary/20 pt-2 flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-primary">{ghs(totalAmount)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Payment Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => <SelectItem key={m} value={m}>{titleCase(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Initial Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving || selectedChargeIds.length === 0}>
          {saving ? "Creating…" : selectedChargeIds.length > 0 ? `Create Invoice — ${ghs(totalAmount)}` : "Select charges to continue"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function EditPaymentModal({ payment, onClose, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const charges = [...DEFAULT_PURPOSES, ...loadCharges().map((c) => ({ id: c.id, name: c.name, amount: c.amount }))];
  const [form, setForm] = useState({
    purpose: payment.purpose || "registration_fee",
    amount: payment.amount || 0,
    status: payment.status || "pending",
    method: payment.method || "cash",
  });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await pb.collection("payments").update(payment.id, form);
      toast({ title: "Payment updated" });
      onSaved(updated);
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Purpose</Label>
        <Select value={form.purpose} onValueChange={(v) => setForm((f) => ({ ...f, purpose: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {charges.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Amount (GHS)</Label>
        <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => <SelectItem key={m} value={m}>{titleCase(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
      </DialogFooter>
    </div>
  );
}

export default function PaymentsPage() {
  const { user, role, log } = useAuth();
  const { toast } = useToast();
  const isFinance = role === "finance_officer" || role === "admin";

  const { records, loading, reload } = useCollection("payments", {
    sort: "-created",
    expand: "payer,parcel",
  });

  const [open, setOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [editPayment, setEditPayment] = useState(null);
  const [refundDialog, setRefundDialog] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return records.filter((p) => {
      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      const matchMethod = filterMethod === "all" || p.method === filterMethod;
      const q = searchQ.toLowerCase();
      const matchQ = !q ||
        p.invoiceNumber?.toLowerCase().includes(q) ||
        p.expand?.payer?.fullName?.toLowerCase().includes(q) ||
        p.ownerName?.toLowerCase().includes(q) ||
        p.parcelNumber?.toLowerCase().includes(q) ||
        p.purpose?.includes(q) ||
        p.areaCouncil?.toLowerCase().includes(q);
      const date = new Date(p.created);
      const matchFrom = !dateFrom || date >= new Date(dateFrom);
      const matchTo = !dateTo || date <= new Date(dateTo + "T23:59:59");
      return matchStatus && matchMethod && matchQ && matchFrom && matchTo;
    });
  }, [records, filterStatus, filterMethod, searchQ, dateFrom, dateTo]);

  const paid = filtered.filter((r) => r.status === "paid");
  const pending = filtered.filter((r) => r.status === "pending");
  const revenue = paid.reduce((s, r) => s + (r.amount || 0), 0);

  const byMethod = METHODS.reduce((acc, m) => {
    acc[m] = paid.filter((r) => r.method === m).reduce((s, r) => s + (r.amount || 0), 0);
    return acc;
  }, {});

  const confirmPaid = async (p) => {
    await pb.collection("payments").update(p.id, { status: "paid" });
    await log("payment_confirmed", "payments", p.invoiceNumber);
    await notify(p.payer, `Payment ${p.invoiceNumber} of ${ghs(p.amount)} confirmed.`, "/app/payments");
    // SMS
    const phone = p.ownerPhone || p.expand?.payer?.phone;
    if (phone) await sendSms(phone, `TeNDA PPD: Payment ${p.invoiceNumber} of ${ghs(p.amount)} for ${titleCase(p.purpose)} confirmed. Land: ${p.parcelNumber || "N/A"}.`);
    reload();
    toast({ title: "Payment confirmed", description: `${p.invoiceNumber} marked as paid.` });
  };

  const processRefund = async (p) => {
    await pb.collection("payments").update(p.id, { status: "refunded" });
    await log("payment_refunded", "payments", p.invoiceNumber);
    await notify(p.payer, `Payment ${p.invoiceNumber} of ${ghs(p.amount)} has been refunded.`, "/app/payments");
    setRefundDialog(null);
    reload();
    toast({ title: "Refund processed" });
  };

  const deletePayment = async (p) => {
    try {
      await pb.collection("payments").delete(p.id);
      await log("payment_deleted", "payments", p.invoiceNumber);
      setDeleteDialog(null);
      reload();
      toast({ title: "Invoice deleted" });
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err?.message });
    }
  };

  const sendReminder = async (p) => {
    await notify(p.payer, `Payment reminder: Invoice ${p.invoiceNumber} for ${ghs(p.amount)} (${titleCase(p.purpose)}) is pending.`, "/app/payments");
    const phone = p.ownerPhone;
    if (phone) await sendSms(phone, `TeNDA PPD Reminder: Invoice ${p.invoiceNumber} for ${ghs(p.amount)} (${titleCase(p.purpose)}) is due. Land: ${p.parcelNumber || "N/A"}.`);
    toast({ title: "Reminder sent" });
  };

  const exportCsv = () => {
    const rows = [["Invoice", "Land ID", "Plot", "Area Council", "Owner", "Purpose", "Amount", "Method", "Status", "Date"]];
    filtered.forEach((p) => rows.push([
      p.invoiceNumber, p.parcelNumber || "—", p.plotNumber || "—", p.areaCouncil || "—",
      p.ownerName || p.expand?.payer?.fullName || "—",
      titleCase(p.purpose), p.amount, titleCase(p.method), titleCase(p.status), formatDate(p.created),
    ]));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payments-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Payment & Revenue"
        subtitle="Land-linked invoices, reconciliation and revenue tracking"
        icon={Wallet}
        action={
          <div className="flex gap-2">
            {isFinance && (
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="mr-1 h-4 w-4" /> Export CSV
              </Button>
            )}
            {isFinance && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> New invoice
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue collected" value={ghs(revenue)} icon={Wallet} accent="gold" />
        <StatCard label="Confirmed" value={paid.length} icon={CheckCircle2} accent="amber" />
        <StatCard label="Pending" value={pending.length} icon={Receipt} accent="blue" />
        <StatCard label="Transactions" value={filtered.length} icon={TrendingUp} accent="primary" />
      </div>

      {/* Revenue by method */}
      {isFinance && Object.values(byMethod).some((v) => v > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {METHODS.map((m) => {
            const Icon = METHOD_ICONS[m];
            return byMethod[m] > 0 ? (
              <div key={m} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{titleCase(m)}</p>
                </div>
                <p className="font-display text-lg font-bold">{ghs(byMethod[m])}</p>
              </div>
            ) : null;
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search by invoice, land ID, owner name…" className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {METHODS.map((m) => <SelectItem key={m} value={m}>{titleCase(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" title="From date" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" title="To date" />
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="No transactions" message="Create an invoice to start tracking payments." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Land / Owner</th>
                <th className="px-5 py-3 font-medium">Purpose</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">Method</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">Date</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => {
                const Icon = METHOD_ICONS[p.method] || Wallet;
                return (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{p.invoiceNumber}</td>
                    <td className="hidden px-5 py-3 md:table-cell">
                      {p.parcelNumber ? (
                        <div>
                          <p className="text-xs font-mono text-primary">{p.parcelNumber}</p>
                          <p className="text-xs text-muted-foreground">{p.ownerName || p.expand?.payer?.fullName}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{p.expand?.payer?.fullName || "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">{titleCase(p.purpose)}</td>
                    <td className="px-5 py-3 font-semibold">{ghs(p.amount)}</td>
                    <td className="hidden px-5 py-3 sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" /> {titleCase(p.method)}
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    <td className="hidden px-5 py-3 text-muted-foreground sm:table-cell">{formatDate(p.created)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setReceiptPayment(p)} title="Receipt">
                          <Receipt className="h-3.5 w-3.5" />
                        </Button>
                        {isFinance && (
                          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditPayment(p)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isFinance && p.status === "pending" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-blue-700" onClick={() => confirmPaid(p)} title="Confirm paid">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground" onClick={() => sendReminder(p)} title="Send reminder">
                              <Bell className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {isFinance && p.status === "paid" && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-orange-600" onClick={() => setRefundDialog(p)} title="Refund">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isFinance && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={() => setDeleteDialog(p)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-muted/20">
              <tr>
                <td colSpan={2} className="px-5 py-3 text-xs text-muted-foreground">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</td>
                <td className="px-5 py-3 font-semibold text-sm">{ghs(revenue)} collected</td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* New Invoice dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Generate Invoice</DialogTitle></DialogHeader>
          {open && (
            <InvoiceForm onClose={() => setOpen(false)} onSaved={reload} userId={user.id} log={log} />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit payment dialog */}
      <Dialog open={!!editPayment} onOpenChange={(o) => { if (!o) setEditPayment(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Invoice — {editPayment?.invoiceNumber}</DialogTitle></DialogHeader>
          {editPayment && (
            <EditPaymentModal payment={editPayment} onClose={() => setEditPayment(null)} onSaved={() => { setEditPayment(null); reload(); }} />
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt modal */}
      <Dialog open={!!receiptPayment} onOpenChange={() => setReceiptPayment(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
          {receiptPayment && <ReceiptModal payment={receiptPayment} />}
        </DialogContent>
      </Dialog>

      {/* Refund confirmation */}
      <Dialog open={!!refundDialog} onOpenChange={() => setRefundDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Process Refund</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Refund <strong>{refundDialog?.invoiceNumber}</strong> for <strong>{ghs(refundDialog?.amount)}</strong>? This will be logged.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => processRefund(refundDialog)}>
              <RefreshCw className="mr-1 h-4 w-4" /> Confirm Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Permanently delete invoice <strong>{deleteDialog?.invoiceNumber}</strong>? This cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletePayment(deleteDialog)}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
