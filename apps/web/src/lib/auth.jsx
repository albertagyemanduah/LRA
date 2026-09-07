import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import pb from "@/lib/pocketbaseClient";

const AuthContext = createContext(null);

// Get effective roles array from a user record
function getRoles(u) {
  if (!u) return [];
  const rolesArr = u.roles;
  if (Array.isArray(rolesArr) && rolesArr.length > 0) return rolesArr;
  if (u.role) return [u.role];
  return [];
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(pb.authStore.record);
  const [ready, setReady] = useState(true);

  // Active role state — persisted in localStorage
  const [activeRole, setActiveRole] = useState(() => {
    const stored = localStorage.getItem("tnda-active-role");
    const u = pb.authStore.record;
    if (!u) return null;
    const roles = getRoles(u);
    if (stored && roles.includes(stored)) return stored;
    return roles[0] || u.role || null;
  });

  useEffect(() => {
    const unsub = pb.authStore.onChange((_t, record) => {
      setUser(record);
      if (record) {
        const roles = getRoles(record);
        // Ensure activeRole is still valid for the (possibly refreshed) record
        setActiveRole((prev) => {
          if (prev && roles.includes(prev)) return prev;
          const stored = localStorage.getItem("tnda-active-role");
          if (stored && roles.includes(stored)) return stored;
          return roles[0] || record.role || null;
        });
      } else {
        setActiveRole(null);
        localStorage.removeItem("tnda-active-role");
      }
    });
    return () => unsub();
  }, []);

  const log = useCallback(async (action, entity, details) => {
    try {
      await pb.collection("audit_logs").create({
        actor: pb.authStore.record?.id,
        action,
        entity: entity || "",
        details: details || "",
      });
    } catch (_) {}
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await pb.collection("users").authWithPassword(email, password);
    // Set initial active role on login
    if (res?.record) {
      const roles = getRoles(res.record);
      const stored = localStorage.getItem("tnda-active-role");
      const initial = (stored && roles.includes(stored)) ? stored : (roles[0] || res.record.role || null);
      setActiveRole(initial);
      if (initial) localStorage.setItem("tnda-active-role", initial);
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
    setActiveRole(null);
    localStorage.removeItem("tnda-active-role");
  }, []);

  const switchRole = useCallback(async (newRole) => {
    const roles = getRoles(pb.authStore.record);
    if (!roles.includes(newRole)) return;
    setActiveRole(newRole);
    localStorage.setItem("tnda-active-role", newRole);
    try {
      await pb.collection("audit_logs").create({
        actor: pb.authStore.record?.id,
        action: "role_switched",
        entity: "users",
        details: `Switched active role to: ${newRole}`,
      });
    } catch (_) {}
  }, []);

  const roles = getRoles(user);
  const effectiveRole = (activeRole && roles.includes(activeRole)) ? activeRole : (roles[0] || user?.role || "admin");

  const value = {
    user,
    role: effectiveRole,
    activeRole: effectiveRole,
    roles,
    isAuthed: pb.authStore.isValid,
    ready,
    login,
    logout,
    log,
    switchRole,
    refresh: async () => {
      if (pb.authStore.isValid) {
        try {
          const rec = await pb.collection("users").getOne(pb.authStore.record.id);
          setUser(rec);
        } catch (_) {}
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
