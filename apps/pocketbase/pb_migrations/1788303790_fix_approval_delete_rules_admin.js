/// <reference path="../pb_data/types.d.ts" />

// Strengthen delete rules on approval-bearing collections so that only
// admins can permanently delete records, including multi-role admins whose
// "admin" role lives in the `roles` JSON array rather than the primary role.
// This enforces server-side the "only Admin may permanently delete rejected
// approvals" requirement — the UI hides the action for non-admins, but the
// rule is the real gatekeeper.

migrate(
  (app) => {
    const editReq = app.findCollectionByNameOrId("land_edit_requests");
    editReq.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.roles ~ '\"admin\"')";
    app.save(editReq);

    const transfers = app.findCollectionByNameOrId("land_transfers");
    transfers.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.roles ~ '\"admin\"')";
    app.save(transfers);
  },
  (app) => {
    // Revert to original admin-only delete rules (primary role only)
    const editReq = app.findCollectionByNameOrId("land_edit_requests");
    editReq.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'";
    app.save(editReq);

    const transfers = app.findCollectionByNameOrId("land_transfers");
    transfers.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'";
    app.save(transfers);
  },
);
