import { useEffect, useState, useCallback } from "react";

const KEY = "tnda-theme"; // "light" | "dark" | "system"

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(pref) {
  const isDark = pref === "dark" || (pref === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

export function initTheme() {
  let pref = "light";
  try { pref = localStorage.getItem(KEY) || "light"; } catch (_) {}
  applyTheme(pref);
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(KEY) || "light"; } catch (_) { return "light"; }
  });

  const change = useCallback((pref) => {
    setTheme(pref);
    try { localStorage.setItem(KEY, pref); } catch (_) {}
    applyTheme(pref);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return { theme, setTheme: change };
}
