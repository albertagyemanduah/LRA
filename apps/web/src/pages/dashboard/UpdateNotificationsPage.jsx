import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import {
  Bell, Plus, Search, Filter, CheckCheck, Archive, Download,
  AlertCircle, Info, Zap, Wrench, Star, Clock, Users, Trash2,
  ChevronDown, Eye, Send, X, FileText, Video, Image, Link,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, timeAgo } from "@/lib/format";

const IMPORTANCE = [
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle, iconColor: "text-red-600" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Zap, iconColor: "text-orange-600" },
  { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Info, iconColor: "text-blue-600" },
  { value: "low", label: "Low", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Star, iconColor: "text-blue-600" },
];

const UPDATE_TYPES = [
  { value: "new_feature", label: "New Feature" },
  { value: "improvement", label: "Improvement" },
  { value: "bug_fix", label: "Bug Fix" },
  { value: "maintenance", label: "Maintenance" },
  { value: "important", label: "Important Notice" },
  { value: "security", label: "Security Update" },
];

const TARGET_OPTIONS = [
  { value: "all", label: "All Users" },
  { value: "admin", label: "Administrators" },
  { value: "planning_officer", label: "Physical Planning Officers" },
  { value: "survey_officer", label: "Survey Officers" },
  { value: "registrar", label: "Land Registrars" },
  { value: "finance_officer", label: "Finance Officers" },
  { value: "customary_secretariat", label: "Customary Land Secretariat" },
];

// Store notifications in localStorage for demo (would be PocketBase in production)
const STORAGE_KEY = "tnda-update-notifications";

function loadNotifs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveNotifs(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

// Load read state per user
function loadReadState(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(`tnda-notif-read-${userId}`) || "[]")); } catch { return new Set(); }
}
function saveReadState(userId, set) {
  localStorage.setItem(`tnda-notif-read-${userId}`, JSON.stringify([...set]));
}
function loadArchivedState(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(`tnda-notif-archived-${userId}`) || "[]")); } catch { return new Set(); }
}
function saveArchivedState(userId, set) {
  localStorage.setItem(`tnda-notif-archived-${userId}`, JSON.stringify([...set]));
}

function getImportanceCfg(v) {
  return IMPORTANCE.find((i) => i.value === v) || IMPORTANCE[2];
}

