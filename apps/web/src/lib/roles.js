// Role definitions, portal metadata, and module access matrix.
// Citizen role removed — all users are staff members.

export const ROLES = {
  planning_officer: {
    label: "Physical Planning Officer",
    portal: "Physical Planning Portal",
    description: "Review applications, enforce planning compliance and approve or reject submissions.",
    modules: ["overview", "parcels", "amendments", "approvals", "transfer-requests", "my-transfers", "documents", "search", "reports", "ownership-analytics", "notification-preferences", "chat", "tickets", "manual", "update-notifications"],
  },
  survey_officer: {
    label: "Survey Officer",
    portal: "Survey Portal",
    description: "Schedule surveys, upload cadastral data and maintain boundary records.",
    modules: ["overview", "parcels", "amendments", "documents", "search", "reports", "ownership-analytics", "notification-preferences", "chat", "tickets", "manual", "update-notifications"],
  },
  registrar: {
    label: "Land Registrar",
    portal: "Land Registry Portal",
    description: "Register titles, issue certificates and verify supporting documents.",
    modules: ["overview", "parcels", "amendments", "transfer-requests", "my-transfers", "documents", "search", "reports", "ownership-analytics", "notification-preferences", "chat", "tickets", "manual", "update-notifications"],
  },
  finance_officer: {
    label: "Finance Officer",
    portal: "Finance & Revenue Portal",
    description: "Manage invoices, reconcile payments and produce revenue reports.",
    modules: ["overview", "payments", "reports", "financial-reports", "ownership-analytics", "notification-preferences", "search", "my-transfers", "chat", "tickets", "manual", "update-notifications"],
  },
  customary_secretariat: {
    label: "Customary Land Secretariat",
    portal: "Customary Land Portal",
    description: "Maintain customary land records, manage disputes and coordinate with the registry.",
    modules: ["overview", "parcels", "amendments", "transfer-requests", "my-transfers", "documents", "search", "reports", "ownership-analytics", "notification-preferences", "chat", "tickets", "manual", "update-notifications"],
  },
  admin: {
    label: "District Assembly Administrator",
    portal: "Administration Portal",
    description: "Oversee all operations, manage users and generate district-level reports.",
    modules: ["overview", "parcels", "amendments", "approvals", "transfer-requests", "my-transfers", "documents", "search", "payments", "reports", "financial-reports", "ownership-analytics", "notification-preferences", "admin", "structure", "verification-codes", "data-management", "parcel-id-correction", "admin-sms", "news-management", "menu-customization", "chat", "tickets", "template-designer", "manual", "update-notifications"],
  },
};

export const MODULES = {
  overview: { label: "Dashboard", path: "", icon: "LayoutDashboard" },
  parcels: { label: "Land Registration", path: "parcels", icon: "MapPinned" },
  amendments: { label: "Bulk Amendment", path: "amendments", icon: "Pencil" },
  approvals: { label: "Approvals", path: "approvals", icon: "ClipboardCheck" },
  "transfer-requests": { label: "Transfer Requests", path: "transfer-requests", icon: "ArrowRightLeft" },
  "my-transfers": { label: "My Transfers", path: "my-transfers", icon: "Send" },
  surveys: { label: "Cadastral & Survey", path: "surveys", icon: "Compass" },
  documents: { label: "Documents", path: "documents", icon: "FileText" },
  applications: { label: "Applications", path: "applications", icon: "ClipboardList" },
  search: { label: "Search & Verify", path: "search", icon: "SearchCheck" },
  payments: { label: "Payments & Revenue", path: "payments", icon: "Wallet" },
  reports: { label: "Reporting", path: "reports", icon: "BarChart3" },
  "financial-reports": { label: "Financial Reports", path: "financial-reports", icon: "Wallet" },
  admin: { label: "User Administration", path: "admin", icon: "ShieldCheck" },
  structure: { label: "Administrative Structure", path: "structure", icon: "Network" },
  chat: { label: "Messages", path: "chat", icon: "MessageSquare" },
  tickets: { label: "Support Tickets", path: "tickets", icon: "LifeBuoy" },
  profile: { label: "My Profile", path: "profile", icon: "UserCircle" },
  "template-designer": { label: "Template Designer", path: "template-designer", icon: "Palette" },
  manual: { label: "User Manual", path: "manual", icon: "BookOpen" },
  "update-notifications": { label: "Update Notifications", path: "update-notifications", icon: "Bell" },
  "verification-codes": { label: "Verification Codes", path: "verification-codes", icon: "KeyRound" },
  "data-management": { label: "Data Management", path: "data-management", icon: "Database" },
  "parcel-id-correction": { label: "Parcel ID Correction", path: "parcel-id-correction", icon: "Hash" },
  "admin-sms": { label: "Send SMS", path: "admin-sms", icon: "MessageSquare" },
  "news-management": { label: "News & Articles", path: "news-management", icon: "Newspaper" },
  "menu-customization": { label: "Menu Customization", path: "menu-customization", icon: "Menu" },
  "ownership-analytics": { label: "Ownership Analytics", path: "ownership-analytics", icon: "GitBranch" },
  "notification-preferences": { label: "Notification Preferences", path: "notification-preferences", icon: "BellRing" },
};

// Sidebar menu grouping — related modules organised under labelled groups.
export const MODULE_GROUPS = [
  { label: "Land Management", modules: ["overview", "parcels", "amendments", "transfer-requests", "my-transfers"] },
  { label: "Documents & Certificates", modules: ["documents", "payments", "template-designer"] },
  { label: "Verification & Search", modules: ["search"] },
  { label: "Communication", modules: ["chat", "tickets", "update-notifications"] },
  { label: "Reporting", modules: ["reports", "financial-reports", "ownership-analytics"] },
  { label: "Administration", modules: ["admin", "structure", "verification-codes", "data-management", "parcel-id-correction", "admin-sms", "news-management", "menu-customization", "notification-preferences"] },
  { label: "Help & Support", modules: ["manual"] },
];

export const ROLE_OPTIONS = Object.entries(ROLES).map(([value, r]) => ({
  value,
  label: r.label,
}));

export function roleLabel(role) {
  return ROLES[role]?.label || "Staff";
}

export function canAccess(role, moduleKey) {
  // roles can be array
  if (Array.isArray(role)) {
    return role.some((r) => ROLES[r]?.modules?.includes(moduleKey));
  }
  return ROLES[role]?.modules?.includes(moduleKey) ?? false;
}

/** Get combined modules for multi-role user */
export function getUserModules(roles) {
  if (!roles || roles.length === 0) return ROLES["admin"]?.modules || [];
  const all = new Set();
  const arr = Array.isArray(roles) ? roles : [roles];
  arr.forEach((r) => ROLES[r]?.modules?.forEach((m) => all.add(m)));
  return Array.from(all);
}
