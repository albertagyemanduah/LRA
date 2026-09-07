import { useState, useEffect, useCallback, useRef } from "react";
import pb from "@/lib/pocketbaseClient";

export function useCollection(name, options = {}) {
  const { filter = "", sort = "-created", expand = "", deps = [], enabled = true, realtime = false } = options;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const subscribedRef = useRef(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await pb.collection(name).getFullList({
        filter, sort, expand, requestKey: `load-${name}-${Date.now()}`,
      });
      setRecords(list);
      setError(null);
    } catch (err) {
      if (err?.isAbort) return;
      setError(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, filter, sort, expand, enabled]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  // Real-time subscription
  useEffect(() => {
    if (!realtime || !enabled) return;

    subscribedRef.current = true;

    void pb.collection(name).subscribe("*", (e) => {
      if (!subscribedRef.current) return;
      if (e.action === "create") {
        setRecords((prev) => {
          if (prev.find((r) => r.id === e.record.id)) return prev;
          return [e.record, ...prev];
        });
      } else if (e.action === "update") {
        setRecords((prev) =>
          prev.map((r) => (r.id === e.record.id ? { ...r, ...e.record } : r))
        );
      } else if (e.action === "delete") {
        setRecords((prev) => prev.filter((r) => r.id !== e.record.id));
      }
    }).catch((err) => {
      console.error(`Realtime subscription failed for ${name}`, err);
    });

    return () => {
      subscribedRef.current = false;
      void pb.collection(name).unsubscribe("*").catch(() => {});
    };
  }, [name, realtime, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { records, loading, error, reload: load, setRecords };
}

export async function notify(userId, message, link = "") {
  try {
    await pb.collection("notifications").create({ user: userId, message, link, read: false });
  } catch (_) {}
}
