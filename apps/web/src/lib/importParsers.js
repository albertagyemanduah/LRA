// Robust import parsers for CSV / XLS / XLSX land data files.
// Handles delimiter detection, quoted + multi-line fields, encodings, BOM,
// multi-sheet workbooks, header aliasing and per-row validation reporting.
import * as XLSX from "xlsx";

export const importLog = [];

export function logImport(step, detail) {
  const entry = { at: new Date().toISOString(), step, detail };
  importLog.push(entry);
  if (importLog.length > 500) importLog.shift();
  // eslint-disable-next-line no-console
  console.info(`[import] ${step}`, detail ?? "");
  return entry;
}

export const CANONICAL_FIELDS = [
  "applicantName", "contactPhone", "alternateMobile", "alternateNumber2", "whatsapp",
  "applicantEmail", "religion", "tribe", "office", "areaCouncil", "community",
  "sector", "plotNumber", "block", "allocationDate", "registrationDate",
];

const HEADER_ALIASES = {
  applicantname: "applicantName", name: "applicantName", nameofapplicant: "applicantName",
  applicant: "applicantName", ownername: "applicantName", fullname: "applicantName",
  contactphone: "contactPhone", phone: "contactPhone", phonenumber: "contactPhone",
  mobile: "contactPhone", contact: "contactPhone", telephone: "contactPhone",
  alternatemobile: "alternateMobile", alternatenumber: "alternateMobile", altmobile: "alternateMobile",
  alternatenumber2: "alternateNumber2", altnumber2: "alternateNumber2", alternatemobile2: "alternateNumber2",
  whatsapp: "whatsapp", whatsappnumber: "whatsapp",
  applicantemail: "applicantEmail", email: "applicantEmail", emailaddress: "applicantEmail",
  religion: "religion", tribe: "tribe", ethnicity: "tribe",
  office: "office", officename: "office",
  areacouncil: "areaCouncil", council: "areaCouncil",
  community: "community", town: "community", village: "community",
  sector: "sector", zone: "sector",
  plotnumber: "plotNumber", plot: "plotNumber", plotno: "plotNumber", plotblock: "plotNumber",
  block: "block", blockno: "block",
  allocationdate: "allocationDate", dateofallocation: "allocationDate",
  registrationdate: "registrationDate", dateofregistration: "registrationDate", regdate: "registrationDate",
};

const normHeader = (h) =>
  String(h ?? "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s._\-/\\]+/g, "");

export function mapHeader(header) {
  const key = normHeader(header);
  if (!key) return "";
  if (HEADER_ALIASES[key]) return HEADER_ALIASES[key];
  const direct = CANONICAL_FIELDS.find((f) => f.toLowerCase() === key);
  return direct || String(header).trim();
}

function detectDelimiter(sample) {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    // count occurrences outside quotes on the header line
    let count = 0, inQ = false;
    for (let i = 0; i < sample.length; i++) {
      const c = sample[i];
      if (c === '"') inQ = !inQ;
      else if (!inQ && c === d) count++;
      else if (!inQ && c === "\n") break;
    }
    if (count > bestCount) { bestCount = count; best = d; }
  }
  return best;
}

// Full RFC4180-ish CSV tokenizer: quoted fields, escaped quotes, multi-line values.
function tokenizeCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delimiter) { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

export function parseCsvText(text) {
  if (!text || !text.trim()) throw new Error("File is empty");
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(clean.split("\n")[0] || "");
  logImport("csv:delimiter", delimiter === "\t" ? "tab" : delimiter);
  const matrix = tokenizeCsv(clean, delimiter);
  if (matrix.length < 2) throw new Error("File must contain a header row and at least one data row");
  return matrixToRows(matrix);
}

export function matrixToRows(matrix) {
  const headers = matrix[0].map((h) => mapHeader(h));
  const rows = matrix.slice(1).map((vals) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (!h) return;
      const v = vals[i];
      obj[h] = v === undefined || v === null ? "" : String(v).trim();
    });
    return obj;
  }).filter((r) => Object.values(r).some((v) => v));
  return { headers: headers.filter(Boolean), rows };
}

async function readFileAsText(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  // Fallback to latin1 when UTF-8 decoding produced replacement characters
  if (/\uFFFD/.test(text)) {
    logImport("csv:encoding", "utf-8 failed, retrying iso-8859-1");
    try { text = new TextDecoder("iso-8859-1").decode(bytes); } catch { /* keep utf-8 */ }
  }
  return text;
}

export function listSheets(file, workbook) {
  return workbook?.SheetNames || [];
}

