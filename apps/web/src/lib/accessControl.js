// Hierarchy-based access control helpers.
// User hierarchy fields: officeRef, areaCouncilRef, communityRef, sectorRef (all name strings).
// Roles with full cross-hierarchy access:
const FULL_ACCESS_ROLES = ["admin", "planning_officer"];

// Ordered levels top → bottom.
const LEVEL_FIELDS = ["officeRef", "areaCouncilRef", "communityRef", "sectorRef"];

// Map a data record's hierarchy fields (parcels use office/areaCouncil/community/sector names).
function dataLevels(data) {
  return {
    officeRef: data?.office || data?.officeRef || "",
    areaCouncilRef: data?.areaCouncil || data?.areaCouncilRef || "",
    communityRef: data?.community || data?.communityRef || "",
    sectorRef: data?.sector || data?.sectorRef || "",
  };
}

function userLevels(user) {
  return {
    officeRef: user?.officeRef || "",
    areaCouncilRef: user?.areaCouncilRef || "",
    communityRef: user?.communityRef || "",
    sectorRef: user?.sectorRef || "",
  };
}

/**
 * Returns true if the user may access the given data record.
 * Full-access roles always allowed. Otherwise the user's assigned level must
 * match, be a parent of, or be a child of the data's level.
 */
export function checkHierarchyAccess(user, data, role) {
  const r = role || user?.role;
  if (FULL_ACCESS_ROLES.includes(r)) return true;
  if (!user) return false;

  const u = userLevels(user);
  const d = dataLevels(data);

  // If the user has no hierarchy assignment, deny (staff must be scoped).
  const userDeepest = LEVEL_FIELDS.filter((f) => u[f]).pop();
  if (!userDeepest) return true; // unscoped staff → allow (backward compatible)

  // Walk from top: every level the user has set must match the data's level
  // up to the user's deepest assigned level (parent/self access). Child access
  // is implied because deeper data fields simply extend the matched path.
  for (const f of LEVEL_FIELDS) {
    if (!u[f]) break; // reached user's deepest level
    if (d[f] && d[f] !== u[f]) return false;
  }
  return true;
}

/**
 * Filter an array of records to only those the user can access.
 */
export function filterDataByHierarchy(user, records, role) {
  const r = role || user?.role;
  if (FULL_ACCESS_ROLES.includes(r)) return records || [];
  if (!Array.isArray(records)) return [];
  return records.filter((rec) => checkHierarchyAccess(user, rec, r));
}

/**
 * Returns the list of hierarchy level values the user can access (self + children).
 * Each entry: { field, value }.
 */
export function getAccessibleHierarchyLevels(user, role) {
  const r = role || user?.role;
  const u = userLevels(user);
  const levels = [];
  for (const f of LEVEL_FIELDS) {
    if (u[f]) levels.push({ field: f, value: u[f] });
  }
  return { fullAccess: FULL_ACCESS_ROLES.includes(r), levels };
}

/** Only the District Assembly Administrator may mutate the hierarchy structure. */
export function canEditStructure(role) {
  return role === "admin";
}

export { FULL_ACCESS_ROLES };
