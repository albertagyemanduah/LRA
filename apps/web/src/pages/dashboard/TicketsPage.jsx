import React, { useState, useEffect } from "react";
import {
  LifeBuoy, Plus, Search, Filter, ChevronDown, X, Send,
  Paperclip, Clock, CheckCircle2, AlertCircle, MessageSquare,
  RefreshCw, Download, Tag, User, ArrowUpRight,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner, EmptyState, StatCard, SectionCard } from "@/components/shared";
import { StatusBadge } from "@/components/shared";
import OtherSelect from "@/components/OtherSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { timeAgo, formatDate, titleCase } from "@/lib/format";
import { roleLabel } from "@/lib/roles";

const CATEGORIES = ["Bug Report", "Feature Request", "General Inquiry", "Complaint", "Technical Issue", "Data Issue", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

const PRIORITY_STYLES = {
  Low: "bg-blue-100 text-blue-700",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};

const STATUS_STYLES_TICKET = {
  Open: "bg-blue-100 text-blue-700",
  "In Progress": "bg-indigo-100 text-indigo-700",
  Resolved: "bg-blue-100 text-blue-800",
  Closed: "bg-muted text-muted-foreground",
};

function PriorityBadge({ priority }) {
  if (!priority) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", PRIORITY_STYLES[priority])}>
      {priority}
    </span>
  );
}

function TicketStatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLES_TICKET[status])}>
      {status}
    </span>
  );
}

