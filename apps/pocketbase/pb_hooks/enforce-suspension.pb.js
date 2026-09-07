/// <reference path="../pb_data/types.d.ts" />

// Block suspended users from authenticating
onRecordAuthRequest((e) => {
  const record = e.record;
  if (record && record.get("suspended") === true) {
    const reason = record.get("suspendedReason") || "Account suspended by administrator.";
    throw new ForbiddenError(`Account suspended: ${reason}`);
  }
  e.next();
}, "users");
