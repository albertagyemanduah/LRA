// Certificate template utilities — shared between AdminPage and ParcelsPage

export const CERT_FIELDS = [
  { key: "parcelNumber", label: "Land/Parcel ID" },
  { key: "applicantName", label: "Applicant Name" },
  { key: "areaCouncil", label: "Area Council" },
  { key: "community", label: "Community" },
  { key: "sector", label: "Sector" },
  { key: "plotNumber", label: "Plot Number" },
  { key: "block", label: "Block" },
  { key: "allocationDate", label: "Allocation Date" },
  { key: "registrationDate", label: "Registration Date" },
  { key: "contactPhone", label: "Phone Number" },
  { key: "applicantEmail", label: "Email" },
  { key: "tribe", label: "Tribe" },
  { key: "religion", label: "Religion" },
  { key: "status", label: "Registration Status" },
];

const STORAGE_KEY = "tnda-cert-templates";

export function loadCertTemplates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch (_) { return []; }
}

export function saveCertTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function loadActiveCertTemplate() {
  const all = loadCertTemplates();
  return all.find((t) => t.isDefault) || all[0] || null;
}