export default function TicketsPage() {
  const { user, role, log } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [tickets, setTickets] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const [form, setForm] = useState({
    subject: "", category: "General Inquiry", priority: "Medium",
    description: "", relatedLandId: "", attachments: null,
  });

  const loadTickets = async () => {
    setLoading(true);
    try {
      const list = await pb.collection("tickets").getFullList({ sort: "-created", requestKey: "tickets-list" });
      setTickets(list);
    } catch (_) {} finally { setLoading(false); }
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    try {
      const list = await pb.collection("users").getFullList({ requestKey: "ticket-users" });
      setUsers(list);
    } catch (_) {}
  };

  const loadComments = async (ticketId) => {
    try {
      const list = await pb.collection("ticket_comments").getFullList({
        filter: `ticket = "${ticketId}"`, sort: "created", requestKey: `comments-${ticketId}`,
        expand: "author",
      });
      setComments(list);
    } catch (_) { setComments([]); }
  };

  useEffect(() => { loadTickets(); loadUsers(); }, []);

  useEffect(() => {
    if (selectedTicket) loadComments(selectedTicket.id);
  }, [selectedTicket]);

  const createTicket = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast({ variant: "destructive", title: "Subject and description are required" }); return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("subject", form.subject);
      fd.append("category", form.category);
      fd.append("priority", form.priority);
      fd.append("description", form.description);
      fd.append("status", "Open");
      fd.append("submittedBy", user.id);
      if (form.relatedLandId) fd.append("relatedLandId", form.relatedLandId);
      if (form.attachments) {
        for (const f of form.attachments) fd.append("attachments", f);
      }
      await pb.collection("tickets").create(fd);
      await log("ticket_created", "tickets", form.subject);
      toast({ title: "Ticket submitted", description: "You will be notified by email when your ticket is updated." });
      setCreateOpen(false);
      setForm({ subject: "", category: "General Inquiry", priority: "Medium", description: "", relatedLandId: "", attachments: null });
      loadTickets();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to create ticket", description: err?.message });
    } finally { setSaving(false); }
  };

  const updateTicketStatus = async (ticketId, status) => {
    try {
      await pb.collection("tickets").update(ticketId, { status });
      await log("ticket_status_updated", "tickets", `Status → ${status}`);
      toast({ title: "Status updated" });
      loadTickets();
      if (selectedTicket?.id === ticketId) setSelectedTicket((t) => ({ ...t, status }));
    } catch (_) {
      toast({ variant: "destructive", title: "Update failed" });
    }
  };

  const assignTicket = async (ticketId, assignedTo) => {
    try {
      await pb.collection("tickets").update(ticketId, { assignedTo: assignedTo || null });
      toast({ title: "Ticket assigned" });
      loadTickets();
    } catch (_) {}
  };

  const addComment = async () => {
    if (!commentText.trim() || !selectedTicket) return;
    setSendingComment(true);
    try {
      await pb.collection("ticket_comments").create({
        ticket: selectedTicket.id,
        author: user.id,
        message: commentText,
        isInternal: isAdmin && isInternal,
      });
      await log("ticket_comment_added", "tickets", selectedTicket.subject);
      setCommentText("");
      setIsInternal(false);
      loadComments(selectedTicket.id);
    } catch (_) {
      toast({ variant: "destructive", title: "Failed to add comment" });
    } finally { setSendingComment(false); }
  };

  const filtered = tickets.filter((t) => {
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    const q = searchQ.toLowerCase();
    const matchQ = !q || t.subject?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
    return matchStatus && matchPriority && matchQ;
  });

  const counts = {
    open: tickets.filter((t) => t.status === "Open").length,
    inProgress: tickets.filter((t) => t.status === "In Progress").length,
    resolved: tickets.filter((t) => t.status === "Resolved").length,
    total: tickets.length,
  };

  return (
    <>
      <PageHeader
        title="Support Tickets"
        subtitle={isAdmin ? "Manage all support requests from staff" : "Submit and track your support requests"}
        icon={LifeBuoy}
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Ticket
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total tickets" value={counts.total} icon={LifeBuoy} accent="primary" />
        <StatCard label="Open" value={counts.open} icon={AlertCircle} accent="blue" />
        <StatCard label="In Progress" value={counts.inProgress} icon={Clock} accent="gold" />
        <StatCard label="Resolved" value={counts.resolved} icon={CheckCircle2} accent="amber" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search tickets…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={loadTickets}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets found"
          message={isAdmin ? "No support tickets match your filters." : "You haven't submitted any tickets yet."}
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Ticket</Button>} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Ticket</th>
                <th className="hidden px-5 py-3 text-left font-medium sm:table-cell">Category</th>
                <th className="px-5 py-3 text-left font-medium">Priority</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="hidden px-5 py-3 text-left font-medium lg:table-cell">Submitted</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedTicket(t)}>
                  <td className="px-5 py-3">
                    <p className="font-medium line-clamp-1">{t.subject}</p>
                    {t.relatedLandId && <p className="text-xs text-muted-foreground">Land: {t.relatedLandId}</p>}
                  </td>
                  <td className="hidden px-5 py-3 sm:table-cell">
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{t.category || "—"}</span>
                  </td>
                  <td className="px-5 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-5 py-3"><TicketStatusBadge status={t.status} /></td>
                  <td className="hidden px-5 py-3 text-muted-foreground lg:table-cell text-xs">{timeAgo(t.created)}</td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" className="h-8 px-2">
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create ticket dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Submit Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Brief description of your issue" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <OtherSelect options={CATEGORIES} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} placeholder="Select category" inputLabel="Specify category" inputPlaceholder="Enter category" allowEmpty={false} />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe your issue in detail…" rows={5} />
            </div>
            <div className="space-y-2">
              <Label>Related Land ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.relatedLandId} onChange={(e) => setForm((f) => ({ ...f, relatedLandId: e.target.value }))}
                placeholder="e.g. LAND-001" />
            </div>
            <div className="space-y-2">
              <Label>Attachments <span className="text-muted-foreground font-normal">(optional, max 5 files)</span></Label>
              <input type="file" multiple accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => setForm((f) => ({ ...f, attachments: e.target.files }))}
                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createTicket} disabled={saving}>
              {saving ? "Submitting…" : "Submit Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket detail dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3 pr-6">
                  <DialogTitle className="text-lg leading-tight">{selectedTicket.subject}</DialogTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge priority={selectedTicket.priority} />
                    <TicketStatusBadge status={selectedTicket.status} />
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Category</p>
                    <p className="font-medium">{selectedTicket.category || "—"}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Submitted</p>
                    <p className="font-medium">{formatDate(selectedTicket.created)}</p>
                  </div>
                  {selectedTicket.relatedLandId && (
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Related Land</p>
                      <p className="font-medium font-mono">{selectedTicket.relatedLandId}</p>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                {/* Admin controls */}
                {isAdmin && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">Admin Controls</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Update Status</Label>
                        <Select value={selectedTicket.status || "Open"}
                          onValueChange={(v) => updateTicketStatus(selectedTicket.id, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Assign To</Label>
                        <Select value={selectedTicket.assignedTo || "none"}
                          onValueChange={(v) => assignTicket(selectedTicket.id, v === "none" ? "" : v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName || u.email}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Comments ({comments.length})
                  </p>
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((c) => (
                        <div key={c.id} className={cn(
                          "rounded-lg border p-3",
                          c.isInternal ? "border-blue-200 bg-blue-50" : "border-border bg-muted/20",
                        )}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold">
                              {c.expand?.author?.fullName || c.expand?.author?.email || "User"}
                            </span>
                            <div className="flex items-center gap-2">
                              {c.isInternal && <span className="text-[10px] rounded-full bg-blue-200 text-blue-800 px-2 py-0.5">Internal</span>}
                              <span className="text-xs text-muted-foreground">{timeAgo(c.created)}</span>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{c.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add comment */}
                {selectedTicket.status !== "Closed" && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <Label>{isAdmin ? "Reply / Note" : "Add Comment"}</Label>
                    <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write your comment…" rows={3} />
                    {isAdmin && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)}
                          className="h-4 w-4 rounded accent-primary" />
                        Internal note (not visible to submitter)
                      </label>
                    )}
                    <Button onClick={addComment} disabled={sendingComment || !commentText.trim()} size="sm">
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {sendingComment ? "Sending…" : "Send"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
