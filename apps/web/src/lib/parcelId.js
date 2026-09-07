// Parcel ID utilities — format: TeNDA-PPD-[COMMUNITY ABBREVIATION]-XXXX
// e.g. TeNDA-PPD-ADUM-0001
//
// The abbreviation is derived deterministically from the community name:
// uppercase, strip non-alphanumerics, take the first 4 characters (min 2).
import pb from "@/lib/pocketbaseClient";

export const PARCEL_ID_PREFIX = "TeNDA-PPD-";

/** Deterministic community abbreviation (2–4 uppercase alphanumerics). */
export function abbreviateCommunity(community) {
  const cleaned = (community || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "UNK";
  return cleaned.slice(0, 4);
}

/** Full regex for the canonical parcel ID format. */
export const PARCEL_ID_REGEX = /^TeNDA-PPD-[A-Z0-9]{2,4}-\d{4}$/;

/**
 * Validate a parcel ID string. When a community is supplied, also checks
 * that the embedded abbreviation matches the community.
 */
export function isValidParcelId(id, community) {
  if (!id || typeof id !== "string") return false;
  if (!PARCEL_ID_REGEX.test(id)) return false;
  if (community !== undefined) {
    const parts = id.split("-");
    if (parts[2] !== abbreviateCommunity(community)) return false;
  }
  return true;
}

/**
 * Analyse a single parcel's ID and return validity + list of issue reasons.
 */
export function analyzeParcelId(parcel, allParcels = []) {
  const issues = [];
  const abbr = abbreviateCommunity(parcel.community);
  const id = parcel.parcelNumber;

  if (!id || !String(id).trim()) {
    issues.push("Missing ID");
  } else {
    if (!/^TeNDA-PPD-/.test(id)) issues.push("Wrong prefix");
    if (!PARCEL_ID_REGEX.test(id)) {
      // Avoid double-reporting prefix; only add malformed if prefix ok
      if (/^TeNDA-PPD-/.test(id)) issues.push("Malformed format");
    } else {
      const parts = id.split("-");
      if (parts[2] !== abbr) issues.push("Wrong community abbreviation");
    }
  }

  // Duplicate check (another parcel shares the same ID)
  const dupes = allParcels.filter(
    (p) => p.id !== parcel.id && p.parcelNumber && p.parcelNumber === id,
  );
  if (id && dupes.length > 0) issues.push("Duplicate ID");

  return { valid: issues.length === 0, issues, abbreviation: abbr };
}

/**
 * Build correction proposals for every invalid parcel in the dataset.
 * Assigns unique, non-conflicting proposed IDs per community abbreviation,
 * incrementing from the highest sequence already in use for that abbreviation.
 */
export function buildCorrections(allParcels) {
  const usedIds = new Set(
    allParcels.map((p) => p.parcelNumber).filter(Boolean),
  );
  const seqByAbbr = {}; // abbreviation -> highest sequence seen

  for (const p of allParcels) {
    const id = p.parcelNumber;
    if (!id) continue;
    const m = id.match(/^TeNDA-PPD-([A-Z0-9]{2,4})-(\d{4})$/);
    if (m) {
      const abbr = m[1];
      const seq = parseInt(m[2], 10);
      if (!seqByAbbr[abbr] || seq > seqByAbbr[abbr]) seqByAbbr[abbr] = seq;
    }
  }

  const corrections = [];
  // Process deterministically by created date then id
  const ordered = [...allParcels].sort((a, b) => {
    const ca = a.created || "";
    const cb = b.created || "";
    if (ca !== cb) return ca < cb ? -1 : 1;
    return (a.id || "") < (b.id || "") ? -1 : 1;
  });

  for (const p of ordered) {
    const analysis = analyzeParcelId(p, allParcels);
    if (analysis.valid) continue;
    const abbr = analysis.abbreviation;
    let seq = (seqByAbbr[abbr] || 0) + 1;
    let proposed;
    do {
      proposed = `TeNDA-PPD-${abbr}-${String(seq).padStart(4, "0")}`;
      seq++;
    } while (usedIds.has(proposed));
    usedIds.add(proposed);
    seqByAbbr[abbr] = seq - 1;
    corrections.push({
      id: p.id,
      parcelId: p.id,
      currentId: p.parcelNumber || "(empty)",
      proposedId: proposed,
      community: p.community || "—",
      areaCouncil: p.areaCouncil || "—",
      applicantName: p.applicantName || "—",
      reason: analysis.issues.join(", "),
    });
  }
  return corrections;
}

/**
 * Generate the next parcel ID for a community, based on the highest sequence
 * currently in use for that community's abbreviation.
 */
export async function generateParcelId(community) {
  const abbr = abbreviateCommunity(community);
  const prefix = `TeNDA-PPD-${abbr}-`;
  let maxSeq = 0;
  try {
    const all = await pb.collection("parcels").getFullList({
      filter: pb.filter("parcelNumber ~ {:prefix}", { prefix }),
      requestKey: `pid-gen-${abbr}-${Date.now()}`,
    });
    for (const p of all) {
      const m = p.parcelNumber && p.parcelNumber.match(/(\d{4})$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    }
  } catch (_) {
    // ignore — start from 1
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}
