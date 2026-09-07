import React, { useState, useRef, useEffect } from "react";
import {
  User, Camera, Lock, Shield, Building2, Phone, Mail,
  Edit3, Check, X, Eye, EyeOff, Upload, Trash2,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatDate, titleCase } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import DuplicateCheck from "@/components/DuplicateCheck";

function AvatarDisplay({ user, size = "lg" }) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-24 w-24 text-2xl",
  };
  const avatarUrl = user?.avatar
    ? pb.files.getURL(user, user.avatar, { thumb: "200x200" })
    : null;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        className={cn("rounded-full object-cover ring-2 ring-primary/20", sizes[size])}
      />
    );
  }
  const initials = [user?.firstName, user?.surname]
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .toUpperCase() || (user?.email || "U").slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold",
        sizes[size],
      )}
    >
      {initials}
    </span>
  );
}

function InfoRow({ label, value, badge }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right flex-1">
        {badge ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {value}
          </span>
        ) : (
          value || "—"
        )}
      </span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, onEdit, editing }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <h2 className="font-display text-base font-semibold">{title}</h2>
      </div>
      {onEdit && !editing && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit
        </Button>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user, role, roles, log, refresh } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [personalForm, setPersonalForm] = useState({ firstName: "", middleName: "", surname: "" });
  const [contactForm, setContactForm] = useState({ phone: "", whatsappNumber: "", alternateNumber2: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", newPwd: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadUser = async () => {
    try {
      setLoading(true);
      const u = await pb.collection("users").getOne(user.id);
      setProfileUser(u);
      setPersonalForm({ firstName: u.firstName || "", middleName: u.middleName || "", surname: u.surname || "" });
      setContactForm({ phone: u.phone || "", whatsappNumber: u.whatsappNumber || "", alternateNumber2: u.alternateNumber2 || "" });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to load profile" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const savePersonal = async () => {
    if (!personalForm.firstName || !personalForm.surname) {
      toast({ variant: "destructive", title: "First Name and Surname are required" });
      return;
    }
    setSaving(true);
    try {
      const fullName = [personalForm.firstName, personalForm.middleName, personalForm.surname].filter(Boolean).join(" ");
      await pb.collection("users").update(user.id, { ...personalForm, fullName });
      await log("profile_updated", "users", "Updated personal information");
      toast({ title: "Personal information updated" });
      setEditingPersonal(false);
      await loadUser();
      await refresh();
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    setSaving(true);
    try {
      await pb.collection("users").update(user.id, contactForm);
      await log("profile_updated", "users", "Updated contact information");
      toast({ title: "Contact information updated" });
      setEditingContact(false);
      await loadUser();
      await refresh();
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (!passwordForm.current) {
      toast({ variant: "destructive", title: "Current password is required" });
      return;
    }
    if (passwordForm.newPwd.length < 8) {
      toast({ variant: "destructive", title: "Password too short", description: "Password must be at least 8 characters" });
      return;
    }
    if (passwordForm.newPwd !== passwordForm.confirm) {
      toast({ variant: "destructive", title: "Passwords do not match" });
      return;
    }
    setSaving(true);
    try {
      await pb.collection("users").update(user.id, {
        oldPassword: passwordForm.current,
        password: passwordForm.newPwd,
        passwordConfirm: passwordForm.confirm,
      });
      await log("password_changed", "users", "User changed their password");
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setEditingPassword(false);
      setPasswordForm({ current: "", newPwd: "", confirm: "" });
    } catch (err) {
      const msg = err?.response?.data?.oldPassword?.message || err?.message || "Update failed";
      toast({ variant: "destructive", title: "Password change failed", description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum 5MB allowed" });
      return;
    }
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast({ variant: "destructive", title: "Invalid file type", description: "JPG, PNG, GIF or WebP only" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      await pb.collection("users").update(user.id, fd);
      await log("avatar_uploaded", "users", "Updated profile picture");
      toast({ title: "Profile photo updated" });
      await loadUser();
      await refresh();
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: err?.message });
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const removeAvatar = async () => {
    setUploadingAvatar(true);
    try {
      await pb.collection("users").update(user.id, { "avatar": null });
      await log("avatar_removed", "users", "Removed profile picture");
      toast({ title: "Profile photo removed" });
      await loadUser();
      await refresh();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to remove photo" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pwdStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z\d]/.test(pwd)) score++;
    const map = [
      { score: 0, label: "", color: "" },
      { score: 1, label: "Very weak", color: "bg-red-500" },
      { score: 2, label: "Weak", color: "bg-orange-500" },
      { score: 3, label: "Fair", color: "bg-yellow-500" },
      { score: 4, label: "Good", color: "bg-blue-500" },
      { score: 5, label: "Strong", color: "bg-blue-500" },
    ];
    return map[score] || map[0];
  };
  const strength = pwdStrength(passwordForm.newPwd);

  if (loading) return <Spinner />;

  const u = profileUser;
  const effectiveRoles = Array.isArray(u?.roles) && u.roles.length > 0 ? u.roles : [u?.role].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="View and manage your personal information, contact details, and security settings"
        icon={User}
      />

      {/* Profile Card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-700 to-red-500 h-28" />
        <div className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar */}
            <div className="relative w-24 h-24">
              <AvatarDisplay user={u} size="lg" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
              >
                {uploadingAvatar
                  ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  : <Camera className="h-5 w-5 text-white" />}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl font-bold text-foreground">
                {u?.fullName || [u?.firstName, u?.surname].filter(Boolean).join(" ") || "—"}
              </h2>
              <p className="text-sm text-muted-foreground">{u?.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {effectiveRoles.map((r) => (
                  <span key={r} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {roleLabel(r)}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {u?.avatar ? "Change photo" : "Upload photo"}
              </Button>
              {u?.avatar && (
                <Button variant="outline" size="sm" onClick={removeAvatar} disabled={uploadingAvatar} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">JPG, PNG, GIF or WebP · max 5 MB</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader icon={User} title="Personal Information" onEdit={() => setEditingPersonal(true)} editing={editingPersonal} />
            {editingPersonal ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name *</Label>
                    <Input value={personalForm.firstName} onChange={(e) => setPersonalForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Middle Name</Label>
                    <Input value={personalForm.middleName} onChange={(e) => setPersonalForm((f) => ({ ...f, middleName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Surname *</Label>
                    <Input value={personalForm.surname} onChange={(e) => setPersonalForm((f) => ({ ...f, surname: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={savePersonal} disabled={saving} size="sm">
                    <Check className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingPersonal(false); setPersonalForm({ firstName: u?.firstName || "", middleName: u?.middleName || "", surname: u?.surname || "" }); }}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <InfoRow label="First Name" value={u?.firstName} />
                <InfoRow label="Middle Name" value={u?.middleName} />
                <InfoRow label="Surname" value={u?.surname} />
                <InfoRow label="Full Name" value={u?.fullName} />
                <InfoRow label="Member Since" value={formatDate(u?.created)} />
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader icon={Phone} title="Contact Information" onEdit={() => setEditingContact(true)} editing={editingContact} />
            {editingContact ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Phone Number</Label>
                    <Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+233 XX XXX XXXX" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>WhatsApp Number</Label>
                    <Input value={contactForm.whatsappNumber} onChange={(e) => setContactForm((f) => ({ ...f, whatsappNumber: e.target.value }))} placeholder="+233 XX XXX XXXX" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alternate Number 2 (Optional)</Label>
                    <Input value={contactForm.alternateNumber2} onChange={(e) => setContactForm((f) => ({ ...f, alternateNumber2: e.target.value }))} placeholder="+233 XX XXX XXXX" />
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Email address can only be changed by an Administrator.
                </div>
                <DuplicateCheck type="contact" label="Check for duplicate contact"
                  getData={() => ({ name: u?.fullName || u?.name || "", phone: contactForm.phone })} />
                <div className="flex gap-2">
                  <Button onClick={saveContact} disabled={saving} size="sm">
                    <Check className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingContact(false); setContactForm({ phone: u?.phone || "", whatsappNumber: u?.whatsappNumber || "", alternateNumber2: u?.alternateNumber2 || "" }); }}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <InfoRow label="Email Address" value={u?.email} />
                <InfoRow label="Phone Number" value={u?.phone} />
                <InfoRow label="WhatsApp Number" value={u?.whatsappNumber} />
                {u?.alternateNumber2 && <InfoRow label="Alternate Number 2" value={u?.alternateNumber2} />}
              </div>
            )}
          </div>

          {/* Password Management */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader icon={Lock} title="Password & Security" onEdit={() => setEditingPassword(true)} editing={editingPassword} />
            {editingPassword ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Current Password *</Label>
                  <div className="relative">
                    <Input
                      type={showPwd.current ? "text" : "password"}
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowPwd((s) => ({ ...s, current: !s.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPwd.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>New Password * <span className="text-muted-foreground font-normal text-xs">(minimum 8 characters)</span></Label>
                  <div className="relative">
                    <Input
                      type={showPwd.new ? "text" : "password"}
                      value={passwordForm.newPwd}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, newPwd: e.target.value }))}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowPwd((s) => ({ ...s, new: !s.new }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPwd.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordForm.newPwd && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= strength.score ? strength.color : "bg-muted")} />
                        ))}
                      </div>
                      {strength.label && <p className="text-xs text-muted-foreground">{strength.label}</p>}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm New Password *</Label>
                  <div className="relative">
                    <Input
                      type={showPwd.confirm ? "text" : "password"}
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                      className={cn("pr-10", passwordForm.confirm && passwordForm.newPwd !== passwordForm.confirm && "border-destructive")}
                    />
                    <button type="button" onClick={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPwd.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordForm.confirm && passwordForm.newPwd !== passwordForm.confirm && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={savePassword} disabled={saving} size="sm">
                    <Lock className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Changing…" : "Change password"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingPassword(false); setPasswordForm({ current: "", newPwd: "", confirm: "" }); }}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <InfoRow label="Password" value="••••••••••••" />
                <p className="mt-2 text-xs text-muted-foreground">
                  For security, we recommend changing your password regularly and using a strong, unique password.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Office & Role Assignment */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader icon={Building2} title="Office & Role Assignment" />
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 mb-4 text-xs text-blue-700">
              Office and role assignments can only be changed by an Administrator.
            </div>
            <div>
              <InfoRow label="Office" value={titleCase((u?.office || "").replace(/_/g, " ")) || "All Offices"} />
              <InfoRow label="Roles" value={effectiveRoles.map(roleLabel).join(", ")} />
              <InfoRow label="Ghana Card No." value={u?.ghanaCard} />
            </div>
          </div>

          {/* Account Info */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <SectionHeader icon={Shield} title="Account Information" />
            <div>
              <InfoRow label="Account ID" value={<span className="font-mono text-xs">{u?.id?.slice(0, 8)}…</span>} />
              <InfoRow label="Created" value={formatDate(u?.created)} />
              <InfoRow label="Last Updated" value={formatDate(u?.updated)} />
              <InfoRow label="Email Verified" value={u?.verified ? "Yes" : "No"} />
            </div>
          </div>

          {/* Quick tips */}
          <div className="rounded-2xl border border-border bg-muted/40 p-5">
            <h3 className="font-display text-sm font-semibold mb-3">Security Tips</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2"><span className="text-primary font-bold">•</span> Use a strong, unique password of at least 8 characters</li>
              <li className="flex gap-2"><span className="text-primary font-bold">•</span> Include uppercase, lowercase, numbers and symbols</li>
              <li className="flex gap-2"><span className="text-primary font-bold">•</span> Do not share your credentials with others</li>
              <li className="flex gap-2"><span className="text-primary font-bold">•</span> Log out when leaving your workstation</li>
              <li className="flex gap-2"><span className="text-primary font-bold">•</span> Report suspicious activity to your administrator</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export { AvatarDisplay };
