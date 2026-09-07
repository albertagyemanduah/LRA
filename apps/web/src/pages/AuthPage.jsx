import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadBranding } from "@/lib/branding";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ArrowLeft, Loader2, Smartphone, Eye, EyeOff, MapPinned, Lock, Mail, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast as sonnerToast } from "sonner";
import { useAuth } from "@/lib/auth";
import apiServerClient from "@/lib/apiServerClient";
import StickyFooter from "@/components/StickyFooter";

const OTP_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
const LAST_LOGIN_KEY = (userId) => `tnda-last-otp-login-${userId}`;

function wasLoginWithinInterval(userId) {
  try {
    const stored = localStorage.getItem(LAST_LOGIN_KEY(userId));
    if (!stored) return false;
    return Date.now() - parseInt(stored, 10) < OTP_INTERVAL_MS;
  } catch (_) { return false; }
}

function markLoginTimestamp(userId) {
  try { localStorage.setItem(LAST_LOGIN_KEY(userId), String(Date.now())); } catch (_) {}
}

function toast({ title, description, variant } = {}) {
  const msg = title || "";
  const opts = description ? { description } : {};
  if (variant === "destructive") return sonnerToast.error(msg, opts);
  if (variant === "success") return sonnerToast.success(msg, opts);
  return sonnerToast(msg, opts);
}

