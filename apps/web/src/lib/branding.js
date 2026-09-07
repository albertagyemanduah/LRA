// Application branding & customisation, persisted in localStorage.
// Managed by the District Assembly Administrator via Admin > Customisation.

export const DEFAULT_BRANDING = {
  appName: "Techiman North",
  tagline: "Land Registry System",
  primaryColor: "210 55% 22%",
  accentColor: "210 60% 38%",
  logoUrl: "/assembly-logo.png",
  faviconUrl: "/assembly-logo.png",
  pwaIcons: null, // { favicon32: dataUrl, apple180: dataUrl, android192: dataUrl, android512: dataUrl }
  footerText: "The official digital land administration platform for the Techiman North District Assembly, Bono East Region, Ghana.",
  contactPhone: "+233 XX XXX XXXX",
  contactEmail: "info@tenda.gov.gh",
  contactAddress: "Techiman North District Assembly, Tuobodom, Bono East Region",
  aboutText: "The Techiman North District Land Registry System is the official digital platform for managing all land administration activities within the district.",
  facebook: "",
  twitter: "",
  linkedin: "",
  termsText: "",
  privacyText: "",
  emailTemplate: "Dear {name}, this is a notification from the Techiman North Land Registry System regarding {subject}.",
  smsTemplate: "TeNDA PPD: {message}",
};

const KEY = "tnda-branding";

// Legacy primary colors that should be auto-reset to current navy palette
const LEGACY_PRIMARIES = ["158 64% 20%", "152 52% 45%", "28 82% 38%", "32 72% 52%"];

export function loadBranding() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null");
    if (stored && LEGACY_PRIMARIES.includes(stored.primaryColor)) {
      // Reset legacy green to new warm navy
      stored.primaryColor = DEFAULT_BRANDING.primaryColor;
      stored.accentColor = DEFAULT_BRANDING.accentColor;
      localStorage.setItem(KEY, JSON.stringify(stored));
    }
    const merged = { ...DEFAULT_BRANDING, ...(stored || {}) };
    // Always fall back to Assembly Logo if no logo has been explicitly uploaded
    if (!merged.logoUrl) merged.logoUrl = DEFAULT_BRANDING.logoUrl;
    if (!merged.faviconUrl) merged.faviconUrl = DEFAULT_BRANDING.faviconUrl;
    return merged;
  } catch (_) {
    return { ...DEFAULT_BRANDING };
  }
}

export function saveBranding(branding) {
  localStorage.setItem(KEY, JSON.stringify(branding));
  applyBranding(branding);
}

export function resetBranding() {
  localStorage.removeItem(KEY);
  applyBranding(DEFAULT_BRANDING);
}

/**
 * Resize an image data URL to a square canvas at the given size.
 * Returns a new data URL (image/png).
 */
export function resizeImageToDataUrl(srcDataUrl, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      // White background (for logos with transparency)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      // Draw image centred and cover
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = srcDataUrl;
  });
}

/**
 * Generate all PWA icon variants from a source image data URL.
 * Returns an object with keys: favicon32, apple180, android192, android512, tile144
 */
export async function generatePWAIcons(srcDataUrl) {
  const [favicon32, apple180, android192, android512, tile144] = await Promise.all([
    resizeImageToDataUrl(srcDataUrl, 32),
    resizeImageToDataUrl(srcDataUrl, 180),
    resizeImageToDataUrl(srcDataUrl, 192),
    resizeImageToDataUrl(srcDataUrl, 512),
    resizeImageToDataUrl(srcDataUrl, 144),
  ]);
  return { favicon32, apple180, android192, android512, tile144 };
}

function setLinkTag(rel, href, sizes) {
  let el = document.querySelector(`link[rel='${rel}']${sizes ? `[sizes='${sizes}']` : ""}`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (sizes) el.sizes = sizes;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function applyBranding(branding) {
  const b = branding || loadBranding();
  const root = document.documentElement;
  if (b.primaryColor) root.style.setProperty("--primary", b.primaryColor);
  if (b.accentColor) {
    root.style.setProperty("--accent", b.accentColor);
    root.style.setProperty("--gold", b.accentColor);
  }

  // Favicon — prefer generated 32px icon, then uploaded faviconUrl, then logoUrl
  const faviconSrc = b.pwaIcons?.favicon32 || b.faviconUrl || b.logoUrl;
  if (faviconSrc) {
    setLinkTag("icon", faviconSrc);
    setLinkTag("shortcut icon", faviconSrc);
  }

  // Apple touch icon (iOS home screen)
  if (b.pwaIcons?.apple180) {
    setLinkTag("apple-touch-icon", b.pwaIcons.apple180, "180x180");
  } else if (b.logoUrl) {
    setLinkTag("apple-touch-icon", b.logoUrl);
  }

  // Dynamic PWA manifest injection (if icons are available)
  if (b.pwaIcons?.android192 || b.pwaIcons?.android512) {
    try {
      const icons = [];
      if (b.pwaIcons.android192) {
        icons.push({ src: b.pwaIcons.android192, sizes: "192x192", type: "image/png", purpose: "any" });
        icons.push({ src: b.pwaIcons.android192, sizes: "192x192", type: "image/png", purpose: "maskable" });
      }
      if (b.pwaIcons.android512) {
        icons.push({ src: b.pwaIcons.android512, sizes: "512x512", type: "image/png", purpose: "any" });
        icons.push({ src: b.pwaIcons.android512, sizes: "512x512", type: "image/png", purpose: "maskable" });
      }
      const manifest = {
        name: b.appName || "Techiman North Land Registry",
        short_name: b.appName || "Land Registry",
        description: "Land registration and management system",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#7c3410",
        background_color: "#7c3410",
        lang: "en",
        icons,
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      let manifestLink = document.querySelector("link[rel='manifest']");
      if (!manifestLink) {
        manifestLink = document.createElement("link");
        manifestLink.rel = "manifest";
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = url;
    } catch (_) {}
  }

  // Document title
  if (b.appName) document.title = `${b.appName} — ${b.tagline || "Land Registry"}`;
}
