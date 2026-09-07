/// <reference path="../pb_data/types.d.ts" />

// Fix approval update rules to support multi-role users.
// The original rules only checked @request.auth.role (primary role in JWT),
// but multi-role users store additional roles in the `roles` JSON array.
// Adding ~ checks on @request.auth.roles covers users who have "admin" or
// "planning_officer" in their roles JSON array even if their primary role differs.

migrate(
  (app) => {
    // Fix land_edit_requests updateRule
    const editReq = app.findCollectionByNameOrId("land_edit_requests");
    editReq.updateRule = "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'planning_officer' || @request.auth.roles ~ '\"admin\"' || @request.auth.roles ~ '\"planning_officer\"')";
    app.save(editReq);

    // Fix land_transfers updateRule
    const transfers = app.findCollectionByNameOrId("land_transfers");
    transfers.updateRule = "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'planning_officer' || @request.auth.roles ~ '\"admin\"' || @request.auth.roles ~ '\"planning_officer\"')";
    app.save(transfers);
  },
  (app) => {
    // Revert to original rules
    const editReq = app.findCollectionByNameOrId("land_edit_requests");
    editReq.updateRule = "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'planning_officer')";
    app.save(editReq);

    const transfers = app.findCollectionByNameOrId("land_transfers");
    transfers.updateRule = "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'planning_officer')";
    app.save(transfers);
  },
);