export async function readWorkbook(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, cellText: false });
  if (!wb.SheetNames || wb.SheetNames.length === 0) throw new Error("Workbook contains no sheets");
  logImport("xlsx:sheets", wb.SheetNames.join(", "));
  return wb;
}

export function sheetToRows(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);
  const matrix = XLSX.utils.sheet_to_json(ws, {
    header: 1, raw: false, defval: "", blankrows: false,
  });
  const cleaned = matrix
    .map((r) => (Array.isArray(r) ? r.map((c) => (c === null || c === undefined ? "" : String(c).trim())) : []))
    .filter((r) => r.some((v) => v !== ""));
  if (cleaned.length < 2) throw new Error(`Sheet "${sheetName}" has no data rows`);
  return matrixToRows(cleaned);
}

export function fileKind(file) {
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) return "csv";
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) return "xlsx";
  if (name.endsWith(".xls")) return "xls";
  return "unknown";
}

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

// Parses any supported file. Returns { kind, sheets, sheetName, workbook, headers, rows }
export async function parseImportFile(file, sheetName) {
  if (!file) throw new Error("No file selected");
  const kind = fileKind(file);
  logImport("file:selected", `${file.name} (${kind}, ${file.size} bytes)`);
  if (kind === "unknown") throw new Error("Unsupported file type. Use .csv, .txt, .xls or .xlsx");
  if (file.size === 0) throw new Error("File is empty");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("File is larger than 20 MB");

  if (kind === "csv") {
    const text = await readFileAsText(file);
    const { headers, rows } = parseCsvText(text);
    logImport("csv:parsed", `${rows.length} rows`);
    return { kind, sheets: [], sheetName: "", workbook: null, headers, rows };
  }

  const workbook = await readWorkbook(file);
  const sheets = workbook.SheetNames;
  const chosen = sheetName && sheets.includes(sheetName) ? sheetName : sheets[0];
  const { headers, rows } = sheetToRows(workbook, chosen);
  logImport("xlsx:parsed", `${chosen}: ${rows.length} rows`);
  return { kind, sheets, sheetName: chosen, workbook, headers, rows };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{6,20}$/;

// Validates parsed (already normalised) rows. Returns a full report.
export function validateRows(rows, hierarchy = {}) {
  const { offices = [], areaCouncils = [], communities = [], sectors = [] } = hierarchy;
  const names = (list) => list.map((i) => String(i?.name || "").toLowerCase().trim()).filter(Boolean);
  const known = {
    office: names(offices), areaCouncil: names(areaCouncils),
    community: names(communities), sector: names(sectors),
  };

  const errors = [];
  const warnings = [];
  const seen = new Map();
  let valid = 0;

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const rowErrors = [];
    if (!String(row.applicantName || "").trim()) rowErrors.push("Missing applicant name");
    for (const key of ["contactPhone", "alternateMobile", "alternateNumber2", "whatsapp"]) {
      const val = String(row[key] || "").trim();
      if (val && !val.split("/").every((p) => !p.trim() || PHONE_RE.test(p.trim()))) {
        warnings.push(`Row ${line}: ${key} "${val}" does not look like a phone number`);
      }
    }
    const email = String(row.applicantEmail || "").trim();
    if (email && !EMAIL_RE.test(email)) warnings.push(`Row ${line}: invalid email "${email}"`);
    for (const key of ["allocationDate", "registrationDate"]) {
      const val = String(row[key] || "").trim();
      if (val && Number.isNaN(new Date(val).getTime()) && !/\d/.test(val)) {
        warnings.push(`Row ${line}: unrecognised ${key} "${val}"`);
      }
    }
    for (const key of ["office", "areaCouncil", "community", "sector"]) {
      const val = String(row[key] || "").toLowerCase().trim();
      if (val && known[key].length > 0 && !known[key].some((n) => n === val || n.includes(val) || val.includes(n))) {
        warnings.push(`Row ${line}: ${key} "${row[key]}" not found in system structure — will be imported as typed`);
      }
    }
    const dupKey = [row.plotNumber, row.block, row.areaCouncil]
      .map((v) => String(v || "").toLowerCase().trim()).join("|");
    if (dupKey.replace(/\|/g, "")) {
      if (seen.has(dupKey)) warnings.push(`Row ${line}: duplicates row ${seen.get(dupKey)} in this file (plot/block/area council)`);
      else seen.set(dupKey, line);
    }
    if (rowErrors.length > 0) errors.push(`Row ${line}: ${rowErrors.join("; ")}`);
    else valid++;
  });

  return {
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    errors,
    warnings,
    suggestions: errors.length > 0
      ? ["Fill in the applicant name for flagged rows, or remove them before importing."]
      : [],
  };
}
