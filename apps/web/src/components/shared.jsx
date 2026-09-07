import React from "react";
import { cn } from "@/lib/utils";
import { STATUS_STYLES, titleCase } from "@/lib/format";

export function StatusBadge({ status, className }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        STATUS_STYLES[status] || "bg-muted text-muted-foreground",
        className,
      )}
    >
      {titleCase(status)}
    </span>
  );
}

export function PageHeader({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
        ) : null}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, accent = "primary" }) {
  const accents = {
    primary: "text-primary bg-primary/10",
    gold: "text-blue-600 bg-blue-100",
    amber: "text-blue-800 bg-blue-100",
    blue: "text-blue-600 bg-blue-100",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accents[accent])}>
            <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      {Icon ? (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-7 w-7" strokeWidth={1.6} />
        </span>
      ) : null}
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      {message ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <div className={cn("flex items-center justify-center py-16", className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
    </div>
  );
}

export function SectionCard({ title, description, children, action, className }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-sm", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            {title ? <h2 className="font-display text-base font-semibold text-foreground">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
