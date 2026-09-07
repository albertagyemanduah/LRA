import React, { useState, useRef, useCallback, useEffect } from "react";
import { Helmet } from "react-helmet";
import {
  Palette, Undo2, Redo2, Grid3X3, Eye, EyeOff, Trash2, Save,
  RotateCcw, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  ChevronDown, ChevronRight, GripVertical, Move, Type, Plus,
  FileText, Receipt, Award, Check, ImageIcon, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared";

const STORAGE_KEY = "tnda-template-designs";
const BG_STORAGE_KEY = "tnda-template-backgrounds";

const PAPER_SIZES = {
  A4: { w: 595, h: 842, label: "A4 (210×297mm)" },
  A3: { w: 842, h: 1191, label: "A3 (297×420mm)" },
  A5: { w: 420, h: 595, label: "A5 (148×210mm)" },
  Letter: { w: 612, h: 792, label: "Letter (8.5×11in)" },
  Legal: { w: 612, h: 1008, label: "Legal (8.5×14in)" },
};

function loadBgs() {
  try { return JSON.parse(localStorage.getItem(BG_STORAGE_KEY) || "{}"); } catch { return {}; }
}

const TEMPLATE_TYPES = [
  { key: "receipt", label: "Receipt", icon: Receipt },
  { key: "invoice", label: "Invoice", icon: FileText },
  { key: "certificate", label: "Certificate", icon: Award },
];

const AVAILABLE_FIELDS = {
  receipt: [
    { key: "org_name", label: "Organization Name", category: "Header", sample: "TECHIMAN NORTH DISTRICT ASSEMBLY" },
    { key: "doc_title", label: "Document Title", category: "Header", sample: "OFFICIAL RECEIPT" },
    { key: "divider", label: "Divider Line", category: "Header", sample: "─────────────────────────" },
    { key: "receipt_no", label: "Receipt Number", category: "Reference", sample: "RCP-2025-0042" },
    { key: "receipt_date", label: "Date", category: "Reference", sample: "29 July 2025" },
    { key: "land_id", label: "Land ID", category: "Land Details", sample: "LAND-001" },
    { key: "owner_name", label: "Owner Name", category: "Land Details", sample: "Kwame Asante" },
    { key: "plot_block", label: "Plot / Block", category: "Land Details", sample: "Plot 12 / Block A" },
    { key: "area_council", label: "Area Council", category: "Land Details", sample: "Tuobodom" },
    { key: "community", label: "Community", category: "Land Details", sample: "Aworowa Community" },
    { key: "sector", label: "Sector", category: "Land Details", sample: "Sector 2" },
    { key: "purpose", label: "Purpose", category: "Payment", sample: "Registration Fee" },
    { key: "amount", label: "Amount", category: "Payment", sample: "GHS 250.00" },
    { key: "method", label: "Payment Method", category: "Payment", sample: "Mobile Money" },
    { key: "status", label: "Payment Status", category: "Payment", sample: "PAID" },
    { key: "footer_note", label: "Footer Note", category: "Footer", sample: "This is an official receipt. Retain for your records." },
    { key: "contact_info", label: "Contact Info", category: "Footer", sample: "Techiman North D/A | Bono East | info@tenda.gov.gh" },
  ],
  invoice: [
    { key: "org_name", label: "Organization Name", category: "Header", sample: "TECHIMAN NORTH DISTRICT ASSEMBLY" },
    { key: "doc_title", label: "Document Title", category: "Header", sample: "INVOICE" },
    { key: "divider", label: "Divider Line", category: "Header", sample: "─────────────────────────" },
    { key: "invoice_no", label: "Invoice Number", category: "Reference", sample: "INV-2025-0042" },
    { key: "invoice_date", label: "Invoice Date", category: "Reference", sample: "29 July 2025" },
    { key: "due_date", label: "Due Date", category: "Reference", sample: "12 August 2025" },
    { key: "land_id", label: "Land ID", category: "Land Details", sample: "LAND-001" },
    { key: "owner_name", label: "Owner Name", category: "Land Details", sample: "Kwame Asante" },
    { key: "owner_contact", label: "Owner Contact", category: "Land Details", sample: "0244123456" },
    { key: "plot_block", label: "Plot / Block", category: "Land Details", sample: "Plot 12 / Block A" },
    { key: "area_council", label: "Area Council", category: "Land Details", sample: "Tuobodom" },
    { key: "community", label: "Community", category: "Land Details", sample: "Aworowa Community" },
    { key: "sector", label: "Sector", category: "Land Details", sample: "Sector 2" },
    { key: "charges_label", label: "Charges Header", category: "Charges", sample: "CHARGES BREAKDOWN" },
    { key: "charge_item_1", label: "Charge Line 1", category: "Charges", sample: "Registration Fee — GHS 250.00" },
    { key: "charge_item_2", label: "Charge Line 2", category: "Charges", sample: "Processing Fee — GHS 120.00" },
    { key: "subtotal", label: "Subtotal", category: "Charges", sample: "Subtotal: GHS 370.00" },
    { key: "total", label: "Total Amount", category: "Charges", sample: "TOTAL: GHS 370.00" },
    { key: "payment_instructions", label: "Payment Instructions", category: "Footer", sample: "Pay via Mobile Money (MTN/Vodafone/AirtelTigo) or at the district office." },
    { key: "footer_note", label: "Footer Note", category: "Footer", sample: "Official invoice. Contact office for disputes." },
    { key: "contact_info", label: "Contact Info", category: "Footer", sample: "Techiman North D/A | Bono East | info@tenda.gov.gh" },
  ],
  certificate: [
    { key: "org_name", label: "Organization Name", category: "Header", sample: "TECHIMAN NORTH DISTRICT ASSEMBLY" },
    { key: "org_subtitle", label: "Organization Subtitle", category: "Header", sample: "Land Administration Division — Bono East Region" },
    { key: "doc_title", label: "Certificate Title", category: "Header", sample: "LAND REGISTRATION CERTIFICATE" },
    { key: "cert_no", label: "Certificate Number", category: "Reference", sample: "CERT-TeNDA-2025-0001" },
    { key: "cert_date", label: "Issue Date", category: "Reference", sample: "29 July 2025" },
    { key: "land_id", label: "Land ID", category: "Land Details", sample: "LAND-001" },
    { key: "owner_name", label: "Owner Name", category: "Land Details", sample: "Kwame Asante" },
    { key: "owner_contact", label: "Owner Contact", category: "Land Details", sample: "0244123456" },
    { key: "plot_block", label: "Plot / Block", category: "Land Details", sample: "Plot 12 / Block A" },
    { key: "area_council", label: "Area Council", category: "Land Details", sample: "Tuobodom Area Council" },
    { key: "community", label: "Community", category: "Land Details", sample: "Aworowa Community" },
    { key: "sector", label: "Sector", category: "Land Details", sample: "Sector 2" },
    { key: "land_use", label: "Land Use Type", category: "Land Details", sample: "Residential" },
    { key: "allocation_date", label: "Allocation Date", category: "Land Details", sample: "15 January 2024" },
    { key: "registration_date", label: "Registration Date", category: "Land Details", sample: "29 July 2025" },
    { key: "cert_status", label: "Certificate Status", category: "Status", sample: "ACTIVE" },
    { key: "issued_by", label: "Issued By", category: "Authority", sample: "Ama Boateng, Land Registrar" },
    { key: "signature_line", label: "Signature Line", category: "Authority", sample: "________________________________" },
    { key: "seal_placeholder", label: "Official Seal", category: "Authority", sample: "[ OFFICIAL SEAL ]" },
    { key: "footer_legal", label: "Legal Footer", category: "Footer", sample: "Issued under the Land Registration Act 2020 (Act 1036). This certificate is official." },
    { key: "contact_info", label: "Contact Info", category: "Footer", sample: "Techiman North D/A | Bono East | info@tenda.gov.gh" },
  ],
};

const DEFAULT_DESIGNS = {
  receipt: [
    { id: "r1", key: "org_name", x: 40, y: 30, w: 515, h: 28, fontSize: 14, bold: true, italic: false, color: "#145A32", align: "center" },
    { id: "r2", key: "doc_title", x: 40, y: 68, w: 515, h: 32, fontSize: 20, bold: true, italic: false, color: "#145A32", align: "center" },
    { id: "r3", key: "divider", x: 40, y: 106, w: 515, h: 18, fontSize: 10, bold: false, italic: false, color: "#888888", align: "center" },
    { id: "r4", key: "receipt_no", x: 40, y: 132, w: 240, h: 22, fontSize: 10, bold: true, italic: false, color: "#222222", align: "left" },
    { id: "r5", key: "receipt_date", x: 310, y: 132, w: 245, h: 22, fontSize: 10, bold: false, italic: false, color: "#444444", align: "right" },
    { id: "r6", key: "land_id", x: 40, y: 164, w: 240, h: 20, fontSize: 10, bold: true, italic: false, color: "#222222", align: "left" },
    { id: "r7", key: "owner_name", x: 40, y: 188, w: 515, h: 20, fontSize: 10, bold: false, italic: false, color: "#333333", align: "left" },
    { id: "r8", key: "plot_block", x: 40, y: 212, w: 515, h: 20, fontSize: 10, bold: false, italic: false, color: "#333333", align: "left" },
    { id: "r9", key: "area_council", x: 40, y: 236, w: 515, h: 20, fontSize: 10, bold: false, italic: false, color: "#333333", align: "left" },
    { id: "r10", key: "purpose", x: 40, y: 268, w: 300, h: 22, fontSize: 11, bold: true, italic: false, color: "#222222", align: "left" },
    { id: "r11", key: "amount", x: 340, y: 268, w: 215, h: 22, fontSize: 12, bold: true, italic: false, color: "#145A32", align: "right" },
    { id: "r12", key: "method", x: 40, y: 294, w: 515, h: 20, fontSize: 10, bold: false, italic: false, color: "#444444", align: "left" },
    { id: "r13", key: "footer_note", x: 40, y: 750, w: 515, h: 20, fontSize: 9, bold: false, italic: true, color: "#666666", align: "center" },
    { id: "r14", key: "contact_info", x: 40, y: 774, w: 515, h: 18, fontSize: 8, bold: false, italic: false, color: "#888888", align: "center" },
  ],
  invoice: [
    { id: "i1", key: "org_name", x: 40, y: 30, w: 515, h: 28, fontSize: 14, bold: true, italic: false, color: "#145A32", align: "center" },
    { id: "i2", key: "doc_title", x: 40, y: 68, w: 515, h: 32, fontSize: 20, bold: true, italic: false, color: "#145A32", align: "center" },
    { id: "i3", key: "divider", x: 40, y: 106, w: 515, h: 18, fontSize: 10, bold: false, italic: false, color: "#888888", align: "center" },
    { id: "i4", key: "invoice_no", x: 40, y: 132, w: 240, h: 22, fontSize: 10, bold: true, italic: false, color: "#222222", align: "left" },
    { id: "i5", key: "invoice_date", x: 310, y: 132, w: 245, h: 22, fontSize: 10, bold: false, italic: false, color: "#444444", align: "right" },
    { id: "i6", key: "land_id", x: 40, y: 164, w: 240, h: 20, fontSize: 10, bold: true, italic: false, color: "#222222", align: "left" },
    { id: "i7", key: "owner_name", x: 40, y: 188, w: 300, h: 20, fontSize: 10, bold: false, italic: false, color: "#333333", align: "left" },
    { id: "i8", key: "area_council", x: 40, y: 212, w: 515, h: 20, fontSize: 10, bold: false, italic: false, color: "#333333", align: "left" },
    { id: "i9", key: "charges_label", x: 40, y: 250, w: 515, h: 22, fontSize: 11, bold: true, italic: false, color: "#145A32", align: "left" },
    { id: "i10", key: "charge_item_1", x: 40, y: 276, w: 515, h: 20, fontSize: 10, bold: false, italic: false, color: "#333333", align: "left" },
    { id: "i11", key: "total", x: 40, y: 320, w: 515, h: 24, fontSize: 12, bold: true, italic: false, color: "#145A32", align: "right" },
    { id: "i12", key: "footer_note", x: 40, y: 750, w: 515, h: 20, fontSize: 9, bold: false, italic: true, color: "#666666", align: "center" },
    { id: "i13", key: "contact_info", x: 40, y: 774, w: 515, h: 18, fontSize: 8, bold: false, italic: false, color: "#888888", align: "center" },
  ],
  certificate: [
    { id: "c1", key: "org_name", x: 40, y: 60, w: 515, h: 30, fontSize: 16, bold: true, italic: false, color: "#145A32", align: "center" },
    { id: "c2", key: "org_subtitle", x: 40, y: 96, w: 515, h: 20, fontSize: 10, bold: false, italic: false, color: "#555555", align: "center" },
    { id: "c3", key: "doc_title", x: 40, y: 140, w: 515, h: 36, fontSize: 22, bold: true, italic: false, color: "#145A32", align: "center" },
    { id: "c4", key: "divider", x: 80, y: 184, w: 435, h: 18, fontSize: 10, bold: false, italic: false, color: "#888888", align: "center" },
    { id: "c5", key: "cert_no", x: 40, y: 214, w: 515, h: 22, fontSize: 10, bold: true, italic: false, color: "#333333", align: "center" },
    { id: "c6", key: "owner_name", x: 40, y: 260, w: 515, h: 26, fontSize: 14, bold: true, italic: false, color: "#222222", align: "center" },
    { id: "c7", key: "land_id", x: 40, y: 290, w: 250, h: 20, fontSize: 10, bold: true, italic: false, color: "#222222", align: "left" },
    { id: "c8", key: "plot_block", x: 40, y: 314, w: 515, h: 20, fontSize: 10, bold: false, italic: false, color: "#333333", align: "left" },
    { id: "c9", key: "area_council", x: 40, y: 338, w: 515, h: 20, fontSize: 10, bold: false, italic: false, color: "#333333", align: "left" },
    { id: "c10", key: "registration_date", x: 40, y: 362, w: 515, h: 20, fontSize: 10, bold: false, italic: false, color: "#333333", align: "left" },
    { id: "c11", key: "cert_status", x: 40, y: 400, w: 515, h: 26, fontSize: 13, bold: true, italic: false, color: "#145A32", align: "center" },
    { id: "c12", key: "issued_by", x: 40, y: 700, w: 240, h: 20, fontSize: 10, bold: false, italic: false, color: "#333333", align: "left" },
    { id: "c13", key: "signature_line", x: 40, y: 724, w: 240, h: 18, fontSize: 10, bold: false, italic: false, color: "#555555", align: "left" },
    { id: "c14", key: "seal_placeholder", x: 340, y: 700, w: 215, h: 42, fontSize: 10, bold: false, italic: false, color: "#888888", align: "center" },
    { id: "c15", key: "footer_legal", x: 40, y: 770, w: 515, h: 18, fontSize: 8, bold: false, italic: true, color: "#666666", align: "center" },
  ],
};

function loadDesigns() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults for any missing template types
      return {
        receipt: parsed.receipt || DEFAULT_DESIGNS.receipt,
        invoice: parsed.invoice || DEFAULT_DESIGNS.invoice,
        certificate: parsed.certificate || DEFAULT_DESIGNS.certificate,
      };
    }
  } catch (_) {}
  return { ...DEFAULT_DESIGNS };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function groupFields(fields) {
  const groups = {};
  fields.forEach((f) => {
    if (!groups[f.category]) groups[f.category] = [];
    groups[f.category].push(f);
  });
  return groups;
}

