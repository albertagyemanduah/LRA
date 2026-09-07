import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import {
  Menu as MenuIcon, GripVertical, Eye, EyeOff, Plus, Trash2, Edit2,
  Save, RotateCcw, ChevronUp, ChevronDown, ArrowRight, Check, X, RefreshCw,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  defaultMenuConfig, normalizeConfig, saveMenuConfig, resetMenuConfig, allModuleKeys,
} from "@/lib/menuConfig";
import { MODULES, ROLES, roleLabel } from "@/lib/roles";

export default function MenuCustomizationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editGroup, setEditGroup] = useState(null); // { index, label }
  const [addModuleTo, setAddModuleTo] = useState(null); // group index
  const [newGroupName, setNewGroupName] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [previewRole, setPreviewRole] = useState("admin");

  // Load config from PB (via menuConfig lib) on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const list = await pb.collection("menu_customizations").getFullList({
          sort: "-updated", requestKey: "menucust-load",
        }).catch(() => []);
        if (!mounted) return;
        if (list && list.length > 0 && list[0].config) {
          setConfig(normalizeConfig(list[0].config));
        } else {
          setConfig(defaultMenuConfig());
        }
      } catch (_) {
        if (mounted) setConfig(defaultMenuConfig());
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const markDirty = useCallback(() => setDirty(true), []);

  // ── Group operations ──────────────────────────────────────────
  const moveGroup = (idx, dir) => {
    setConfig((prev) => {
      const groups = [...prev.groups];
      const target = idx + dir;
      if (target < 0 || target >= groups.length) return prev;
      [groups[idx], groups[target]] = [groups[target], groups[idx]];
      return { ...prev, groups };
    });
    markDirty();
  };

  const toggleGroupVisible = (idx) => {
    setConfig((prev) => {
      const groups = [...prev.groups];
      groups[idx] = { ...groups[idx], visible: !groups[idx].visible };
      return { ...prev, groups };
    });
    markDirty();
  };

  const deleteGroup = (idx) => {
    setConfig((prev) => {
      const groups = prev.groups.filter((_, i) => i !== idx);
      return { ...prev, groups };
    });
    markDirty();
  };

  const renameGroup = (idx, label) => {
    setConfig((prev) => {
      const groups = [...prev.groups];
      groups[idx] = { ...groups[idx], label };
      return { ...prev, groups };
    });
    markDirty();
  };

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    setConfig((prev) => ({
      ...prev,
      groups: [...prev.groups, { id: `group-${Date.now()}`, label: newGroupName.trim(), modules: [], visible: true }],
    }));
    setNewGroupName("");
    setShowAddGroup(false);
    markDirty();
  };

  // ── Module operations within a group ──────────────────────────
  const moveModule = (groupIdx, modIdx, dir) => {
    setConfig((prev) => {
      const groups = [...prev.groups];
      const mods = [...groups[groupIdx].modules];
      const target = modIdx + dir;
      if (target < 0 || target >= mods.length) return prev;
      [mods[modIdx], mods[target]] = [mods[target], mods[modIdx]];
      groups[groupIdx] = { ...groups[groupIdx], modules: mods };
      return { ...prev, groups };
    });
    markDirty();
  };

  const removeModule = (groupIdx, modIdx) => {
    setConfig((prev) => {
      const groups = [...prev.groups];
      const mods = groups[groupIdx].modules.filter((_, i) => i !== modIdx);
      groups[groupIdx] = { ...groups[groupIdx], modules: mods };
      return { ...prev, groups };
    });
    markDirty();
  };

  const addModule = (groupIdx, moduleKey) => {
    if (!moduleKey || moduleKey === "_none") return;
    setConfig((prev) => {
      const groups = prev.groups.map((g) => ({
        ...g,
        modules: g.modules.filter((m) => m !== moduleKey),
      }));
      groups[groupIdx] = { ...groups[groupIdx], modules: [...groups[groupIdx].modules, moduleKey] };
      return { ...prev, groups, hiddenModules: (prev.hiddenModules || []).filter((m) => m !== moduleKey) };
    });
    setAddModuleTo(null);
    markDirty();
  };

  // ── Unassigned / hidden modules ───────────────────────────────
  const assignedModules = () => {
    const set = new Set();
    (config?.groups || []).forEach((g) => g.modules.forEach((m) => set.add(m)));
    return set;
  };

  const unassignedModules = () => allModuleKeys().filter((m) => !assignedModules().has(m));

  const toggleHideModule = (moduleKey) => {
    setConfig((prev) => {
      const hidden = new Set(prev.hiddenModules || []);
      if (hidden.has(moduleKey)) hidden.delete(moduleKey); else hidden.add(moduleKey);
      return { ...prev, hiddenModules: Array.from(hidden) };
    });
    markDirty();
  };

  // ── Save / Reset ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await saveMenuConfig(config, user);
      setDirty(false);
      toast({ title: "Menu saved", description: "Changes applied to the dashboard sidebar." });
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err?.message || "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const def = await resetMenuConfig();
      setConfig(def);
      setDirty(false);
      setResetOpen(false);
      toast({ title: "Menu reset to default" });
    } catch (err) {
      toast({ variant: "destructive", title: "Reset failed" });
    } finally {
      setSaving(false);
    }
  };

  // Preview modules for selected role
  const previewModules = ROLES[previewRole]?.modules || [];

  if (loading) return <Spinner />;
  if (!config) return <EmptyState icon={MenuIcon} title="Could not load menu configuration" />;

  return (
    <>
      <Helmet>
        <title>Menu Customization — Techiman North Land Registry</title>
        <meta name="description" content="Customize the dashboard sidebar menu: reorder groups, toggle visibility, and manage submenus." />
      </Helmet>

      <div className="flex flex-col gap-5">
        <PageHeader
          title="Menu Customization"
          subtitle="Reorder menu groups, toggle visibility, and assign modules (submenus) — admin only"
          icon={MenuIcon}
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setResetOpen(true)} disabled={saving}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                {saving ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          }
        />

        {dirty && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> You have unsaved changes. Click "Save Changes" to apply them to the dashboard.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── LEFT: Menu structure editor ─────────────────────── */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">Menu Groups</h2>
              <Button variant="outline" size="sm" onClick={() => setShowAddGroup(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Group
              </Button>
            </div>

            {config.groups.map((group, gIdx) => (
              <div
                key={group.id || gIdx}
                className={cn(
                  "rounded-xl border bg-card shadow-sm overflow-hidden",
                  group.visible ? "border-border" : "border-dashed border-border opacity-70",
                )}
              >
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/30">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    {editGroup?.index === gIdx ? (
                      <Input
                        value={editGroup.label}
                        onChange={(e) => setEditGroup({ index: gIdx, label: e.target.value })}
                        onBlur={() => { renameGroup(gIdx, editGroup.label.trim() || group.label); setEditGroup(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { renameGroup(gIdx, editGroup.label.trim() || group.label); setEditGroup(null); } }}
                        autoFocus
                        className="h-7 text-sm font-medium"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-foreground truncate">{group.label}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{group.modules.length} module(s) · {group.visible ? "Visible" : "Hidden"}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconBtn title="Move up" onClick={() => moveGroup(gIdx, -1)} disabled={gIdx === 0}><ChevronUp className="h-4 w-4" /></IconBtn>
                    <IconBtn title="Move down" onClick={() => moveGroup(gIdx, 1)} disabled={gIdx === config.groups.length - 1}><ChevronDown className="h-4 w-4" /></IconBtn>
                    <IconBtn title="Rename" onClick={() => setEditGroup({ index: gIdx, label: group.label })}><Edit2 className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title={group.visible ? "Hide group" : "Show group"} onClick={() => toggleGroupVisible(gIdx)}>
                      {group.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </IconBtn>
                    <IconBtn title="Delete group" onClick={() => deleteGroup(gIdx)} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </div>

                {/* Modules (submenus) */}
                <div className="p-2 space-y-1">
                  {group.modules.length === 0 && (
                    <p className="text-xs text-muted-foreground italic px-2 py-2">No modules in this group.</p>
                  )}
                  {group.modules.map((modKey, mIdx) => {
                    const mod = MODULES[modKey];
                    if (!mod) return null;
                    const isHidden = (config.hiddenModules || []).includes(modKey);
                    return (
                      <div
                        key={modKey}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm border transition-colors",
                          isHidden ? "border-dashed border-border bg-muted/20 opacity-60" : "border-transparent hover:bg-muted/40",
                        )}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        <span className="flex-1 truncate text-foreground">{mod.label}</span>
                        <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">/{mod.path || "app"}</span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <IconBtn title="Move up" onClick={() => moveModule(gIdx, mIdx, -1)} disabled={mIdx === 0}><ChevronUp className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn title="Move down" onClick={() => moveModule(gIdx, mIdx, 1)} disabled={mIdx === group.modules.length - 1}><ChevronDown className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn title={isHidden ? "Show module" : "Hide module"} onClick={() => toggleHideModule(modKey)}>
                            {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </IconBtn>
                          <IconBtn title="Remove from group" onClick={() => removeModule(gIdx, mIdx)} danger><X className="h-3.5 w-3.5" /></IconBtn>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add module to this group */}
                  {addModuleTo === gIdx ? (
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <Select value="_none" onValueChange={(v) => addModule(gIdx, v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select a module to add…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">— Select —</SelectItem>
                          {[...unassignedModules(), ...group.modules].map((m) => (
                            <SelectItem key={m} value={m}>{MODULES[m]?.label || m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => setAddModuleTo(null)} className="h-8"><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddModuleTo(gIdx)}
                      className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-xs text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add submenu
                    </button>
                  )}
                </div>
              </div>
            ))}

            {showAddGroup && (
              <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 flex items-center gap-2">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="New group name (e.g. Finance Tools)"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") addGroup(); if (e.key === "Escape") setShowAddGroup(false); }}
                  className="h-9"
                />
                <Button size="sm" onClick={addGroup}><Check className="h-3.5 w-3.5 mr-1" /> Add</Button>
                <Button variant="outline" size="sm" onClick={() => { setShowAddGroup(false); setNewGroupName(""); }}><X className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>

          {/* ── RIGHT: Unassigned modules + Preview ─────────────── */}
          <div className="space-y-4">
            {/* Unassigned modules */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Unassigned Modules</h3>
              <p className="text-xs text-muted-foreground mb-3">Drag these into a group, or toggle visibility. Unassigned modules won't appear in the sidebar.</p>
              {unassignedModules().length === 0 ? (
                <p className="text-xs text-muted-foreground italic">All modules are assigned.</p>
              ) : (
                <div className="space-y-1">
                  {unassignedModules().map((m) => {
                    const mod = MODULES[m];
                    if (!mod) return null;
                    const isHidden = (config.hiddenModules || []).includes(m);
                    return (
                      <div key={m} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm border border-dashed border-border bg-muted/20">
                        <span className="flex-1 truncate text-foreground">{mod.label}</span>
                        <IconBtn title={isHidden ? "Show" : "Hide"} onClick={() => toggleHideModule(m)}>
                          {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </IconBtn>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Role preview */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Eye className="h-4 w-4 text-primary" /> Role Preview</h3>
              <p className="text-xs text-muted-foreground mb-3">See how the menu looks for a given role.</p>
              <Select value={previewRole} onValueChange={setPreviewRole}>
                <SelectTrigger className="h-8 text-sm mb-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(ROLES).map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {config.groups
                  .filter((g) => g.visible !== false)
                  .map((g) => {
                    const visibleMods = g.modules.filter((m) => previewModules.includes(m) && !(config.hiddenModules || []).includes(m));
                    if (visibleMods.length === 0) return null;
                    return (
                      <div key={g.id}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">{g.label}</p>
                        <div className="space-y-0.5">
                          {visibleMods.map((m) => (
                            <div key={m} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground bg-muted/30">
                              <ArrowRight className="h-3 w-3 text-muted-foreground" /> {MODULES[m]?.label || m}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset confirmation */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset menu to default?</DialogTitle>
            <DialogDescription>
              This will discard all customizations and restore the original menu structure. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleReset} disabled={saving}>
              {saving ? "Resetting…" : "Reset to Default"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IconBtn({ title, onClick, disabled, danger, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none",
        danger && "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20",
      )}
    >
      {children}
    </button>
  );
}
