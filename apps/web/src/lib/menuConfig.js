// Menu customization — loads/saves the admin-configured sidebar menu structure.
// Persisted in PocketBase (menu_customizations collection) with localStorage cache.
import pb from "@/lib/pocketbaseClient";
import { MODULE_GROUPS, MODULES } from "@/lib/roles";

const CACHE_KEY = "tnda-menu-config";

// Default config derived from the static MODULE_GROUPS in roles.js
export function defaultMenuConfig() {
  return {
    groups: MODULE_GROUPS.map((g, i) => ({
      id: `group-${i}`,
      label: g.label,
      modules: [...g.modules],
      visible: true,
    })),
    hiddenModules: [],
  };
}

// All known module keys (for the customization UI)
export function allModuleKeys() {
  return Object.keys(MODULES);
}

// Load the effective config: try PocketBase, fall back to localStorage cache, then default
export async function loadMenuConfig() {
  // Fast path: localStorage cache for instant render
  const cached = readCache();
  if (cached) {
    // Kick off a background refresh from PB (don't block)
    refreshFromPB().catch(() => {});
    return cached;
  }
  try {
    const cfg = await refreshFromPB();
    return cfg || defaultMenuConfig();
  } catch (_) {
    return defaultMenuConfig();
  }
}

async function refreshFromPB() {
  try {
    const list = await pb.collection("menu_customizations").getFullList({
      sort: "-updated", requestKey: "menu-cfg-load",
    });
    if (!list || list.length === 0) return null;
    const rec = list[0];
    const cfg = rec.config && typeof rec.config === "object"
      ? normalizeConfig(rec.config)
      : defaultMenuConfig();
    writeCache(cfg);
    return cfg;
  } catch (_) {
    return null;
  }
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return normalizeConfig(JSON.parse(raw));
  } catch (_) {
    return null;
  }
}

function writeCache(cfg) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (_) {}
}

// Ensure the config has the expected shape and includes any new modules
export function normalizeConfig(cfg) {
  if (!cfg || !Array.isArray(cfg.groups)) return defaultMenuConfig();
  const known = new Set(allModuleKeys());
  const groups = cfg.groups.map((g, i) => ({
    id: g.id || `group-${i}`,
    label: g.label || `Group ${i + 1}`,
    modules: Array.isArray(g.modules) ? g.modules.filter((m) => known.has(m)) : [],
    visible: g.visible !== false,
  }));
  const hiddenModules = Array.isArray(cfg.hiddenModules)
    ? cfg.hiddenModules.filter((m) => known.has(m))
    : [];
  // Backfill any known module that isn't placed in a group (e.g. a newly
  // added module) into its default group so it always appears in the menu.
  const placed = new Set(groups.flatMap((g) => g.modules));
  MODULE_GROUPS.forEach((dg, i) => {
    const target = groups[i] || (groups[i] = {
      id: `group-${i}`, label: dg.label, modules: [], visible: true,
    });
    dg.modules.forEach((m) => {
      if (known.has(m) && !placed.has(m) && !hiddenModules.includes(m)) {
        target.modules.push(m);
        placed.add(m);
      }
    });
  });
  return { groups, hiddenModules };
}

// Save config to PocketBase (admin only). Upserts the single config record.
export async function saveMenuConfig(cfg, user) {
  const normalized = normalizeConfig(cfg);
  writeCache(normalized);
  if (!user?.id) return normalized;
  try {
    const existing = await pb.collection("menu_customizations").getFullList({
      sort: "-updated", requestKey: "menu-cfg-save-find",
    });
    const data = { config: normalized, label: "Default menu configuration", owner: user.id };
    if (existing && existing.length > 0) {
      await pb.collection("menu_customizations").update(existing[0].id, data, { requestKey: "menu-cfg-save-upd" });
    } else {
      await pb.collection("menu_customizations").create(data, { requestKey: "menu-cfg-save-new" });
    }
  } catch (err) {
    // PB save failed (e.g. permissions) — cache still updated locally
    console.warn("Menu config save failed", err);
  }
  return normalized;
}

// Reset to default (clears cache + deletes PB record)
export async function resetMenuConfig() {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
  try {
    const existing = await pb.collection("menu_customizations").getFullList({
      sort: "-updated", requestKey: "menu-cfg-reset-find",
    });
    if (existing && existing.length > 0) {
      await pb.collection("menu_customizations").delete(existing[0].id, { requestKey: "menu-cfg-reset-del" });
    }
  } catch (_) {}
  return defaultMenuConfig();
}

// Compute the visible menu groups for a given set of accessible modules
export function effectiveMenuForRole(config, accessibleModules) {
  const access = new Set(accessibleModules);
  const hidden = new Set(config.hiddenModules || []);
  return config.groups
    .filter((g) => g.visible !== false)
    .map((g) => ({
      label: g.label,
      modules: g.modules.filter((m) => access.has(m) && !hidden.has(m)),
    }))
    .filter((g) => g.modules.length > 0);
}
