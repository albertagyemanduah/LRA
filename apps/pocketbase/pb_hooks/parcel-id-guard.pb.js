/// <reference path="../pb_data/types.d.ts" />

// Parcel ID guard — only District Administrators (or platform superusers) may
// change a parcel's parcelNumber (Land ID) on update. Non-admins can still
// update every other field; the ID itself is locked. Registration (create) is
// unaffected. Multi-role admins store "admin" inside the JSON `roles` field
// and/or have the `role` select field set to "admin".
//
// The JSVM (goja) may expose `requestInfo` as either a property or a method
// depending on the PocketBase version, so we handle both. Goja does not
// reliably serialize Go-backed JSON arrays via JSON.stringify on the raw
// get() value, so we use marshalJSON() to get the record's JSON string and
// parse the roles field from there.
onRecordUpdateRequest((e) => {
  // ── Resolve the RequestInfo (handle property vs method) ──────────────
  let info = null;
  try {
    const ri = e.requestInfo;
    if (ri && typeof ri === "object") {
      info = ri;
    } else if (typeof ri === "function") {
      info = ri.call(e);
    }
  } catch (_) {}

  // ── Superuser check (event-level and info-level) ──────────────────────
  let isSuperuser = false;
  try {
    if (typeof e.hasSuperuserAuth === "function" && e.hasSuperuserAuth()) {
      isSuperuser = true;
    }
  } catch (_) {}
  if (!isSuperuser && info) {
    try {
      if (typeof info.hasSuperuserAuth === "function" && info.hasSuperuserAuth()) {
        isSuperuser = true;
      }
    } catch (_) {}
  }

  // ── Get the authenticated record ──────────────────────────────────────
  let auth = null;
  if (info) {
    try { auth = info.auth || null; } catch (_) {}
  }

  // ── Admin detection ───────────────────────────────────────────────────
  // Check a record for admin role using multiple strategies. The `roles`
  // field is JSON; goja wraps it as a Go-backed value that JSON.stringify
  // may not handle, so we use marshalJSON() to get a reliable JSON string.
  const checkRecordAdmin = (record) => {
    if (!record) return false;

    // 1) Primary role select field — reliable via getString
    try {
      if (record.getString("role") === "admin") return true;
    } catch (_) {}

    // 2) getStringSlice — works for select and some JSON array fields
    try {
      const arr = record.getStringSlice("roles");
      if (arr && arr.length) {
        for (let i = 0; i < arr.length; i++) {
          if (String(arr[i]) === "admin") return true;
        }
      }
    } catch (_) {}

    // 3) marshalJSON — serialise the whole record to JSON and parse roles.
    //    This bypasses goja's Go-backed value wrapping entirely.
    try {
      const raw = record.marshalJSON();
      const s = typeof raw === "string" ? raw : String.fromCharCode.apply(null, raw);
      const parsed = JSON.parse(s);
      if (parsed && parsed.roles) {
        const rs = JSON.stringify(parsed.roles);
        if (rs && rs.indexOf("admin") >= 0) return true;
      }
    } catch (_) {}

    // 4) Fallback: iterate the raw get value if it looks array-like
    try {
      const v = record.get("roles");
      if (v && typeof v.length === "number") {
        for (let i = 0; i < v.length; i++) {
          try { if (String(v[i]) === "admin") return true; } catch (_) {}
        }
      }
    } catch (_) {}

    return false;
  };

  let isAdmin = isSuperuser;

  if (!isAdmin) {
    isAdmin = checkRecordAdmin(auth);
  }

  // 5) Authoritative fallback: re-fetch the user from the database
  if (!isAdmin && auth && auth.id) {
    try {
      const user = $app.findRecordById("users", auth.id);
      isAdmin = checkRecordAdmin(user);
    } catch (_) {}
  }

  // ── Enforce: block non-admin parcelNumber changes ─────────────────────
  if (!isAdmin) {
    let oldId = "";
    try {
      oldId = e.record.original().getString("parcelNumber");
    } catch (_) {
      try {
        const existing = $app.findRecordById("parcels", e.record.id);
        oldId = existing.getString("parcelNumber");
      } catch (_) {
        oldId = "";
      }
    }
    const newId = e.record.getString("parcelNumber");
    if (oldId && newId && oldId !== newId) {
      throw new ForbiddenError(
        "Only District Administrators may change a parcel Land ID.",
      );
    }
  }

  e.next();
}, "parcels");
