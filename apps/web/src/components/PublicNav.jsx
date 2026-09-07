import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { loadBranding } from "@/lib/branding";

const NAV_LINKS = [
  { to: "/", label: "Home", exact: true },
  { to: "/about", label: "About Us" },
  { to: "/services", label: "Services" },
  { to: "/news", label: "News" },
  { to: "/verify-land", label: "Verify Land" },
  { to: "/contact", label: "Contact" },
  { to: "/faq", label: "FAQ" },
];

export default function PublicNav() {
  const { isAuthed } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const brand = loadBranding();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-primary/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[80rem] items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2.5 text-primary-foreground">
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.appName || "Logo"} className="h-9 w-auto max-w-[8rem] rounded-lg object-contain" />
            : <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent font-display text-sm font-extrabold text-accent-foreground">TN</span>}
          <span className="leading-tight">
            <span className="block font-display text-sm font-bold">{brand.appName || "Techiman North"}</span>
            <span className="block text-[11px] text-primary-foreground/70">{brand.tagline || "Land Registry System"}</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 text-sm text-primary-foreground/80 md:flex">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.exact}
              className={({ isActive }) =>
                cn("transition hover:text-white", isActive ? "text-white font-semibold" : "")
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="text-primary-foreground hover:bg-white/10 hover:text-white">
            <Link to="/auth">Staff Login</Link>
          </Button>
          {isAuthed && (
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/app">Dashboard</Link>
            </Button>
          )}
          <button
            className="text-primary-foreground md:hidden ml-1"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-primary/98 px-5 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-3">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.exact}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn("rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    isActive ? "bg-white/15 text-white" : "text-primary-foreground/80 hover:bg-white/10 hover:text-white")
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
