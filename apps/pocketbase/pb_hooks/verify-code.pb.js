/// <reference path="../pb_data/types.d.ts" />

// Public endpoint used by /verify-land to validate a verification code
// without exposing the verification_codes collection to anonymous listing.
routerAdd("POST", "/api/verify-code", (e) => {
  const body = new DynamicModel({ code: "" });
  e.bindBody(body);

  const raw = String(body.code || "").trim().toUpperCase();

  const log = (status, reason, communityRef) => {
    try {
      const col = $app.findCollectionByNameOrId("verification_logs");
      const rec = new Record(col);
      rec.set("code", raw);
      rec.set("status", status);
      rec.set("reason", reason || "");
      rec.set("communityRef", communityRef || "");
      rec.set("resultsCount", 0);
      $app.save(rec);
    } catch (_) {}
  };

  if (!/^[A-Z0-9]{10}$/.test(raw)) {
    log("failure", "Invalid format", "");
    return e.json(400, { valid: false, error: "Verification codes are exactly 10 letters or numbers (e.g. A1B2C3D4E5)." });
  }

  let rec = null;
  try {
    rec = $app.findFirstRecordByFilter("verification_codes", "code = {:c}", { c: raw });
  } catch (_) {
    rec = null;
  }

  if (!rec) {
    log("failure", "Code not found", "");
    return e.json(404, { valid: false, error: "Invalid verification code. Please check and try again." });
  }

  const now = new Date();
  if (!rec.getBool("isActive")) {
    log("failure", "Inactive", rec.getString("communityRef"));
    return e.json(403, { valid: false, error: "This verification code is inactive." });
  }

  const exp = rec.getString("expiresAt");
  if (exp && new Date(exp) < now) {
    log("failure", "Expired", rec.getString("communityRef"));
    return e.json(403, { valid: false, error: "This verification code has expired." });
  }

  const maxUsage = rec.getInt("maxUsage");
  const usageCount = rec.getInt("usageCount");
  if (maxUsage > 0 && usageCount >= maxUsage) {
    log("failure", "Max usage reached", rec.getString("communityRef"));
    return e.json(403, { valid: false, error: "This code has reached its maximum usage limit." });
  }

  try {
    rec.set("usageCount", usageCount + 1);
    rec.set("lastUsedAt", new Date().toISOString());
    $app.save(rec);
  } catch (_) {}

  log("success", "Validated", rec.getString("communityRef"));

  return e.json(200, {
    valid: true,
    code: {
      id: rec.id,
      code: rec.getString("code"),
      codeType: rec.getString("codeType") || "community",
      officeRef: rec.getString("officeRef"),
      areaCouncilRef: rec.getString("areaCouncilRef"),
      communityRef: rec.getString("communityRef"),
      description: rec.getString("description"),
      maxUsage: maxUsage,
      usageCount: usageCount + 1,
      expiresAt: exp,
    },
  });
});
