import React, { useState } from "react";
import { ShieldAlert, CheckCircle2, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkDuplicates } from "@/lib/duplicateCheck";
import { cn } from "@/lib/utils";

/**
 * Reusable duplicate checker for any form.
 * Props: type ("parcel"|"transfer"|"contact"|"user"), getData() -> object,
 * label (button text), onResult(result) optional.
 */
export default function DuplicateCheck({ type, getData, label = "Check for duplicates", onResult, className }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = typeof getData === "function" ? getData() : getData || {};
      const res = await checkDuplicates(type, data);
      setResult(res);
      if (onResult) onResult(res);
    } finally {
      setLoading(false);
    }
  };

  const describe = (r) =>
    r.parcelNumber || r.toOwnerName || r.email || r.fullName || r.applicantName || r.id;

  return (
    <div className={cn("space-y-2", className)}>
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
        {loading ? "Checking…" : label}
      </Button>
      {result && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            result.duplicate
              ? "border-orange-300 bg-orange-50 text-orange-900 dark:bg-orange-900/20 dark:text-orange-200"
              : "border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
          )}
        >
          <p className="flex items-center gap-1.5 font-semibold">
            {result.duplicate ? <ShieldAlert className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {result.duplicate
              ? `${result.records.length} possible duplicate${result.records.length > 1 ? "s" : ""} found`
              : "No duplicates found"}
          </p>
          {result.label && <p className="mt-0.5 opacity-80">Checked: {result.label}</p>}
          {result.duplicate && (
            <ul className="mt-1 space-y-0.5">
              {result.records.slice(0, 5).map((r) => (
                <li key={r.id} className="truncate">• {describe(r)}</li>
              ))}
              {result.records.length > 5 && <li>… and {result.records.length - 5} more</li>}
            </ul>
          )}
          {result.duplicate && <p className="mt-1 opacity-80">You may still continue if this is intentional.</p>}
        </div>
      )}
    </div>
  );
}
