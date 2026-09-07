import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, ArrowRight, Newspaper, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/lib/pocketbaseClient";

const STORAGE_KEY = "seen_news_flash";
const AUTO_HIDE_MS = 12000;

function getSeenIds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

function markSeen(id) {
  const seen = getSeenIds();
  if (!seen.includes(id)) {
    const updated = [id, ...seen].slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
}

export default function NewsFlash() {
  const [flash, setFlash] = useState(null);
  const [visible, setVisible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await pb.collection("news_posts").getList(1, 1, {
          filter: 'status="published"',
          sort: "-created",
          requestKey: "news-flash",
        });
        if (result.items.length === 0) return;
        const latest = result.items[0];
        const seen = getSeenIds();
        if (seen.includes(latest.id)) return;
        setFlash(latest);
        setVisible(true);

        // Auto-hide
        const timer = setTimeout(() => {
          setVisible(false);
        }, AUTO_HIDE_MS);
        return () => clearTimeout(timer);
      } catch (_) {}
    };
    // Small delay so page loads first
    const t = setTimeout(load, 2000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    if (flash) markSeen(flash.id);
    setVisible(false);
  };

  const basePath = flash?.type === "article" ? "articles" : "news";

  return (
    <AnimatePresence>
      {visible && flash && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[200] flex items-center gap-3 bg-primary px-4 py-3 text-white shadow-lg"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Newspaper className="h-4 w-4 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm mr-2">
              {flash.type === "article" ? "New Article:" : "Breaking News:"}
            </span>
            <span className="text-sm text-white/90 line-clamp-1">{flash.title}</span>
          </div>
          <Link
            to={`/${basePath}/${flash.id}`}
            onClick={dismiss}
            className="hidden sm:flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white whitespace-nowrap"
          >
            Read more <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className="text-white/60 hover:text-white transition"
            title={soundEnabled ? "Mute" : "Sound on"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button onClick={dismiss} className="text-white/70 hover:text-white transition">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