function getFieldMeta(type, key) {
  return AVAILABLE_FIELDS[type]?.find((f) => f.key === key) || { label: key, sample: key };
}

function FieldBlock({ item, meta, selected, showSample, scale, onSelect, onMoveStart }) {
  const textAlign = item.align || "left";
  const style = {
    position: "absolute",
    left: item.x * scale,
    top: item.y * scale,
    width: item.w * scale,
    height: item.h * scale,
    fontSize: item.fontSize * scale,
    fontWeight: item.bold ? "bold" : "normal",
    fontStyle: item.italic ? "italic" : "normal",
    color: item.color,
    textAlign,
    display: "flex",
    alignItems: "center",
    cursor: "move",
    border: selected ? "1.5px dashed #357DF9" : "1px dashed transparent",
    borderRadius: 2,
    padding: "0 3px",
    boxSizing: "border-box",
    userSelect: "none",
    overflow: "hidden",
    whiteSpace: "nowrap",
    background: selected ? "rgba(53,125,249,0.05)" : "transparent",
    justifyContent: textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start",
  };

  return (
    <div
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
      draggable
      onDragStart={(e) => onMoveStart(e, item)}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {showSample ? meta.sample : meta.label}
      </span>
    </div>
  );
}

export default function TemplateDesignerPage() {
  const { toast } = useToast();
  const [activeType, setActiveType] = useState("receipt");
  const [designs, setDesigns] = useState(loadDesigns);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [showGrid, setShowGrid] = useState(true);
  const [showSample, setShowSample] = useState(true);
  const [zoom, setZoom] = useState(0.7);
  const [backgrounds, setBackgrounds] = useState(loadBgs);
  const [bgOpacity, setBgOpacity] = useState(1);
  const [bgPosition, setBgPosition] = useState("stretch");
  const [paperSize, setPaperSize] = useState("A4");
  const bgInputRef = useRef(null);

  const currentBg = backgrounds[activeType];
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;
  const CANVAS_W = paper.w;
  const CANVAS_H = paper.h;
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const canvasRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragTypeRef = useRef(null); // 'new' | 'move'
  const dragDataRef = useRef(null);

  const currentDesign = designs[activeType] || [];
  const selectedItem = currentDesign.find((f) => f.id === selectedId) || null;
  const fields = AVAILABLE_FIELDS[activeType] || [];
  const fieldGroups = groupFields(fields);
  const scale = zoom;

  const pushHistory = useCallback((prev) => {
    setHistory((h) => [...h.slice(-30), prev]);
    setFuture([]);
  }, []);

  const updateDesign = useCallback((updater) => {
    setDesigns((d) => {
      const prev = d[activeType];
      const next = typeof updater === "function" ? updater(prev) : updater;
      pushHistory({ type: activeType, design: prev });
      return { ...d, [activeType]: next };
    });
  }, [activeType, pushHistory]);

  const undo = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setFuture((f) => [{ type: activeType, design: designs[activeType] }, ...f]);
    setDesigns((d) => ({ ...d, [last.type]: last.design }));
    setHistory((h) => h.slice(0, -1));
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory((h) => [...h, { type: activeType, design: designs[activeType] }]);
    setDesigns((d) => ({ ...d, [next.type]: next.design }));
    setFuture((f) => f.slice(1));
  };

  // Drag from palette
  const handlePaletteDragStart = (e, field) => {
    dragTypeRef.current = "new";
    dragDataRef.current = field;
    e.dataTransfer.effectAllowed = "copy";
  };

  // Drag existing item
  const handleItemMoveStart = (e, item) => {
    e.stopPropagation();
    dragTypeRef.current = "move";
    dragDataRef.current = item;
    const rect = canvasRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: (e.clientX - rect.left) / scale - item.x,
      y: (e.clientY - rect.top) / scale - item.y,
    };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / scale);
    const y = Math.round((e.clientY - rect.top) / scale);

    if (dragTypeRef.current === "new") {
      const field = dragDataRef.current;
      const newItem = {
        id: uid(),
        key: field.key,
        x: Math.max(0, Math.min(x, CANVAS_W - 200)),
        y: Math.max(0, Math.min(y, CANVAS_H - 24)),
        w: 300,
        h: 24,
        fontSize: 11,
        bold: false,
        italic: false,
        color: "#222222",
        align: "left",
      };
      updateDesign((prev) => [...prev, newItem]);
      setSelectedId(newItem.id);
    } else if (dragTypeRef.current === "move") {
      const item = dragDataRef.current;
      const nx = Math.round(x - dragOffsetRef.current.x);
      const ny = Math.round(y - dragOffsetRef.current.y);
      updateDesign((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, x: Math.max(0, Math.min(nx, CANVAS_W - f.w)), y: Math.max(0, Math.min(ny, CANVAS_H - f.h)) }
            : f
        )
      );
    }
    dragTypeRef.current = null;
    dragDataRef.current = null;
  };

  const removeSelected = () => {
    if (!selectedId) return;
    updateDesign((prev) => prev.filter((f) => f.id !== selectedId));
    setSelectedId(null);
  };

  const updateProp = (key, value) => {
    if (!selectedId) return;
    updateDesign((prev) =>
      prev.map((f) => (f.id === selectedId ? { ...f, [key]: value } : f))
    );
  };

  const handleBgUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Background image must be under 3MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      const updated = { ...backgrounds, [activeType]: url };
      setBackgrounds(updated);
      try { localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(updated)); } catch {}
      toast({ title: "Background applied" });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeBg = () => {
    const updated = { ...backgrounds };
    delete updated[activeType];
    setBackgrounds(updated);
    try { localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(updated)); } catch {}
    toast({ title: "Background removed" });
  };

  const resetDesign = () => {
    pushHistory({ type: activeType, design: currentDesign });
    setDesigns((d) => ({ ...d, [activeType]: DEFAULT_DESIGNS[activeType] }));
    setSelectedId(null);
    toast({ title: "Reset to default template" });
  };

  const saveDesigns = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
    toast({ title: "Template designs saved", description: "Your custom layouts are now active." });
  };

  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Placed fields not in currentDesign palette
  const placedKeys = new Set(currentDesign.map((f) => f.key));

  return (
    <>
      <Helmet>
        <title>Template Designer — Techiman North Land Registry</title>
        <meta name="description" content="Drag-and-drop designer for receipt, invoice, and certificate templates." />
      </Helmet>

      <PageHeader
        title="Template Designer"
        subtitle="Customize receipt, invoice, and certificate layouts with drag-and-drop"
        icon={Palette}
        action={
          <Button onClick={saveDesigns} className="gap-2">
            <Save className="h-4 w-4" /> Save All Designs
          </Button>
        }
      />

      {/* Template type selector */}
      <div className="flex gap-2">
        {TEMPLATE_TYPES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveType(key); setSelectedId(null); }}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition",
              activeType === key
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card hover:bg-muted/40"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-4 min-h-0">
        {/* Fields Palette */}
        <div className="w-56 shrink-0 rounded-2xl border border-border bg-card overflow-y-auto max-h-[calc(100vh-16rem)] shadow-sm">
          <div className="sticky top-0 bg-card border-b border-border px-4 py-3 z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Available Fields</p>
            <p className="text-xs text-muted-foreground mt-0.5">Drag to canvas</p>
          </div>
          <div className="py-2">
            {Object.entries(fieldGroups).map(([category, catFields]) => (
              <div key={category}>
                <button
                  className="flex w-full items-center justify-between px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                  {collapsedCategories[category] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {!collapsedCategories[category] && catFields.map((field) => {
                  const alreadyPlaced = placedKeys.has(field.key);
                  return (
                    <div
                      key={field.key}
                      draggable
                      onDragStart={(e) => handlePaletteDragStart(e, field)}
                      className={cn(
                        "mx-2 mb-1 flex cursor-grab items-center gap-2 rounded-lg px-3 py-2 text-xs transition active:cursor-grabbing",
                        alreadyPlaced
                          ? "bg-primary/5 text-primary/70 border border-primary/20"
                          : "bg-muted/40 hover:bg-muted text-foreground border border-transparent"
                      )}
                    >
                      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{field.label}</span>
                      {alreadyPlaced && <Check className="h-3 w-3 shrink-0 text-primary ml-auto" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
            <Button size="sm" variant="ghost" onClick={undo} disabled={!history.length} title="Undo">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={redo} disabled={!future.length} title="Redo">
              <Redo2 className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-border" />
            <Button size="sm" variant={showGrid ? "default" : "ghost"} onClick={() => setShowGrid(!showGrid)} title="Toggle grid">
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant={showSample ? "default" : "ghost"} onClick={() => setShowSample(!showSample)} title="Toggle sample data">
              {showSample ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <div className="w-px h-5 bg-border" />
            <span className="text-xs text-muted-foreground">Zoom:</span>
            {[0.5, 0.65, 0.8, 1.0].map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={cn("text-xs px-2 py-1 rounded-md transition", zoom === z ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                {Math.round(z * 100)}%
              </button>
            ))}
            <div className="w-px h-5 bg-border" />
            <Button size="sm" variant="ghost" onClick={resetDesign} title="Reset to default">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </Button>
            {selectedId && (
              <Button size="sm" variant="ghost" onClick={removeSelected} title="Delete selected">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            <div className="w-px h-5 bg-border" />
            <span className="text-xs text-muted-foreground">Paper:</span>
            <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background">
              {Object.entries(PAPER_SIZES).map(([k]) => <option key={k} value={k}>{k}</option>)}
            </select>
            <div className="w-px h-5 bg-border" />
            <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
            <Button size="sm" variant="outline" onClick={() => bgInputRef.current?.click()}>
              <ImageIcon className="h-4 w-4 mr-1" /> BG
            </Button>
            {currentBg && (
              <>
                <select value={bgPosition} onChange={(e) => setBgPosition(e.target.value)}
                  className="text-xs border border-border rounded px-2 py-1 bg-background">
                  <option value="stretch">Stretch</option>
                  <option value="fit">Fit</option>
                  <option value="tile">Tile</option>
                  <option value="center">Center</option>
                </select>
                <input type="range" min={0} max={1} step={0.05} value={bgOpacity}
                  onChange={(e) => setBgOpacity(Number(e.target.value))}
                  className="w-16" title={`Opacity: ${Math.round(bgOpacity*100)}%`} />
                <Button size="sm" variant="ghost" onClick={removeBg}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
            <div className="ml-auto text-xs text-muted-foreground">
              {currentDesign.length} field{currentDesign.length !== 1 ? "s" : ""} placed
            </div>
          </div>

          {/* Canvas */}
          <div className="overflow-auto rounded-xl border border-border bg-muted/20 p-4 shadow-inner">
            <div
              ref={canvasRef}
              style={{
                position: "relative",
                width: CANVAS_W * scale,
                height: CANVAS_H * scale,
                background: "#ffffff",
                boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
                backgroundImage: showGrid
                  ? `repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent ${20 * scale}px), repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent ${20 * scale}px)`
                  : "none",
                cursor: "crosshair",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCanvasDrop}
              onClick={() => setSelectedId(null)}
            >
              {/* Background image */}
              {currentBg && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                  opacity: bgOpacity,
                  backgroundImage: `url(${currentBg})`,
                  backgroundSize: bgPosition === "stretch" ? "100% 100%" : bgPosition === "fit" ? "contain" : bgPosition === "tile" ? "auto" : "auto",
                  backgroundRepeat: bgPosition === "tile" ? "repeat" : "no-repeat",
                  backgroundPosition: "center",
                  pointerEvents: "none",
                  zIndex: 0,
                }} />
              )}
              {/* Green header band */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                height: 10 * scale,
                background: "#145A32",
                zIndex: 1,
              }} />

              {currentDesign.map((item) => {
                const meta = getFieldMeta(activeType, item.key);
                return (
                  <FieldBlock
                    key={item.id}
                    item={item}
                    meta={meta}
                    selected={selectedId === item.id}
                    showSample={showSample}
                    scale={scale}
                    onSelect={setSelectedId}
                    onMoveStart={handleItemMoveStart}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-56 shrink-0 rounded-2xl border border-border bg-card shadow-sm overflow-y-auto max-h-[calc(100vh-16rem)]">
          <div className="sticky top-0 bg-card border-b border-border px-4 py-3 z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Properties</p>
          </div>
          {!selectedItem ? (
            <div className="px-4 py-8 text-center">
              <Move className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-xs text-muted-foreground">Click a field on the canvas to edit its properties</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-primary mb-1">{getFieldMeta(activeType, selectedItem.key).label}</p>
              </div>

              {/* Position & Size */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Position & Size</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[["x", "X"], ["y", "Y"], ["w", "W"], ["h", "H"]].map(([k, label]) => (
                    <div key={k}>
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input
                        type="number"
                        value={selectedItem[k]}
                        onChange={(e) => updateProp(k, Number(e.target.value))}
                        className="h-7 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Typography</p>
                <div>
                  <Label className="text-xs text-muted-foreground">Font Size</Label>
                  <Input
                    type="number"
                    value={selectedItem.fontSize}
                    onChange={(e) => updateProp("fontSize", Number(e.target.value))}
                    className="h-7 text-xs"
                    min={6}
                    max={72}
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateProp("bold", !selectedItem.bold)}
                    className={cn("flex-1 flex items-center justify-center h-7 rounded-lg border text-xs transition",
                      selectedItem.bold ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                    )}
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => updateProp("italic", !selectedItem.italic)}
                    className={cn("flex-1 flex items-center justify-center h-7 rounded-lg border text-xs transition",
                      selectedItem.italic ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                    )}
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={selectedItem.color}
                      onChange={(e) => updateProp("color", e.target.value)}
                      className="h-7 w-10 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={selectedItem.color}
                      onChange={(e) => updateProp("color", e.target.value)}
                      className="h-7 text-xs flex-1"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              {/* Alignment */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alignment</p>
                <div className="flex gap-1">
                  {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([a, Icon]) => (
                    <button
                      key={a}
                      onClick={() => updateProp("align", a)}
                      className={cn("flex-1 flex items-center justify-center h-7 rounded-lg border text-xs transition",
                        selectedItem.align === a ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Delete */}
              <Button variant="destructive" size="sm" onClick={removeSelected} className="w-full">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove Field
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-border bg-muted/30 px-5 py-4 text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
        <span><strong>Drag</strong> fields from the palette to the canvas</span>
        <span><strong>Drag</strong> placed fields to reposition them</span>
        <span><strong>Click</strong> a field to edit its properties</span>
        <span><strong>Ctrl+Z</strong> style: use Undo/Redo buttons</span>
        <span><strong>Eye icon</strong> toggles sample data preview</span>
        <span><strong>Save</strong> stores all three template layouts</span>
      </div>
    </>
  );
}