function NotifCard({ notif, isRead, isArchived, onRead, onArchive, onUnarchive, onDelete, isAdmin, userId }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getImportanceCfg(notif.importance);
  const Icon = cfg.icon;

  return (
    <div className={cn("rounded-2xl border bg-card shadow-sm overflow-hidden transition",
      !isRead ? "border-primary/30 bg-primary/[0.02]" : "border-border",
      isArchived ? "opacity-60" : "")}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border", cfg.color)}>
            <Icon className={cn("h-4 w-4", cfg.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {!isRead && <span className="flex h-2 w-2 rounded-full bg-primary shrink-0" />}
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", cfg.color)}>{cfg.label}</span>
              {notif.type && <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{UPDATE_TYPES.find((t) => t.value === notif.type)?.label || notif.type}</span>}
              {notif.targetRole !== "all" && (
                <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] text-secondary-foreground">{TARGET_OPTIONS.find((t) => t.value === notif.targetRole)?.label || notif.targetRole}</span>
              )}
              <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">{timeAgo(notif.createdAt)}</span>
            </div>
            <h3 className="font-semibold text-sm leading-snug">{notif.title}</h3>
            <p className={cn("text-sm text-muted-foreground mt-1 leading-relaxed", !expanded && "line-clamp-2")}>{notif.description}</p>
            {notif.description?.length > 150 && (
              <button onClick={() => setExpanded((e) => !e)} className="text-xs text-primary hover:underline mt-0.5">
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
            {expanded && notif.steps?.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-semibold">Step-by-step instructions:</p>
                <ol className="space-y-1">
                  {notif.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {expanded && notif.videoUrl && (
              <div className="mt-3">
                <p className="text-xs font-semibold mb-1 flex items-center gap-1"><Video className="h-3.5 w-3.5" /> Video Tutorial</p>
                {notif.videoUrl.includes("youtube.com") || notif.videoUrl.includes("youtu.be") ? (
                  <div className="aspect-video rounded-lg overflow-hidden border border-border">
                    <iframe
                      src={notif.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                      className="w-full h-full" allowFullScreen title="Tutorial" />
                  </div>
                ) : (
                  <a href={notif.videoUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <Link className="h-3.5 w-3.5" /> Open video tutorial
                  </a>
                )}
              </div>
            )}
            {expanded && notif.affectedFeatures?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold mb-1">Affected Features:</p>
                <div className="flex flex-wrap gap-1">
                  {notif.affectedFeatures.map((f, i) => (
                    <span key={i} className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {expanded && notif.implementationDate && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Implementation date: {notif.implementationDate}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
          {!isRead && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onRead(notif.id)}><CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark read</Button>}
          {!isArchived
            ? <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onArchive(notif.id)}><Archive className="mr-1 h-3.5 w-3.5" /> Archive</Button>
            : <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onUnarchive(notif.id)}>Unarchive</Button>
          }
          {isAdmin && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive ml-auto" onClick={() => onDelete(notif.id)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  title: "", description: "", importance: "medium", type: "new_feature",
  targetRole: "all", steps: [""], affectedFeatures: "", videoUrl: "", implementationDate: "",
};

export default function UpdateNotificationsPage() {
  const { user, role, log } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [notifs, setNotifs] = useState(loadNotifs);
  const [readSet, setReadSet] = useState(() => loadReadState(user?.id));
  const [archivedSet, setArchivedSet] = useState(() => loadArchivedState(user?.id));
  const [tab, setTab] = useState("inbox"); // inbox | archived | manage (admin)
  const [searchQ, setSearchQ] = useState("");
  const [filterImportance, setFilterImportance] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Filter notifications for current user's role
  const userNotifs = notifs.filter((n) => n.targetRole === "all" || n.targetRole === role);

  const filteredNotifs = userNotifs.filter((n) => {
    const isArch = archivedSet.has(n.id);
    if (tab === "inbox" && isArch) return false;
    if (tab === "archived" && !isArch) return false;
    if (filterImportance !== "all" && n.importance !== filterImportance) return false;
    const q = searchQ.toLowerCase();
    if (q && !n.title.toLowerCase().includes(q) && !n.description.toLowerCase().includes(q)) return false;
    return true;
  });

  const unreadCount = userNotifs.filter((n) => !readSet.has(n.id) && !archivedSet.has(n.id)).length;

  const markRead = (id) => {
    setReadSet((prev) => {
      const next = new Set(prev); next.add(id);
      saveReadState(user?.id, next);
      return next;
    });
  };

  const markAllRead = () => {
    setReadSet((prev) => {
      const next = new Set(prev);
      userNotifs.forEach((n) => next.add(n.id));
      saveReadState(user?.id, next);
      return next;
    });
    toast({ title: "All notifications marked as read" });
  };

  const archive = (id) => {
    setArchivedSet((prev) => { const next = new Set(prev); next.add(id); saveArchivedState(user?.id, next); return next; });
    markRead(id);
  };

  const unarchive = (id) => {
    setArchivedSet((prev) => { const next = new Set(prev); next.delete(id); saveArchivedState(user?.id, next); return next; });
  };

  const deleteNotif = (id) => {
    const arr = notifs.filter((n) => n.id !== id);
    setNotifs(arr); saveNotifs(arr);
    toast({ title: "Notification deleted" });
  };

  const setStep = (i, val) => {
    setForm((f) => { const steps = [...f.steps]; steps[i] = val; return { ...f, steps }; });
  };
  const addStep = () => setForm((f) => ({ ...f, steps: [...f.steps, ""] }));
  const removeStep = (i) => setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));

  const sendNotification = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast({ variant: "destructive", title: "Title and description are required" }); return;
    }
    setSaving(true);
    try {
      const notif = {
        id: `notif-${Date.now()}`,
        ...form,
        steps: form.steps.filter((s) => s.trim()),
        affectedFeatures: form.affectedFeatures ? form.affectedFeatures.split(",").map((s) => s.trim()).filter(Boolean) : [],
        createdBy: user?.email,
        createdAt: new Date().toISOString(),
      };
      const arr = [notif, ...notifs];
      setNotifs(arr); saveNotifs(arr);
      // Also send as in-app notification to targeted users
      try {
        const filter = form.targetRole === "all" ? "" : `role = "${form.targetRole}"`;
        const users = await pb.collection("users").getFullList({ filter: filter || undefined, requestKey: "notif-users" });
        for (const u of users) {
          if (u.id === user?.id) continue;
          await pb.collection("notifications").create({
            user: u.id,
            message: `[${getImportanceCfg(form.importance).label}] ${form.title}`,
            link: "/app/update-notifications",
            read: false,
          }, { requestKey: `send-notif-${u.id}` }).catch(() => {});
        }
      } catch (_) {}
      await log("notification_sent", "notifications", `${form.title} → ${form.targetRole}`);
      toast({ title: "Notification sent", description: `Sent to: ${TARGET_OPTIONS.find((t) => t.value === form.targetRole)?.label || form.targetRole}` });
      setForm({ ...EMPTY_FORM });
      setCreateOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Update Notifications — TeNDA Land Registry</title>
        <meta name="description" content="System update notifications and announcements for TeNDA Land Registry." />
      </Helmet>

      <PageHeader
        title="Update Notifications"
        subtitle="System updates, feature announcements, and important notices"
        icon={Bell}
        action={isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create Notification
          </Button>
        )}
      />

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-2.5 flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{unreadCount} unread</span>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-2.5 flex items-center gap-2">
          <Archive className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{archivedSet.size} archived</span>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "inbox", label: `Inbox${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
          { key: "archived", label: "Archived" },
          ...(isAdmin ? [{ key: "manage", label: "All Notifications" }] : []),
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition whitespace-nowrap",
              tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search notifications…" className="pl-9" />
        </div>
        <Select value={filterImportance} onValueChange={setFilterImportance}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All importance</SelectItem>
            {IMPORTANCE.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Notifications list */}
      {tab === "manage" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{notifs.length} total notifications in system</p>
          {notifs.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications yet" message="Create the first system notification using the button above." />
          ) : (
            notifs.map((n) => (
              <NotifCard key={n.id} notif={n} isRead={readSet.has(n.id)} isArchived={archivedSet.has(n.id)}
                onRead={markRead} onArchive={archive} onUnarchive={unarchive} onDelete={deleteNotif}
                isAdmin={isAdmin} userId={user?.id} />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifs.length === 0 ? (
            <EmptyState icon={Bell}
              title={tab === "archived" ? "No archived notifications" : "No notifications"}
              message={tab === "archived" ? "Archived notifications will appear here." : "No new notifications at this time."} />
          ) : (
            filteredNotifs.map((n) => (
              <NotifCard key={n.id} notif={n} isRead={readSet.has(n.id)} isArchived={archivedSet.has(n.id)}
                onRead={markRead} onArchive={archive} onUnarchive={unarchive} onDelete={deleteNotif}
                isAdmin={isAdmin} userId={user?.id} />
            ))
          )}
        </div>
      )}

      {/* Create notification dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Update Notification</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Importance Level</Label>
                <Select value={form.importance} onValueChange={(v) => setForm((f) => ({ ...f, importance: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMPORTANCE.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notification Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UPDATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Target Audience</Label>
              <Select value={form.targetRole} onValueChange={(v) => setForm((f) => ({ ...f, targetRole: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. New Bulk Import Feature Available" />
            </div>

            <div className="space-y-1.5">
              <Label>Description *</Label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the update, what changed, and why it matters…"
                rows={4} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
            </div>

            <div className="space-y-2">
              <Label>Step-by-step Instructions (optional)</Label>
              {form.steps.map((step, i) => (
                <div key={i} className="flex gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <Input value={step} onChange={(e) => setStep(i, e.target.value)}
                    placeholder={`Step ${i + 1}…`} className="flex-1" />
                  {form.steps.length > 1 && (
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => removeStep(i)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addStep} className="text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" /> Add step
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Video Tutorial URL (optional)</Label>
                <Input value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                  placeholder="YouTube or video URL" />
              </div>
              <div className="space-y-1.5">
                <Label>Implementation Date (optional)</Label>
                <Input type="date" value={form.implementationDate}
                  onChange={(e) => setForm((f) => ({ ...f, implementationDate: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Affected Features (comma-separated, optional)</Label>
              <Input value={form.affectedFeatures} onChange={(e) => setForm((f) => ({ ...f, affectedFeatures: e.target.value }))}
                placeholder="e.g. Land Registration, Bulk Import, CSV Upload" />
            </div>

            {/* Preview */}
            {form.title && (
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-semibold mb-2 text-muted-foreground">Preview:</p>
                <div className="flex items-start gap-2">
                  {React.createElement(getImportanceCfg(form.importance).icon, {
                    className: cn("h-4 w-4 shrink-0 mt-0.5", getImportanceCfg(form.importance).iconColor)
                  })}
                  <div>
                    <div className="flex gap-1.5 mb-1">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", getImportanceCfg(form.importance).color)}>
                        {getImportanceCfg(form.importance).label}
                      </span>
                    </div>
                    <p className="font-semibold text-sm">{form.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{form.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={sendNotification} disabled={saving}>
              <Send className="mr-1 h-4 w-4" /> {saving ? "Sending…" : "Send Notification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
