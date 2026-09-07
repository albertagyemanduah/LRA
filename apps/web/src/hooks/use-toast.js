// Sonner-based toast shim — preserves the useToast/toast API used throughout the app
import { toast as sonnerToast } from "sonner";

function toast({ title, description, variant, ...rest }) {
  const msg = title || "";
  const opts = { ...(description ? { description } : {}), ...rest };
  if (variant === "destructive") return sonnerToast.error(msg, opts);
  if (variant === "success") return sonnerToast.success(msg, opts);
  return sonnerToast(msg, opts);
}

function useToast() {
  return {
    toast,
    toasts: [],
    dismiss: (id) => sonnerToast.dismiss(id),
  };
}

export { useToast, toast };
