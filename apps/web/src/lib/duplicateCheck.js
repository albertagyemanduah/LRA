import pb from "@/lib/pocketbaseClient";
import { isParcelSoftDeleted } from "@/lib/deleteUtils";

// Normalise a value for tolerant comparison (case / spacing / punctuation safe)
export const normKey = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const normPhone = (v) => String(v ?? "").replace(/\D/g, "").slice(-9);

/**
 * Find an existing parcel matching Sector + Plot Number + Block (the canonical
 * land-identity combination). Robust against casing/whitespace differences that
 * made the strict server-side filter report "exists" incorrectly or miss real
 * matches. Pass `excludeId` to skip the current parcel (used by edit/amendment/
 * transfer forms so a record is never flagged as a duplicate of itself).
 */
export async function findExistingParcel(
  { plotNumber, block, sector },
  requestKey = "dupe-parcel",
  excludeId = null,
) {
  const plot = normKey(plotNumber);
  if (!plot) return null;
  let candidates = [];
  try {
    candidates = await pb.collection("parcels").getFullList({
      filter: pb.filter("plotNumber ~ {:p}", { p: String(plotNumber).trim() }),
      requestKey: `${requestKey}-${Math.random().toString(36).slice(2)}`,
    });
  } catch (err) {
    console.error("[duplicateCheck] parcel lookup failed", err);
    return null;
  }
  const b = normKey(block);
  const sec = normKey(sector);
  const potentials = candidates.filter((c) => {
    if (excludeId && c.id === excludeId) return false;
    if (normKey(c.plotNumber) !== plot) return false;
    if (normKey(c.block) !== b) return false;
    // Sector is part of the duplicate identity — must match (empty == empty).
    if (normKey(c.sector) !== sec) return false;
    return true;
  });

  // Skip soft-deleted records so import/duplicate-check treats them as absent
  for (const candidate of potentials) {
    let deleted = false;
    try { deleted = await isParcelSoftDeleted(candidate.id); } catch (_) {}
    if (!deleted) return candidate;
  }
  return null;
}

/**
 * Generic duplicate check used by forms.
 * type: "parcel" | "transfer" | "contact" | "user"
 * Returns { duplicate: boolean, records: [], label: string }
 */
export async function checkDuplicates(type, data = {}) {
  try {
    if (type === "parcel") {
      const rec = await findExistingParcel(data, "form-dupe-parcel", data.excludeId || null);
      return {
        duplicate: !!rec,
        records: rec ? [rec] : [],
        label: `Sector ${data.sector || "—"} · Plot ${data.plotNumber || "—"} / Block ${data.block || "—"}`,
      };
    }
    if (type === "transfer") {
      const items = await pb.collection("land_transfers").getFullList({
        filter: pb.filter("parcel = {:p} && status = 'pending'", { p: data.parcelId || "" }),
        requestKey: `form-dupe-transfer-${Math.random().toString(36).slice(2)}`,
      });
      const name = normKey(data.toOwnerName);
      const matches = items.filter((t) => !name || normKey(t.toOwnerName) === name || t.toOwnerUser === data.toOwnerUser);
      return { duplicate: matches.length > 0, records: matches, label: "Pending transfer for this parcel" };
    }
    if (type === "user") {
      const items = await pb.collection("users").getFullList({
        filter: pb.filter("email = {:e}", { e: (data.email || "").trim() }),
        requestKey: `form-dupe-user-${Math.random().toString(36).slice(2)}`,
      });
      const matches = items.filter((u) => u.id !== data.excludeId);
      return { duplicate: matches.length > 0, records: matches, label: data.email || "—" };
    }
    if (type === "contact") {
      const phone = normPhone(data.phone);
      const name = normKey(data.name);
      const items = await pb.collection("parcels").getFullList({
        filter: pb.filter("applicantName ~ {:n}", { n: (data.name || "").trim() }),
        requestKey: `form-dupe-contact-${Math.random().toString(36).slice(2)}`,
      });
      const matches = items.filter(
        (p) => normKey(p.applicantName) === name &&
          (!phone || [p.contactPhone, p.alternateMobile, p.alternateNumber2].some((x) => normPhone(x) === phone))
      );
      return { duplicate: matches.length > 0, records: matches, label: `${data.name || "—"} · ${data.phone || "—"}` };
    }
  } catch (err) {
    console.error("[duplicateCheck] check failed", type, err);
  }
  return { duplicate: false, records: [], label: "" };
}

/** Bulk duplicate scan across the registry. Returns grouped duplicates. */
export async function findAllDuplicates() {
  const out = { parcels: [], users: [], transfers: [] };
  try {
    const parcels = await pb.collection("parcels").getFullList({ requestKey: "bulk-dupe-parcels" });
    const groups = new Map();
    for (const p of parcels) {
      const key = `${normKey(p.sector)}|${normKey(p.plotNumber)}|${normKey(p.block)}`;
      if (!normKey(p.plotNumber)) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    out.parcels = [...groups.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([key, records]) => ({ key, records }));
  } catch (err) { console.error("[duplicateCheck] parcels scan failed", err); }

  try {
    const users = await pb.collection("users").getFullList({ requestKey: "bulk-dupe-users" });
    const groups = new Map();
    for (const u of users) {
      const key = normPhone(u.phone) || normKey(u.fullName);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(u);
    }
    out.users = [...groups.entries()].filter(([, v]) => v.length > 1).map(([key, records]) => ({ key, records }));
  } catch (err) { console.error("[duplicateCheck] users scan failed", err); }

  try {
    const transfers = await pb.collection("land_transfers").getFullList({ requestKey: "bulk-dupe-transfers" });
    const groups = new Map();
    for (const t of transfers) {
      if (t.status !== "pending") continue;
      const key = `${t.parcel}|${normKey(t.toOwnerName)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    out.transfers = [...groups.entries()].filter(([, v]) => v.length > 1).map(([key, records]) => ({ key, records }));
  } catch (err) { console.error("[duplicateCheck] transfers scan failed", err); }

  return out;
}
