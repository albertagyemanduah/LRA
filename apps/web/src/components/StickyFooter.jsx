import React from "react";
import { loadBranding } from "@/lib/branding";

/**
 * Minimal sticky footer — copyright + developer credit only.
 * Fixed at the bottom of the viewport across all pages.
 */
export default function StickyFooter() {
  const brand = loadBranding();
  const year = new Date().getFullYear();
  const appName = brand.appName || "Techiman North Land Registry";

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-50 w-full border-t border-border/60 bg-sidebar text-sidebar-foreground"
      style={{ minHeight: "var(--sticky-footer-h, 38px)" }}
    >
      <div className="mx-auto flex max-w-[90rem] flex-col items-center justify-between gap-0.5 px-4 py-2 text-center sm:flex-row sm:text-left">
        <p className="text-[11px] text-sidebar-foreground/70">
          &copy; {year}{" "}
          <span className="font-semibold text-sidebar-foreground">{appName}</span>
          . All rights reserved. · Techiman North District Assembly, Ghana.
        </p>
        <p className="text-[11px] text-sidebar-foreground/70">
          Developed &amp; Managed by{" "}
          <span className="font-semibold text-sidebar-primary">Albert Fordjour Antwi</span>
          {" "}· Head, MIS Unit — TeNDA
        </p>
      </div>
    </footer>
  );
}

/** Height in px consumed by the sticky footer — use for bottom padding on page content. */
export const STICKY_FOOTER_HEIGHT = 42;
