import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, Lock, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast as sonnerToast } from "sonner";
import pb from "@/lib/pocketbaseClient";
import { loadBranding } from "@/lib/branding";
import StickyFooter from "@/components/StickyFooter";
import { Helmet } from "react-helmet";

function toast({ title, description, variant } = {}) {
  const msg = title || "";
  const opts = description ? { description } : {};
  if (variant === "destructive") return sonnerToast.error(msg, opts);
  return sonnerToast.success(msg, opts);
}

function PasswordInput({ id, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-9 pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ── Forgot Password (request reset email) ──────────────────────
function ForgotPasswordForm({ logoUrl }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { sonnerToast.error("Please enter your email address"); return; }
    setLoading(true);
    try {
      await pb.collection("users").requestPasswordReset(email);
      setSent(true);
    } catch (_) {
      // PocketBase always returns 200 for security; show success even on error
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-secondary/60 to-background px-5">
        <Helmet>
          <title>Forgot Password — Techiman North Land Registry</title>
          <meta name="description" content="Reset your Techiman North Land Registry password" />
        </Helmet>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl text-center"
        >
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold">Check Your Email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            If an account exists for <strong>{email}</strong>, a password reset link has been sent to your registered <strong>email address</strong> and <strong>phone number (SMS)</strong>.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">The link expires in 30 minutes. Check your inbox, spam folder, and SMS messages.</p>
          <Link to="/auth">
            <Button className="mt-6 w-full h-11">Back to Sign In</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Helmet>
        <title>Forgot Password — Techiman North Land Registry</title>
        <meta name="description" content="Reset your Techiman North Land Registry password" />
      </Helmet>
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-secondary/60 to-background px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-6 flex items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="Assembly Logo" className="h-12 w-12 rounded-xl object-contain border border-border shadow" />}
            <div>
              <p className="text-xs text-muted-foreground">Techiman North District Assembly</p>
              <p className="font-display font-bold text-sm">Land Registry System</p>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-bold">Forgot Password?</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your staff email address. A reset link will be sent to your registered <strong>email</strong> and <strong>phone number (SMS)</strong>.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Staff Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@tenda.gov.gh"
                    className="pl-9"
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <Link to="/auth" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
      <StickyFooter />
    </div>
  );
}

// ── Reset Password (confirm new password from token) ───────────
function ResetPasswordForm({ logoUrl }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) { sonnerToast.error("Invalid or missing reset token. Request a new link."); return; }
    if (password.length < 8) { sonnerToast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { sonnerToast.error("Passwords do not match"); return; }
    setLoading(true);
    try {
      await pb.collection("users").confirmPasswordReset(token, password, confirm);
      sonnerToast.success("Password reset successfully");
      setTimeout(() => navigate("/auth"), 1500);
    } catch (err) {
      sonnerToast.error("Reset failed", { description: err?.message || "The link may have expired. Request a new one." });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Helmet>
        <title>Reset Password — Techiman North Land Registry</title>
        <meta name="description" content="Set a new password for your account" />
      </Helmet>
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-secondary/60 to-background px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-6 flex items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="Assembly Logo" className="h-12 w-12 rounded-xl object-contain border border-border shadow" />}
            <div>
              <p className="text-xs text-muted-foreground">Techiman North District Assembly</p>
              <p className="font-display font-bold text-sm">Land Registry System</p>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-bold">Set New Password</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Choose a strong password for your account. Minimum 8 characters.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pwd">New Password</Label>
                <PasswordInput id="pwd" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 8 chars)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpwd">Confirm Password</Label>
                <PasswordInput id="cpwd" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" />
              </div>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <Link to="/auth" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
      <StickyFooter />
    </div>
  );
}

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    const b = loadBranding();
    setLogoUrl(b.logoUrl || "");
  }, []);

  const token = searchParams.get("token");

  if (token) {
    return <ResetPasswordForm logoUrl={logoUrl} />;
  }
  return <ForgotPasswordForm logoUrl={logoUrl} />;
}