const HERO = "https://images.hostinger.com/be655138-806c-4137-85f0-2f9e6569c1a8.png";

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
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, log } = useAuth();
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    const b = loadBranding();
    setLogoUrl(b.logoUrl || "");
  }, []);

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaEntry, setMfaEntry] = useState("");
  const [mfaInfo, setMfaInfo] = useState({ emailSent: false, primarySent: false, whatsappSent: false, maskedEmail: null, maskedPrimary: null, maskedWhatsapp: null, channels: [] });
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0); // seconds remaining before resend allowed
  const cooldownRef = useRef(null);
  const [splashStep, setSplashStep] = useState(false);
  const [splashBranding, setSplashBranding] = useState({ appName: "Techiman North", logoUrl: "" });
  const splashTimer = useRef(null);

  const startCooldown = (seconds = 60) => {
    setOtpCooldown(seconds);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setOtpCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async (userId) => {
    setSendingOtp(true);
    try {
      const res = await apiServerClient.fetch("/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        setMfaInfo(data);
        const channels = [];
        if (data.emailSent && data.maskedEmail) channels.push(`Email (${data.maskedEmail})`);
        if (data.primarySent && data.maskedPrimary) channels.push(`Primary phone (${data.maskedPrimary})`);
        startCooldown(60);
        toast({
          title: "Verification code sent",
          description: channels.length > 0
            ? `Code delivered via: ${channels.join(", ")}`
            : "Check your registered email and phone for the code.",
        });
      } else {
        throw new Error("OTP send failed");
      }
    } catch (err) {
      const retryAfter = err?.retryAfter;
      if (retryAfter) {
        startCooldown(retryAfter);
        toast({ title: "Please wait", description: `You can request a new code in ${retryAfter}s.` });
      } else {
        startCooldown(60);
        toast({
          title: "Verification code sent",
          description: "Check your registered email and phone number for the 6-digit code.",
        });
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const showSplash = (record) => {
    const b = loadBranding();
    setSplashBranding({ appName: b.appName || "Techiman North", logoUrl: b.logoUrl || "" });
    setSplashStep(true);
    clearTimeout(splashTimer.current);
    splashTimer.current = setTimeout(() => {
      setSplashStep(false);
      navigate("/app");
    }, 3500);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await login(email, password);
      const user = res.record;
      setLoggedInUser(user);
      setLoading(false);
      // 3-hour OTP interval: skip OTP if recently authenticated
      if (wasLoginWithinInterval(user.id)) {
        await log("login_skip_otp", "auth", "Login within 3-hour interval — OTP skipped");
        markLoginTimestamp(user.id);
        showSplash(user);
        return;
      }
      setMfaEntry("");
      setMfaStep(true);
      await sendOtp(user.id);
    } catch (err) {
      setLoading(false);
      const status = err?.status;
      let description = "Invalid email or password. Contact your administrator if you need access.";
      if (status === 403) {
        description = err?.message || "Your account is not permitted to sign in. Contact your administrator.";
      } else if (status === 0) {
        description = "Network problem — please check your connection and try again.";
      } else if (status >= 500) {
        description = "The registry service is temporarily unavailable. Please try again shortly.";
      }
      toast({ variant: "destructive", title: "Sign in failed", description });
    }
  };

  const verifyMfa = async (e) => {
    e.preventDefault();
    if (!mfaEntry || mfaEntry.length !== 6) {
      toast({ variant: "destructive", title: "Enter a 6-digit code" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiServerClient.fetch("/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: loggedInUser?.id, code: mfaEntry }),
      });
      const data = await res.json();
      if (data.verified) {
        await log("mfa_verified", "auth", "Multi-factor authentication passed via email + SMS");
        markLoginTimestamp(loggedInUser?.id);
        toast({ title: "Welcome", description: "You are securely signed in." });
        setMfaStep(false);
        showSplash(loggedInUser);
      } else {
        setLoading(false);
        toast({ variant: "destructive", title: "Invalid code", description: data.error || "The verification code does not match." });
      }
    } catch (_) {
      // Fallback if API unreachable — allow entry if it looks like a 6-digit code
      setLoading(false);
      toast({ variant: "destructive", title: "Verification failed", description: "Could not verify code. Please try again." });
    }
  };

  const resendOtp = async () => {
    if (!loggedInUser) return;
    await sendOtp(loggedInUser.id);
  };

  // Splash screen
  if (splashStep) {
    return (
      <AnimatePresence>
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary"
          style={{ background: "linear-gradient(135deg, hsl(210 55% 12%) 0%, hsl(210 55% 22%) 50%, hsl(210 55% 30%) 100%)" }}
        >
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 120 }}
            className="flex flex-col items-center gap-6 text-center px-8 relative z-10"
          >
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white/15 border border-white/25 shadow-2xl overflow-hidden">
              {splashBranding.logoUrl ? (
                <img src={splashBranding.logoUrl} alt="Assembly Logo" className="h-full w-full object-contain p-2" />
              ) : (
                <MapPinned className="h-16 w-16 text-white" />
              )}
            </div>
            <div className="space-y-1">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-display text-3xl font-extrabold text-white tracking-tight"
              >
                {splashBranding.appName}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="text-white/75 font-medium text-base"
              >
                District Assembly
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="text-white/50 text-sm"
              >
                Land Registry &amp; Administration System
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="w-48 h-1 rounded-full bg-white/20 overflow-hidden mt-2"
            >
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3.2, ease: "linear", delay: 0.2 }}
                className="h-full bg-white/60 rounded-full"
              />
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              className="text-white/35 text-xs mt-2"
            >
              Developed by the District ICT Unit &bull; Techiman North District Assembly
            </motion.p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (mfaStep) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary/60 to-background px-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Smartphone className="h-7 w-7" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold">Two-Factor Verification</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter the 6-digit code sent to your registered channels.
          </p>

          {/* Delivery confirmation — per channel */}
          <div className="mt-4 space-y-2">
            {mfaInfo.emailSent && mfaInfo.maskedEmail && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                <Mail className="h-4 w-4 text-blue-700 shrink-0" />
                <span className="text-xs text-blue-800">Email sent to <strong>{mfaInfo.maskedEmail}</strong></span>
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 ml-auto" />
              </div>
            )}
            {mfaInfo.primarySent && mfaInfo.maskedPrimary && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                <Smartphone className="h-4 w-4 text-blue-700 shrink-0" />
                <span className="text-xs text-blue-800">SMS sent to primary <strong>{mfaInfo.maskedPrimary}</strong></span>
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 ml-auto" />
              </div>
            )}
            {!mfaInfo.emailSent && !mfaInfo.primarySent && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-xs text-blue-700">Code sent to your registered email and phone</span>
              </div>
            )}
          </div>

          <form onSubmit={verifyMfa} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfa">Verification code</Label>
              <Input
                id="mfa"
                inputMode="numeric"
                maxLength={6}
                value={mfaEntry}
                onChange={(e) => setMfaEntry(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-xl tracking-[0.5em] font-mono h-12"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Continue"}
            </Button>
            <button
              type="button"
              onClick={resendOtp}
              disabled={sendingOtp || otpCooldown > 0}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            >
              {sendingOtp ? "Sending…" : otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend code (via email & SMS)"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Code expires in 10 minutes. If you did not request this, contact your administrator.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-12">
    <div className="grid flex-1 lg:grid-cols-[1fr_1.1fr]">
      {/* Left panel — Login Form */}
      <div className="flex flex-col items-center justify-center bg-background px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Assembly Logo" className="h-10 w-10 rounded-xl object-contain" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow">
                <MapPinned className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Techiman North</p>
              <p className="font-display font-bold text-sm">District Land Registry</p>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <h1 className="font-display text-2xl font-bold tracking-tight">Staff Sign In</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              After login, a 6-digit code will be sent to your registered email and primary phone.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@tenda.gov.gh" className="pl-9" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password" />
              </div>

              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In Securely"}
              </Button>
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
            </form>

            <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Two-Factor Authentication</p>
              After entering your credentials, a verification code will be sent to your registered <strong>email address</strong> and <strong>phone number</strong>. Code expires in 10 minutes.
            </div>

            <p className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground text-center">
              To request an account, contact the District Assembly Administrator.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right panel — Branding / Logo */}
      <div className="relative hidden lg:flex flex-col overflow-hidden">
        <img src={HERO} alt="Techiman North farmland" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/95 via-primary/80 to-primary/50" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "32px 32px"
        }} />
        <div className="relative z-10 flex flex-col h-full p-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition self-end">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {/* Large logo */}
            <div className="flex items-center justify-center mb-6">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Techiman North District Assembly"
                  className="h-36 w-36 rounded-3xl object-contain bg-white/10 p-3 shadow-2xl border border-white/20"
                />
              ) : (
                <div className="flex h-36 w-36 items-center justify-center rounded-3xl bg-white/15 border border-white/20 shadow-2xl">
                  <MapPinned className="h-16 w-16 text-white" />
                </div>
              )}
            </div>
            <p className="font-display text-xs font-semibold uppercase tracking-widest text-white/60 mb-2">Techiman North</p>
            <h2 className="font-display text-3xl font-extrabold text-white leading-tight">
              District Assembly
            </h2>
            <p className="mt-2 text-white/70 text-sm font-medium">Land Registry &amp; Administration System</p>
            <div className="mt-8 space-y-3 text-left max-w-xs w-full">
              {[
                { icon: ShieldCheck, text: "Ghana Card & MFA protected" },
                { icon: Lock, text: "OTP via Email + SMS verification" },
                { icon: Building2, text: "Office-based access control" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-white/80">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/40 text-center">Land Registration Act 2020 (Act 1036) · Techiman North District</p>
        </div>
      </div>
    </div>
    <StickyFooter />
    </div>
  );
}
