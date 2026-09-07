import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={8000}
      toastOptions={{
        style: { fontFamily: "DM Sans, sans-serif" },
      }}
    />
  );
}
