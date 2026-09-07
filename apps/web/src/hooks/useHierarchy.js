import { useState, useEffect } from "react";
import pb from "@/lib/pocketbaseClient";

/**
 * Loads all 4 hierarchy levels from PocketBase (non-deleted records only).
 * Returns { offices, areaCouncils, communities, sectors, loading }
 * All values are stored as record names (strings) in existing text fields.
 */
export function useHierarchy() {
  const [offices, setOffices] = useState([]);
  const [areaCouncils, setAreaCouncils] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      pb.collection("offices_struct").getFullList({ sort: "name", requestKey: "hier-off" }).catch(() => []),
      pb.collection("area_councils").getFullList({ sort: "name", expand: "office", requestKey: "hier-ac" }).catch(() => []),
      pb.collection("communities").getFullList({ sort: "name", expand: "areaCouncil", requestKey: "hier-comm" }).catch(() => []),
      pb.collection("sectors").getFullList({ sort: "name", expand: "community", requestKey: "hier-sect" }).catch(() => []),
    ]).then(([o, a, c, s]) => {
      const ok = (x) => x && !x.isDeleted && typeof x.name === "string" && x.name.trim() !== "";
      setOffices(o.filter(ok));
      setAreaCouncils(a.filter(ok));
      setCommunities(c.filter(ok));
      setSectors(s.filter(ok));
      setLoading(false);
    }).catch((err) => { console.error("Hierarchy load failed", err); setLoading(false); });
  }, []);

  /** Filter helpers (cascade by parent name — tolerant of id OR name storage, case-insensitive) */
  const norm = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
  const byName = (list, name) => list.find((x) => norm(x.name) === norm(name));
  // matches when the child's parent field holds the parent id, the parent name,
  // or when the expanded parent record's name matches
  const childMatches = (child, field, parent, parentName) => {
    const raw = child?.[field];
    const expandedName = child?.expand?.[field]?.name;
    if (parent && raw === parent.id) return true;
    if (norm(raw) && norm(raw) === norm(parentName)) return true;
    if (expandedName && norm(expandedName) === norm(parentName)) return true;
    return false;
  };

  const acForOffice = (officeName) => {
    if (!officeName) return areaCouncils;
    const office = byName(offices, officeName);
    const matched = areaCouncils.filter((a) => childMatches(a, "office", office, officeName));
    return matched.length ? matched : areaCouncils;
  };

  const commForAC = (acName) => {
    if (!acName) return communities;
    const ac = byName(areaCouncils, acName);
    const matched = communities.filter((c) => childMatches(c, "areaCouncil", ac, acName));
    return matched.length ? matched : communities;
  };

  const sectForComm = (commName) => {
    if (!commName) return sectors;
    const comm = byName(communities, commName);
    const matched = sectors.filter((s) => childMatches(s, "community", comm, commName));
    return matched.length ? matched : sectors;
  };

  return { offices, areaCouncils, communities, sectors, loading, acForOffice, commForAC, sectForComm };
}
