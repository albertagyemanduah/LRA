import React, { useEffect } from "react";
import { CheckCircle2, X, Download, Printer, Undo2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * SuccessDialog — reusable success feedback overlay.
 *
 * Props:
 *  open          boolean
 *  onClose       () => void
 *  title         string
 *  message       string
 *  detail        string (optional, extra line)
 *  count         number (optional, "X records affected")
 *  autoClose     boolean (default false — stays open until user closes)
 *  onUndo        () => void (optional — shows Undo button)
 *  onDownload    () => void (optional — shows Download button)
 *  onPrint       () => void (optional — shows Print button)
 */
export default function SuccessDialog({
  open,
  onClose,
  title = "Success",
  message = "Your changes have been saved.",
  detail,
  count,
  autoClose = false,
  onUndo,
  onDownload,
  onPrint,
}) {
  useEffect(() => {
    if (!open || !autoClose) return;
    const t = setTimeout(() => onClose?.(), 5000);
    return () => clearTimeout(t);
  }, [open, autoClose, onClose]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-0 shadow-2xl">
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-blue-400" />

        <div className="p-6 text-center space-y-4">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 ring-8 ring-blue-100 dark:ring-blue-900/30">
            <CheckCircle2 className="h-9 w-9 text-blue-500" strokeWidth={1.5} />
          </div>

          {/* Text */}
          <div className="space-y-1">
            <h2 className="text-lg font-display font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
            {count !== undefined && (
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mt-1">
                {count} record{count !== 1 ? "s" : ""} affected
              </p>
            )}
          </div>

          {/* Timestamp */}
          <p className="text-[11px] text-muted-foreground/60">{new Date().toLocaleString()}</p>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {onUndo && (
              <Button size="sm" variant="outline" onClick={() => { onUndo(); onClose?.(); }} className="gap-1.5">
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
            )}
            {onDownload && (
              <Button size="sm" variant="outline" onClick={onDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            )}
            {onPrint && (
              <Button size="sm" variant="outline" onClick={onPrint} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            )}
            <Button size="sm" onClick={onClose} className="gap-1.5 bg-blue-500 hover:bg-blue-700 text-white">
              <X className="h-3.5 w-3.5" /> Close
            </Button>
          </div>


        </div>
      </DialogContent>
    </Dialog>
  );
}
