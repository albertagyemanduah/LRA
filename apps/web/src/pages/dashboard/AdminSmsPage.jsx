import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import { MessageSquare, Send, Users, Search, RefreshCw, Loader2, Phone } from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import apiServerClient from "@/lib/apiServerClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleLabel } from "@/lib/roles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SMS_TEMPLATES = [
  { name: "Registration Confirmation", text: "Dear {name}, your land registration has been successfully submitted. Reference: {ref}. TeNDA PPD." },
  { name: "Approval Notification", text: "Dear {name}, your land registration application has been approved. Please visit the office. TeNDA PPD." },
  { name: "Rejection Notification", text: "Dear {name}, your land registration application has been rejected. Contact us for details. TeNDA PPD." },
  { name: "Transfer Notification", text: "Dear {name}, a land transfer request involving your parcel has been processed. TeNDA PPD." },
  { name: "Payment Reminder", text: "Dear {name}, you have outstanding payment(s) due. Please visit the finance office. TeNDA PPD." },
  { name: "General Notice", text: "Dear {name}, this is an important notice from Techiman North District Assembly. TeNDA PPD." },
];

function StatusBadge({ status }) {
  const map = { sent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", map[status] || map.pending)}>{status}</span>;
}

export default function AdminSmsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("compose"); // compose | history
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Load users
  useEffect(() => {
    pb.collection("users").getFullList({ sort: "fullName,name", requestKey: "admin-sms-users" })
      .then(setUsers).catch(() => {});
  }, []);

  // Filter users
  useEffect(() => {
    let list = users;
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter || (u.roles || []).includes(roleFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) => (u.fullName || u.name || "").toLowerCase().includes(q) || (u.phone || "").includes(q) || (u.email || "").toLowerCase().includes(q));
    }
    setFilteredUsers(list);
  }, [users, search, roleFilter]);

  // Load SMS history
  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    pb.collection("sms_logs").getList(1, 100, { sort: "-created", requestKey: "sms-history" })
      .then((r) => setHistory(r.items))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => { if (activeTab === "history") loadHistory(); }, [activeTab, loadHistory]);

  const toggleUser = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const applyTemplate = (name) => {
    const tpl = SMS_TEMPLATES.find((t) => t.name === name);
    if (tpl) setMessage(tpl.text);
    setSelectedTemplate(name);
  };

  const sendSms = async () => {
    if (!message.trim()) { toast({ title: "Message required", variant: "destructive" }); return; }
    if (selectedIds.size === 0) { toast({ title: "Select at least one recipient", variant: "destructive" }); return; }

    const targets = users.filter((u) => selectedIds.has(u.id));
    const withPhone = targets.filter((u) => u.phone);
    if (withPhone.length === 0) { toast({ title: "None of the selected users have a phone number", variant: "destructive" }); return; }

    setSending(true);
    setProgress({ done: 0, total: withPhone.length });

    let successCount = 0;
    for (let i = 0; i < withPhone.length; i++) {
      const u = withPhone[i];
      const msg = message.replace("{name}", u.fullName || u.name || "User").replace("{ref}", "N/A");
      let status = "sent";
      let errorMsg = "";
      try {
        await apiServerClient.post("/sms", { to: u.phone, message: msg });
        successCount++;
      } catch (err) {
        status = "failed";
        errorMsg = err?.response?.data?.error || err.message || "Unknown error";
      }
      // Log to PocketBase
      try {
        await pb.collection("sms_logs").create({
          sentBy: user.id,
          recipientId: u.id,
          recipientName: u.fullName || u.name || u.email,
          recipientPhone: u.phone,
          message: msg,
          status,
          errorMsg,
          isBulk: withPhone.length > 1,
          bulkGroup: withPhone.length > 1 ? `bulk-${Date.now()}` : "",
          templateName: selectedTemplate,
        });
      } catch (_) {}
      setProgress({ done: i + 1, total: withPhone.length });
    }

    setSending(false);
    toast({ title: `SMS sent to ${successCount}/${withPhone.length} recipients`, variant: successCount === withPhone.length ? "default" : "destructive" });
    setSelectedIds(new Set());
    if (activeTab === "history") loadHistory();
  };

  const resendSms = async (log) => {
    try {
      await apiServerClient.post("/sms", { to: log.recipientPhone, message: log.message });
      await pb.collection("sms_logs").create({ sentBy: user.id, recipientId: log.recipientId, recipientName: log.recipientName, recipientPhone: log.recipientPhone, message: log.message, status: "sent", templateName: log.templateName });
      toast({ title: "SMS resent successfully" });
      loadHistory();
    } catch (err) {
      toast({ title: "Resend failed", description: err.message, variant: "destructive" });
    }
  };

  const roleOptions = [...new Set(users.flatMap((u) => [u.role, ...(u.roles || [])]).filter(Boolean))];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <Helmet><title>Admin SMS — Techiman North Land Registry</title><meta name="description" content="Send SMS messages to registered users" /></Helmet>

      <div className="flex items-center gap-2">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Admin SMS Messaging</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {["compose", "history"].map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t === "compose" ? "Compose & Send" : "SMS History"}
          </button>
        ))}
      </div>

      {activeTab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* User List */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Select Recipients ({selectedIds.size} selected)</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-40 h-9"><SelectValue placeholder="All roles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {roleOptions.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-b px-4 py-2 flex items-center gap-3 bg-muted/30">
                <Checkbox checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0} onCheckedChange={toggleAll} id="select-all" />
                <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">Select all ({filteredUsers.length})</label>
              </div>
              <div className="overflow-y-auto max-h-[400px] divide-y">
                {filteredUsers.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No users found</p>}
                {filteredUsers.map((u) => (
                  <div key={u.id} onClick={() => toggleUser(u.id)} className={cn("flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors", selectedIds.has(u.id) && "bg-primary/5")}>
                    <Checkbox checked={selectedIds.has(u.id)} onCheckedChange={() => toggleUser(u.id)} onClick={(e) => e.stopPropagation()} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.fullName || u.name || u.email}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{roleLabel(u.role)}</span>
                        {u.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{u.phone}</span> : <span className="text-red-500">No phone</span>}
                      </div>
                    </div>
                    {!u.phone && <span className="text-xs text-red-500">No #</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Composer */}
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Compose Message</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Template</label>
                <Select value={selectedTemplate} onValueChange={applyTemplate}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Choose template..." /></SelectTrigger>
                  <SelectContent>
                    {SMS_TEMPLATES.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Message <span className="text-muted-foreground/60">(Use {"{name}"} for recipient name)</span></label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="min-h-[160px] resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground mt-1">{message.length}/500 characters · ~{Math.ceil(message.length / 160)} SMS part(s)</p>
              </div>

              {sending && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Sending...</span><span>{progress.done}/{progress.total}</span></div>
                  <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
                </div>
              )}

              <Button onClick={sendSms} disabled={sending || selectedIds.size === 0 || !message.trim()} className="w-full">
                {sending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</> : <><Send className="h-4 w-4 mr-2" />Send SMS to {selectedIds.size} recipient{selectedIds.size !== 1 ? "s" : ""}</>}
              </Button>

              {selectedIds.size > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  {users.filter((u) => selectedIds.has(u.id) && !u.phone).length > 0 && (
                    <span className="text-yellow-600">⚠ {users.filter((u) => selectedIds.has(u.id) && !u.phone).length} selected user(s) have no phone — they will be skipped.</span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "history" && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">SMS History</CardTitle>
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading}><RefreshCw className={cn("h-4 w-4", historyLoading && "animate-spin")} /></Button>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading && <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>}
            {!historyLoading && history.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">No SMS history yet.</div>}
            {!historyLoading && history.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Recipient</th>
                      <th className="text-left px-4 py-2 font-medium">Phone</th>
                      <th className="text-left px-4 py-2 font-medium">Message</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="text-left px-4 py-2 font-medium">Sent</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{log.recipientName || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{log.recipientPhone || "—"}</td>
                        <td className="px-4 py-2.5 max-w-xs"><p className="truncate" title={log.message}>{log.message}</p>{log.templateName && <span className="text-xs text-muted-foreground">{log.templateName}</span>}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={log.status} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(log.created).toLocaleString()}</td>
                        <td className="px-4 py-2.5">
                          {log.status === "failed" && log.recipientPhone && (
                            <Button variant="outline" size="sm" onClick={() => resendSms(log)}>Retry</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
