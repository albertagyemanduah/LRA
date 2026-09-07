// Office → Area Council mapping for Techiman North District Assembly

export const OFFICES = {
  tuobodom_office: {
    label: "Tuobodom Office",
    areaCouncils: ["Tuobodom"],
  },
  offuman_office: {
    label: "Offuman Office",
    areaCouncils: ["Offuman"],
  },
  akrofrom_office: {
    label: "Akrofrom Office",
    areaCouncils: ["Aworowa", "Buoyem", "Krobo"],
  },
};

export const OFFICE_OPTIONS = Object.entries(OFFICES).map(([value, o]) => ({
  value,
  label: o.label,
  areaCouncils: o.areaCouncils,
}));

export const ALL_AREA_COUNCILS = ["Aworowa", "Buoyem", "Krobo", "Tuobodom", "Offuman"];

/**
 * Returns the area councils a user has access to based on their role and hierarchy.
 * Admin and planning_officer always get all area councils (null = no filter).
 * Registrar, survey_officer, and other staff see their assigned area council(s).
 * If a specific areaCouncilRef is set, use that. Otherwise use office-based ACs.
 * If neither is set, return null (show all) to prevent empty access.
 */
export function getUserAreaCouncils(user) {
  const role = user?.role;
  if (role === "admin" || role === "planning_officer") return null; // no filter

  // For registrars and all other staff: check areaCouncilRef first
  const acRef = user?.areaCouncilRef;
  if (acRef && acRef.trim()) return [acRef.trim()];

  // Fall back to office-based area councils
  const office = user?.office;
  if (office && OFFICES[office]) return OFFICES[office].areaCouncils;

  // No specific assignment — allow all so staff aren't locked out
  return null;
}

/** Roles that always see every land record. */
const FULL_VISIBILITY_ROLES = ["admin", "planning_officer"];

const norm = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");

/** All office identifiers (key, label, officeRef) that map to this user. */
export function getUserOfficeNames(user) {
  const out = new Set();
  const key = user?.office;
  if (key) {
    out.add(norm(key));
    if (OFFICES[key]) out.add(norm(OFFICES[key].label));
  }
  if (user?.officeRef) out.add(norm(user.officeRef));
  return Array.from(out);
}

/**
 * Area councils visible to the user: explicit areaCouncilRef + every area
 * council belonging to their office. Returns null when unrestricted.
 */
export function getVisibleAreaCouncils(user) {
  if (FULL_VISIBILITY_ROLES.includes(user?.role)) return null;
  const set = new Set();
  if (user?.areaCouncilRef && user.areaCouncilRef.trim()) set.add(user.areaCouncilRef.trim());
  const office = user?.office;
  if (office && OFFICES[office]) OFFICES[office].areaCouncils.forEach((a) => set.add(a));
  if (set.size === 0) return null; // unscoped staff → see everything
  return Array.from(set);
}

/**
 * Visibility check for a single land record. Never depends on who uploaded it —
 * only on the office / area council hierarchy the user belongs to.
 */
export function canUserSeeParcel(user, parcel) {
  if (!parcel) return false;
  if (FULL_VISIBILITY_ROLES.includes(user?.role)) return true;

  const offices = getUserOfficeNames(user);
  if (offices.length && parcel.office && offices.includes(norm(parcel.office))) return true;

  const acs = getVisibleAreaCouncils(user);
  if (acs === null) return true;
  if (parcel.areaCouncil && acs.some((a) => norm(a) === norm(parcel.areaCouncil))) return true;

  // No hierarchy fields on the record at all → don't hide it.
  if (!parcel.office && !parcel.areaCouncil) return true;
  return false;
}

/** Filter a list of land records by the user's office / area council hierarchy. */
export function filterParcelsForUser(user, parcels) {
  if (!Array.isArray(parcels)) return [];
  if (FULL_VISIBILITY_ROLES.includes(user?.role)) return parcels;
  return parcels.filter((p) => canUserSeeParcel(user, p));
}

export function officeLabel(officeKey) {
  return OFFICES[officeKey]?.label || officeKey || "—";
}
