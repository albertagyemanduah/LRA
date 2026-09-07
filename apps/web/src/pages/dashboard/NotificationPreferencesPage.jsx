import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Bell, Save, Clock, MessageSquare, Mail, Smartphone } from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner, SectionCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ALERT_TYPES = [
  { key: "transferAlerts", label: "Ownership transfers", desc: "Notify me when a land transfer is submitted or approved." },
  { key: "editAlerts", label: "Land edits", desc: "Notify me when a land record is edited or an edit is approved." },
  { key: "deleteAlerts", label: "Deletions & restores", desc: "Notify me when a land record is soft-deleted or restored." },
  { key: "approvalAlerts", label: "Approvals", desc: "Notify me when an approval request is submitted." },
  { key: "rejectionAlerts", label: "Rejections", desc: "Notify me when a request is rejected." },
  { key: "reminderAlerts", label: "Pending reminders", desc: "Send reminders for approvals/ transfers still pending." },
];

const DEFAULTS = {
  channels: { sms: true, email: true, inapp: true },
  transferAlerts: true,
  editAlerts: true,
  deleteAlerts: true,
  approvalAlerts: true,
  rejectionAlerts: true,
  reminderAlerts: true,
  frequency: "instant",
  quietHoursStart: "",
  quietHoursEnd: "",
};

export default function NotificationPreferencesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefsId, setPrefsId] = useState(null);
  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await pb.collection("notification_preferences").getFullList({
          filter: pb.filter("user = {:uid}", { uid: user.id }),
          requestKey: "notif-prefs-load",
        });
        if (cancelled) return;
        if (existing.length > 0) {
          const r = existing[0];
          setPrefsId(r.id);
          setForm({
            channels: r.channels || DEFAULTS.channels,
            transferAlerts: r.transferAlerts ?? true,
            editAlerts: r.editAlerts ?? true,
            deleteAlerts: r.deleteAlerts ?? true,
            approvalAlerts: r.approvalAlerts ?? true,
            rejectionAlerts: r.rejectionAlerts ?? true,
            reminderAlerts: r.reminderAlerts ?? true,
            frequency: r.frequency || "instant",
            quietHoursStart: r.quietHoursStart || "",
            quietHoursEnd: r.quietHoursEnd || "",
          });
        }
      } catch (_) {
        // no prefs yet — keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const toggleChannel = (ch) => setForm((f) => ({ ...f, channels: { ...f.channels, [ch]: !f.channels[ch] } }));
  const toggleAlert = (key) => setForm((f) => ({ ...f, [key]: !f[key] }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, user: user.id };
      if (prefsId) {
        await pb.collection("notification_preferences").update(prefsId, payload, { requestKey: "notif-prefs-save" });
      } else {
        const rec = await pb.collection("notification_preferences").create(payload, { requestKey: "notif-prefs-create" });
        setPrefsId(rec.id);
      }
      toast({ title: "Notification preferences saved" });
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <Helmet>
        <title>Notification Preferences — TeNDA Land Registry</title>
        <meta name="description" content="Configure how and when you receive ownership change, approval, and reminder notifications." />
      </Helmet>

      <PageHeader
        title="Notification Preferences"
        subtitle="Choose your notification channels, alert types, and quiet hours"
        icon={Bell}
        action={<Button size="sm" onClick={save} disabled={saving}><Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save"}</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Delivery channels" description="Select how you want to receive notifications">
          <div className="space-y-3">
            {[
              { key: "sms", label: "SMS", icon: Smartphone, desc: "Text messages to your phone" },
              { key: "email", label: "Email", icon: Mail, desc: "Messages to your inbox" },
              { key: "inapp", label: "In-App", icon: MessageSquare, desc: "Notifications inside the dashboard" },
            ].map(({ key, label, icon: Icon, desc }) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                </div>
                <Switch checked={!!form.channels[key]} onCheckedChange={() => toggleChannel(key)} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Frequency & quiet hours" description="Control when notifications arrive">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant — as events happen</SelectItem>
                  <SelectItem value="daily">Daily digest</SelectItem>
                  <SelectItem value="weekly">Weekly digest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Quiet hours start</Label>
                <Input type="time" value={form.quietHoursStart} onChange={(e) => setForm((f) => ({ ...f, quietHoursStart: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Quiet hours end</Label>
                <Input type="time" value={form.quietHoursEnd} onChange={(e) => setForm((f) => ({ ...f, quietHoursEnd: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">During quiet hours, non-critical notifications are held and delivered when the window ends.</p>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Alert types" description="Choose which events trigger a notification">
        <div className="space-y-2">
          {ALERT_TYPES.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-border p-4">
              <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
              <Switch checked={!!form[key]} onCheckedChange={() => toggleAlert(key)} />
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
